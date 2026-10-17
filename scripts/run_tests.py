import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PYTHON_TESTS = sorted((ROOT / "tests").glob("test_*.py"))
JAVASCRIPT_TESTS = sorted((ROOT / "tests").glob("test_*.js"))


def run(command):
    print(f"\n$ {' '.join(str(part) for part in command)}", flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def main():
    if not PYTHON_TESTS and not JAVASCRIPT_TESTS:
        raise RuntimeError("No tests were found.")

    for test_path in PYTHON_TESTS:
        run([sys.executable, str(test_path.relative_to(ROOT))])

    if JAVASCRIPT_TESTS:
        node = shutil.which("node")
        if not node:
            raise RuntimeError("Node.js is required to run the JavaScript tests.")
        run([node, "--test", *map(str, JAVASCRIPT_TESTS)])

    total = len(PYTHON_TESTS) + len(JAVASCRIPT_TESTS)
    print(f"\nAll {total} test files passed.")


if __name__ == "__main__":
    main()
