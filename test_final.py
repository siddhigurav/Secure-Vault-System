import subprocess
import time

# Start server with run_server.py
server = subprocess.Popen(['python', 'run_server.py'])
time.sleep(5)

try:
    # Test login
    result = subprocess.run([
        'curl', '-X', 'POST',
        'http://127.0.0.1:8000/api/v1/login',
        '-H', 'Content-Type: application/json',
        '-d', '{"username":"admin","password":"admin123"}'
    ], capture_output=True, text=True)

    print('Exit code:', result.returncode)
    print('Response:', result.stdout.strip())

except Exception as e:
    print('Error:', e)
finally:
    server.terminate()