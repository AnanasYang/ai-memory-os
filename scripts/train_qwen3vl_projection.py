#!/usr/bin/env python3
"""
Qwen3-VL-Embedding Projection Head 训练脚本
基于对比学习训练Instruction-aware多模态Embedding模型

使用方法:
    python train_qwen3vl_projection.py \
        --data_path ./data/annotations.jsonl \
        --output_dir ./output \
        --batch_size 32 \
        --epochs 10 \
        --lr 1e-4
"""

import os
import json
import logging
import argparse
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.cuda.amp import autocast, GradScaler

from transformers import (
    AutoTokenizer, 
    AutoModel, 
    AutoProcessor,
    Qwen2_5_VLForConditionalGeneration,
    Qwen2_5_VLProcessor
)
from PIL import Image
from tqdm import tqdm
import numpy as np

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ==============================================================================
# 配置类
# ==============================================================================

@dataclass
class TrainingConfig:
    """训练配置"""
    # 模型配置
    model_name: str = "Qwen/Qwen3-VL-Embedding-8B"
    projection_dim: int = 1024
    hidden_dim: int = 2048
    freeze_vision: bool = True
    freeze_text: bool = True
    
    # 训练配置
    batch_size: int = 32
    num_epochs: int = 10
    learning_rate: float = 1e-4
    weight_decay: float = 0.01
    warmup_steps: int = 100
    temperature: float = 0.07
    max_grad_norm: float = 1.0
    
    # 数据配置
    max_length: int = 128
    image_size: int = 448
    num_hard_negatives: int = 5
    
    # 优化配置
    use_amp: bool = True
    gradient_accumulation_steps: int = 1
    
    # 路径配置
    output_dir: str = "./output"
    save_steps: int = 500
    eval_steps: int = 100


# ==============================================================================
# 投影头模型
# ==============================================================================

