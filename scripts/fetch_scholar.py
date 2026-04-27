#!/usr/bin/env python3
"""
Fetch publications from Google Scholar and write data/publications.json.

Strategy:
  1. Hit the public Scholar profile page directly (one HTTPS GET, no proxies).
     The `scholarly` library + FreeProxies path is fragile in CI; Scholar
     happily serves the static profile HTML to a normal-looking user agent
     and that's enough metadata for the CV.
  2. Parse rows out of the HTML with regex (keeps the runtime dependency
     surface tiny — only stdlib + urllib).
  3. Merge with the previous publications.json so manual annotations
     (`note`, `co_first`, curated `venue`/`url`) survive across runs.
  4. Apply data/overrides.json (venue/year overrides + exclusions).

Designed to run locally and in GitHub Actions on a schedule.
"""

from __future__ import annotations

import html as html_lib
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

SCHOLAR_ID = "uCrw1ZMAAAAJ"
AUTHOR_NAME = "Harsh Parikh"
AUTHOR_ALIASES = {"h parikh", "harsh parikh", "harsh j parikh", "hp"}

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
OUTPUT_FILE = os.path.join(REPO_ROOT, "data", "publications.json")
OVERRIDES_FILE = os.path.join(REPO_ROOT, "data", "overrides.json")

PROFILE_URL = (
    "https://scholar.google.com/citations"
    f"?user={SCHOLAR_ID}&hl=en&cstart=0&pagesize=100"
)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_author(name: str) -> str:
    return " ".join(name.lower().replace(".", "").replace(",", "").split())


def is_me(name: str) -> bool:
    n = normalize_author(name)
    if n in AUTHOR_ALIASES:
        return True
    return n.endswith("parikh") and n.startswith("h")


def strip_tags(s: str) -> str:
    return html_lib.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def expand_authors(authors_raw: str) -> list[str]:
    """Scholar returns abbreviated authors like 'H Parikh, C Varjao'."""
    if not authors_raw:
        return []
    parts = [a.strip() for a in authors_raw.split(",")]
    return [p for p in parts if p]


# ---------------------------------------------------------------------------
# Fetch + parse
# ---------------------------------------------------------------------------

