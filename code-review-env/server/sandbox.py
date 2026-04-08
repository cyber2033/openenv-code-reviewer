import subprocess
import signal
import os
import sys
import tempfile
import time
from typing import Dict, Any, Optional

class SecuritySandbox:
    """
    A sample security sandbox for executing untrusted code segments.
    In a production hackathon environment, this would ideally use Docker containers.
    This version uses restricted subprocesses with timeouts.
    """

    def __init__(self, timeout: int = 5, memory_limit_mb: int = 128):
        self.timeout = timeout
        self.memory_limit = memory_limit_mb

    def execute_python_code(self, code: str) -> Dict[str, Any]:
        """
        Executes Python code in a separate process and returns the results.
        """
        # Create a temporary file for the code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as tf:
            tf.write(code)
            temp_file_path = tf.name

        start_time = time.time()
        result = {
            "stdout": "",
            "stderr": "",
            "exit_code": -1,
            "duration": 0,
            "status": "unknown"
        }

        try:
            # On Linux/Unix, we could use preexec_fn for more isolation (resource limits)
            # On Windows, we rely on basic subprocess management
            process = subprocess.Popen(
                [sys.executable, temp_file_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                # Using shell=False is safer
                shell=False 
            )

            try:
                stdout, stderr = process.communicate(timeout=self.timeout)
                result["stdout"] = stdout
                result["stderr"] = stderr
                result["exit_code"] = process.returncode
                result["status"] = "success" if process.returncode == 0 else "error"
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate()
                result["stdout"] = stdout
                result["stderr"] = stderr
                result["status"] = "timeout"
                result["exit_code"] = -1
        except Exception as e:
            result["status"] = "exception"
            result["stderr"] = str(e)
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            
            result["duration"] = time.time() - start_time

        return result

    def execute_in_docker(self, code: str, image: str = "python:3.10-slim") -> Dict[str, Any]:
        """
        Draft implementation for a Docker-based sandbox.
        Requires 'docker' python package.
        """
        try:
            import docker
            client = docker.from_env()
            
            # Using a simplified docker run for demonstration
            container = client.containers.run(
                image,
                command=["python", "-c", code],
                detach=False,
                remove=True,
                network_disabled=True,
                mem_limit=f"{self.memory_limit}m",
                cpu_period=100000,
                cpu_quota=50000, # 50% CPU
                timeout=self.timeout,
                stdout=True,
                stderr=True
            )
            return {
                "stdout": container.decode('utf-8'),
                "stderr": "",
                "status": "success",
                "exit_code": 0
            }
        except ImportError:
            return {"status": "error", "stderr": "Docker SDK not installed"}
        except Exception as e:
            return {"status": "error", "stderr": str(e)}

# Usage Example:
# sandbox = SecuritySandbox(timeout=2)
# result = sandbox.execute_python_code("print('Hello from Sandbox!')")
# print(result)
