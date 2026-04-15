#!/usr/bin/env python3
"""
难负样本挖掘工具

功能:
1. 使用当前训练好的模型挖掘难负样本
2. 基于向量相似度找出"相似但不匹配"的样本对
3. 更新标注文件，添加难负样本

使用方法:
    python hard_negative_mining.py \
        --annotation_file ./annotations.jsonl \
        --model_path ./output/best_model.pt \
        --base_model Qwen/Qwen3-VL-Embedding-8B \
        --top_k 5 \
        --output ./annotations_with_hard_negatives.jsonl
"""

import os
import json
import argparse
from pathlib import Path
from typing import List, Dict, Tuple
from tqdm import tqdm

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from transformers import AutoTokenizer, AutoProcessor
from PIL import Image

# 导入训练脚本中的模型类
import sys
sys.path.append(str(Path(__file__).parent))
from train_qwen3vl_projection import Qwen3VLEmbeddingModel, ProjectionHead


class HardNegativeMiner:
    """难负样本挖掘器"""
    
    def __init__(
        self,
        model_path: str,
        base_model_name: str,
        device: str = 'cuda'
    ):
        self.device = device
        
        # 加载模型配置
        checkpoint = torch.load(model_path, map_location='cpu')
        
        # 创建投影头
        projection_config = checkpoint.get('projection_config', {
            'hidden_dim': 2048,
            'output_dim': 1024,
            'architecture': 'with_type_embedding',
            'num_instruction_types': 4
        })
        
        # 加载基座模型和投影头
        self.model = Qwen3VLEmbeddingModel(
            base_model_name,
            projection_config,
            freeze_vision=True,
            freeze_text=True
        ).to(device)
        
        self.model.projection_head.load_state_dict(checkpoint['projection_head'])
        self.model.eval()
        
        # 加载tokenizer和processor
        self.tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
        self.processor = AutoProcessor.from_pretrained(base_model_name, trust_remote_code=True)
        
        print(f"Model loaded from {model_path}")
    
    @torch.no_grad()
    def encode_text(self, query: str, instruction_type: str) -> torch.Tensor:
        """编码查询文本"""
        # 处理文本
        text_inputs = self.tokenizer(
            query,
            max_length=128,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        ).to(self.device)
        
        # 编码
        inst_type_map = Qwen3VLEmbeddingModel.INSTRUCTION_TYPES
        inst_type_id = inst_type_map.get(instruction_type, 0)
        
        embeds = self.model.encode_text(
            text_inputs['input_ids'],
            text_inputs['attention_mask'],
            torch.tensor([inst_type_id]).to(self.device)
        )
        return embeds
    
    @torch.no_grad()
    def encode_image(self, image_path: str, instruction_type: str) -> torch.Tensor:
        """编码图片"""
        # 加载图片
        image = Image.open(image_path).convert('RGB')
        image_inputs = self.processor(images=image, return_tensors='pt').to(self.device)
        
        # 编码
        inst_type_map = Qwen3VLEmbeddingModel.INSTRUCTION_TYPES
        inst_type_id = inst_type_map.get(instruction_type, 0)
        
        embeds = self.model.encode_image(
            image_inputs['pixel_values'],
            torch.tensor([inst_type_id]).to(self.device)
        )
        return embeds
    
    def mine_hard_negatives(
        self,
        annotation: Dict,
        candidate_pool: List[str],
        top_k: int = 5
    ) -> List[str]:
        """
        为单个查询挖掘难负样本
        
        Args:
            annotation: 单个查询的标注
            candidate_pool: 候选图片池（通常是其他查询的图片）
            top_k: 返回最难的k个负样本
        
        Returns:
            hard_negatives: 难负样本图片路径列表
        """
        query = annotation['query_text']
        inst_type = annotation['instruction_type']
        positive_images = set(annotation.get('positive_images', []))
        existing_negatives = set(annotation.get('negative_images', []))
        
        # 编码查询
        query_embed = self.encode_text(query, inst_type)
        
        # 编码候选图片
        similarities = []
        for img_path in tqdm(candidate_pool, desc=f"Mining for: {query[:30]}...", leave=False):
            # 跳过正样本
            if img_path in positive_images:
                continue
            
            try:
                img_embed = self.encode_image(img_path, inst_type)
                sim = F.cosine_similarity(query_embed, img_embed).item()
                similarities.append((img_path, sim))
            except Exception as e:
                print(f"Error encoding {img_path}: {e}")
                continue
        
        # 按相似度排序
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        # 选择最难的负样本（相似度高但不是正样本）
        hard_negatives = []
        for img_path, sim in similarities:
            if img_path not in positive_images and img_path not in existing_negatives:
                hard_negatives.append(img_path)
                if len(hard_negatives) >= top_k:
                    break
        
        return hard_negatives
    
    def process_annotations(
        self,
        annotations: List[Dict],
        top_k: int = 5,
        use_cross_query: bool = True
    ) -> List[Dict]:
        """
        处理所有标注，挖掘难负样本
        
        Args:
            annotations: 所有查询的标注列表
            top_k: 每个查询挖掘的难负样本数
            use_cross_query: 是否使用其他查询的图片作为候选池
        
        Returns:
            updated_annotations: 包含难负样本的更新后的标注
        """
        # 构建候选池
        all_images = set()
        for ann in annotations:
            all_images.update(ann.get('positive_images', []))
            all_images.update(ann.get('negative_images', []))
        all_images = list(all_images)
        
        print(f"Total candidate images: {len(all_images)}")
        print(f"Processing {len(annotations)} queries...")
        
        updated_annotations = []
        
        for ann in tqdm(annotations, desc="Mining hard negatives"):
            if use_cross_query:
                # 使用所有其他图片作为候选池
                candidate_pool = [img for img in all_images 
                                if img not in ann.get('positive_images', [])]
            else:
                # 只使用负样本作为候选池
                candidate_pool = ann.get('negative_images', [])
            
            if len(candidate_pool) == 0:
                print(f"Warning: No candidates for query {ann['query_id']}")
                updated_annotations.append(ann)
                continue
            
            # 挖掘难负样本
            hard_negatives = self.mine_hard_negatives(ann, candidate_pool, top_k)
            
            # 更新标注
            ann['hard_negatives'] = hard_negatives
            updated_annotations.append(ann)
            
            print(f"Query {ann['query_id']}: Found {len(hard_negatives)} hard negatives")
        
        return updated_annotations


