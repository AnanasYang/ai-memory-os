# Qwen3-VL-Embedding 投影头训练 - 使用指南

## 📁 文件说明

```
workspace/
├── docs/
│   └── qwen3vl_embedding_training_guide.md    # 详细技术文档
├── scripts/
│   ├── train_qwen3vl_projection.py            # 主训练脚本
│   ├── annotation_tool.py                     # 数据标注工具
│   └── hard_negative_mining.py                # 难负样本挖掘工具
└── data/                                      # 数据目录（需创建）
```

---

## 🚀 快速开始

### 步骤1: 准备数据

#### 1.1 生成标注模板
```bash
cd ~/.openclaw/workspace

python scripts/train_qwen3vl_projection.py --prepare_template
```
这会生成 `annotation_template.jsonl`，你可以参考这个格式创建自己的标注文件。

#### 1.2 使用标注工具（推荐）
```bash
# 空间类标注
python scripts/annotation_tool.py \
    --image_dir ./data/images \
    --output ./data/annotations_spatial.jsonl \
    --instruction_type spatial

# 环境类标注
python scripts/annotation_tool.py \
    --image_dir ./data/images \
    --output ./data/annotations_environment.jsonl \
    --instruction_type environment
```

标注工具特点：
- 可视化界面，快捷键操作（Space正样本，N负样本，Enter保存）
- 内置4类指令模板
- 支持自定义查询

#### 1.3 合并标注文件
```bash
# 将所有标注合并到一个文件
cat ./data/annotations_*.jsonl > ./data/annotations.jsonl

# 划分训练集和验证集（80/20）
shuf ./data/annotations.jsonl | split -l $(( $(wc -l < ./data/annotations.jsonl) * 8 / 10 ))
mv xaa ./data/train.jsonl
mv xab ./data/val.jsonl
```

---

### 步骤2: 训练模型

#### 2.1 基础训练
```bash
python scripts/train_qwen3vl_projection.py \
    --data_path ./data/train.jsonl \
    --val_data_path ./data/val.jsonl \
    --output_dir ./output \
    --batch_size 32 \
    --num_epochs 10 \
    --learning_rate 1e-4 \
    --architecture with_type_embedding
```

#### 2.2 小显存训练（梯度累积）
```bash
python scripts/train_qwen3vl_projection.py \
    --data_path ./data/train.jsonl \
    --val_data_path ./data/val.jsonl \
    --output_dir ./output \
    --batch_size 8 \
    --gradient_accumulation_steps 4 \
    --num_epochs 10 \
    --learning_rate 1e-4
```

#### 2.3 关键参数说明

| 参数 | 推荐值 | 说明 |
|-----|-------|------|
| `--batch_size` | 32 | 越大越好，in-batch negatives更多 |
| `--architecture` | with_type_embedding | simple/with_type_embedding/instruction_conditioned |
| `--learning_rate` | 1e-4 | 投影头可稍大 |
| `--projection_dim` | 1024 | 输出embedding维度 |
| `--temperature` | 0.07 | 对比学习温度系数 |

---

### 步骤3: 挖掘难负样本（迭代优化）

训练一轮后，使用当前模型挖掘难负样本：

```bash
python scripts/hard_negative_mining.py \
    --annotation_file ./data/train.jsonl \
    --model_path ./output/best_model.pt \
    --base_model Qwen/Qwen3-VL-Embedding-8B \
    --top_k 5 \
    --output ./data/train_with_hard_negatives.jsonl
```

然后用包含难负样本的数据重新训练：

```bash
python scripts/train_qwen3vl_projection.py \
    --data_path ./data/train_with_hard_negatives.jsonl \
    --val_data_path ./data/val.jsonl \
    --output_dir ./output_v2 \
    --batch_size 32 \
    --num_epochs 5 \
    --learning_rate 5e-5
```

---

## 📊 评估与使用

### 训练日志解读
```
Epoch 1/10: 100%|█████| 50/50 [02:15<00:00, 2.70s/it, loss=1.234]
Validation results at step 500:
  recall@1: 0.4523
  recall@5: 0.7234
  recall@10: 0.8456
New best model saved! recall@10: 0.8456
```

- **loss**: 应该逐渐下降，稳定在1.0-2.0之间
- **recall@10**: 目标>60%（初期），优化后>80%

### 使用训练好的模型

