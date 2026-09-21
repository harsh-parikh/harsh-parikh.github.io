#!/usr/bin/env python3
"""Validate data/jobs.csv and confirm that jobs.html matches it."""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

from build_jobs import CSV_FILE, HTML_FILE, JobDataError, build_document, load_jobs


def main() -> int:
    try:
        jobs = load_jobs()
        current = HTML_FILE.read_text(encoding="utf-8")
        generated, active_count = build_document(current, jobs)
    except (OSError, JobDataError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if generated != current:
        print("ERROR: jobs.html is out of date; run python3 scripts/build_jobs.py", file=sys.stderr)
        return 1

    print(f"Validated {len(jobs)} CSV rows and {active_count} rendered jobs from {CSV_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
