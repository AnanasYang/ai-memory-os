# 本地LLM部署指南

## 系统要求
- 你的系统配置：32GB 内存，20 核 CPU，Intel 集成显卡
- 此配置足以运行中小型本地 LLM

## 方案一：使用 Ollama（推荐）

### 1. 安装 Ollama
```bash
# 下载并安装 Ollama
curl -fsSL https://ollama.ai/install.sh | sh
```

或手动下载：
```bash
# 访问 https://github.com/ollama/ollama/releases 下载适合你系统的版本
# 对于 Linux AMD64：
wget https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tgz
tar -xzf ollama-linux-amd64.tgz
sudo mv ollama /usr/local/bin/
```

### 2. 启动 Ollama 服务
```bash
# 启动服务（需要管理员权限）
sudo systemctl start ollama
# 或直接运行
ollama serve
```

### 3. 拉取并运行模型
```bash
# 拉取一个轻量级模型
ollama pull llama3.1:8b

# 或者拉取其他模型
ollama pull mistral:7b
ollama pull phi3:medium
```

### 4. 运行模型
```bash
ollama run llama3.1:8b
```

## 方案二：使用 Llama.cpp

### 1. 克隆仓库
```bash
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
make
```

### 2. 下载模型
从 Hugging Face 下载 GGUF 格式的模型文件

### 3. 运行模型
```bash
./llama-cli -m ./models/llama-3.1-8b-instruct.Q4_K_M.gguf -p "Hello, how are you?" -n 128
```

## 配置 OpenClaw 使用本地模型

编辑 OpenClaw 配置文件 `.openclaw/config.json`：

```json
{
  "agents": {
    "defaults": {
      "model": "ollama/llama3.1:8b"
    }
  },
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434"
    }
  }
}
```

## 推荐模型选择

基于你的硬件配置，推荐以下模型：

1. **Llama 3.1 8B** - 性能与能力的良好平衡
2. **Phi-3 Medium** - 微软开发的小模型，效果不错
3. **Mistral 7B** - 在代码和对话方面表现良好
4. **Gemma 2 9B** - Google 开发的高效模型

## 注意事项

- 由于使用 CPU 推理，响应时间会比云端 API 慢
- 8B 参数模型在你的系统上应能流畅运行
- 建议使用量化模型（如 Q4_K_M）以节省内存

## 性能优化

- 设置 Ollama 环境变量限制并发：
  ```bash
  export OLLAMA_NUM_PARALLEL=2
  ```
- 调整上下文窗口大小以节省内存
- 定期清理未使用的模型以释放磁盘空间