```python
import torch
from scripts.train_qwen3vl_projection import Qwen3VLEmbeddingModel, ProjectionHead
from transformers import AutoTokenizer, AutoProcessor

# 加载模型
checkpoint = torch.load('./output/best_model.pt')
projection_config = {
    'hidden_dim': 2048,
    'output_dim': 1024,
    'architecture': 'with_type_embedding',
    'num_instruction_types': 4
}

model = Qwen3VLEmbeddingModel(
    'Qwen/Qwen3-VL-Embedding-8B',
    projection_config,
    freeze_vision=True,
    freeze_text=True
)
model.projection_head.load_state_dict(checkpoint['projection_head'])
model = model.cuda().eval()

# 加载tokenizer和processor
tokenizer = AutoTokenizer.from_pretrained('Qwen/Qwen3-VL-Embedding-8B', trust_remote_code=True)
processor = AutoProcessor.from_pretrained('Qwen/Qwen3-VL-Embedding-8B', trust_remote_code=True)

# 编码查询
text_embed = model.encode_text(
    input_ids=tokenizer("[空间] 前方左侧cut-in", return_tensors='pt')['input_ids'].cuda(),
    attention_mask=tokenizer("[空间] 前方左侧cut-in", return_tensors='pt')['attention_mask'].cuda(),
    instruction_type=torch.tensor([0]).cuda()  # spatial=0
)

# 编码图片
from PIL import Image
image = Image.open('./test_image.jpg')
image_inputs = processor(images=image, return_tensors='pt')
image_embed = model.encode_image(
    pixel_values=image_inputs['pixel_values'].cuda(),
    instruction_type=torch.tensor([0]).cuda()
)

# 计算相似度
similarity = torch.cosine_similarity(text_embed, image_embed)
print(f"相似度: {similarity.item():.4f}")
```

---

## 🔧 常见问题

### Q: 训练loss不下降
- 检查正负样本是否正确配对
- 降低学习率到1e-5试试
- 确保embedding做了归一化（L2 norm）

### Q: 显存不足
```bash
# 使用梯度累积
--batch_size 8 --gradient_accumulation_steps 4

# 或使用混合精度训练（默认已开启）
```

### Q: 验证集Recall一直很低
- 增加难负样本比例
- 检查数据分布是否一致
- 尝试不同的architecture

### Q: 不同类型查询效果差异大
- 确保4类样本数量平衡
- 使用`with_type_embedding`架构
- 考虑不同类型独立训练投影头

---

## 📈 完整训练流程示例

```bash
# 1. 准备数据（假设已有1000张图片）
python scripts/annotation_tool.py --image_dir ./data/images --output ./data/ann_spatial.jsonl --instruction_type spatial
python scripts/annotation_tool.py --image_dir ./data/images --output ./data/ann_env.jsonl --instruction_type environment
python scripts/annotation_tool.py --image_dir ./data/images --output ./data/ann_temporal.jsonl --instruction_type temporal
python scripts/annotation_tool.py --image_dir ./data/images --output ./data/ann_object.jsonl --instruction_type object

# 2. 合并并划分
mkdir -p ./data/all
find ./data -name "ann_*.jsonl" -exec cat {} \; > ./data/all/annotations.jsonl
shuf ./data/all/annotations.jsonl | split -l $(( $(wc -l < ./data/all/annotations.jsonl) * 8 / 10 ))
mv xaa ./data/all/train.jsonl
mv xab ./data/all/val.jsonl

# 3. 第一轮训练
python scripts/train_qwen3vl_projection.py \
    --data_path ./data/all/train.jsonl \
    --val_data_path ./data/all/val.jsonl \
    --output_dir ./output/round1 \
    --batch_size 32 \
    --num_epochs 10

# 4. 挖掘难负样本
python scripts/hard_negative_mining.py \
    --annotation_file ./data/all/train.jsonl \
    --model_path ./output/round1/best_model.pt \
    --output ./data/all/train_hard.jsonl

# 5. 第二轮训练（使用难负样本）
python scripts/train_qwen3vl_projection.py \
    --data_path ./data/all/train_hard.jsonl \
    --val_data_path ./data/all/val.jsonl \
    --output_dir ./output/round2 \
    --batch_size 32 \
    --num_epochs 5 \
    --learning_rate 5e-5

# 6. 导出最终模型
cp ./output/round2/best_model.pt ./output/final_projection_head.pt
```

---

## 📚 相关文档

- 详细技术文档: `docs/qwen3vl_embedding_training_guide.md`
- Qwen3-VL官方文档: https://huggingface.co/Qwen
- 对比学习理论: See papers/SigLIP, CLIP

---

如有问题，随时讨论！
