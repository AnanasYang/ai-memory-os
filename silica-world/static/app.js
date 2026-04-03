// Silica World - 前端应用

let selectedAgent = null;
let currentState = null;  // 保存当前状态
const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');

function showMessage(msg) {
    const el = document.getElementById('message');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 2000);
}

async function updateState() {
    try {
        const response = await fetch('/api/state');
        const data = await response.json();
        
        // 保存当前状态
        currentState = data;
        
        document.getElementById('virtual-time').textContent = Math.floor(data.virtual_time);
        document.getElementById('tick-count').textContent = data.tick;
        document.getElementById('agent-count').textContent = 
            Object.values(data.agents).filter(a => a.body.alive).length;
        document.getElementById('collision-count').textContent = data.stats.collisions;
        document.getElementById('food-count').textContent = data.food_count || 0;
        
        drawWorld(data);
        updateAgentList(data.agents);
        updateEvents(data.events);
        
        // 如果当前有选中的代理，更新控制面板
        if (selectedAgent) {
            updateControlPanel();
        }
    } catch (e) {
        console.error('更新失败:', e);
    }
}

function drawWorld(data) {
    const width = canvas.width;
    const height = canvas.height;
    const worldW = data.world_size.width;
    const worldH = data.world_size.height;
    
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, width, height);
    
    // 网格
    ctx.strokeStyle = '#1a3a5c';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * width;
        const y = (i / 10) * height;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    
    // 水藻（食物）
    if (data.foods) {
        for (const [id, food] of Object.entries(data.foods)) {
            const x = (food.position.x / worldW) * width;
            const y = (food.position.y / worldH) * height;
            const radius = food.radius * 5;
            
            // 水藻光晕效果
            ctx.fillStyle = 'rgba(100, 255, 100, 0.3)';
            ctx.beginPath();
            ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
            ctx.fill();
            
            // 水藻本体
            ctx.fillStyle = '#4aff4a';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // 角色
    for (const [id, agent] of Object.entries(data.agents)) {
        const x = (agent.body.position.x / worldW) * width;
        const y = (agent.body.position.y / worldH) * height;
        const radius = agent.body.radius * 4;
        
        ctx.fillStyle = agent.role === 'predator' ? 
            (agent.body.energy > 30 ? '#ff4444' : '#ff8888') :
            (agent.body.energy > 30 ? '#44ff44' : '#88ff88');
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (agent.body.speed > 0.1) {
            const vx = agent.body.velocity.x * 8;
            const vy = agent.body.velocity.y * 8;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + vx, y + vy);
            ctx.stroke();
        }
        
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(agent.name, x - 15, y - radius - 5);
        
        if (selectedAgent === id) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function updateAgentList(agents) {
    const list = document.getElementById('agent-list');
    let html = '';
    
    for (const [id, agent] of Object.entries(agents)) {
        const status = agent.body.alive ? 
            `能量:${Math.floor(agent.body.energy)} 速度:${agent.body.speed.toFixed(1)}` : 
            '<span style="color:#ff4444">已死亡</span>';
        
        // LLM大脑状态和战略
        let brainSection = '';
        if (agent.llm_brain) {
            const remaining = agent.llm_brain.remaining !== undefined ? agent.llm_brain.remaining : '?';
            const isThinking = agent.llm_brain.thinking;
            const intent = agent.llm_brain.current_intent || 'NONE';
            
            const thinkingStatus = isThinking ? 
                '<span style="color:#ffaa44;font-weight:bold;">🧠 正在思考...</span>' : 
                `<span style="color:#66aaff;">💭 ${intent}</span>`;
            
            brainSection = `
                <div style="background: #0d1b2a; padding: 8px; border-radius: 4px; margin-top: 6px; font-size: 12px; border-left: 3px solid #66aaff;">
                    <div style="margin-bottom: 4px;">${thinkingStatus}</div>
                    <div style="color: #888; font-size: 11px;">剩余思考: ${remaining}/15</div>
                </div>
            `;
        } else {
            brainSection = `
                <div style="background: #0d1b2a; padding: 8px; border-radius: 4px; margin-top: 6px; font-size: 12px; color: #888;">
                    💭 使用默认策略
                </div>
            `;
        }
        
        const userControlBadge = agent.user_controlled ? 
            '<span style="color: #4aff4a; font-weight: bold;">👤 用户控制</span>' : 
            '<span style="color: #888;">🤖 AI运行</span>';
        
        html += `<div class="agent-card ${agent.role}" onclick="selectAgent('${id}')" style="cursor: pointer; margin-bottom: 12px; padding: 12px; background: #1b3a5c; border-radius: 6px;">
            <div class="agent-name" style="font-weight: bold; margin-bottom: 4px;">${agent.name} ${userControlBadge}</div>
            <div class="agent-info" style="font-size: 12px; color: #ccc;">
                ${agent.role === 'predator' ? '🔴 大鱼(捕食者)' : '🟢 小鱼(猎物)'} | 
                📍 (${agent.body.position.x.toFixed(1)}, ${agent.body.position.y.toFixed(1)}) | ${status}
            </div>
            ${brainSection}
        </div>`;
    }
    
    list.innerHTML = html || '<p style="color: #666;">暂无角色</p>';
}

function updateEvents(events) {
    const div = document.getElementById('events');
    if (events.length === 0) {
        div.innerHTML = '<p style="color: #666;">暂无事件</p>';
        return;
    }
    
    const html = events.slice().reverse().map(e => {
        const time = Math.floor(e.time);
        let desc = '';
        let icon = '';
        
        switch(e.type) {
            case 'collision':
                icon = '💥';
                desc = `碰撞: ${e.data.body_a} vs ${e.data.body_b}`;
                break;
            case 'spawn':
                icon = '✨';
                desc = `诞生: ${e.data.body_id}`;
                break;
            case 'death':
                icon = '💀';
                desc = `死亡: ${e.data.name}`;
                break;
            case 'eat_food':
                icon = '🌿';
                desc = `${e.data.agent_id} 吃水藻 +${e.data.energy_gained}能量`;
                break;
            case 'predation':
                icon = '🍖';
                desc = `${e.data.predator_id} 吃掉 ${e.data.prey_id} +${e.data.energy_gained}能量`;
                break;
            case 'food_spawn':
                icon = '🌱';
                desc = `水藻生成 +${e.data.energy}`;
                break;
            case 'user_command':
                icon = '👤';
                desc = `${e.data.agent_name}: ${e.data.response || e.data.command}`;
                break;
            default:
                icon = '•';
                desc = `${e.type}`;
        }
        
        return `<div class="event" style="padding: 4px 0; border-bottom: 1px solid #1a3a5c; font-size: 12px;">
            <span style="color: #888;">[${time}]</span> ${icon} ${desc}
        </div>`;
    }).join('');
    
    div.innerHTML = html;
}

function selectAgent(agentId) {
    selectedAgent = agentId;
    updateControlPanel();
}

function updateControlPanel() {
    const panel = document.getElementById('control-panel');
    if (!selectedAgent) {
        panel.innerHTML = '<p style="color: #666; font-size: 13px;">点击角色卡片选择要控制的角色</p>';
        return;
    }
    
    // 从当前状态中查找选中的代理
    const agent = currentState && currentState.agents ? currentState.agents[selectedAgent] : null;
    
    let strategyInfo = '';
    let brainInfo = '';
    
    if (agent && agent.llm_brain) {
        const intent = agent.llm_brain.current_intent || 'NONE';
        const remaining = agent.llm_brain.remaining || 0;
        const isThinking = agent.llm_brain.thinking;
        
        strategyInfo = `
            <div style="background: #1a3a5c; padding: 8px; border-radius: 4px; margin: 10px 0; font-size: 12px;">
                <div><strong>🎯 当前战略:</strong> ${intent}</div>
                <div style="color: ${isThinking ? '#ffaa44' : '#66aaff'};">
                    ${isThinking ? '🧠 正在思考...' : '💭 战略缓存中'}
                </div>
            </div>
        `;
        
        brainInfo = `<div style="font-size: 11px; color: #888; margin-top: 5px;">
            剩余思考次数: ${remaining}/15
        </div>`;
    }
    
    const userControlStatus = agent && agent.user_controlled ? '👤 用户控制中' : '🤖 AI自主运行';
    
    panel.innerHTML = `
        <p style="font-size: 13px;">选中: <strong>${selectedAgent}</strong> 
            <span style="color: #66aaff;">(${userControlStatus})</span>
        </p>
        ${strategyInfo}
        <button onclick="toggleControl('${selectedAgent}')" style="margin: 5px 0;">
            ${agent && agent.user_controlled ? '释放控制(交还AI)' : '接管控制'}
        </button>
        <div class="command-box" style="margin-top: 10px;">
            <input type="text" id="cmd-input" placeholder="输入命令：向左、向右、加速、休息..." 
                   onkeypress="if(event.key==='Enter')sendCommand('${selectedAgent}')">
            <button onclick="sendCommand('${selectedAgent}')">发送</button>
        </div>
        <p style="font-size: 11px; color: #888;">支持：左/右/上/下游、加速、减速、休息</p>
        ${brainInfo}
    `;
}

async function controlWorld(action) {
    await fetch('/api/control/' + action, {method: 'POST'});
    showMessage('已' + action);
}

async function initWorld() {
    await fetch('/api/init', {method: 'POST'});
    showMessage('已初始化鱼缸');
}

async function toggleControl(agentId) {
    const response = await fetch('/api/agent/' + agentId + '/toggle_control', {method: 'POST'});
    const result = await response.json();
    
    if (result.success) {
        const status = result.controlled ? '👤 已接管控制' : '🤖 已释放控制';
        showMessage(status);
        
        // 立即更新控制面板
        updateControlPanel();
    }
}

async function sendCommand(agentId) {
    const input = document.getElementById('cmd-input');
    const cmd = input.value.trim();
    if (!cmd) return;
    
    const response = await fetch('/api/agent/' + agentId + '/command', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({command: cmd})
    });
    
    const result = await response.json();
    
    // 显示角色响应
    if (result.response) {
        showMessage(result.response);
    } else if (result.error) {
        showMessage('错误: ' + result.error);
    } else {
        showMessage('已发送: ' + cmd);
    }
    
    input.value = '';
}

// 启动自动更新
setInterval(updateState, 500);
updateState();
