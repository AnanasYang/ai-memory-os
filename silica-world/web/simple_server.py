"""
Silica World - Simple HTTP Server (No Flask Required)
使用Python内置库的轻量级Web服务器 - 静态文件分离版
"""

import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os
import mimetypes

# 尝试导入项目模块
try:
    from core.manager import get_world_manager, reset_world_manager
except ImportError as e:
    print(f"导入错误: {e}")
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from core.manager import get_world_manager, reset_world_manager


# 获取项目根目录
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(PROJECT_ROOT, 'static')
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, 'templates')

# 全局管理器引用
_manager = None

def get_manager():
    global _manager
    if _manager is None:
        _manager = get_world_manager()
    return _manager


class RequestHandler(BaseHTTPRequestHandler):
    """HTTP请求处理器 - 支持静态文件"""
    
    def do_GET(self):
        """处理GET请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == '/' or path == '/index.html':
            self._serve_file(os.path.join(TEMPLATES_DIR, 'index.html'), 'text/html')
        elif path.startswith('/static/'):
            # 服务静态文件
            file_path = os.path.join(PROJECT_ROOT, path.lstrip('/'))
            self._serve_static_file(file_path)
        elif path == '/api/state':
            self._serve_api_state()
        else:
            self._serve_404()
    
    def do_POST(self):
        """处理POST请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path.startswith('/api/control/'):
            action = path.split('/')[-1]
            self._handle_control(action)
        elif path == '/api/init':
            self._handle_init()
        elif path.startswith('/api/agent/') and path.endswith('/command'):
            agent_id = path.split('/')[3]
            self._handle_command(agent_id)
        elif path.startswith('/api/agent/') and path.endswith('/toggle_control'):
            agent_id = path.split('/')[3]
            self._handle_toggle_control(agent_id)
        else:
            self._serve_404()
    
    def _serve_file(self, file_path, content_type):
        """从文件系统服务文件"""
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type + '; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self._serve_error(404, f"File not found: {file_path}")
        except Exception as e:
            self._serve_error(500, str(e))
    
    def _serve_static_file(self, file_path):
        """服务静态文件（CSS, JS等）"""
        # 安全检查：确保路径在项目目录内
        real_path = os.path.realpath(file_path)
        real_static = os.path.realpath(STATIC_DIR)
        
        if not real_path.startswith(real_static):
            self._serve_404()
            return
        
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            self._serve_404()
            return
        
        # 根据扩展名确定Content-Type
        content_type, _ = mimetypes.guess_type(file_path)
        if content_type is None:
            content_type = 'application/octet-stream'
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self._serve_error(500, str(e))
    
    def _serve_api_state(self):
        """服务API状态"""
        manager = get_manager()
        state = manager.get_current_state()
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(state).encode())
    
    def _handle_control(self, action):
        """处理世界控制"""
        manager = get_manager()
        
        if action == 'start':
            manager.start()
        elif action == 'pause':
            manager.pause()
        elif action == 'resume':
            manager.resume()
        elif action == 'reset':
            manager.reset()
        
        self._serve_json({"status": action})
    
    def _handle_init(self):
        """初始化世界"""
        manager = get_manager()
        
        if manager.agents:
            manager.reset()
        
        manager.add_agent("big-fish-1", "大鱼", "predator", x=30, y=50)
        manager.add_agent("small-fish-1", "小鱼", "prey", x=70, y=50)
        
        # 添加初始水藻
        for i in range(5):
            manager.world.add_food()
        
        if not manager.running:
            manager.start()
        
        self._serve_json({"status": "initialized", "food_count": 5})
    
    def _handle_command(self, agent_id):
        """处理角色命令"""
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode()
        data = json.loads(body)
        command = data.get('command', '')
        
        manager = get_manager()
        result = manager.send_command(agent_id, command)
        
        self._serve_json(result)
    
    def _handle_toggle_control(self, agent_id):
        """切换用户控制"""
        manager = get_manager()
        
        if agent_id in manager.agents:
            current = manager.agents[agent_id].user_controlled
            manager.toggle_user_control(agent_id, not current)
            self._serve_json({"success": True, "controlled": not current})
        else:
            self._serve_json({"success": False}, 404)
    
    def _serve_json(self, data, status=200):
        """服务JSON响应"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def _serve_error(self, code, message):
        """服务错误响应"""
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode())
    
    def _serve_404(self):
        """404响应"""
        self._serve_error(404, "not found")
    
    def log_message(self, format, *args):
        """简化日志"""
        pass  # 静默模式，减少输出


def run_server(port=8080):
    """运行服务器"""
    # 确保静态文件目录存在
    os.makedirs(STATIC_DIR, exist_ok=True)
    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    
    # 检查关键文件是否存在
    index_html = os.path.join(TEMPLATES_DIR, 'index.html')
    style_css = os.path.join(STATIC_DIR, 'style.css')
    app_js = os.path.join(STATIC_DIR, 'app.js')
    
    if not os.path.exists(index_html):
        print(f"⚠️ 警告: 找不到 {index_html}")
    if not os.path.exists(style_css):
        print(f"⚠️ 警告: 找不到 {style_css}")
    if not os.path.exists(app_js):
        print(f"⚠️ 警告: 找不到 {app_js}")
    
    server = HTTPServer(('0.0.0.0', port), RequestHandler)
    print(f"🌐 Silica World 已启动: http://localhost:{port}")
    print(f"   物理公平 · 准实时制 · 涌现观察")
    print(f"   静态文件: {STATIC_DIR}")
    print(f"   模板文件: {TEMPLATES_DIR}\n")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 关闭服务器...")
        manager = get_manager()
        manager.stop()
        server.shutdown()


if __name__ == '__main__':
    run_server()
