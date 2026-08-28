from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from collections import defaultdict, deque
from threading import Lock
from time import monotonic


WINDOW_SECONDS = 2
REQUEST_LIMIT = 5
requests_by_tenant = defaultdict(deque)
requests_lock = Lock()


def rate_limited(tenant):
    now = monotonic()
    with requests_lock:
        requests = requests_by_tenant[tenant]
        while requests and requests[0] <= now - WINDOW_SECONDS:
            requests.popleft()
        if len(requests) >= REQUEST_LIMIT:
            return True
        requests.append(now)
        return False


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        token_ok = self.headers.get("authorization") == "Bearer lab-token"
        tenant = self.headers.get("x-tenant-id", "")
        tenant_ok = tenant == "team-a"
        if token_ok and tenant_ok:
            if self.headers.get("x-enable-rate-limit") == "true" and rate_limited(tenant):
                self.send_response(429)
                self.send_header("content-type", "application/json")
                self.send_header("retry-after", str(WINDOW_SECONDS))
                self.end_headers()
                self.wfile.write(b'{"allowed":false,"reason":"tenant rate exceeded"}')
                return
            self.send_response(200)
            self.send_header("x-current-user", "admin")
            self.end_headers()
            self.wfile.write(b'{"allowed":true}')
            return
        self.send_response(403)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"allowed":false,"reason":"token or tenant rejected"}')

    def log_message(self, message, *args):
        print(f"authz: {message % args}", flush=True)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 9000), Handler).serve_forever()
