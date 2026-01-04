#!/usr/bin/env python3
"""
Secure Vault System - Development Runner
Starts both backend and frontend servers
"""
import subprocess
import sys
import os
import signal
import time
from pathlib import Path

def run_backend():
    """Start the FastAPI backend"""
    print("🚀 Starting backend server...")
    backend_cmd = [
        sys.executable, "-m", "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", "8000",
        "--reload",
        "--log-level", "info"
    ]
    return subprocess.Popen(backend_cmd, cwd=Path(__file__).parent)

def run_frontend():
    """Serve static HTML/CSS/JS frontend"""
    import http.server
    import socketserver
    import threading
    import os

    frontend_dir = Path(__file__).parent / "static"
    if not frontend_dir.exists():
        print("❌ Static frontend directory not found.")
        return None

    # Change to frontend directory
    os.chdir(frontend_dir)

    class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            # Suppress log messages
            pass

    def serve_frontend():
        with socketserver.TCPServer(("", 3000), QuietHTTPRequestHandler) as httpd:
            print("🎨 Frontend server running on http://127.0.0.1:3000")
            httpd.serve_forever()

    # Start frontend server in a separate thread
    frontend_thread = threading.Thread(target=serve_frontend, daemon=True)
    frontend_thread.start()

    return frontend_thread

def main():
    """Run both servers"""
    print("🔐 Secure Vault System - Development Mode")
    print("=" * 50)

    # Start backend
    backend_process = run_backend()
    if backend_process is None:
        print("❌ Failed to start backend")
        return 1

    # Wait a bit for backend to start
    time.sleep(2)

    # Start frontend
    frontend_process = run_frontend()
    if frontend_process is None:
        print("❌ Failed to start frontend")
        backend_process.terminate()
        return 1

    print("\n✅ Both servers started successfully!")
    print("📊 Backend API: http://127.0.0.1:8000")
    print("🎨 Frontend UI:  http://127.0.0.1:3000")
    print("\nPress Ctrl+C to stop both servers")

    def signal_handler(sig, frame):
        print("\n🛑 Stopping servers...")
        backend_process.terminate()
        # For thread, we can't terminate it cleanly, but it will stop when the process exits
        backend_process.wait()
        print("✅ Servers stopped")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    # Wait for processes
    try:
        backend_process.wait()
    except KeyboardInterrupt:
        signal_handler(signal.SIGINT, None)

if __name__ == "__main__":
    sys.exit(main())