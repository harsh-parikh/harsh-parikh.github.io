#!/usr/bin/env python3
"""
Fetch publications from Google Scholar and write publications.json.

Uses the `scholarly` library with optional proxy support.
Designed to run in GitHub Actions on a schedule.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

SCHOLAR_ID = "uCrw1ZMAAAAJ"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "publications.json")
AUTHOR_NAME = "Harsh Parikh"
# Aliases to detect "me" in author lists
AUTHOR_ALIASES = {"h parikh", "harsh parikh", "hp"}


def normalize_author(name: str) -> str:
    """Lowercase, strip periods/commas, collapse whitespace."""
    return " ".join(name.lower().replace(".", "").replace(",", "").split())


def is_me(name: str) -> bool:
    n = normalize_author(name)
    return n in AUTHOR_ALIASES or n.endswith("parikh") and n[0] == "h"


def fetch_publications():
    from scholarly import scholarly, ProxyGenerator

    # Use free proxies to avoid Scholar blocking in CI
    try:
        pg = ProxyGenerator()
        pg.FreeProxies()
        scholarly.use_proxy(pg)
    except Exception:
        pass  # Fall back to direct if proxy setup fails

    author = scholarly.search_author_id(SCHOLAR_ID)
    author = scholarly.fill(author, sections=["publications"])

    pubs = []
    for i, pub_stub in enumerate(author.get("publications", [])):
        try:
            pub = scholarly.fill(pub_stub)
        except Exception:
            pub = pub_stub

        bib = pub.get("bib", {})
        title = bib.get("title", "")
        authors_raw = bib.get("author", "")
        venue = bib.get("journal", "") or bib.get("conference", "") or bib.get("venue", "") or bib.get("publisher", "")
        year = bib.get("pub_year", "") or ""
        citation_count = pub.get("num_citations", 0)
        scholar_url = pub.get("pub_url", "") or pub.get("eprint_url", "")
        citation_id = pub.get("author_pub_id", "")

        # Parse author list
        author_list = [a.strip() for a in authors_raw.split(" and ")]
        if len(author_list) == 1:
            # Sometimes comma-separated
            author_list = [a.strip() for a in authors_raw.split(",")]

        pubs.append({
            "title": title,
            "authors": author_list,
            "authors_raw": authors_raw,
            "venue": venue,
            "year": str(year),
            "citations": citation_count,
            "url": scholar_url,
            "scholar_id": citation_id,
        })

        # Be polite to Scholar
        time.sleep(1)

    return pubs


def main():
    print(f"Fetching publications for Scholar ID: {SCHOLAR_ID}")
    pubs = fetch_publications()
    print(f"Found {len(pubs)} publications")

    # Sort by year descending, then by citation count descending
    pubs.sort(key=lambda p: (-(int(p["year"]) if p["year"].isdigit() else 0), -p["citations"]))

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


if __name__ == "__main__":
    main()
