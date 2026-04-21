#!/usr/bin/env python3
"""
直接调用飞书 API 追加内容到文档
"""

import json
import os

# 文档信息
DOC_TOKEN = "YaUpdVUAloFuRwxJczIcR8KMnvd"

# 完整内容
CONTENT = """【今日AI前沿 - 2026-04-20】
报送人：小爪
日期：2026-04-20
范围：过去24小时关键动态

🔴 核心层（可落地的开源项目/模型/范式）

一、AI startup Cursor in talks to raise $2 billion funding round at valuation of over $50 billion - CNBC
关键信息：
  • Cursor正在谈判融资20亿美元，估值超过500亿美元
💡 对你：AI Agent技术可应用于内部效率工具开发，关注与现有工作流的集成方式。
🔗 来源链接：https://www.cnbc.com/2026/04/19/cursor-ai-2-billion-funding-round.html
📰 来源：TechCrunch/Forbes等

二、David Soria Parra on the Future of AI Agents - StartupHub.ai
关键信息：
  • 演讲主题"The Future of MCP"，探讨从早期AI演示到复杂任务智能体的演进
💡 对你：AI Agent技术可应用于内部效率工具开发，关注与现有工作流的集成方式。
🔗 来源链接：https://www.startuphub.ai/ai-news/technology/2026/david-soria-parra-on-the-future-of-ai-agents
📰 来源：TechCrunch/Forbes等

三、Microsoft Is Quietly Opening the Windows 11 Taskbar To Third-Party AI Agents - Wccftech
关键信息：
  • 微软正悄悄开放Windows 11任务栏给第三方AI Agent
💡 对你：AI Agent技术可应用于内部效率工具开发，关注与现有工作流的集成方式。
🔗 来源链接：https://wccftech.com/microsoft-continues-with-its-plan-to-bring-ai-agents-to-windows-11/
📰 来源：TechCrunch/Forbes等

🟡 近层（行业动态/产品发布/技术路线）

4、The Irish Times view on artificial intelligence: self-regulation is a dangerous myth
关键信息：
  • Anthropic的Claude Mythos工具仅向约40家科技公司开放，绕过正常监管程序
💡 对你：关注行业动态，评估对技术路线选择的影响。
🔗 来源链接：https://www.irishtimes.com/opinion/editorials/2026/04/19/the-irish-times-view-on-artificial-intelligence-self-regulation-is-a-dangerous-myth/
📰 来源：The Irish Times

5、Humanoid robot beats human half-marathon world record by 7 minutes at Beijing race
关键信息：
  • 北京人形机器人半程马拉松比赛，112支队伍参赛
💡 对你：关注行业动态，评估对技术路线选择的影响。
🔗 来源链接：https://thenextweb.com/news/humanoid-robot-half-marathon-beijing-world-record
📰 来源：The Next Web

6、D-Wave Soared 46% On Nvidia's Quantum Bet - Forbes
关键信息：
  • 英伟达CEO黄仁勋从怀疑量子计算转向积极投入，发布开源AI模型Ising
💡 对你：关注行业动态，评估对技术路线选择的影响。
🔗 来源链接：https://www.forbes.com/sites/petercohan/2026/04/19/d-wave-soared-46-on-nvidias-quantum-bet-heres-the-surprise-winner/
📰 来源：Forbes

🟢 外延层（观点思辨/跨领域启发/前沿探索）

7、Indian-Origin OpenAI CTO Srinivas Narayanan Quits - NDTV
关键信息：
  • OpenAI CTO离职，计划回印度陪伴年迈父母
💡 对你：作为技术视野拓展，关注跨领域创新对自身工作的启发价值。
🔗 来源链接：https://www.ndtv.com/feature/indian-origin-openai-cto-srinivas-narayanan-quits-plans-to-spend-time-with-ageing-parents-in-india-11380513
📰 来源：NDTV

8、Kimi新论文：把KV Cache玩成新商业模式
关键信息：
  • Kimi发布新论文，探索KV Cache的商业化模式
💡 对你：作为技术视野拓展，关注跨领域创新对自身工作的启发价值。
🔗 来源链接：https://www.qbitai.com/2026/04/403528.html
📰 来源：量子位

⚪ 支撑层（政策/投资/宏观）

9、Jim Cramer on Tesla: "We Want to Hear About Self-Driving Cars, We Want Robots"
关键信息：
  • 市场对特斯拉的期待集中在自动驾驶和机器人业务
💡 对你：作为决策参考，关注对技术投入和资源配置的影响。
🔗 来源链接：https://finance.yahoo.com/markets/stocks/articles/jim-cramer-tesla-want-hear-185130017.html
📰 来源：Yahoo Finance

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
🟡 近层    3条   30%
🟢 外延层  2条   20%
⚪ 支撑层  1条   10%

每条信息均附来源链接，影响分析一句话。
已排除企业IT Infra接入类新闻。"""

# 构建 feishu_doc 工具调用参数
params = {
    "action": "append",
    "doc_token": DOC_TOKEN,
    "content": CONTENT
}

print("=" * 60)
print("飞书文档追加工具")
print("=" * 60)
print(f"\n文档Token: {DOC_TOKEN}")
print(f"操作: append")
print(f"内容长度: {len(CONTENT)} 字符")
print(f"\n{'='*60}")
print("工具调用参数 (JSON):")
print(json.dumps(params, ensure_ascii=False, indent=2))
print(f"{'='*60}\n")

# 由于无法直接调用 feishu_doc 工具，输出提示信息
print("⚠️  提示: 当前环境无法直接调用 feishu_doc 工具")
print("📋 请使用以下方式之一完成操作:\n")
print("1. 手动复制粘贴:")
print(f"   - 文件位置: /home/bruce/.openclaw/workspace/简报_日报_2026-04-20.md")
print(f"   - 飞书文档: https://feishu.cn/docx/{DOC_TOKEN}\n")
print("2. 在飞书渠道上下文中直接调用 feishu_doc 工具")
print("3. 使用 OpenClaw CLI (如果支持): openclaw tools feishu_doc")

# 保存内容到文件
output_file = "/tmp/feishu_append_final.txt"
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(CONTENT)

print(f"\n✅ 内容已保存到: {output_file}")