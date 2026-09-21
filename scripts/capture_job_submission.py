#!/usr/bin/env python3
"""Record a GitHub Issue Form job suggestion in the separate review queue CSV."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
QUEUE_FILE = ROOT / "data" / "job_submissions.csv"

FIELDNAMES = [
    "submission_id",
    "submitted_at",
    "submitter",
    "issue_url",
    "title",
    "organization",
    "location",
    "country",
    "type",
    "focus",
    "deadline_kind",
    "deadline",
    "apply_url",
    "source_url",
    "description",
    "compensation",
    "remote",
    "notes",
]

HEADINGS = {
    "title": "Job title",
    "organization": "Organization",
    "location": "Location",
    "country": "Country or region",
    "type": "Job type",
    "focus": "Focus areas",
    "deadline_kind": "Deadline kind",
    "deadline": "Deadline",
    "apply_url": "Official application URL",
    "source_url": "Source URL",
    "description": "Short description",
    "compensation": "Compensation",
    "remote": "Remote-friendly",
    "notes": "Additional notes",
}

TYPE_MAP = {
    "postdoc": "postdoc",
    "fellowship": "fellowship",
    "faculty": "faculty",
    "industry": "industry",
    "research": "research",
}

DEADLINE_KIND_MAP = {
    "specific date": "specific",
    "rolling or open until filled": "rolling",
    "not listed": "not_listed",
}


class SubmissionError(ValueError):
    """Raised when an issue cannot safely enter the review queue."""


def clean(value: str, *, limit: int = 1200) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    if value.casefold() in {"_no response_", "no response"}:
        return ""
    if len(value) > limit:
        raise SubmissionError(f"field exceeds {limit} characters")
    if value[:1] in {"=", "+", "@"} or re.match(r"^-[=+@0-9]", value):
        raise SubmissionError("field begins with a spreadsheet-formula character")
    return value


def valid_https_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def parse_sections(body: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    pattern = re.compile(r"^###\s+(.+?)\s*$\n(.*?)(?=^###\s+|\Z)", re.MULTILINE | re.DOTALL)
    for heading, value in pattern.findall(body or ""):
        sections[heading.strip()] = value.strip()
    return sections


def normalize_focus(value: str) -> str:
    items = [clean(item, limit=80) for item in re.split(r"[,|;]", value) if item.strip()]
    unique = list(dict.fromkeys(items))
    if not unique:
        raise SubmissionError("focus areas are required")
    return "|".join(unique)


def submission_from_event(event: dict[str, object]) -> dict[str, str]:
    issue = event.get("issue")
    if not isinstance(issue, dict):
        raise SubmissionError("event does not contain an issue")
    issue_title = str(issue.get("title") or "")
    if not issue_title.startswith("[Job submission]:"):
        raise SubmissionError("issue is not a Job Board submission")

    sections = parse_sections(str(issue.get("body") or ""))
    values = {field: clean(sections.get(heading, "")) for field, heading in HEADINGS.items()}
    required = [
        "title",
        "organization",
        "location",
        "country",
        "type",
        "focus",
        "deadline_kind",
        "apply_url",
        "source_url",
        "description",
        "remote",
    ]
    missing = [field for field in required if not values[field]]
    if missing:
        raise SubmissionError(f"missing required form values: {', '.join(missing)}")

    job_type = TYPE_MAP.get(values["type"].casefold())
    if not job_type:
        raise SubmissionError("unknown job type")
    deadline_kind = DEADLINE_KIND_MAP.get(values["deadline_kind"].casefold())
    if not deadline_kind:
        raise SubmissionError("unknown deadline kind")
    deadline = values["deadline"]
    if deadline_kind == "specific":
        try:
            parsed_deadline = date.fromisoformat(deadline)
        except ValueError as exc:
            raise SubmissionError("specific deadline must be YYYY-MM-DD") from exc
        if parsed_deadline < date.today():
            raise SubmissionError("the submitted deadline has already passed")
    elif deadline:
        raise SubmissionError("deadline must be blank unless deadline kind is Specific date")

    for field in ("apply_url", "source_url"):
        if not valid_https_url(values[field]):
            raise SubmissionError(f"{field} must be an https URL")

    remote_value = values["remote"].casefold()
    if remote_value not in {"yes", "no"}:
        raise SubmissionError("remote-friendly must be Yes or No")

    number = issue.get("number")
    if not isinstance(number, int):
        raise SubmissionError("issue number is missing")
    user = issue.get("user")
    submitter = str(user.get("login") or "") if isinstance(user, dict) else ""

    return {
        "submission_id": f"issue-{number}",
        "submitted_at": clean(str(issue.get("created_at") or ""), limit=40),
        "submitter": clean(submitter, limit=100),
        "issue_url": clean(str(issue.get("html_url") or ""), limit=500),
        "title": values["title"],
        "organization": values["organization"],
        "location": values["location"],
        "country": values["country"],
        "type": job_type,
        "focus": normalize_focus(values["focus"]),
        "deadline_kind": deadline_kind,
        "deadline": deadline,
        "apply_url": values["apply_url"],
        "source_url": values["source_url"],
        "description": values["description"],
        "compensation": values["compensation"],
        "remote": "true" if remote_value == "yes" else "false",
        "notes": values["notes"],
    }


def load_queue() -> list[dict[str, str]]:
    with QUEUE_FILE.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != FIELDNAMES:
            raise SubmissionError("job_submissions.csv has unexpected columns")
        return list(reader)


def append_submission(row: dict[str, str]) -> None:
    existing = load_queue()
    if any(item["submission_id"] == row["submission_id"] for item in existing):
        print(f"Submission {row['submission_id']} is already queued")
        return
    with QUEUE_FILE.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=FIELDNAMES, quoting=csv.QUOTE_ALL, lineterminator="\n"
        )
        writer.writerow(row)
    print(f"Queued {row['submission_id']} for review: {row['organization']} — {row['title']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", required=True, type=Path, help="GitHub issue event JSON")
    args = parser.parse_args()
    try:
        event = json.loads(args.event.read_text(encoding="utf-8"))
        append_submission(submission_from_event(event))
    except (OSError, json.JSONDecodeError, SubmissionError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
