"""Tile build/shots/slide-*.png into contact sheets (6 per sheet) for a quick visual review."""
import glob
import os

from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
shots = sorted(glob.glob(os.path.join(here, "shots", "slide-*.png")))
per = 6
for k in range(0, len(shots), per):
    batch = shots[k:k + per]
    w, h = 640, 360
    sheet = Image.new("RGB", (w * 2, h * 3), "white")
    for i, p in enumerate(batch):
        im = Image.open(p).convert("RGB").resize((w, h), Image.LANCZOS)
        sheet.paste(im, ((i % 2) * w, (i // 2) * h))
    out = os.path.join(here, "shots", f"sheet-{k // per + 1}.png")
    sheet.save(out)
    print(out)
