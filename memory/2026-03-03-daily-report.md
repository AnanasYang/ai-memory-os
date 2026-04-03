Week 1 - 2026.02.02 - 2026.02.06

- 2026.02.02
- Qwen3-VL-Embedding & Reranker 项目启动
- 调研 Qwen3-VL-Embedding-8B 和 Qwen3-VL-Reranker-8B 模型架构
- 分析多模态向量检索场景需求（自动驾驶前视广角视频）
- 设计系统架构：Embedding 生成 → Milvus 存储 → 检索 → Reranker 精排
- Qwen3-VL-Embedding 是较新的模型，官方文档示例较少，通过通读 transformers 源码和 Qwen-VL 系列 GitHub issue，理解模型输入输出格式

- 2026.02.03
- 研究 Milvus 向量数据库多向量字段存储方案
- 设计四维度上下文向量存储结构（comprehensive/spatial/temporal/object）
- 调研 Qwen3-VL-Embedding 多卡推理方案（device_map + max_memory）
- Milvus 单 Collection 多向量字段支持度有限，采用独立字段存储四维度向量，通过 video_id 关联，保证检索时可按维度独立查询

- 2026.02.04
- 搭建项目基础代码框架
- 实现 Qwen3VLForEmbedding 模型类，支持视频特征提取
- 编写视频帧提取和预处理模块
- transformers 版本兼容性问题，Qwen3VL 需要特定版本支持，升级 transformers 到最新 dev 版本，安装 qwen-vl-utils 辅助库

- 2026.02.05
- 完善 Embedding 模型推理代码，支持 batch 处理
- 测试单视频/多视频输入的 embedding 生成流程
- 向量维度验证：3584 维 float16
- 视频帧数不统一导致 batch 处理失败，采用动态帧采样策略（FPS=1, MAX_FRAMES=64），统一视频输入格式

- 2026.02.06
- 整理开发文档和接口设计
- 代码 review 和初步单元测试
- 准备下周 Milvus 集成开发

Week 2 - 2026.02.09 - 2026.02.12

- 2026.02.09
- Milvus 向量存储模块开发启动
- 实现 Milvus 客户端初始化（连接本地 19530 端口）
- 设计 Collection Schema：id + video_path + video_name + embedding
- Milvus 客户端连接失败，提示认证错误，检查 Milvus 服务端配置，使用正确的 token 格式 root:Milvus 进行连接

- 2026.02.10
- 完成 create_collection 函数，支持 COSINE 相似度度量
- 实现 insert_embeddings 批量插入接口
- 开发 search_similar 向量检索接口
- 向量维度不匹配问题，Embedding 输出 3584 维但 Milvus 配置为 4096 维，统一 VECTOR_DIM=3584，重新创建 Collection，确保存储和检索维度一致

- 2026.02.11
- 测试 Milvus 数据写入和读取流程
- 验证向量检索结果的正确性
- 优化 Milvus 连接配置和错误处理
- 批量插入大数据量时出现超时，采用分批插入策略，每批控制在 100 条以内，添加重试机制

- 2026.02.12
- 整合 Embedding 生成与 Milvus 存储流程
- 调试视频文件路径解析和 metadata 存储
- 完成 Store 模式的端到端测试
- 视频文件路径含中文导致编码错误，统一使用 Pathlib 处理路径，确保跨平台兼容性

Week 4 - 2026.02.25 - 2026.02.27

- 2026.02.25
- 开发 Qwen3VL 多维度上下文 Embedding 生成模块
- 实现 comprehensive_context、spatial_context、temporal_context、object_context 四种指令模板
- 测试单视频四维度向量生成，验证向量独立性

- 2026.02.26
- 完成 qwen3_vl_embedding2milvus.py 整合模块开发
- 实现 process_independent_video 接口，支持四维度向量同时入库
- 设计 video_id + view_type 的联合索引方案

- 2026.02.27
- 编写 test.py 综合测试脚本
- 验证多视频批量处理流程
- 测试不同视角类型（front_wide）的向量存储
- Embedding 模型推理时出现 OOM，双卡负载不均衡，使用 DataParallel 时主卡显存占用过高，副卡利用率低，改用 device_map="auto" + max_memory 配置，显式分配每张卡的显存上限，实现真正的模型并行

Week 5 - 2026.03.02 - 2026.03.03

- 2026.03.02
- 重构 video_embedding.py，使用 max_memory 限制实现双卡负载均衡
- 配置 max_memory={0: "20GiB", 1: "22GiB"}，解决 OOM 问题
- 优化 Milvus 存储接口，完善 video2milvus 类封装
- 测试多视频并行 embedding 生成，双卡利用率平均分配
- 模型加载后首次推理耗时过长（模型预热问题），添加 warmup 步骤，使用空输入进行一次前向传播，确保后续批处理速度稳定

- 2026.03.03
- 开发 Search + Rerank 完整流程
- 实现 search_rerank.py 检索和重排序模块框架
- 编写 main.py 主入口，支持 store/search 双模式切换
- 开发 main_img.py 图片检索专用入口
- Reranker 模型（Qwen3-VL-Reranker-8B）下载中，尚未跑通
- Store 和 Search（rerank 前）流程验证通过，支持前视广角视频多维度语义检索
- HuggingFace 模型下载慢且经常中断，配置 HF_HOME 和 TRANSFORMERS_CACHE 到本地大容量磁盘，使用 HuggingFace 镜像源加速下载
- Reranker 模型依赖与 Embedding 模型存在版本冲突，当前隔离开发，计划使用独立的 Python 环境或 Docker 容器运行 Reranker 服务
