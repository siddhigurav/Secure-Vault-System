import subprocess
import time

# Start server with minimal main
server = subprocess.Popen(['python', '-m', 'uvicorn', 'app.main_minimal:app', '--host', '127.0.0.1', '--port', '8001'])
time.sleep(3)

try:
    # Test with curl
    result = subprocess.run([
        'curl', '-X', 'POST',
        'http://127.0.0.1:8001/api/v1/login',
        '-H', 'Content-Type: application/json',
        '-d', '{"username":"admin","password":"admin123"}'
    ], capture_output=True, text=True)

    print('Curl exit code:', result.returncode)
    print('Curl stdout:', result.stdout)
    if result.stderr:
        print('Curl stderr:', result.stderr)

except Exception as e:
    print('Error:', e)
finally:
    server.terminate()