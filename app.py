"""Dependency-free local dashboard server for Ghost Data Still Exists."""
from __future__ import annotations
import csv
import json
import mimetypes
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

ROOT = Path(__file__).resolve().parents[1]
WEB = Path(__file__).resolve().parent
OUTPUT_CSV = ROOT / "output.csv"
REQUESTS_CSV = ROOT / "dataset" / "deletion_requests.csv"
HOST, PORT = "127.0.0.1", 5000


def read_csv(path: Path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_cases():
    requests_by_id = {r.get("case_id", ""): r for r in read_csv(REQUESTS_CSV)}
    cases = []
    for row in read_csv(OUTPUT_CSV):
        case_id = row.get("case_id", "")
        source = requests_by_id.get(case_id, {})
        try:
            steps = json.loads(row.get("steps_json", "[]") or "[]")
            if not isinstance(steps, list): steps = []
        except (ValueError, TypeError):
            steps = []
        ops = Counter(s.get("operation", "") for s in steps if isinstance(s, dict))
        cases.append({
            "case_id": case_id, "deletion_status": row.get("deletion_status", "UNKNOWN"),
            "email": source.get("email", ""), "requested_at": source.get("requested_at", ""),
            "reported_status": source.get("reported_status", ""), "reported_at": source.get("reported_at", ""),
            "audit_at": source.get("audit_at", ""), "request_text": source.get("request_text", ""),
            "step_count": len(steps), "has_findings": any(s.get("phase") == "FINDING" for s in steps if isinstance(s, dict)),
            "has_remediation": any(s.get("phase") == "REMEDIATION" for s in steps if isinstance(s, dict)),
            "has_verification": any(s.get("phase") == "VERIFICATION" for s in steps if isinstance(s, dict)),
            "operations": dict(ops), "steps": steps,
        })
    return sorted(cases, key=lambda c: c["case_id"])


def get_summary(cases):
    statuses = Counter(c["deletion_status"] for c in cases)
    operation_counts, phase_counts = Counter(), Counter()
    for c in cases:
        operation_counts.update(c["operations"])
        for step in c["steps"]:
            if isinstance(step, dict): phase_counts.update([step.get("phase", "UNKNOWN")])
    return {
        "total_requests": len(cases),
        "statuses": {k: statuses.get(k, 0) for k in ["COMPLETE", "INCOMPLETE", "NOT_APPLICABLE"]},
        "operation_counts": dict(operation_counts), "phase_counts": dict(phase_counts),
        "cases_with_findings": sum(c["has_findings"] for c in cases),
        "cases_with_remediation": sum(c["has_remediation"] for c in cases),
        "cases_with_verification": sum(c["has_verification"] for c in cases),
        "data_available": OUTPUT_CSV.exists() and REQUESTS_CSV.exists(),
    }


class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[dashboard] " + fmt % args)

    def send_bytes(self, body: bytes, content_type="text/plain; charset=utf-8", status=200, extra_headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for key, value in extra_headers.items(): self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, obj, status=200):
        self.send_bytes(json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", status)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/":
            self.serve_file(WEB / "templates" / "index.html")
        elif path in ("/static/style.css", "/static/app.js"):
            name = path.rsplit("/", 1)[1]
            self.serve_file(WEB / "static" / name)
        elif path == "/api/summary":
            self.send_json(get_summary(load_cases()))
        elif path == "/api/cases":
            params = parse_qs(parsed.query)
            q = params.get("q", [""])[0].strip().casefold()
            status = params.get("status", ["ALL"])[0].upper()
            cases = load_cases()
            if status != "ALL": cases = [c for c in cases if c["deletion_status"] == status]
            if q: cases = [c for c in cases if q in c["case_id"].casefold() or q in c["email"].casefold() or q in c["reported_status"].casefold()]
            public_cases = [{k: v for k, v in c.items() if k not in ("steps", "operations", "request_text")} for c in cases[:500]]
            self.send_json({"count": len(cases), "cases": public_cases})
        elif path.startswith("/api/cases/"):
            case_id = unquote(path[len("/api/cases/"):])
            case = next((c for c in load_cases() if c["case_id"] == case_id), None)
            if case is None: self.send_json({"error": "Case not found"}, 404)
            else: self.send_json(case)
        elif path == "/download/output.csv":
            if not OUTPUT_CSV.exists(): self.send_bytes(b"output.csv not found. Run python code/main.py first.", status=404)
            else: self.serve_file(OUTPUT_CSV, attachment=True)
        else:
            self.send_bytes(b"Not found", status=404)

    def serve_file(self, path: Path, attachment=False):
        if not path.is_file():
            self.send_bytes(b"File not found", status=404); return
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        headers = {"Content-Disposition": f'attachment; filename="{path.name}"'} if attachment else None
        self.send_bytes(path.read_bytes(), ctype, extra_headers=headers)


def main():
    if not REQUESTS_CSV.exists() or not OUTPUT_CSV.exists():
        print("Warning: dataset/deletion_requests.csv or output.csv is missing.")
        print("Run this from the full repository, and generate output with: python code/main.py")
    server = ThreadingHTTPServer((HOST, PORT), DashboardHandler)
    print("Ghost Data Still Exists dashboard is running.")
    print(f"Open http://{HOST}:{PORT} in your browser.")
    print("This server is local-only. Press Ctrl+C to stop.")
    try: server.serve_forever()
    except KeyboardInterrupt: print("\nStopping dashboard…")
    finally: server.server_close()


if __name__ == "__main__":
    main()
