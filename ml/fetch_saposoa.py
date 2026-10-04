"""Fetch a stratified sample of the Saposoa (San Martin, Peru) coffee leaf dataset.

Source: Mendeley Data mfpxg4y65r v1, CC BY 4.0 (Santa-Maria & Rodriguez, 2026).
Used ONLY as a held-out distribution-shift test: Roya/Sanas are in-class shift,
Ojo_Gallo (Mycena citricolor) is a class the model never sees and must abstain on.
"""
import hashlib
import io
import json
import random
import sys
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (chakra research; CC BY 4.0 dataset reuse)"}


def _open(url, timeout, retries=5):
    import time
    for attempt in range(retries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout)
        except Exception:  # noqa: BLE001 - transient 5xx/timeouts from the CDN
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)
from pathlib import Path

from PIL import Image

API = "https://data.mendeley.com/public-api/datasets/mfpxg4y65r/files?folder_id={}&version=1"
FOLDERS = {
    "ojo_de_gallo": "f760dc37-52d0-401d-aac2-985ac1db7632",
    "rust": "a6d78025-8ec5-4172-a901-822754b39082",
    "healthy": "94bf2522-3657-455f-a6b1-8845e0c90be3",
}
PER_CLASS = int(sys.argv[1]) if len(sys.argv) > 1 else 60
OUT = Path(__file__).parent / "data" / "saposoa"


def main():
    random.seed(7)
    manifest = []
    for label, folder in FOLDERS.items():
        files = json.load(_open(API.format(folder), 60))
        files = [f for f in files if f["filename"].lower().endswith((".jpg", ".jpeg", ".png"))]
        (OUT / label).mkdir(parents=True, exist_ok=True)
        for f in random.sample(files, min(PER_CLASS, len(files))):
            cd = f["content_details"]
            dest = OUT / label / (Path(f["filename"]).stem.replace(" ", "_") + ".jpg")
            if not dest.exists():
                raw = _open(cd["download_url"], 120).read()
                if hashlib.sha256(raw).hexdigest() != cd["sha256_hash"]:
                    print("hash mismatch, skipped", f["filename"])
                    continue
                img = Image.open(io.BytesIO(raw)).convert("RGB")
                img.thumbnail((320, 320))
                img.save(dest, quality=90)
            manifest.append({"label": label, "file": str(dest.relative_to(OUT)), "sha256": cd["sha256_hash"]})
        print(label, "done")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(len(manifest), "images")


if __name__ == "__main__":
    main()
