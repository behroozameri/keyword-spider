import hashlib
import json
import shutil
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "manifest.json"


def extension_files():
    yield MANIFEST_PATH
    yield ROOT / "engine" / "spider.js"
    yield from sorted(
        path
        for path in (ROOT / "extension").rglob("*")
        if path.is_file() and "__pycache__" not in path.parts
    )


def main():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    version = manifest["version"]
    output_dir = ROOT / "dist"
    output_dir.mkdir(parents=True, exist_ok=True)
    unpacked_path = output_dir / "keyword-spider-unpacked"
    output_path = output_dir / f"keyword-spider-v{version}.zip"

    files = list(extension_files())
    missing = [str(path.relative_to(ROOT)) for path in files if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing extension files: {', '.join(missing)}")

    if unpacked_path.exists():
        shutil.rmtree(unpacked_path)

    for path in files:
        destination = unpacked_path / path.relative_to(ROOT)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(ROOT).as_posix())

    with zipfile.ZipFile(output_path) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("The generated extension archive is corrupt.")
        archived_files = set(archive.namelist())
        expected_files = {path.relative_to(ROOT).as_posix() for path in files}
        if archived_files != expected_files:
            raise RuntimeError("The generated extension archive contains unexpected files.")
        if "manifest.json" not in archived_files:
            raise RuntimeError("The extension manifest is not at the archive root.")

    checksum = hashlib.sha256(output_path.read_bytes()).hexdigest()

    print(f"Built {unpacked_path.relative_to(ROOT)} with {len(files)} files")
    print(f"Built {output_path.relative_to(ROOT)} with {len(files)} files")
    print(f"SHA-256: {checksum}")


if __name__ == "__main__":
    main()
