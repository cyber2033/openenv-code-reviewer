import json
from pathlib import Path

from server.tasks.easy import EASY_TASKS
from server.tasks.hard import HARD_TASKS
from server.tasks.medium import MEDIUM_TASKS

DATASET_DIR = Path(__file__).resolve().parent / "dataset"


def write_dataset(path: Path, payload: list[dict]) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp_path.replace(path)


def main() -> None:
    DATASET_DIR.mkdir(exist_ok=True)

    datasets = {
        "easy_bugs.json": EASY_TASKS,
        "medium_bugs.json": MEDIUM_TASKS,
        "hard_bugs.json": HARD_TASKS,
    }

    for filename, payload in datasets.items():
        write_dataset(DATASET_DIR / filename, payload)

    print("Dumped JSONs")


if __name__ == "__main__":
    main()
