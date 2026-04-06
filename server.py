import http.server
import socketserver
import json
import os
import shutil

PORT = 8000
CONTEXTS_DIR = "contexts"

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/context/"):
            session_id = self.path.split("/")[-1]
            file_path = os.path.join(CONTEXTS_DIR, f"{session_id}.json")
            if os.path.exists(file_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'{}')
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/context/"):
            session_id = self.path.split("/")[-1]
            file_path = os.path.join(CONTEXTS_DIR, f"{session_id}.json")
            
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            os.makedirs(CONTEXTS_DIR, exist_ok=True)
            with open(file_path, 'wb') as f:
                f.write(post_data)
                
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"success"}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        if self.path.startswith("/api/context/"):
            session_id = self.path.split("/")[-1]
            file_path = os.path.join(CONTEXTS_DIR, f"{session_id}.json")
            if os.path.exists(file_path):
                os.remove(file_path)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"deleted"}')
        else:
            self.send_response(404)
            self.end_headers()

print(f"Starting Python API Server on port {PORT}...")
with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    httpd.serve_forever()
