# Qwen3-VL-Embedding 投影头训练技术指南

## 1. 背景与目标

### 1.1 项目背景
- **基座模型**: Qwen3-VL-Embedding-8B
- **训练目标**: 冻结视觉-语言编码器，仅训练投影头(Projection Head)
- **应用场景**: 自动驾驶场景的多维度语义检索（空间/时间/环境/目标物）

### 1.2 核心挑战
- 如何将无标注图片转化为可训练的对比学习样本
- 如何设计Instruction-aware的Embedding空间
- 如何针对自动驾驶场景优化检索效果

---

## 2. 技术原理

### 2.1 对比学习基础

**核心思想**: 让匹配的(查询, 图片)对在Embedding空间中距离更近，不匹配的更远。

**数学形式**:
```
L = -log[ exp(sim(q, p)/τ) / Σ exp(sim(q, n)/τ) ]

其中:
- q: 查询文本Embedding
- p: 正样本图片Embedding  
- n: 负样本图片Embedding
- τ: 温度系数(通常0.05-0.1)
- sim(): 余弦相似度
```

### 2.2 投影头的作用

基座模型输出的特征维度高(3584维)且针对通用任务优化，投影头的作用:
1. **降维**: 3584 → 1024/512，提高检索效率
2. **适配**: 将通用特征映射到特定任务空间
3. **对齐**: 平衡视觉和文本模态的差异

### 2.3 Instruction-Aware机制

针对你的4类查询设计:
```
[空间] 前方左侧车辆正在cut-in
[时间] 车辆正在加速变道
[环境] 雨天夜间高速公路
[目标物] 前方有行人和自行车
```

实现方式:
- **指令前缀编码**: 将指令类型作为token前缀输入
- **类型嵌入**: 学习4种类型的Embedding向量，加到输出上
- **多头投影**: 不同类型使用不同的投影头参数

---

## 3. 数据准备策略

### 3.1 数据格式

```json
{
  "query_id": "q001",
  "query_text": "[空间] 前方左侧车辆正在cut-in",
  "instruction_type": "spatial",
  "positive_images": ["img_0342.jpg", "img_0343.jpg"],
  "negative_images": ["img_0001.jpg", "img_0891.jpg"],
  "hard_negatives": ["img_0156.jpg"]  // 相似但不匹配
}
```

### 3.2 标注策略

| 维度 | 查询设计示例 | 正样本策略 | 负样本策略 |
|------|-------------|-----------|-----------|
| **空间** | 前方左侧cut-in / 右侧跟车 / 左变道 | 符合空间描述的帧 | 其他空间关系 |
| **时间** | 正在减速 / 保持匀速 / 加速 | 连续帧序列 | 不同时序状态 |
| **环境** | 晴天城市道路 / 雨天高速 | 符合环境条件 | 其他环境 |
| **目标物** | 有行人 / 有施工区域 / 无障碍 | 包含目标物 | 不包含 |

### 3.3 难负样本挖掘

**为什么重要**: 简单负样本(完全无关)太容易被区分，模型学不到精细特征。

**挖掘策略**:
1. **同类型不同内容**: 都是cut-in但不同场景
2. **相似但不匹配**: 雨天vs雪天，都是恶劣天气但不同
3. **模型迭代挖掘**: 用当前模型找最相似的负样本

---

## 4. 模型架构设计

### 4.1 整体结构

```
输入图片 → Qwen3-VL Vision Encoder (冻结) → 3584维特征
                                            ↓
输入文本 → Qwen3-VL Text Encoder (冻结) → 3584维特征
                                            ↓
                                   [投影头 Projection Head]
                                            ↓
                              1024维Instruction-aware Embedding
```

### 4.2 投影头设计

**方案1: 简单MLP** (推荐初期使用)
```python
ProjectionHead(
  Linear(3584 → 2048),
  ReLU(),
  Dropout(0.1),
  Linear(2048 → 1024)
)
```

**方案2: 指令条件投影**
```python
# 不同类型用不同的投影参数
if instruction_type == "spatial":
    use spatial_projection_head
elif instruction_type == "temporal":
    use temporal_projection_head
...
```