def fetch_profile_html() -> str:
    req = urllib.request.Request(PROFILE_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_rows(html: str) -> list[dict]:
    rows = re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', html, re.DOTALL)
    pubs = []
    for row in rows:
        m = re.search(
            r'<a([^>]*)class="gsc_a_at"[^>]*>(.*?)</a>', row, re.DOTALL
        )
        if not m:
            continue

        href_m = re.search(r'href="([^"]+)"', m.group(1))
        href = html_lib.unescape(href_m.group(1)) if href_m else ""
        cid_m = re.search(r"citation_for_view=([^&]+)", href)
        cid = cid_m.group(1) if cid_m else ""

        title = strip_tags(m.group(2))

        grays = re.findall(
            r'<div class="gs_gray">(.*?)</div>', row, re.DOTALL
        )
        authors_raw = strip_tags(grays[0]) if grays else ""
        venue_part = grays[1] if len(grays) > 1 else ""
        venue_year_clean = re.sub(
            r'<span class="gs_oph">.*?</span>', "", venue_part
        )
        venue_scholar = strip_tags(venue_year_clean).rstrip(",").strip()

        cites_m = re.search(
            r'<a[^>]*class="gsc_a_ac[^"]*"[^>]*>(\d*)</a>', row
        )
        citations = int(cites_m.group(1)) if cites_m and cites_m.group(1) else 0

        year_m = re.search(r'<span class="gsc_a_h[^"]*">(\d{4})</span>', row)
        year = year_m.group(1) if year_m else ""

        # Scholar's `citation_for_view` already includes the user prefix
        # (e.g. "uCrw1ZMAAAAJ:5nxA0vEk-isC"). Don't double-prefix it.
        scholar_id = cid if cid.startswith(f"{SCHOLAR_ID}:") else (
            f"{SCHOLAR_ID}:{cid}" if cid else ""
        )

        pubs.append({
            "title": title,
            "authors_raw": authors_raw,
            "authors": expand_authors(authors_raw),
            "venue": venue_scholar,  # may be overridden / preserved below
            "year": year,
            "citations": citations,
            "url": "",  # filled in from existing JSON when possible
            "scholar_id": scholar_id,
        })
    return pubs


# ---------------------------------------------------------------------------
# Merge with previous JSON + overrides
# ---------------------------------------------------------------------------

def load_previous() -> dict:
    if not os.path.exists(OUTPUT_FILE):
        return {}
    try:
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return {
            p.get("scholar_id", ""): p
            for p in data.get("publications", [])
            if p.get("scholar_id")
        }
    except Exception as exc:
        print(f"warning: failed to load previous publications.json: {exc}",
              file=sys.stderr)
        return {}


def load_overrides() -> dict:
    if not os.path.exists(OVERRIDES_FILE):
        return {"overrides": [], "exclude": []}
    with open(OVERRIDES_FILE, encoding="utf-8") as f:
        return json.load(f)


def matches(title: str, fragment: str) -> bool:
    return fragment.lower() in title.lower()


def merge(scholar_pubs: list[dict], previous: dict, overrides: dict) -> list[dict]:
    excludes = [s.lower() for s in overrides.get("exclude", [])]
    rules = overrides.get("overrides", [])

    merged = []
    for pub in scholar_pubs:
        if any(ex in pub["title"].lower() for ex in excludes):
            continue

        prev = previous.get(pub["scholar_id"], {})

        # Prefer curated venue/url from previous JSON (cleaner than Scholar's).
        if prev.get("venue"):
            pub["venue"] = prev["venue"]
        if prev.get("url"):
            pub["url"] = prev["url"]
        # Carry forward curated authors list if it has more detail than the
        # Scholar abbreviation (Scholar shows "H Parikh", we want "Harsh Parikh").
        if prev.get("authors") and len(prev["authors"]) >= len(pub["authors"]):
            pub["authors"] = prev["authors"]
            pub["authors_raw"] = prev.get("authors_raw", pub["authors_raw"])

        # Manual annotations always survive.
        if prev.get("note"):
            pub["note"] = prev["note"]
        if prev.get("co_first"):
            pub["co_first"] = prev["co_first"]

        # Apply title-substring overrides last so they win.
        for rule in rules:
            if matches(pub["title"], rule.get("match", "")):
                if rule.get("venue"):
                    pub["venue"] = rule["venue"]
                if rule.get("year"):
                    pub["year"] = str(rule["year"])
                if rule.get("note"):
                    pub["note"] = rule["note"]

        merged.append(pub)
    return merged


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    print(f"Fetching publications for Scholar ID: {SCHOLAR_ID}")
    html = fetch_profile_html()
    if "gsc_a_tr" not in html:
        print("ERROR: profile page did not contain publication rows.",
              file=sys.stderr)
        print("First 1000 chars of response:", file=sys.stderr)
        print(html[:1000], file=sys.stderr)
        return 1

    scholar_pubs = parse_rows(html)
    print(f"Parsed {len(scholar_pubs)} rows from profile.")

    previous = load_previous()
    overrides = load_overrides()
    pubs = merge(scholar_pubs, previous, overrides)
    print(f"After merge + overrides: {len(pubs)} publications.")

    # Sort: year desc, then citations desc.
    pubs.sort(
        key=lambda p: (
            -(int(p["year"]) if p["year"].isdigit() else 0),
            -p.get("citations", 0),
        )
    )

    output = {
        "scholar_id": SCHOLAR_ID,
        "author": AUTHOR_NAME,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "count": len(pubs),
        "publications": pubs,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Wrote {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