def main():
    parser = argparse.ArgumentParser(description="Hard Negative Mining Tool")
    parser.add_argument('--annotation_file', type=str, required=True,
                        help='Path to annotation JSONL file')
    parser.add_argument('--model_path', type=str, required=True,
                        help='Path to trained projection head checkpoint')
    parser.add_argument('--base_model', type=str, default='Qwen/Qwen3-VL-Embedding-8B',
                        help='Base model name')
    parser.add_argument('--top_k', type=int, default=5,
                        help='Number of hard negatives to mine per query')
    parser.add_argument('--output', type=str, required=True,
                        help='Output file path')
    parser.add_argument('--device', type=str, default='cuda',
                        help='Device to use')
    parser.add_argument('--no_cross_query', action='store_true',
                        help='Do not use cross-query images as candidates')
    
    args = parser.parse_args()
    
    # 加载标注
    print(f"Loading annotations from {args.annotation_file}")
    annotations = []
    with open(args.annotation_file, 'r', encoding='utf-8') as f:
        for line in f:
            annotations.append(json.loads(line.strip()))
    
    # 创建挖掘器
    miner = HardNegativeMiner(
        args.model_path,
        args.base_model,
        device=args.device
    )
    
    # 挖掘难负样本
    updated_annotations = miner.process_annotations(
        annotations,
        top_k=args.top_k,
        use_cross_query=not args.no_cross_query
    )
    
    # 保存结果
    with open(args.output, 'w', encoding='utf-8') as f:
        for ann in updated_annotations:
            f.write(json.dumps(ann, ensure_ascii=False) + '\n')
    
    print(f"\nUpdated annotations saved to {args.output}")
    print(f"Total queries: {len(updated_annotations)}")
    
    # 统计
    total_hard_neg = sum(len(a.get('hard_negatives', [])) for a in updated_annotations)
    print(f"Total hard negatives added: {total_hard_neg}")


if __name__ == '__main__':
    main()