**方案3: 类型嵌入增强**
```python
# 学习4个类型嵌入向量
instruction_emb = type_embedding(instruction_type_id)  # [batch, 1024]
final_emb = projected_emb + instruction_emb
```

---

## 5. 训练策略

### 5.1 损失函数

**InfoNCE Loss** (最常用)
```python
logits = torch.matmul(q_emb, img_emb.T) / temperature
labels = torch.arange(batch_size)
loss = F.cross_entropy(logits, labels)
```

**Triplet Loss** (如果有明确难负样本)
```python
loss = max(0, margin - sim(q, p) + sim(q, n))
```

**Symmetric Loss** (推荐)
```python
# 双向对比: 图片→文本 + 文本→图片
loss = (loss_i2t + loss_t2i) / 2
```

### 5.2 超参数建议

| 参数 | 推荐值 | 说明 |
|------|-------|------|
| 学习率 | 1e-4 ~ 5e-4 | 投影头可稍大 |
| Batch Size | 32-64 | 越大in-batch负样本越多 |
| Temperature | 0.07 | CLIP/SigLIP常用值 |
| 训练轮数 | 5-10 | 观察验证集Recall@K |
| 优化器 | AdamW | weight_decay=0.01 |
| 学习率调度 | Cosine + Warmup | warmup_steps=10% |

### 5.3 训练技巧

**1. 梯度累积**: 小GPU可以累积梯度模拟大batch
```python
accumulation_steps = 4
if (step + 1) % accumulation_steps == 0:
    optimizer.step()
```

**2. 混合精度训练**: 节省显存，加速训练
```python
from torch.cuda.amp import autocast, GradScaler
scaler = GradScaler()
```

**3. 早停策略**: 监控验证集Recall@10
```python
if val_recall10 < best_recall10 * 0.95:  # 连续3轮下降则停止
    patience_counter += 1
```

---

## 6. 评估方案

### 6.1 核心指标

**Recall@K**: Top-K检索中是否包含正样本
```python
def compute_recall_at_k(model, test_data, k_values=[1, 5, 10]):
    for query, pos_img in test_queries:
        similarities = model.similarity(query, all_images)
        top_k_indices = similarities.topk(max(k_values)).indices
        for k in k_values:
            if pos_img_idx in top_k_indices[:k]:
                recall[k] += 1
    return {k: v/len(test_queries) for k, v in recall.items()}
```

**Mean Reciprocal Rank (MRR)**:
```
MRR = average(1/rank_of_first_positive)
```

### 6.2 分维度评估

分别计算4类instruction的Recall@10:
- 空间类查询召回率
- 时间类查询召回率
- 环境类查询召回率
- 目标物类查询召回率

**目标**: 初期Recall@10 >= 60%，优化后 >= 80%

---

## 7. 常见问题与解决方案

### Q1: 训练loss不下降
- 检查正负样本是否正确配对
- 降低学习率
- 检查embedding是否归一化

### Q2: 验证集Recall一直很低
- 增加难负样本比例
- 检查测试集和训练集分布是否一致
- 尝试不同类型的投影头

### Q3: 不同类型查询效果差异大
- 确保各类样本数量平衡
- 使用指令类型嵌入增强
- 考虑不同类型独立投影头

### Q4: 显存不足
- 使用梯度累积
- 降低batch size，增加accumulation steps
- 使用混合精度训练(fp16/bf16)

---

## 8. 参考资源

### 相关论文
1. CLIP: Learning Transferable Visual Models From Natural Language Supervision
2. SigLIP: Sigmoid Loss for Language Image Pre-Training
3. Qwen-VL: A Versatile Vision-Language Model

### 开源实现
- transformers库中的CLIP实现
- sentence-transformers多模态训练代码
- llama-factory多模态微调框架

---

## 9. 后续优化方向

1. **难负样本在线挖掘**: 每N轮用当前模型重新挖掘难负样本
2. **指令类型自适应**: 根据数据自动学习最优指令分类
3. **多尺度融合**: 融合不同层次(before/after projection)的特征
4. **知识蒸馏**: 用更大的教师模型指导投影头训练
