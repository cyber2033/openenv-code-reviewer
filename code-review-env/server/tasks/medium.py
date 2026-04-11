MEDIUM_TASKS = [
    {
        "id": "medium_001",
        "filename": "app.py",
        "diff": "1: @app.route('/user')\n2: def get_user():\n3:     user_id = request.args.get('id')\n4:     query = f'SELECT * FROM users WHERE id = {user_id}'\n5:     db.execute(query)\n6:     return 'ok'",
        "ground_truth": [{"line": 4, "severity": "critical", "category": "Security"}]
    },
    {
        "id": "medium_002",
        "filename": "config.py",
        "diff": "1: class Config:\n2:     DEBUG = True\n3:     API_KEY = 'sk-12345ABCD'\n4:     PORT = 8080",
        "ground_truth": [{"line": 3, "severity": "critical", "category": "Security"}]
    },
    {
        "id": "medium_003",
        "filename": "admin.py",
        "diff": "1: def delete_user(user_id):\n2:     db.delete(user_id)\n3:     if not current_user.is_admin():\n4:         return 'Unauthorized', 403\n5:     return 'Deleted'",
        "ground_truth": [{"line": 2, "severity": "high", "category": "Security"}]
    },
    {
        "id": "medium_004",
        "filename": "files.py",
        "diff": "1: @app.route('/download')\n2: def download():\n3:     filename = request.args.get('file')\n4:     with open(filename, 'r') as f:\n5:         data = f.read()\n6:     return data",
        "ground_truth": [{"line": 4, "severity": "high", "category": "Security"}]
    },
    {
        "id": "medium_005",
        "filename": "redirect.py",
        "diff": "1: @app.route('/login')\n2: def login():\n3:     next_url = request.args.get('next')\n4:     do_login()\n5:     return redirect(next_url)",
        "ground_truth": [{"line": 5, "severity": "medium", "category": "Security"}]
    },
    {
        "id": "medium_006",
        "filename": "hello.py",
        "diff": "1: @app.route('/hello')\n2: def hello():\n3:     name = request.args.get('name', 'Guest')\n4:     return f'<h1>Hello {name}</h1>'",
        "ground_truth": [{"line": 4, "severity": "medium", "category": "Security"}]
    },
    {
        "id": "medium_007",
        "filename": "token_gen.py",
        "diff": "1: import random\n2: def generate_reset_token():\n3:     return str(random.random())",
        "ground_truth": [{"line": 3, "severity": "medium", "category": "Security"}]
    },
    {
        "id": "medium_008",
        "filename": "server.js",
        "diff": "1: app.get('/calculate', (req, res) => {\n2:   const result = eval(req.query.exp);\n3:   res.send(`Result: ${result}`);\n4: });",
        "ground_truth": [{"line": 2, "severity": "critical", "category": "Security"}]
    }
]
