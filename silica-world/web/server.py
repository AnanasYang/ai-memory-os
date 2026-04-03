"""
Silica World - Web Interface
Web监控面板 - 实时观测世界状态
"""

from flask import Flask, jsonify, request, render_template_string
import json
import os

from core.manager import get_world_manager, reset_world_manager

app = Flask(__name__)

# HTML模板（嵌入式，无需外部文件）
DASHBOARD_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Silica World - 硅基虚拟世界</title>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #0a0a0a; color: #eee; }
        h1 { color: #00d4ff; margin-bottom: 10px; }
        .container { display: flex; gap: 20px; }
        .panel { background: #1a1a1a; border-radius: 10px; padding: 15px; flex: 1; }
        .panel h2 { color: #00d4ff; margin-top: 0; font-size: 18px; }
        canvas { background: #0d1b2a; border: 2px solid #00d4ff; border-radius: 5px; }
        .status { display: flex; gap: 20px; margin-bottom: 15px; flex-wrap: wrap; }
        .stat-box { background: #252525; padding: 10px 15px; border-radius: 5px; text-align: center; }
        .stat-label { font-size: 12px; color: #888; }
        .stat-value { font-size: 20px; font-weight: bold; color: #00d4ff; }
        .agent-list { max-height: 400px; overflow-y: auto; }
        .agent-card { background: #252525; margin: 10px 0; padding: 10px; border-radius: 5px; border-left: 3px solid #00d4ff; }
        .agent-card.predator { border-left-color: #ff4444; }
        .agent-card.prey { border-left-color: #44ff44; }
        .agent-name { font-weight: bold; color: #fff; }
        .agent-info { font-size: 12px; color: #aaa; margin-top: 5px; }
        .controls { margin: 15px 0; }
        button { background: #00d4ff; color: #000; border: none; padding: 10px 20px; margin: 5px; border-radius: 5px; cursor: pointer; font-weight: bold; }
        button:hover { background: #33ddff; }
        button.secondary { background: #444; color: #fff; }
        .events { max-height: 200px; overflow-y: auto; font-size: 12px; font-family: monospace; }
        .event { padding: 3px 0; border-bottom: 1px solid #333; }
        .command-box { margin-top: 15px; }
        input[type="text"] { width: 70%; padding: 10px; background: #252525; border: 1px solid #444; color: #fff; border-radius: 5px; }
        .philosophy { background: #1a1a1a; padding: 15px; border-radius: 5px; margin-top: 20px; font-size: 14px; line-height: 1.6; }
        .philosophy h3 { color: #ffaa00; margin-top: 0; }
    </style>
</head>
<body>
    <h1>🌊 Silica World - 硅基虚拟世界</h1>
    <p style="color: #888;">物理上可信的多智能体生态系统 | 准实时制 | 涌现行为观察</p>
    
    <div class="status" id="status">
        <div class="stat-box">
            <div class="stat-label">虚拟时间</div>
            <div class="stat-value" id="virtual-time">0</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Tick数</div>
            <div class="stat-value" id="tick-count">0</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">存活角色</div>
            <div class="stat-value" id="agent-count">0</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">碰撞次数</div>
            <div class="stat-value" id="collision-count">0</div>
        </div>
    </div>
    
    <div class="controls">
        <button onclick="controlWorld('start')">▶ 启动世界</button>
        <button onclick="controlWorld('pause')">⏸ 暂停</button>
        <button onclick="controlWorld('resume')">▶ 恢复</button>
        <button onclick="controlWorld('reset')" class="secondary">↺ 重置</button>
        <button onclick="initWorld()" class="secondary">🐟 初始化鱼缸</button>
    </div>
    
    <div class="container">
        <div class="panel">
            <h2>🗺️ 世界地图</h2>
            <canvas id="world-canvas" width="600" height="400"></canvas>
            <div style="margin-top: 10px; font-size: 12px; color: #888;">
                🔴 大鱼（捕食者）| 🟢 小鱼（猎物）| 圆圈大小 = 体积
            </div>
        </div>
        
        <div class="panel">
            <h2>👤 角色状态</h2>
            <div class="agent-list" id="agent-list">
                <p style="color: #666;">暂无角色，点击"初始化鱼缸"开始</p>
            </div>
        </div>
    </div>
    
    <div class="container" style="margin-top: 20px;">
        <div class="panel">
            <h2>📜 最近事件</h2>
            <div class="events" id="events">
                <p style="color: #666;">等待世界启动...</p>
            </div>
        </div>
        
        <div class="panel">
            <h2>💬 角色控制</h2>
            <div id="control-panel">
                <p style="color: #666;">选择一个角色进行控制</p>
            </div>
        </div>
    </div>
    
    <div class="philosophy">
        <h3>🧠 构建理念</h3>
        <p><strong>物理公平性：</strong>所有角色共享相同的硅基物理定律，不存在"行动点"等抽象货币。移动距离 = 速度 × 时间，这是刚性约束。</p>
        <p><strong>准实时制：</strong>世界以固定tick推进，物理定律自然处理碰撞，无需外部仲裁。时间对所有角色一视同仁。</p>
        <p><strong>涌现观察：</strong>我们观察简单规则产生的复杂行为，而非设计预设的剧本。</p>
        <p><strong>5层记忆：</strong>L0状态 → L1情境 → L2习惯 → L3认知 → L4核心，高层记忆指导低层决策。</p>
    </div>
    
    <script>
        let selectedAgent = null;
        
        // 初始化画布
        const canvas = document.getElementById('world-canvas');
        const ctx = canvas.getContext('2d');
        
        async function updateState() {
            try {
                const response = await fetch('/api/state');
                const data = await response.json();
                
                // 更新状态显示
                document.getElementById('virtual-time').textContent = Math.floor(data.virtual_time);
                document.getElementById('tick-count').textContent = data.tick;
                document.getElementById('agent-count').textContent = Object.values(data.agents).filter(a => a.body.alive).length;
                document.getElementById('collision-count').textContent = data.stats.collisions;
                
                // 绘制世界
                drawWorld(data);
                
                // 更新角色列表
                updateAgentList(data.agents);
                
                // 更新事件
                updateEvents(data.events);
                
            } catch (e) {
                console.error('更新状态失败:', e);
            }
        }
        
        function drawWorld(data) {
            const width = canvas.width;
            const height = canvas.height;
            const worldW = data.world_size.width;
            const worldH = data.world_size.height;
            
            // 清空画布
            ctx.fillStyle = '#0d1b2a';
            ctx.fillRect(0, 0, width, height);
            
            // 绘制网格
            ctx.strokeStyle = '#1a3a5c';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 10; i++) {
                const x = (i / 10) * width;
                const y = (i / 10) * height;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
            
            // 绘制角色
            for (const [id, agent] of Object.entries(data.agents)) {
                const x = (agent.body.position.x / worldW) * width;
                const y = (agent.body.position.y / worldH) * height;
                const radius = agent.body.radius * 3;  // 放大显示
                
                // 根据角色类型着色
                if (agent.role === 'predator') {
                    ctx.fillStyle = agent.body.energy > 30 ? '#ff4444' : '#ff8888';
                } else {
                    ctx.fillStyle = agent.body.energy > 30 ? '#44ff44' : '#88ff88';
                }
                
                // 绘制圆
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
                
                // 绘制速度方向
                if (agent.body.speed > 0.1) {
                    const vx = agent.body.velocity.x * 5;
                    const vy = agent.body.velocity.y * 5;
                    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + vx, y + vy);
                    ctx.stroke();
                }
                
                // 绘制名称
                ctx.fillStyle = '#fff';
                ctx.font = '12px sans-serif';
                ctx.fillText(agent.name, x - 20, y - radius - 5);
                
                // 高亮选中角色
                if (selectedAgent === id) {
                    ctx.strokeStyle = '#ffff00';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }
        
        function updateAgentList(agents) {
            const list = document.getElementById('agent-list');
            let html = '';
            
            for (const [id, agent] of Object.entries(agents)) {
                const roleClass = agent.role;
                const status = agent.body.alive ? 
                    `能量:${Math.floor(agent.body.energy)} 速度:${agent.body.speed.toFixed(1)}` : 
                    '<span style="color:#ff4444">已死亡</span>';
                
                html += `
                    <div class="agent-card ${roleClass}" onclick="selectAgent('${id}')" style="cursor:pointer;">
                        <div class="agent-name">${agent.name} ${agent.user_controlled ? '👤' : '🤖'}</div>
                        <div class="agent-info">
                            类型: ${agent.role === 'predator' ? '大鱼(捕食者)' : '小鱼(猎物)'} | 
                            位置: (${agent.body.position.x.toFixed(1)}, ${agent.body.position.y.toFixed(1)}) | 
                            ${status}
                        </div>
                    </div>
                `;
            }
            
            list.innerHTML = html || '<p style="color: #666;">暂无角色</p>';
        }
        
        function updateEvents(events) {
            const eventsDiv = document.getElementById('events');
            if (events.length === 0) return;
            
            const html = events.slice().reverse().map(e => {
                const time = Math.floor(e.time);
                let desc = '';
                if (e.type === 'collision') {
                    desc = `💥 ${e.data.body_a} 与 ${e.data.body_b} 碰撞`;
                } else if (e.type === 'spawn') {
                    desc = `✨ ${e.data.body_id} 诞生`;
                } else if (e.type === 'death') {
                    desc = `💀 ${e.data.name} 死亡`;
                } else {
                    desc = `${e.type}: ${JSON.stringify(e.data).slice(0, 50)}`;
                }
                return `<div class="event">[${time}] ${desc}</div>`;
            }).join('');
            
            eventsDiv.innerHTML = html;
        }
        
        function selectAgent(agentId) {
            selectedAgent = agentId;
            updateControlPanel();
        }
        
        function updateControlPanel() {
            const panel = document.getElementById('control-panel');
            if (!selectedAgent) {
                panel.innerHTML = '<p style="color: #666;">点击上方角色卡片选择</p>';
                return;
            }
            
            panel.innerHTML = `
                <p>选中角色: <strong>${selectedAgent}</strong></p>
                <div style="margin: 10px 0;">
                    <button onclick="toggleControl('${selectedAgent}')">切换用户控制</button>
                </div>
                <div class="command-box">
                    <input type="text" id="command-input" placeholder="输入命令：向左、向右、加速、休息..." 
                           onkeypress="if(event.key==='Enter')sendCommand('${selectedAgent}')">
                    <button onclick="sendCommand('${selectedAgent}')">发送</button>
                </div>
                <p style="font-size: 12px; color: #888;">支持的命令：向左/右/上/下游、加速、减速、休息</p>
            `;
        }
        
        async function controlWorld(action) {
            await fetch(`/api/control/${action}`, {method: 'POST'});
        }
        
        async function initWorld() {
            await fetch('/api/init', {method: 'POST'});
        }
        
        async function toggleControl(agentId) {
            await fetch(`/api/agent/${agentId}/toggle_control`, {method: 'POST'});
        }
        
        async function sendCommand(agentId) {
            const input = document.getElementById('command-input');
            const command = input.value.trim();
            if (!command) return;
            
            await fetch(`/api/agent/${agentId}/command`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({command})
            });
            
            input.value = '';
        }
        
        // 定时更新
        setInterval(updateState, 500);  // 每500ms更新一次
        updateState();
    </script>
</body>
</html>
"""


@app.route('/')
def index():
    """主页面 - 监控面板"""
    return render_template_string(DASHBOARD_TEMPLATE)


@app.route('/api/state')
def get_state():
    """获取当前世界状态"""
    manager = get_world_manager()
    return jsonify(manager.get_current_state())


@app.route('/api/control/<action>', methods=['POST'])
def control_world(action):
    """控制世界（启动/暂停/恢复/重置）"""
    manager = get_world_manager()
    
    if action == 'start':
        manager.start()
        return jsonify({"status": "started"})
    elif action == 'pause':
        manager.pause()
        return jsonify({"status": "paused"})
    elif action == 'resume':
        manager.resume()
        return jsonify({"status": "resumed"})
    elif action == 'reset':
        manager.reset()
        return jsonify({"status": "reset"})
    
    return jsonify({"error": "unknown action"}), 400


@app.route('/api/init', methods=['POST'])
def init_world():
    """初始化鱼缸世界 - 创建大鱼和小鱼"""
    manager = get_world_manager()
    
    # 如果已有角色，先重置
    if manager.agents:
        manager.reset()
    
    # 创建大鱼（捕食者）
    manager.add_agent(
        agent_id="big-fish-1",
        name="大鱼",
        role="predator",
        x=30,
        y=50
    )
    
    # 创建小鱼（猎物）
    manager.add_agent(
        agent_id="small-fish-1",
        name="小鱼",
        role="prey",
        x=70,
        y=50
    )
    
    # 自动启动
    if not manager.running:
        manager.start()
    
    return jsonify({"status": "initialized", "agents": list(manager.agents.keys())})


@app.route('/api/agent/<agent_id>/command', methods=['POST'])
def send_command(agent_id):
    """向角色发送命令"""
    manager = get_world_manager()
    data = request.get_json()
    command = data.get('command', '')
    
    success = manager.send_command(agent_id, command)
    return jsonify({"success": success, "agent": agent_id, "command": command})


@app.route('/api/agent/<agent_id>/toggle_control', methods=['POST'])
def toggle_control(agent_id):
    """切换用户控制模式"""
    manager = get_world_manager()
    
    if agent_id in manager.agents:
        current = manager.agents[agent_id].user_controlled
        manager.toggle_user_control(agent_id, not current)
        return jsonify({"success": True, "user_controlled": not current})
    
    return jsonify({"success": False, "error": "agent not found"}), 404


@app.route('/api/agent/<agent_id>')
def get_agent(agent_id):
    """获取角色详细信息"""
    manager = get_world_manager()
    info = manager.get_agent_info(agent_id)
    if info:
        return jsonify(info)
    return jsonify({"error": "agent not found"}), 404


@app.route('/api/agent/<agent_id>/observation')
def get_observation(agent_id):
    """获取角色的观测视角"""
    manager = get_world_manager()
    obs = manager.get_observation_for_agent(agent_id)
    if obs:
        return jsonify(obs)
    return jsonify({"error": "agent not found"}), 404


def run_web_server(host='0.0.0.0', port=8080, debug=False):
    """启动Web服务器"""
    print(f"🌐 Silica World Web界面: http://{host}:{port}")
    app.run(host=host, port=port, debug=debug, use_reloader=False)


if __name__ == '__main__':
    run_web_server()
