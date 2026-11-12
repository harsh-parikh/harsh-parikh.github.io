"""Slide-text gate: every sentence in slide text (not notes) at most 20 words; list the offenders."""
import re, html, sys
s = open("index.html").read()
s = re.sub(r"<aside class=\"notes\">.*?</aside>", "", s, flags=re.S)
s = re.sub(r"<script.*?</script>", "", s, flags=re.S)
s = re.sub(r"\$[^$]*\$", " EQ ", s)
slides = re.findall(r"<section class=\"slide[^\"]*\"[^>]*>(.*?)</section>", s, flags=re.S)
bad = 0
for i, sl in enumerate(slides, 1):
    txt = html.unescape(re.sub(r"<[^>]+>", " ", sl))
    for sent in re.split(r"(?<=[.!?])\s+", txt):
        w = sent.split()
        if len(w) > 20:
            bad += 1; print(f"slide {i}: {len(w)} words: {' '.join(w)}")
print("sentences over 20 words:", bad)
