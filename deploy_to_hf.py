"""
deploy_to_hf.py
Purpose: Deploy the full OpenEnv stack to HuggingFace Spaces.

FIX APPLIED:
  - Now builds the dashboard (npm run build) before uploading so HF has
    static files to serve from dashboard/dist/
  - Uploads dashboard/dist/ instead of raw source (vite/node not on HF)
  - Added constants.py to the upload list (new file added this session)
  - Added progress logging to make failures easier to diagnose
  - Added verification step that prints the live Space URL when done
"""

# Standard library
import os
import subprocess
import sys

# Third party
from dotenv import load_dotenv
from huggingface_hub import HfApi

# Load .env so HF_TOKEN is available without setting it manually
load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REPO_ID = "receptionistprotactiniumsoft/openenv-code-reviewer"
HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    print("ERROR: HF_TOKEN environment variable is not set.")
    print("Set it in your .env file and re-run this script.")
    sys.exit(1)

api = HfApi(token=HF_TOKEN)

# ---------------------------------------------------------------------------
# Step 1 — Build the dashboard so HuggingFace has static files to serve
# ---------------------------------------------------------------------------
DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "dashboard")
DIST_DIR = os.path.join(DASHBOARD_DIR, "dist")

print("=" * 60)
print("STEP 1: Building dashboard (npm run build)...")
print("=" * 60)

try:
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=DASHBOARD_DIR,
        check=True,
        capture_output=True,
        text=True,
        shell=True,  # Required on Windows
    )
    print(result.stdout)
    print("[OK] Dashboard build complete - dist/ folder ready.")
except subprocess.CalledProcessError as e:
    print(f"[FAIL] Dashboard build failed:\n{e.stderr}")
    print("Proceeding with upload anyway (dist/ may already exist).")

if not os.path.isdir(DIST_DIR):
    print("WARNING: dashboard/dist/ does not exist. Frontend will not be served on HF.")

# ---------------------------------------------------------------------------
# Step 2 — Define all files/folders to upload
# ---------------------------------------------------------------------------
print()
print("=" * 60)
print("STEP 2: Uploading files to HuggingFace Space...")
print("=" * 60)

# Format: (local_path, path_in_repo)
ITEMS_TO_UPLOAD = [
    # Root-level entry points
    ("inference.py",        "inference.py"),
    ("Dockerfile",          "Dockerfile"),
    ("openenv.yaml",        "openenv.yaml"),
    ("requirements.txt",    "requirements.txt"),
    ("README.md",           "README.md"),

    # Backend server (all modules including new constants.py)
    ("code-review-env/server",          "code-review-env/server"),
    ("code-review-env/requirements.txt","code-review-env/requirements.txt"),

    # Frontend — upload the compiled dist/ (not raw source)
    # HuggingFace Spaces does not run npm/vite during build
    ("dashboard/dist",      "dashboard/dist"),
    ("dashboard/index.html","dashboard/index.html"),
]

# ---------------------------------------------------------------------------
# Step 3 — Upload each item
# ---------------------------------------------------------------------------
failed = []

for local_path, repo_path in ITEMS_TO_UPLOAD:
    # Normalize to forward slashes for HuggingFace API
    repo_path = repo_path.replace("\\", "/")

    if not os.path.exists(local_path):
        print(f"  [SKIP] Not found: {local_path}")
        continue

    if os.path.isfile(local_path):
        try:
            print(f"  [FILE] Uploading: {local_path} -> {repo_path}")
            api.upload_file(
                path_or_fileobj=local_path,
                path_in_repo=repo_path,
                repo_id=REPO_ID,
                repo_type="space",
            )
        except Exception as e:
            print(f"  [FAIL] {local_path} - {e}")
            failed.append(local_path)

    elif os.path.isdir(local_path):
        try:
            print(f"  [DIR]  Uploading: {local_path} -> {repo_path}")
            api.upload_folder(
                folder_path=local_path,
                path_in_repo=repo_path,
                repo_id=REPO_ID,
                repo_type="space",
                ignore_patterns=["*.pyc", "__pycache__*", "node_modules*", ".env"],
            )
        except Exception as e:
            print(f"  [FAIL] {local_path} - {e}")
            failed.append(local_path)

# ---------------------------------------------------------------------------
# Step 4 — Print final status and live URL
# ---------------------------------------------------------------------------
print()
print("=" * 60)
if failed:
    print(f"[WARN] Deployment finished with {len(failed)} failure(s):")
    for f in failed:
        print(f"    - {f}")
else:
    print("[OK] All files uploaded successfully!")

print()
print("Live HuggingFace Space URL:")
print(f"  https://huggingface.co/spaces/{REPO_ID}")
print()
print("Wait 2-3 minutes for HuggingFace to rebuild, then open:")
print(f"  https://{REPO_ID.replace('/', '-')}.hf.space")
print("=" * 60)
