from pathlib import Path
import sys

import uvicorn


REPO_ROOT = Path(__file__).resolve().parent.parent
NESTED_ROOT = REPO_ROOT / "code-review-env"
NESTED_SERVER = NESTED_ROOT / "server"


def _ensure_nested_server_path() -> None:
    nested_root = str(NESTED_ROOT)
    nested_server = str(NESTED_SERVER)

    if nested_root not in sys.path:
        sys.path.insert(0, nested_root)

    pkg = sys.modules.get("server")
    if pkg is not None and hasattr(pkg, "__path__"):
        existing_paths = [str(path) for path in pkg.__path__]
        if nested_server not in existing_paths:
            pkg.__path__.append(nested_server)


_ensure_nested_server_path()

from server.main import app


def main() -> None:
    _ensure_nested_server_path()
    uvicorn.run("server.main:app", host="0.0.0.0", port=7860, reload=False)


if __name__ == "__main__":
    main()
