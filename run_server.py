#!/usr/bin/env python3
"""
Secure Vault System - Production Server Runner
"""
import uvicorn
import os
from pathlib import Path

def main():
    """Start the FastAPI server"""
    try:
        # Change to the project root directory
        project_root = Path(__file__).parent
        os.chdir(project_root)

        print("🚀 Starting Secure Vault System...")

        uvicorn.run(
            "app.main:app",
            host="127.0.0.1",
            port=8002,  # Changed from 8001 to 8002
            reload=False,
            log_level="info"
        )
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()