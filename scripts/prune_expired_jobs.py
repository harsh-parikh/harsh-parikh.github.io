#!/usr/bin/env python3
"""Delete jobs whose explicit deadline has passed from the CSV source of truth."""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True

try:
    from build_jobs import CSV_FILE, FIELDNAMES as JOB_FIELDS
    from capture_job_submission import FIELDNAMES as QUEUE_FIELDS, QUEUE_FILE
except ModuleNotFoundError:  # Support importing this file as scripts.prune_expired_jobs.
    from scripts.build_jobs import CSV_FILE, FIELDNAMES as JOB_FIELDS
    from scripts.capture_job_submission import FIELDNAMES as QUEUE_FIELDS, QUEUE_FILE


class PruneError(ValueError):
    """Raised when a CSV cannot be safely pruned."""


def read_csv(path: Path, fields: list[str]) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != fields:
            raise PruneError(f"{path.name} has unexpected columns")
        return list(reader)


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=fields, quoting=csv.QUOTE_ALL, lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def passed(value: str, today: date, label: str) -> bool:
    if not value.strip():
        return False
    try:
        return date.fromisoformat(value.strip()) < today
    except ValueError as exc:
        raise PruneError(f"{label} has invalid deadline {value!r}") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report removals without changing CSV files")
    parser.add_argument("--today", type=date.fromisoformat, default=date.today(), help="override date for testing")
    args = parser.parse_args()

    try:
        jobs = read_csv(CSV_FILE, JOB_FIELDS)
        expired_jobs = [row for row in jobs if passed(row["deadline"], args.today, row["id"])]
        current_jobs = [row for row in jobs if row not in expired_jobs]

        queue = read_csv(QUEUE_FILE, QUEUE_FIELDS)
        expired_queue = [
            row
            for row in queue
            if row["deadline_kind"] == "specific"
            and passed(row["deadline"], args.today, row["submission_id"])
        ]
        current_queue = [row for row in queue if row not in expired_queue]

        for row in expired_jobs:
            print(f"Expired published job: {row['id']} — {row['organization']} / {row['title']}")
        for row in expired_queue:
            print(f"Expired queued submission: {row['submission_id']} — {row['organization']} / {row['title']}")

        if not args.dry_run:
            if expired_jobs:
                write_csv(CSV_FILE, JOB_FIELDS, current_jobs)
            if expired_queue:
                write_csv(QUEUE_FILE, QUEUE_FIELDS, current_queue)
        print(f"Removed {len(expired_jobs)} published and {len(expired_queue)} queued expired entries")
    except (OSError, PruneError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
