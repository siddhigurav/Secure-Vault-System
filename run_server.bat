@echo off
cd /d C:\Users\SATISH\OneDrive\Desktop\Secure-Vault-System
C:\Users\SATISH\OneDrive\Desktop\Secure-Vault-System\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --access-log --log-level info
pause