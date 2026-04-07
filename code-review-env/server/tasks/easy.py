EASY_TASKS = [
    {
        "id": "easy_001",
        "filename": "binary_search.py",
        "diff": "1: def binary_search(arr, target):\n2:     low = 0\n3:     high = len(arr)\n4:     while low < high:\n5:         mid = (low + high) // 2\n6:         if arr[mid] == target:\n7:             return mid\n8:         elif arr[mid] < target:\n9:             low = mid + 1\n10:        else:\n11:            high = mid - 1\n12:    return -1",
        "ground_truth": [{"line": 4, "severity": "medium", "category": "Logic", "description": "Off-by-one in while condition"}]
    },
    {
        "id": "easy_002",
        "filename": "auth.py",
        "diff": "1: def check_password(input_pass, real_pass):\n2:     if input_pass = real_pass:\n3:         return True\n4:     return False",
        "ground_truth": [{"line": 2, "severity": "high", "category": "Syntax", "description": "Assignment vs comparison"}]
    },
    {
        "id": "easy_003",
        "filename": "stats.py",
        "diff": "1: def get_average(items):\n2:     total = sum(items)\n3:     avg = total / len(items)\n4:     return avg",
        "ground_truth": [{"line": 3, "severity": "medium", "category": "Logic", "description": "ZeroDivisionError without length check"}]
    },
    {
        "id": "easy_004",
        "filename": "db.py",
        "diff": "1: def get_user_email(user_id):\n2:     user = db.query(user_id)\n3:     return user.email",
        "ground_truth": [{"line": 3, "severity": "medium", "category": "Logic", "description": "Returns user.email without None check on user object"}]
    },
    {
        "id": "easy_005",
        "filename": "math_utils.py",
        "diff": "1: def fib(n):\n2:     if n <= 0: return 0\n3:     if n == 1: return 0\n4:     return fib(n-1) + fib(n-2)",
        "ground_truth": [{"line": 3, "severity": "low", "category": "Logic", "description": "wrong base case: should return 1"}]
    }
]
