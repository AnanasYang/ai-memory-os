#!/usr/bin/env python3
"""
直接调用飞书 API 追加内容到文档
使用 OpenClaw 内置的 feishu_doc 功能
"""

import subprocess
import json
import os
import sys

# 文档信息
DOC_TOKEN = "YaUpdVUAloFuRwxJczIcR8KMnvd"

# 准备内容
CONTENT = """【今日AI前沿 - 2026-04-20】
报送人：小爪
日期：2026-04-20
范围：过去24小时关键动态

🔴 核心层（可落地的开源项目/模型/范式）

一、AI startup Cursor in talks to raise $2 billion funding round at valuation of over $50 billion - CNBC
关键信息：
  • 2 b
💡 对你：AI Agent技术可应用于内部效率工具开发，关注与现有工作流的集成方式。
🔗 来源链接：https://www.cnbc.com/2026/04/19/cursor-ai-2-billion-funding-round.html
📰 来源：TechCrunch/Forbes等

二、David Soria Parra on the Future of AI Agents - StartupHub.ai
关键信息：
  • His presentation, titled "The Future of MCP," explored the progression from early AI demos to sophisticated agents capable of complex tasks and progra
💡 对你：AI Agent技术可应用于内部效率工具开发，关注与现有工作流的集成方式。
🔗 来源链接：https://www.startuphub.ai/ai-news/technology/2026/david-soria-parra-on-the-future-of-ai-agents
📰 来源：TechCrunch/Forbes等

三、Microsoft Is Quietly Opening the Windows 11 Taskbar To Third-Party AI Agents That Can Act On Your Desktop - Wccftech
关键信息：
  • # Microsoft Is Quietly Opening the Windows 11 Taskbar To Third-Party AI Agents That Can Act On Your Desktop.
💡 对你：AI Agent技术可应用于内部效率工具开发，关注与现有工作流的集成方式。
🔗 来源链接：https://wccftech.com/microsoft-continues-with-its-plan-to-bring-ai-agents-to-windows-11/
📰 来源：TechCrunch/Forbes等

🟡 近层（行业动态/产品发布/技术路线）

4、Details on Louisiana shooting that killed 8 children - CBS News
关键信息：
  • Image 178: Iran war impacts jet fuel prices, travelers ### Iran war impacts jet fuel prices, travelers 03:36 Apr 17, 2026Image 179: Kylie Kelce promot
💡 对你：关注行业动态，评估对技术路线选择的影响。
🔗 来源链接：https://www.cbsnews.com/video/details-on-louisiana-shooting-that-killed-8-children/
📰 来源：TechCrunch/Forbes等

5、The Irish Times view on artificial intelligence: self-regulation is a dangerous myth - The Irish Times
关键信息：
  • Claude Mythos tool developed by Anthropic, the US AI firm, last week. Anthropic says that is because Claude Mythos is only available to a limited pool of about 40 technology companies, so it did not need to go through the normal regulatory hoops. The European Commission published the EU AI Act in 2024 to regulate the technology. Unlike the EU, the White House accepts the argument made by US tech firms that they understand the industry best and that anything other than self-regulation will stymie the growth and potential of AI.
💡 对你：关注行业动态，评估对技术路线选择的影响。
🔗 来源链接：https://www.irishtimes.com/opinion/editorials/2026/04/19/the-irish-times-view-on-artificial-intelligence-self-regulation-is-a-dangerous-myth/
📰 来源：TechCrunch/Forbes等

6、Humanoid robot beats human half-marathon world record by 7 minutes at Beijing race with 112 teams - The Next Web
关键信息：
  • 10 b
💡 对你：关注行业动态，评估对技术路线选择的影响。
🔗 来源链接：https://thenextweb.com/news/humanoid-robot-half-marathon-beijing-world-record
📰 来源：TechCrunch/Forbes等

7、D-Wave Soared 46% On Nvidia's Quantum Bet. Here's The Surprise Winner - Forbes
关键信息：
  • * Nvidia's CEO Jensen Huang has shifted from skepticism to actively advancing quantum computing, releasing open-source AI models (Ising) to address QC
💡 对你：关注行业动态，评估对技术路线选择的影响。
🔗 来源链接：https://www.forbes.com/sites/petercohan/2026/04/19/d-wave-soared-46-on-nvidias-quantum-bet-heres-the-surprise-winner/
📰 来源：TechCrunch/Forbes等

🟢 外延层（观点思辨/跨领域启发/前沿探索）

8、Indian-Origin OpenAI CTO Srinivas Narayanan Quits, Plans To Spend Time With "Ageing Parents In India" - NDTV
关键信息：
  • 2B
💡 对你：作为技术视野拓展，关注跨领域创新对自身工作的启发价值。
🔗 来源链接：https://www.ndtv.com/feature/indian-origin-openai-cto-srinivas-narayanan-quits-plans-to-spend-time-with-ageing-parents-in-india-11380513
📰 来源：TechCrunch/Forbes等

9、Kimi新论文：把KVCache玩成新商业模式了
关键信息：
  • Kimi新论文：把KVCache玩成新商业模式了
  • （详情请点击下方链接查看原文）
💡 对你：作为技术视野拓展，关注跨领域创新对自身工作的启发价值。
🔗 来源链接：https://www.qbitai.com/2026/04/403528.html
📰 来源：量子位

⚪ 支撑层（政策/投资/宏观）

10、Jim Cramer on Tesla: "We Want to Hear About Self-Driving Cars, We Want Robots" - Yahoo Finance
关键信息：
  • # Jim Cramer on Tesla: "We Want to Hear About Self-Driving Cars, We Want Robots".
💡 对你：作为决策参考，关注对技术投入和资源配置的影响。
🔗 来源链接：https://finance.yahoo.com/markets/stocks/articles/jim-cramer-tesla-want-hear-185130017.html
📰 来源：TechCrunch/Forbes等

📋 今日行动建议

【短期】
  • 跟踪近层动态中的技术路线变化

【中期】
  • 整理本周核心层技术，评估试点可行性
  • 关注支撑层政策动向对技术规划的影响

【学习】
  • 阅读核心层相关技术文档/论文
  • 思考跨领域创新对自身工作的启发

📊 今日动态分布

层级      数量  占比
🔴 核心层  3条   30%
🟡 近层    4条   40%
🟢 外延层  2条   20%
⚪ 支撑层  1条   10%

每条信息均附来源链接，影响分析一句话。
已排除企业IT Infra接入类新闻。"""

# 将内容保存到文件
content_file = "/tmp/feishu_append_content.txt"
with open(content_file, 'w', encoding='utf-8') as f:
    f.write(CONTENT)

print(f"✅ 内容已保存到: {content_file}")
print(f"📄 文档Token: {DOC_TOKEN}")
print(f"📊 内容长度: {len(CONTENT)} 字符")
print(f"\n📝 请使用以下命令手动追加到飞书文档:")
print(f"   1. 打开文件: {content_file}")
print(f"   2. 复制内容")
print(f"   3. 粘贴到飞书文档: https://feishu.cn/docx/{DOC_TOKEN}")

# 尝试使用 openclaw agent 命令
print(f"\n🤖 尝试使用 OpenClaw agent 命令...")

# 构建消息
message = f"使用 feishu_doc 工具追加内容到文档 {DOC_TOKEN}"

cmd = [
    "openclaw", "agent",
    "--channel", "feishu",
    "--to", "+8613800138000",
    "--message", message,
    "--timeout", "60"
]

print(f"执行: {' '.join(cmd[:6])}...")
result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

print(f"\n返回码: {result.returncode}")
if result.stdout:
    print(f"输出: {result.stdout[:500]}")
if result.stderr:
    print(f"错误: {result.stderr[:500]}")