from huggingface_hub import HfApi
import os

api = HfApi(token=os.getenv("HF_TOKEN"))
repo_id = "receptionistprotactiniumsoft/openenv-code-reviewer"

print("🚀 Starting FULL REPAIR upload to Hugging Face Space...")

# High-priority files and folders with correct relative paths
# We use forward slashes for path_in_repo to avoid the Windows backslash mess
ITEMS_TO_UPLOAD = [
    ("inference.py", "inference.py"),
    ("Dockerfile", "Dockerfile"),
    ("openenv.yaml", "openenv.yaml"),
    ("requirements.txt", "requirements.txt"),
    ("README.md", "README.md"),
    # Backend files (including tasks, models, grader)
    ("code-review-env/server", "code-review-env/server"),
    ("code-review-env/requirements.txt", "code-review-env/requirements.txt"),
    # Frontend files
    ("dashboard/index.html", "dashboard/index.html"),
    ("dashboard/package.json", "dashboard/package.json"),
    ("dashboard/vite.config.js", "dashboard/vite.config.js"),
    ("dashboard/src", "dashboard/src"),
    ("dashboard/public", "dashboard/public"),
]

for local_path, repo_path in ITEMS_TO_UPLOAD:
    # Ensure forward slashes for repo path
    repo_path = repo_path.replace("\\", "/")
    
    if os.path.isfile(local_path):
        try:
            print(f"⬆️ Uploading File: {local_path} -> {repo_path}...")
            api.upload_file(
                path_or_fileobj=local_path,
                path_in_repo=repo_path,
                repo_id=repo_id,
                repo_type="space"
            )
        except Exception as e:
            print(f"❌ Failed to upload {local_path}: {e}")
    elif os.path.isdir(local_path):
        try:
            print(f"⬆️ Uploading Folder: {local_path} -> {repo_path}...")
            api.upload_folder(
                folder_path=local_path,
                path_in_repo=repo_path,
                repo_id=repo_id,
                repo_type="space",
                ignore_patterns=["*.pyc", "__pycache__*", "node_modules*", "dist*"]
            )
        except Exception as e:
            print(f"❌ Failed to upload folder {local_path}: {e}")

print("✅ SUCCESS! All missing components uploaded. Build should restart now.")
