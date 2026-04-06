import http.server
import socketserver
import json
import os
import subprocess
import urllib.request
import urllib.parse
import re

PORT = 8000
CONTEXTS_DIR = os.path.join(os.path.dirname(__file__), "contexts")
UI_DIR = os.path.join(os.path.dirname(__file__), "..", "ui")

def strip_html(html):
    """Strip HTML tags and collapse whitespace."""
    text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:4000]  # Limit to 4000 chars to stay within context window

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.abspath(UI_DIR), **kwargs)

    def send_json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        # Context file retrieval
        if self.path.startswith("/api/context/"):
            session_id = self.path.split("/")[-1]
            file_path = os.path.join(CONTEXTS_DIR, f"{session_id}.json")
            if os.path.exists(file_path):
                with open(file_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_response(404)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{}')

        # URL fetcher tool
        elif self.path.startswith("/api/fetch_url"):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            target_url = params.get('url', [None])[0]
            if not target_url:
                self.send_json(400, {"error": "Missing url parameter"})
                return
            try:
                req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    raw_html = resp.read().decode('utf-8', errors='ignore')
                text = strip_html(raw_html)
                self.send_json(200, {"url": target_url, "content": text})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        else:
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length else b''

        # Context file save
        if self.path.startswith("/api/context/"):
            session_id = self.path.split("/")[-1]
            file_path = os.path.join(CONTEXTS_DIR, f"{session_id}.json")
            os.makedirs(CONTEXTS_DIR, exist_ok=True)
            with open(file_path, 'wb') as f:
                f.write(post_data)
            self.send_json(200, {"status": "success"})

        # Python code execution sandbox
        elif self.path == "/api/run_python":
            try:
                payload = json.loads(post_data)
                code = payload.get("code", "")
                result = subprocess.run(
                    ["python3", "-c", code],
                    capture_output=True, text=True, timeout=5
                )
                output = result.stdout or result.stderr or "(no output)"
                self.send_json(200, {"output": output[:2000]})
            except subprocess.TimeoutExpired:
                self.send_json(200, {"output": "Error: Code execution timed out (5s limit)"})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        if self.path.startswith("/api/context/"):
            session_id = self.path.split("/")[-1]
            file_path = os.path.join(CONTEXTS_DIR, f"{session_id}.json")
            if os.path.exists(file_path):
                os.remove(file_path)
            self.send_json(200, {"status": "deleted"})
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        print(f"[server] {self.address_string()} - {format % args}")

print(f"✅ Gemma AI Python API Server running on http://localhost:{PORT}")
with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    httpd.allow_reuse_address = True
    httpd.serve_forever()
