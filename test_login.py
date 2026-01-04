import subprocess
import time

# Start server in background
server = subprocess.Popen(['python', 'run_server.py'])
time.sleep(5)

try:
    # Test with curl
    result = subprocess.run([
        'curl', '-X', 'POST',
        'http://127.0.0.1:8000/api/v1/login',
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