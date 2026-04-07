HARD_TASKS = [
    {
        "id": "hard_001",
        "filename": "yaml_config_parser.diff",
        "diff": "--- a/config.py\n+++ b/config.py\n1: import yaml\n2: \n3: def parse_user_config(user_uploaded_config):\n4:     # Parse deployment configs\n5:     try:\n6:         data = yaml.load(user_uploaded_config, Loader=yaml.Loader)\n7:         return data\n8:     except Exception as e:\n9:         return {'error': str(e)}",
        "ground_truth": [
            {"line": 6, "severity": "critical", "category": "security"}
        ]
    },
    {
        "id": "hard_002",
        "filename": "ssrf_fetcher.diff",
        "diff": "--- a/fetcher.py\n+++ b/fetcher.py\n1: import requests\n2: from urllib.parse import urlparse\n3: \n4: def fetch_profile_picture(user_input_url):\n5:     parsed = urlparse(user_input_url)\n6:     if parsed.hostname in ['localhost', '127.0.0.1']:\n7:         return 'Internal calls blocked'\n8:     # Vulnerable to DNS Rebinding or alternate IPs (0.0.0.0, 2130706433)\n9:     resp = requests.get(user_input_url, timeout=5)\n10:    return resp.content",
        "ground_truth": [
            {"line": 6, "severity": "medium", "category": "security"}, 
            {"line": 9, "severity": "critical", "category": "security"}
        ]
    },
    {
        "id": "hard_003",
        "filename": "auth_middleware.diff",
        "diff": "--- a/auth_middleware.py\n+++ b/auth_middleware.py\n1: def check_permissions(request):\n2:     user = request.user\n3:     if not user:\n4:         return False\n5:     \n6:     roles = db.query(f\"SELECT role FROM users WHERE id = '{user.id}'\")\n7:     if request.path.startswith('/admin'):\n8:         return 'admin' in roles\n9:     return True\n10: \n11: def verify_session_token(token, expected):\n12:    return token == expected",
        "ground_truth": [
            {"line": 6, "severity": "critical", "category": "security"}, 
            {"line": 12, "severity": "high", "category": "security"}
        ]
    }
]
