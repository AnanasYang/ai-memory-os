#!/usr/bin/env python3
"""
数据标注工具 - 辅助生成训练数据

功能:
1. 从目录加载图片，提供可视化界面进行查询-图片匹配标注
2. 支持批量标注和快捷键操作
3. 自动生成JSONL格式的标注文件

使用方法:
    python annotation_tool.py \
        --image_dir ./images \
        --output ./annotations.jsonl \
        --instruction_type spatial
"""

import os
import json
import argparse
from pathlib import Path
from typing import List, Dict
import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageTk


class AnnotationTool:
    """标注工具GUI"""
    
    INSTRUCTION_TEMPLATES = {
        "spatial": [
            "[空间] 前方左侧车辆正在cut-in",
            "[空间] 前方右侧车辆正在变道",
            "[空间] 本车正在左侧车道行驶",
            "[空间] 前方车辆保持在本车道",
            "[空间] 前方有车辆从右侧汇入",
        ],
        "temporal": [
            "[时间] 车辆正在加速",
            "[时间] 车辆正在减速",
            "[时间] 车辆保持匀速行驶",
            "[时间] 车辆正在停车",
            "[时间] 车辆正在起步",
        ],
        "environment": [
            "[环境] 晴天白天城市道路",
            "[环境] 雨天高速公路",
            "[环境] 夜间有路灯照明",
            "[环境] 雾天低能见度",
            "[环境] 隧道内行驶",
        ],
        "object": [
            "[目标物] 前方有行人横穿",
            "[目标物] 前方有自行车骑行者",
            "[目标物] 前方有施工区域",
            "[目标物] 前方有静止车辆",
            "[目标物] 前方无特殊障碍物",
        ]
    }
    
    def __init__(self, image_dir: str, output_path: str, instruction_type: str):
        self.image_dir = Path(image_dir)
        self.output_path = Path(output_path)
        self.instruction_type = instruction_type
        
        # 加载图片列表
        self.image_files = sorted([
            f for f in self.image_dir.iterdir()
            if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']
        ])
        self.current_idx = 0
        
        # 标注数据
        self.annotations: List[Dict] = []
        self.current_query = ""
        self.positive_images: List[str] = []
        self.negative_images: List[str] = []
        
        # 创建GUI
        self.root = tk.Tk()
        self.root.title(f"Embedding Annotation Tool - {instruction_type}")
        self.root.geometry("1200x800")
        
        self._setup_ui()
        self._load_current_image()
    
    def _setup_ui(self):
        """设置UI界面"""
        # 主布局
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(0, weight=1)
        
        # 左侧面板 - 控制区
        left_frame = ttk.Frame(main_frame, padding="5")
        left_frame.grid(row=0, column=0, sticky=(tk.N, tk.S, tk.W))
        
        # 查询选择
        ttk.Label(left_frame, text="选择查询模板:").pack(anchor=tk.W, pady=(0, 5))
        
        self.query_var = tk.StringVar()
        templates = self.INSTRUCTION_TEMPLATES.get(self.instruction_type, [])
        self.query_combo = ttk.Combobox(
            left_frame,
            textvariable=self.query_var,
            values=templates,
            width=40
        )
        self.query_combo.pack(fill=tk.X, pady=(0, 10))
        if templates:
            self.query_combo.set(templates[0])
        
        # 自定义查询
        ttk.Label(left_frame, text="或输入自定义查询:").pack(anchor=tk.W, pady=(0, 5))
        self.custom_query = tk.Text(left_frame, height=3, width=40)
        self.custom_query.pack(fill=tk.X, pady=(0, 10))
        
        # 操作按钮
        ttk.Button(
            left_frame,
            text="标记为正样本 (Space)",
            command=self._mark_positive
        ).pack(fill=tk.X, pady=5)
        
        ttk.Button(
            left_frame,
            text="标记为负样本 (N)",
            command=self._mark_negative
        ).pack(fill=tk.X, pady=5)
        
        ttk.Button(
            left_frame,
            text="跳过 (→)",
            command=self._next_image
        ).pack(fill=tk.X, pady=5)
        
        ttk.Button(
            left_frame,
            text="保存当前查询标注 (Enter)",
            command=self._save_current_query
        ).pack(fill=tk.X, pady=20)
        
        # 统计信息
        self.stats_label = ttk.Label(left_frame, text="统计: 0 查询, 0 正样本, 0 负样本")
        self.stats_label.pack(anchor=tk.W, pady=(20, 5))
        
        # 进度
        self.progress_label = ttk.Label(left_frame, text=f"进度: 0 / {len(self.image_files)}")
        self.progress_label.pack(anchor=tk.W)
        
        # 快捷键说明
        shortcut_text = """
快捷键:
Space - 正样本
N - 负样本
→ - 下一张
Enter - 保存查询
Ctrl+S - 保存所有
        """
        ttk.Label(left_frame, text=shortcut_text, justify=tk.LEFT).pack(anchor=tk.W, pady=(20, 0))
        
        # 右侧面板 - 图片显示
        right_frame = ttk.Frame(main_frame, padding="5")
        right_frame.grid(row=0, column=1, sticky=(tk.N, tk.S, tk.E, tk.W))
        right_frame.columnconfigure(0, weight=1)
        right_frame.rowconfigure(0, weight=1)
        
        # 图片显示标签
        self.image_label = ttk.Label(right_frame)
        self.image_label.grid(row=0, column=0, sticky=(tk.N, tk.S, tk.E, tk.W))
        
        # 图片路径显示
        self.path_label = ttk.Label(right_frame, text="")
        self.path_label.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=5)
        
        # 当前标注状态
        self.status_label = ttk.Label(right_frame, text="未标注", foreground="gray")
        self.status_label.grid(row=2, column=0, sticky=(tk.W, tk.E))
        
        # 绑定快捷键
        self.root.bind('<space>', lambda e: self._mark_positive())
        self.root.bind('<n>', lambda e: self._mark_negative())
        self.root.bind('<Right>', lambda e: self._next_image())
        self.root.bind('<Return>', lambda e: self._save_current_query())
        self.root.bind('<Control-s>', lambda e: self._save_all())
    
    def _load_current_image(self):
        """加载当前图片"""
        if self.current_idx >= len(self.image_files):
            messagebox.showinfo("完成", "所有图片已标注完毕！")
            self._save_all()
            self.root.quit()
            return
        
        image_path = self.image_files[self.current_idx]
        
        try:
            # 加载并缩放图片
            image = Image.open(image_path)
            
            # 保持纵横比缩放
            max_size = (800, 600)
            image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # 转换为PhotoImage
            photo = ImageTk.PhotoImage(image)
            
            self.image_label.configure(image=photo)
            self.image_label.image = photo  # 保持引用
            
            self.path_label.configure(text=str(image_path))
            self.progress_label.configure(
                text=f"进度: {self.current_idx + 1} / {len(self.image_files)}"
            )
            
            # 重置标注状态
            self.status_label.configure(text="未标注", foreground="gray")
            
        except Exception as e:
            messagebox.showerror("错误", f"无法加载图片: {e}")
            self._next_image()
    
    def _get_current_query(self) -> str:
        """获取当前查询文本"""
        custom = self.custom_query.get("1.0", tk.END).strip()
        if custom:
            return custom
        return self.query_var.get()
    
    def _mark_positive(self):
        """标记为正样本"""
        image_path = str(self.image_files[self.current_idx])
        if image_path not in self.positive_images:
            self.positive_images.append(image_path)
            self.status_label.configure(text="✓ 正样本", foreground="green")
            self._update_stats()
        self._next_image()
    
    def _mark_negative(self):
        """标记为负样本"""
        image_path = str(self.image_files[self.current_idx])
        if image_path not in self.negative_images:
            self.negative_images.append(image_path)
            self.status_label.configure(text="✗ 负样本", foreground="red")
            self._update_stats()
        self._next_image()
    
    def _next_image(self):
        """下一张图片"""
        self.current_idx += 1
        self._load_current_image()
    
    def _save_current_query(self):
        """保存当前查询的标注"""
        query = self._get_current_query()
        if not query:
            messagebox.showwarning("警告", "请输入查询文本")
            return
        
        if not self.positive_images:
            messagebox.showwarning("警告", "请至少标注一个正样本")
            return
        
        # 创建标注条目
        annotation = {
            "query_id": f"{self.instruction_type}_{len(self.annotations):04d}",
            "query_text": query,
            "instruction_type": self.instruction_type,
            "positive_images": self.positive_images.copy(),
            "negative_images": self.negative_images.copy(),
            "hard_negatives": []
        }
        
        self.annotations.append(annotation)
        
        # 重置
        self.positive_images = []
        self.negative_images = []
        self.custom_query.delete("1.0", tk.END)
        
        self._update_stats()
        messagebox.showinfo("保存成功", f"已保存查询: {query}")
    
    def _update_stats(self):
        """更新统计信息"""
        total_pos = sum(len(a['positive_images']) for a in self.annotations)
        total_neg = sum(len(a['negative_images']) for a in self.annotations)
        self.stats_label.configure(
            text=f"统计: {len(self.annotations)} 查询, {total_pos} 正样本, {total_neg} 负样本"
        )
    
    def _save_all(self):
        """保存所有标注到文件"""
        if not self.annotations:
            messagebox.showwarning("警告", "没有可保存的标注")
            return
        
        # 追加到现有文件
        existing = []
        if self.output_path.exists():
            with open(self.output_path, 'r', encoding='utf-8') as f:
                existing = [json.loads(line) for line in f]
        
        all_annotations = existing + self.annotations
        
        with open(self.output_path, 'w', encoding='utf-8') as f:
            for ann in all_annotations:
                f.write(json.dumps(ann, ensure_ascii=False) + '\n')
        
        messagebox.showinfo(
            "保存成功",
            f"已保存 {len(self.annotations)} 条标注到 {self.output_path}\n"
            f"总计 {len(all_annotations)} 条标注"
        )
    
    def run(self):
        """运行GUI"""
        self.root.mainloop()


def main():
    parser = argparse.ArgumentParser(description="Annotation Tool for Embedding Training")
    parser.add_argument('--image_dir', type=str, required=True, help='Directory containing images')
    parser.add_argument('--output', type=str, default='annotations.jsonl', help='Output annotation file')
    parser.add_argument('--instruction_type', type=str, required=True,
                        choices=['spatial', 'temporal', 'environment', 'object'],
                        help='Type of instruction to annotate')
    
    args = parser.parse_args()
    
    tool = AnnotationTool(args.image_dir, args.output, args.instruction_type)
    tool.run()


if __name__ == '__main__':
    main()
