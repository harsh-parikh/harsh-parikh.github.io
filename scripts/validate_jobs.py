#!/usr/bin/env python3
"""Validate data/jobs.json using only the Python standard library."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "jobs.json"
REQUIRED = {
    "id",
    "title",
    "organization",
    "location",
    "type",
    "focus",
    "deadline",
    "deadlineLabel",
    "applyUrl",
    "sourceUrl",
    "description",
    "compensation",
    "remote",
    "featured",
    "verified",
}
ALLOWED_TYPES = {"postdoc", "fellowship", "faculty", "industry"}


def valid_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def main() -> int:
    try:
        payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read valid JSON from {DATA_FILE}: {exc}")
        return 1

    errors: list[str] = []
    jobs = payload.get("jobs")
    if not isinstance(jobs, list):
        print("ERROR: top-level 'jobs' must be an array")
        return 1

    seen: set[str] = set()
    for index, job in enumerate(jobs):
        label = f"jobs[{index}]"
        if not isinstance(job, dict):
            errors.append(f"{label} must be an object")
            continue
        missing = REQUIRED - set(job)
        if missing:
            errors.append(f"{label} missing fields: {', '.join(sorted(missing))}")
        job_id = job.get("id")
        if not isinstance(job_id, str) or not job_id:
            errors.append(f"{label}.id must be a non-empty string")
        elif job_id in seen:
            errors.append(f"duplicate id: {job_id}")
        else:
            seen.add(job_id)
        if job.get("type") not in ALLOWED_TYPES:
            errors.append(f"{label}.type must be one of {sorted(ALLOWED_TYPES)}")
        if not isinstance(job.get("focus"), list) or not job.get("focus"):
            errors.append(f"{label}.focus must be a non-empty array")
        for field in ("applyUrl", "sourceUrl"):
            if not valid_url(job.get(field)):
                errors.append(f"{label}.{field} must be an https URL")
        for field in ("deadline", "verified"):
            value = job.get(field)
            if field == "deadline" and value is None:
                continue
            try:
                date.fromisoformat(value)
            except (TypeError, ValueError):
                errors.append(f"{label}.{field} must be YYYY-MM-DD{'' if field == 'verified' else ' or null'}")
        for field in ("remote", "featured"):
            if not isinstance(job.get(field), bool):
                errors.append(f"{label}.{field} must be boolean")

    if errors:
        print("Job data validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validated {len(jobs)} jobs in {DATA_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
