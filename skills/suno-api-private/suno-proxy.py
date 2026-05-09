#!/usr/bin/env python3
"""
Suno API Proxy — lightweight Python server using direct JWT auth.
Handles: credits, generate, custom_generate, feed/status.

Token: JWT from /tmp/suno_cookie.txt
Base: https://studio-api.prod.suno.com

Usage:
  python3 suno-proxy.py          # starts on port 3002
  python3 suno-proxy.py --port 9000
"""

import sys, os, json, time, argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode

TOKEN_FILE = "/tmp/suno_cookie.txt"
STUDIO_API = "https://studio-api.prod.suno.com"
DEFAULT_MODEL = "chirp-fenix"  # v5.5

def get_token():
    with open(TOKEN_FILE) as f:
        t = f.read().strip()
    if t.startswith("eyJ"):
        return t
    # Old suno.py format: cookie string, extract JWT
    for part in t.split(";"):
        if "__session=" in part:
            return part.split("__session=")[1].strip()
    return t

def api_get(path, token=None):
    token = token or get_token()
    req = Request(f"{STUDIO_API}{path}", headers={
        "Authorization": f"Bearer {token}",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    })
    with urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def api_post(path, body, token=None):
    token = token or get_token()
    data = json.dumps(body).encode()
    req = Request(f"{STUDIO_API}{path}", data=data, headers={
        "Authorization": f"Bearer {token}",
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/json"
    })
    with urlopen(req, timeout=15) as r:
        return json.loads(r.read())

# ── Routes ────────────────────────────────────────────────────────────────────

def handle_get_limit(token):
    info = api_get("/api/billing/info/", token)
    return {
        "credits_left": info.get("total_credits_left"),
        "period": info.get("period"),
        "monthly_limit": info.get("monthly_limit"),
        "monthly_usage": info.get("monthly_usage"),
        "renews_on": info.get("renews_on", "").split("T")[0]
    }

def handle_generate(body, token):
    payload = {
        "gpt_description_prompt": body.get("gpt_description_prompt", ""),
        "make_instrumental": body.get("make_instrumental", True),
        "mv": body.get("model", DEFAULT_MODEL),
        "prompt": body.get("prompt", ""),
        "tags": body.get("tags", ""),
    }
    if body.get("title"):
        payload["title"] = body["title"]
    if body.get("tags"):
        payload["gpt_description_prompt"] = ""
    
    resp = api_post("/api/generate/v2/", payload, token)
    clips = resp if isinstance(resp, list) else resp.get("clips", [resp])
    return [{"id": c["id"], "status": c.get("status","queued"), "title": c.get("title","")} for c in clips]

def handle_custom_generate(body, token):
    payload = {
        "gpt_description_prompt": body.get("gpt_description_prompt", ""),
        "make_instrumental": body.get("make_instrumental", True),
        "mv": body.get("model", DEFAULT_MODEL),
        "prompt": body.get("prompt", ""),
        "tags": body.get("tags", ""),
        "title": body.get("title", ""),
    }
    if body.get("tags"):
        payload["gpt_description_prompt"] = ""
    
    resp = api_post("/api/generate/v2/", payload, token)
    clips = resp if isinstance(resp, list) else resp.get("clips", [resp])
    return [{"id": c["id"], "status": c.get("status","queued"), "title": c.get("title","")} for c in clips]

def handle_get(ids, token):
    resp = api_get(f"/api/feed/?ids={ids}", token)
    clips = resp if isinstance(resp, list) else [resp]
    result = []
    for c in clips:
        result.append({
            "id": c.get("id"),
            "status": c.get("status"),
            "title": c.get("title",""),
            "audio_url": c.get("audio_url",""),
            "image_url": c.get("image_url",""),
            "tags": c.get("metadata",{}).get("tags",""),
            "prompt": c.get("metadata",{}).get("prompt",""),
            "model_name": c.get("model_name",""),
            "duration": c.get("metadata",{}).get("duration",""),
            "error_message": c.get("metadata",{}).get("error_message",""),
        })
    return result

def handle_feed(token):
    resp = api_get("/api/feed/v2?page=0", token)
    clips = resp.get("clips", [])
    result = []
    for c in clips:
        result.append({
            "id": c.get("id"),
            "status": c.get("status"),
            "title": c.get("title",""),
            "audio_url": c.get("audio_url",""),
            "image_url": c.get("image_url",""),
            "tags": c.get("metadata",{}).get("tags",""),
            "created_at": c.get("created_at",""),
        })
    return result

def handle_generate_lyrics(body, token):
    payload = {
        "prompt": body.get("prompt", ""),
        "gpt_description_prompt": body.get("gpt_description_prompt", ""),
        "make_instrumental": body.get("make_instrumental", True),
        "mv": body.get("model", DEFAULT_MODEL),
    }
    resp = api_post("/api/generate/v2/", payload, token)
    clips = resp if isinstance(resp, list) else resp.get("clips", [resp])
    return [{"id": c["id"], "status": c.get("status","queued"), "title": c.get("title","")} for c in clips]


# ── HTTP Server ────────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            token = get_token()
            if self.path == "/api/get_limit" or self.path == "/api/limit":
                out = handle_get_limit(token)
            elif self.path.startswith("/api/get"):
                ids = parse_qs(self.path.split("?")[1]).get("ids",[""])[0]
                out = handle_get(ids, token)
            elif self.path == "/api/feed" or self.path == "/api/library":
                out = handle_feed(token)
            elif self.path == "/api/health":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode())
                return
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'{"error": "not found"}')
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(out).encode())

        except HTTPError as e:
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            err_body = e.read()
            try:
                err_json = json.loads(err_body)
                self.wfile.write(json.dumps({"error": err_json}).encode())
            except:
                self.wfile.write(json.dumps({"error": err_body.decode()}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_POST(self):
        try:
            token = get_token()
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length > 0 else {}

            if self.path == "/api/generate":
                out = handle_generate(body, token)
            elif self.path == "/api/custom_generate":
                out = handle_custom_generate(body, token)
            elif self.path == "/api/generate_lyrics":
                out = handle_generate_lyrics(body, token)
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'{"error": "not found"}')
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(out).encode())

        except HTTPError as e:
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            err_body = e.read()
            try:
                err_json = json.loads(err_body)
                self.wfile.write(json.dumps({"error": err_json}).encode())
            except:
                self.wfile.write(json.dumps({"error": err_body.decode()}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def log_message(self, format, *args):
        pass  # silence default logging

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=3002)
    args = parser.parse_args()

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    print(f"Suno Proxy listening on :{args.port}")
    server.serve_forever()

if __name__ == "__main__":
    main()