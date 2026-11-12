"""Apply the html() slide-text fixes from _audit_fix_2026-11-12.py to index_full.html (soft anchors)."""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
src = open(os.path.join(HERE, "_audit_fix_2026-11-12.py")).read()
rep_src = re.search(r"SOFT = False\ndef rep\(s, old, new, count=1\):.*?return s\.replace\(old, new\) if count == 0 else s\.replace\(old, new, count\)", src, flags=re.S).group(0)
html_src = re.search(r"def html\(s\):.*?\n    return s\n", src, flags=re.S).group(0)
ns = {"re": re}
exec(rep_src + "\n" + html_src, ns)
ns["SOFT"] = True
p = os.path.join(ROOT, "index_full.html"); s = open(p).read(); s2 = ns["html"](s); open(p, "w").write(s2)
print("index_full.html: varphi", s2.count("varphi"), "validation", s2.count("validation"))