class ProjectionHead(nn.Module):
    """
    投影头: 将基座模型的3584维特征映射到目标维度
    
    支持多种架构:
    - simple: 简单MLP
    - instruction_conditioned: 指令条件投影
    - with_type_embedding: 类型嵌入增强
    """
    
    def __init__(
        self, 
        input_dim: int = 3584,
        hidden_dim: int = 2048,
        output_dim: int = 1024,
        dropout: float = 0.1,
        architecture: str = "simple",
        num_instruction_types: int = 4
    ):
        super().__init__()
        self.architecture = architecture
        self.input_dim = input_dim
        self.output_dim = output_dim
        
        if architecture == "simple":
            # 简单MLP投影
            self.projection = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_dim, output_dim)
            )
            
        elif architecture == "with_type_embedding":
            # 类型嵌入增强
            self.projection = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_dim, output_dim)
            )
            self.type_embedding = nn.Embedding(num_instruction_types, output_dim)
            
        elif architecture == "instruction_conditioned":
            # 不同类型不同投影头
            self.projections = nn.ModuleList([
                nn.Sequential(
                    nn.Linear(input_dim, hidden_dim),
                    nn.ReLU(),
                    nn.Dropout(dropout),
                    nn.Linear(hidden_dim, output_dim)
                )
                for _ in range(num_instruction_types)
            ])
        else:
            raise ValueError(f"Unknown architecture: {architecture}")
    
    def forward(
        self, 
        features: torch.Tensor, 
        instruction_type: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """
        Args:
            features: [batch_size, input_dim]
            instruction_type: [batch_size] 指令类型索引
        Returns:
            embeddings: [batch_size, output_dim]
        """
        if self.architecture == "simple":
            return self.projection(features)
            
        elif self.architecture == "with_type_embedding":
            proj = self.projection(features)
            if instruction_type is not None:
                type_emb = self.type_embedding(instruction_type)
                proj = proj + type_emb
            return proj
            
        elif self.architecture == "instruction_conditioned":
            if instruction_type is None:
                raise ValueError("instruction_type required for instruction_conditioned architecture")
            
            # 对每个样本使用对应的投影头
            outputs = []
            for i, (feat, inst_type) in enumerate(zip(features, instruction_type)):
                out = self.projections[inst_type.item()](feat.unsqueeze(0))
                outputs.append(out)
            return torch.cat(outputs, dim=0)


class Qwen3VLEmbeddingModel(nn.Module):
    """
    完整的Qwen3-VL Embedding模型
    冻结基座，只训练投影头
    """
    
    INSTRUCTION_TYPES = {
        "spatial": 0,
        "temporal": 1,
        "environment": 2,
        "object": 3
    }
    
    def __init__(
        self,
        model_name: str,
        projection_config: Dict,
        freeze_vision: bool = True,
        freeze_text: bool = True
    ):
        super().__init__()
        
        # 加载基座模型
        logger.info(f"Loading base model: {model_name}")
        self.base_model = AutoModel.from_pretrained(
            model_name,
            torch_dtype=torch.bfloat16,
            trust_remote_code=True
        )
        
        # 冻结基座参数
        if freeze_vision:
            for param in self.base_model.visual.parameters():
                param.requires_grad = False
            logger.info("Vision encoder frozen")
            
        if freeze_text:
            for param in self.base_model.model.parameters():
                param.requires_grad = False
            logger.info("Text encoder frozen")
        
        # 获取特征维度
        self.hidden_size = self.base_model.config.hidden_size
        
        # 创建投影头
        self.projection_head = ProjectionHead(
            input_dim=self.hidden_size,
            **projection_config
        )
        
        # 初始化投影头
        self._init_projection_head()
    
    def _init_projection_head(self):
        """初始化投影头参数"""
        for module in self.projection_head.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
    
    def encode_text(
        self, 
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        instruction_type: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """编码文本"""
        with torch.no_grad():
            text_outputs = self.base_model.model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                output_hidden_states=True
            )
            # 取最后一层hidden state的mean pooling
            text_features = text_outputs.hidden_states[-1]
            text_features = (text_features * attention_mask.unsqueeze(-1)).sum(dim=1)
            text_features = text_features / attention_mask.sum(dim=1, keepdim=True)
        
        # 投影
        text_embeds = self.projection_head(text_features, instruction_type)
        return F.normalize(text_embeds, p=2, dim=-1)
    
    def encode_image(
        self, 
        pixel_values: torch.Tensor,
        instruction_type: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """编码图片"""
        with torch.no_grad():
            image_outputs = self.base_model.visual(pixel_values)
            # 取visual output的mean pooling
            if isinstance(image_outputs, tuple):
                image_features = image_outputs[0]
            else:
                image_features = image_outputs
            image_features = image_features.mean(dim=1)
        
        # 投影
        image_embeds = self.projection_head(image_features, instruction_type)
        return F.normalize(image_embeds, p=2, dim=-1)
    
    def forward(
        self,
        text_input_ids: torch.Tensor,
        text_attention_mask: torch.Tensor,
        pixel_values: torch.Tensor,
        instruction_type: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """前向传播，返回文本和图片的embedding"""
        text_embeds = self.encode_text(
            text_input_ids, text_attention_mask, instruction_type
        )
        image_embeds = self.encode_image(pixel_values, instruction_type)
        return text_embeds, image_embeds


# ==============================================================================
# 数据集
# ==============================================================================

class EmbeddingDataset(Dataset):
    """
    Embedding训练数据集
    支持多种数据格式
    """
    
    def __init__(
        self,
        data_path: str,
        tokenizer,
        processor,
        config: TrainingConfig,
        is_train: bool = True
    ):
        self.data = self._load_data(data_path)
        self.tokenizer = tokenizer
        self.processor = processor
        self.config = config
        self.is_train = is_train
        
        # 构建图片路径到查询的映射
        self.samples = self._build_samples()
        
        logger.info(f"Loaded {len(self.samples)} samples from {data_path}")
    
    def _load_data(self, data_path: str) -> List[Dict]:
        """加载数据文件"""
        data = []
        with open(data_path, 'r', encoding='utf-8') as f:
            for line in f:
                data.append(json.loads(line.strip()))
        return data
    
    def _build_samples(self) -> List[Dict]:
        """构建样本列表"""
        samples = []
        for item in self.data:
            query = item['query_text']
            inst_type = item['instruction_type']
            
            # 正样本
            for pos_img in item.get('positive_images', []):
                samples.append({
                    'query': query,
                    'instruction_type': inst_type,
                    'image': pos_img,
                    'label': 1
                })
            
            # 负样本（训练时使用）
            if self.is_train:
                for neg_img in item.get('negative_images', []):
                    samples.append({
                        'query': query,
                        'instruction_type': inst_type,
                        'image': neg_img,
                        'label': 0
                    })
        return samples
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx: int) -> Dict:
        sample = self.samples[idx]
        
        # 加载图片
        image_path = sample['image']
        try:
            image = Image.open(image_path).convert('RGB')
        except Exception as e:
            logger.warning(f"Failed to load image {image_path}: {e}")
            # 返回空白图片
            image = Image.new('RGB', (448, 448), (128, 128, 128))
        
        # 处理文本
        query = sample['query']
        text_inputs = self.tokenizer(
            query,
            max_length=self.config.max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        
        # 处理图片
        image_inputs = self.processor(images=image, return_tensors='pt')
        
        # 指令类型编码
        inst_type_map = Qwen3VLEmbeddingModel.INSTRUCTION_TYPES
        inst_type_id = inst_type_map.get(sample['instruction_type'], 0)
        
        return {
            'input_ids': text_inputs['input_ids'].squeeze(0),
            'attention_mask': text_inputs['attention_mask'].squeeze(0),
            'pixel_values': image_inputs['pixel_values'].squeeze(0),
            'instruction_type': torch.tensor(inst_type_id, dtype=torch.long),
            'label': torch.tensor(sample['label'], dtype=torch.float),
            'query': query,
            'image_path': image_path
        }


# ==============================================================================
# 损失函数
# ==============================================================================

class ContrastiveLoss(nn.Module):
    """
    对比学习损失
    支持InfoNCE和Symmetric InfoNCE
    """
    
    def __init__(self, temperature: float = 0.07, symmetric: bool = True):
        super().__init__()
        self.temperature = temperature
        self.symmetric = symmetric
    
    def forward(
        self, 
        text_embeds: torch.Tensor, 
        image_embeds: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            text_embeds: [batch_size, dim]
            image_embeds: [batch_size, dim]
        Returns:
            loss: scalar
        """
        batch_size = text_embeds.shape[0]
        
        # 计算相似度矩阵 [batch, batch]
        logits = torch.matmul(text_embeds, image_embeds.T) / self.temperature
        
        # 对角线是正样本对
        labels = torch.arange(batch_size, device=logits.device)
        
        # 文本→图片方向的loss
        loss_t2i = F.cross_entropy(logits, labels)
        
        if self.symmetric:
            # 图片→文本方向的loss
            loss_i2t = F.cross_entropy(logits.T, labels)
            loss = (loss_t2i + loss_i2t) / 2
        else:
            loss = loss_t2i
        
        return loss


# ==============================================================================
# 评估
# ==============================================================================

class EmbeddingEvaluator:
    """Embedding模型评估器"""
    
    def __init__(self, model: Qwen3VLEmbeddingModel, config: TrainingConfig):
        self.model = model
        self.config = config
    
    @torch.no_grad()
    def evaluate(
        self, 
        dataloader: DataLoader, 
        k_values: List[int] = [1, 5, 10]
    ) -> Dict[str, float]:
        """评估Recall@K"""
        self.model.eval()
        
        all_text_embeds = []
        all_image_embeds = []
        all_labels = []
        
        for batch in tqdm(dataloader, desc="Evaluating"):
            text_embeds, image_embeds = self.model(
                input_ids=batch['input_ids'].cuda(),
                attention_mask=batch['attention_mask'].cuda(),
                pixel_values=batch['pixel_values'].cuda(),
                instruction_type=batch['instruction_type'].cuda()
            )
            
            all_text_embeds.append(text_embeds.cpu())
            all_image_embeds.append(image_embeds.cpu())
            all_labels.append(batch['label'])
        
        # 合并
        all_text_embeds = torch.cat(all_text_embeds, dim=0)
        all_image_embeds = torch.cat(all_image_embeds, dim=0)
        all_labels = torch.cat(all_labels, dim=0)
        
        # 计算相似度矩阵
        similarity_matrix = torch.matmul(all_text_embeds, all_image_embeds.T)
        
        # 计算Recall@K
        results = {}
        for k in k_values:
            # 对每个查询，检查正样本是否在top-k中
            top_k_indices = torch.topk(similarity_matrix, k, dim=1).indices
            
            recall_count = 0
            for i in range(len(all_text_embeds)):
                # 找到这个查询对应的正样本
                positive_indices = (all_labels == 1).nonzero(as_tuple=True)[0]
                if len(positive_indices) > 0:
                    # 检查是否有正样本在top-k中
                    if any(idx in top_k_indices[i] for idx in positive_indices):
                        recall_count += 1
            
            results[f'recall@{k}'] = recall_count / len(all_text_embeds)
        
        return results


# ==============================================================================
# 训练器
# ==============================================================================

class Trainer:
    """训练器"""
    
    def __init__(
        self,
        model: Qwen3VLEmbeddingModel,
        config: TrainingConfig,
        train_dataloader: DataLoader,
        val_dataloader: Optional[DataLoader] = None
    ):
        self.model = model.cuda()
        self.config = config
        self.train_dataloader = train_dataloader
        self.val_dataloader = val_dataloader
        
        # 优化器 - 只优化投影头参数
        projection_params = list(model.projection_head.parameters())
        self.optimizer = AdamW(
            projection_params,
            lr=config.learning_rate,
            weight_decay=config.weight_decay
        )
        
        # 学习率调度
        total_steps = len(train_dataloader) * config.num_epochs
        self.scheduler = CosineAnnealingLR(
            self.optimizer, 
            T_max=total_steps,
            eta_min=config.learning_rate * 0.1
        )
        
        # 损失函数
        self.criterion = ContrastiveLoss(
            temperature=config.temperature,
            symmetric=True
        )
        
        # 混合精度
        self.scaler = GradScaler() if config.use_amp else None
        
        # 全局步数
        self.global_step = 0
        
        # 最佳模型
        self.best_val_recall = 0.0
    
    def train(self):
        """训练循环"""
        logger.info("Starting training...")
        
        for epoch in range(self.config.num_epochs):
            self.model.train()
            epoch_loss = 0.0
            
            pbar = tqdm(self.train_dataloader, desc=f"Epoch {epoch+1}/{self.config.num_epochs}")
            
            for step, batch in enumerate(pbar):
                loss = self._train_step(batch)
                epoch_loss += loss
                
                # 更新进度条
                pbar.set_postfix({'loss': f'{loss:.4f}'})
                
                # 评估
                if self.val_dataloader and self.global_step % self.config.eval_steps == 0:
                    self._evaluate()
                
                # 保存检查点
                if self.global_step % self.config.save_steps == 0:
                    self._save_checkpoint()
                
                self.global_step += 1
            
            avg_loss = epoch_loss / len(self.train_dataloader)
            logger.info(f"Epoch {epoch+1} finished. Avg loss: {avg_loss:.4f}")
            
            # 每个epoch结束后评估
            if self.val_dataloader:
                self._evaluate()
                self._save_checkpoint(is_epoch_end=True)
    
    def _train_step(self, batch: Dict) -> float:
        """单步训练"""
        # 将数据移到GPU
        input_ids = batch['input_ids'].cuda()
        attention_mask = batch['attention_mask'].cuda()
        pixel_values = batch['pixel_values'].cuda()
        instruction_type = batch['instruction_type'].cuda()
        
        # 只取正样本进行训练（负样本通过in-batch negatives构造）
        positive_mask = batch['label'] == 1
        if positive_mask.sum() == 0:
            return 0.0
        
        input_ids = input_ids[positive_mask]
        attention_mask = attention_mask[positive_mask]
        pixel_values = pixel_values[positive_mask]
        instruction_type = instruction_type[positive_mask]
        
        # 混合精度训练
        if self.config.use_amp:
            with autocast():
                text_embeds, image_embeds = self.model(
                    input_ids, attention_mask, pixel_values, instruction_type
                )
                loss = self.criterion(text_embeds, image_embeds)
            
            # 梯度累积
            loss = loss / self.config.gradient_accumulation_steps
            self.scaler.scale(loss).backward()
            
            if (self.global_step + 1) % self.config.gradient_accumulation_steps == 0:
                self.scaler.unscale_(self.optimizer)
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(), 
                    self.config.max_grad_norm
                )
                self.scaler.step(self.optimizer)
                self.scaler.update()
                self.scheduler.step()
                self.optimizer.zero_grad()
        else:
            text_embeds, image_embeds = self.model(
                input_ids, attention_mask, pixel_values, instruction_type
            )
            loss = self.criterion(text_embeds, image_embeds)
            loss = loss / self.config.gradient_accumulation_steps
            
            loss.backward()
            
            if (self.global_step + 1) % self.config.gradient_accumulation_steps == 0:
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(),
                    self.config.max_grad_norm
                )
                self.optimizer.step()
                self.scheduler.step()
                self.optimizer.zero_grad()
        
        return loss.item() * self.config.gradient_accumulation_steps
    
    @torch.no_grad()
    def _evaluate(self):
        """评估"""
        if self.val_dataloader is None:
            return
        
        evaluator = EmbeddingEvaluator(self.model, self.config)
        results = evaluator.evaluate(self.val_dataloader)
        
        logger.info(f"Validation results at step {self.global_step}:")
        for metric, value in results.items():
            logger.info(f"  {metric}: {value:.4f}")
        
        # 保存最佳模型
        recall10 = results.get('recall@10', 0.0)
        if recall10 > self.best_val_recall:
            self.best_val_recall = recall10
            self._save_checkpoint(is_best=True)
            logger.info(f"New best model saved! recall@10: {recall10:.4f}")
    
    def _save_checkpoint(self, is_best: bool = False, is_epoch_end: bool = False):
        """保存检查点"""
        output_dir = Path(self.config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if is_best:
            save_path = output_dir / "best_model.pt"
        elif is_epoch_end:
            save_path = output_dir / f"checkpoint_epoch_{self.global_step // len(self.train_dataloader)}.pt"
        else:
            save_path = output_dir / f"checkpoint_step_{self.global_step}.pt"
        
        # 只保存投影头
        torch.save({
            'projection_head': self.model.projection_head.state_dict(),
            'config': self.config,
            'global_step': self.global_step,
            'best_val_recall': self.best_val_recall
        }, save_path)
        
        logger.info(f"Checkpoint saved to {save_path}")


# ==============================================================================
# 数据准备工具
# ==============================================================================

def prepare_annotation_template():
    """
    生成标注模板文件
    用户可以基于这个模板创建自己的标注数据
    """
    template = [
        {
            "query_id": "spatial_001",
            "query_text": "[空间] 前方左侧车辆正在cut-in",
            "instruction_type": "spatial",
            "positive_images": [
                "/path/to/img_0342.jpg",
                "/path/to/img_0343.jpg"
            ],
            "negative_images": [
                "/path/to/img_0001.jpg",
                "/path/to/img_0891.jpg"
            ],
            "hard_negatives": [
                "/path/to/img_0156.jpg"
            ]
        },
        {
            "query_id": "temporal_001",
            "query_text": "[时间] 车辆正在减速停车",
            "instruction_type": "temporal",
            "positive_images": [
                "/path/to/img_0201.jpg",
                "/path/to/img_0202.jpg",
                "/path/to/img_0203.jpg"
            ],
            "negative_images": [
                "/path/to/img_0005.jpg"
            ],
            "hard_negatives": []
        },
        {
            "query_id": "environment_001",
            "query_text": "[环境] 雨天夜间高速公路场景",
            "instruction_type": "environment",
            "positive_images": [
                "/path/to/img_0501.jpg"
            ],
            "negative_images": [
                "/path/to/img_0300.jpg"
            ],
            "hard_negatives": [
                "/path/to/img_0401.jpg"  # 雪天夜间，相似但不匹配
            ]
        },
        {
            "query_id": "object_001",
            "query_text": "[目标物] 前方有行人和自行车",
            "instruction_type": "object",
            "positive_images": [
                "/path/to/img_0601.jpg",
                "/path/to/img_0602.jpg"
            ],
            "negative_images": [
                "/path/to/img_0701.jpg"
            ],
            "hard_negatives": []
        }
    ]
    
    with open('annotation_template.jsonl', 'w', encoding='utf-8') as f:
        for item in template:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    print("Annotation template saved to: annotation_template.jsonl")


# ==============================================================================
# 主函数
# ==============================================================================

def parse_args():
    parser = argparse.ArgumentParser(description="Train Qwen3-VL Embedding Projection Head")
    
    # 数据参数
    parser.add_argument('--data_path', type=str, required=True, help='Path to annotation JSONL file')
    parser.add_argument('--val_data_path', type=str, default=None, help='Path to validation data')
    parser.add_argument('--image_root', type=str, default='', help='Root directory for images')
    
    # 模型参数
    parser.add_argument('--model_name', type=str, default='Qwen/Qwen3-VL-Embedding-8B')
    parser.add_argument('--projection_dim', type=int, default=1024)
    parser.add_argument('--hidden_dim', type=int, default=2048)
    parser.add_argument('--architecture', type=str, default='with_type_embedding',
                        choices=['simple', 'with_type_embedding', 'instruction_conditioned'])
    
    # 训练参数
    parser.add_argument('--batch_size', type=int, default=32)
    parser.add_argument('--num_epochs', type=int, default=10)
    parser.add_argument('--learning_rate', type=float, default=1e-4)
    parser.add_argument('--weight_decay', type=float, default=0.01)
    parser.add_argument('--temperature', type=float, default=0.07)
    parser.add_argument('--gradient_accumulation_steps', type=int, default=1)
    
    # 其他参数
    parser.add_argument('--output_dir', type=str, default='./output')
    parser.add_argument('--save_steps', type=int, default=500)
    parser.add_argument('--eval_steps', type=int, default=100)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--prepare_template', action='store_true', help='Generate annotation template')
    
    return parser.parse_args()


def main():
    args = parse_args()
    
    # 生成标注模板
    if args.prepare_template:
        prepare_annotation_template()
        return
    
    # 设置随机种子
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    
    # 配置
    config = TrainingConfig(
        model_name=args.model_name,
        projection_dim=args.projection_dim,
        hidden_dim=args.hidden_dim,
        batch_size=args.batch_size,
        num_epochs=args.num_epochs,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        temperature=args.temperature,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        output_dir=args.output_dir,
        save_steps=args.save_steps,
        eval_steps=args.eval_steps
    )
    
    # 加载tokenizer和processor
    logger.info("Loading tokenizer and processor...")
    tokenizer = AutoTokenizer.from_pretrained(args.model_name, trust_remote_code=True)
    processor = AutoProcessor.from_pretrained(args.model_name, trust_remote_code=True)
    
    # 创建数据集
    logger.info("Creating datasets...")
    train_dataset = EmbeddingDataset(
        args.data_path,
        tokenizer,
        processor,
        config,
        is_train=True
    )
    
    train_dataloader = DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=True,
        num_workers=4,
        pin_memory=True
    )
    
    val_dataloader = None
    if args.val_data_path:
        val_dataset = EmbeddingDataset(
            args.val_data_path,
            tokenizer,
            processor,
            config,
            is_train=False
        )
        val_dataloader = DataLoader(
            val_dataset,
            batch_size=config.batch_size,
            shuffle=False,
            num_workers=4,
            pin_memory=True
        )
    
    # 创建模型
    logger.info("Creating model...")
    projection_config = {
        'hidden_dim': config.hidden_dim,
        'output_dim': config.projection_dim,
        'architecture': args.architecture,
        'num_instruction_types': 4
    }
    
    model = Qwen3VLEmbeddingModel(
        args.model_name,
        projection_config,
        freeze_vision=True,
        freeze_text=True
    )
    
    # 打印模型信息
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    logger.info(f"Total parameters: {total_params:,}")
    logger.info(f"Trainable parameters: {trainable_params:,}")
    logger.info(f"Frozen parameters: {total_params - trainable_params:,}")
    
    # 训练
    trainer = Trainer(model, config, train_dataloader, val_dataloader)
    trainer.train()
    
    logger.info("Training completed!")


if __name__ == '__main__':
    main()
