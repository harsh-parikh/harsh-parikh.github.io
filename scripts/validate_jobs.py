#!/usr/bin/env python3
"""Validate data/jobs.csv and confirm that jobs.html matches it."""

from __future__ import annotations

import csv
import sys
from datetime import date

sys.dont_write_bytecode = True

from build_jobs import CSV_FILE, HTML_FILE, JobDataError, build_document, load_jobs
from capture_job_submission import FIELDNAMES as QUEUE_FIELDNAMES, QUEUE_FILE, valid_https_url


def validate_queue() -> int:
    with QUEUE_FILE.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != QUEUE_FIELDNAMES:
            raise JobDataError("job_submissions.csv has unexpected columns")
        seen: set[str] = set()
        count = 0
        for row_number, row in enumerate(reader, start=2):
            submission_id = row["submission_id"].strip()
            if not submission_id or submission_id in seen:
                raise JobDataError(f"job_submissions.csv row {row_number}: invalid or duplicate id")
            seen.add(submission_id)
            if row["type"] not in {"postdoc", "fellowship", "faculty", "industry", "research"}:
                raise JobDataError(f"job_submissions.csv row {row_number}: invalid type")
            if row["remote"] not in {"true", "false"}:
                raise JobDataError(f"job_submissions.csv row {row_number}: invalid remote value")
            for field in ("apply_url", "source_url", "issue_url"):
                if not valid_https_url(row[field]):
                    raise JobDataError(f"job_submissions.csv row {row_number}: invalid {field}")
            kind = row["deadline_kind"]
            deadline = row["deadline"].strip()
            if kind == "specific":
                try:
                    date.fromisoformat(deadline)
                except ValueError as exc:
                    raise JobDataError(
                        f"job_submissions.csv row {row_number}: invalid deadline"
                    ) from exc
            elif kind not in {"rolling", "not_listed"} or deadline:
                raise JobDataError(f"job_submissions.csv row {row_number}: invalid deadline kind")
            count += 1
    return count


def main() -> int:
    try:
        jobs = load_jobs()
        queued = validate_queue()
        current = HTML_FILE.read_text(encoding="utf-8")
        generated, active_count = build_document(current, jobs)
    except (OSError, JobDataError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if generated != current:
        print("ERROR: jobs.html is out of date; run python3 scripts/build_jobs.py", file=sys.stderr)
        return 1

    print(
        f"Validated {len(jobs)} published rows, {queued} queued submissions, "
        f"and {active_count} rendered jobs"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
