import subprocess
import time

# Start server directly with uvicorn
server = subprocess.Popen(['python', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8002'])
time.sleep(3)

try:
    # Test login
    result = subprocess.run([
        'curl', '-X', 'POST',
        'http://127.0.0.1:8002/api/v1/login',
        '-H', 'Content-Type: application/json',
        '-d', '{"username":"admin","password":"admin123"}'
    ], capture_output=True, text=True)

    print('Exit code:', result.returncode)
    print('Response:', result.stdout.strip())

except Exception as e:
    print('Error:', e)
finally:
    server.terminate()