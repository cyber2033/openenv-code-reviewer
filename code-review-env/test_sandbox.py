from server.sandbox import SecuritySandbox

def test_sandbox():
    sandbox = SecuritySandbox(timeout=2)
    
    print("Test 1: Simple code execution")
    result = sandbox.execute_python_code("print('Hello from the security sandbox!')")
    print(f"Status: {result['status']}, Output: {result['stdout'].strip()}")
    
    print("\nTest 2: Infinite loop (Timeout)")
    result = sandbox.execute_python_code("while True: pass")
    print(f"Status: {result['status']}, Duration: {result['duration']:.2f}s")
    
    print("\nTest 3: Error handling")
    result = sandbox.execute_python_code("1 / 0")
    print(f"Status: {result['status']}, Error: {result['stderr'].strip()}")

if __name__ == "__main__":
    test_sandbox()
