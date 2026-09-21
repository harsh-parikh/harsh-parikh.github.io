#!/usr/bin/env python3
"""Approve or reject one queued Job Board suggestion after human/agent review."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from datetime import date, datetime
from pathlib import Path

sys.dont_write_bytecode = True

try:
    from build_jobs import ALLOWED_TYPES, CSV_FILE, FIELDNAMES as JOB_FIELDS, valid_https_url
    from capture_job_submission import FIELDNAMES as QUEUE_FIELDS, QUEUE_FILE
except ModuleNotFoundError:  # Support importing this file as scripts.review_job_submission.
    from scripts.build_jobs import ALLOWED_TYPES, CSV_FILE, FIELDNAMES as JOB_FIELDS, valid_https_url
    from scripts.capture_job_submission import FIELDNAMES as QUEUE_FIELDS, QUEUE_FILE


class ReviewError(ValueError):
    """Raised when a queued suggestion is not safe to publish."""


def read_csv(path: Path, fields: list[str]) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != fields:
            raise ReviewError(f"{path.name} has unexpected columns")
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


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def slug(value: str) -> str:
    result = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return result[:48].rstrip("-") or "role"


def deadline_values(row: dict[str, str], today: date) -> tuple[str, str]:
    kind = row["deadline_kind"]
    value = row["deadline"].strip()
    if kind == "specific":
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ReviewError("specific deadline must be YYYY-MM-DD") from exc
        if parsed < today:
            raise ReviewError(f"deadline {value} has passed")
        return value, f"{parsed.strftime('%b')} {parsed.day}, {parsed.year}"
    if value:
        raise ReviewError("non-specific deadline rows must have a blank deadline")
    if kind == "rolling":
        return "", "Rolling / open until filled"
    if kind == "not_listed":
        return "", "Deadline not listed · check source"
    raise ReviewError(f"unknown deadline kind {kind!r}")


def publishable(row: dict[str, str], jobs: list[dict[str, str]], today: date) -> dict[str, str]:
    required = ["title", "organization", "location", "country", "type", "focus", "apply_url", "source_url", "description"]
    missing = [field for field in required if not row[field].strip()]
    if missing:
        raise ReviewError(f"blank required values: {', '.join(missing)}")
    if row["type"] not in ALLOWED_TYPES:
        raise ReviewError(f"unsupported type {row['type']!r}")
    if not [item for item in row["focus"].split("|") if item.strip()]:
        raise ReviewError("focus must contain at least one value")
    for field in ("apply_url", "source_url"):
        if not valid_https_url(row[field]):
            raise ReviewError(f"{field} must be an https URL")
    if row["remote"] not in {"true", "false"}:
        raise ReviewError("remote must be true or false")

    role_key = (normalized(row["organization"]), normalized(row["title"]))
    if any((normalized(job["organization"]), normalized(job["title"])) == role_key for job in jobs):
        raise ReviewError("a job with the same organization and title is already published")
    if any(row["apply_url"].rstrip("/") == job["apply_url"].rstrip("/") for job in jobs):
        raise ReviewError("this application URL is already published")

    deadline, deadline_label = deadline_values(row, today)
    try:
        posted = datetime.fromisoformat(row["submitted_at"].replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        posted = today.isoformat()
    issue_number = row["submission_id"].removeprefix("issue-")

    return {
        "id": f"community-{issue_number}-{slug(row['title'])}",
        "title": row["title"].strip(),
        "organization": row["organization"].strip(),
        "location": row["location"].strip(),
        "country": row["country"].strip(),
        "type": row["type"],
        "focus": row["focus"].strip(),
        "posted": posted,
        "deadline": deadline,
        "deadline_label": deadline_label,
        "apply_url": row["apply_url"].strip(),
        "source_url": row["source_url"].strip(),
        "description": row["description"].strip(),
        "compensation": row["compensation"].strip(),
        "remote": row["remote"],
        "featured": "false",
        "verified": today.isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--submission-id", required=True, help="Queue id, for example issue-123")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--approve", action="store_true", help="move the verified entry into jobs.csv")
    action.add_argument("--reject", action="store_true", help="remove an invalid entry from the queue")
    parser.add_argument(
        "--confirmed-active",
        action="store_true",
        help="attest that the official source was freshly checked and the role is open and in scope",
    )
    args = parser.parse_args()

    try:
        queue = read_csv(QUEUE_FILE, QUEUE_FIELDS)
        matches = [row for row in queue if row["submission_id"] == args.submission_id]
        if len(matches) != 1:
            raise ReviewError(f"expected one queue row for {args.submission_id}, found {len(matches)}")
        remaining = [row for row in queue if row["submission_id"] != args.submission_id]

        if args.approve:
            if not args.confirmed_active:
                raise ReviewError("approval requires --confirmed-active after checking the official source")
            jobs = read_csv(CSV_FILE, JOB_FIELDS)
            job = publishable(matches[0], jobs, date.today())
            jobs.append(job)
            write_csv(CSV_FILE, JOB_FIELDS, jobs)
            write_csv(QUEUE_FILE, QUEUE_FIELDS, remaining)
            print(f"Approved {args.submission_id} as {job['id']}; rebuild jobs.html next")
        else:
            write_csv(QUEUE_FILE, QUEUE_FIELDS, remaining)
            print(f"Rejected and removed {args.submission_id} from the queue")
    except (OSError, ReviewError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
