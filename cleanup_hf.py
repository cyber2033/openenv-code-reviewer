from huggingface_hub import HfApi
import os

api = HfApi(token=os.getenv("HF_TOKEN"))
repo_id = "receptionistprotactiniumsoft/openenv-code-reviewer"

print("🔍 Fetching file list from Hugging Face...")
files = api.list_repo_files(repo_id=repo_id, repo_type="space")

# We want to keep ONLY these core files/folders
STAY_LIST = [
    "inference.py",
    "Dockerfile",
    "openenv.yaml",
    "requirements.txt",
    "README.md",
    "code-review-env",
    "dashboard"
]

to_delete = []
for f in files:
    # If the file starts with .venv or has a backslash (Windows mess), delete it
    if "\\" in f or f.startswith(".venv") or f.startswith("venv"):
        to_delete.append(f)

if to_delete:
    print(f"🗑️ Found {len(to_delete)} junk files to delete.")
    # HF API allows deleting multiple files in a single commit via CommitOperationDelete
    from huggingface_hub import CommitOperationDelete
    operations = [CommitOperationDelete(path_in_repo=f) for f in to_delete]
    
    # Batch delete in chunks of 100 to avoid timeouts
    for i in range(0, len(operations), 100):
        chunk = operations[i:i+100]
        print(f"🧹 Deleting chunk {i//100 + 1}...")
        api.create_commit(
            repo_id=repo_id,
            operations=chunk,
            commit_message=f"Cleanup junk files batch {i//100 + 1}",
            repo_type="space"
        )
    print("✨ Cleanup finished!")
else:
    print("✅ No junk files found.")
