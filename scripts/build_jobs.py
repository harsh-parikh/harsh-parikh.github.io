#!/usr/bin/env python3
"""Build the static job board in jobs.html from data/jobs.csv."""

from __future__ import annotations

import argparse
import csv
import html
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CSV_FILE = ROOT / "data" / "jobs.csv"
HTML_FILE = ROOT / "jobs.html"

FIELDNAMES = [
    "id",
    "title",
    "organization",
    "location",
    "country",
    "type",
    "focus",
    "posted",
    "deadline",
    "deadline_label",
    "apply_url",
    "source_url",
    "description",
    "compensation",
    "remote",
    "featured",
    "verified",
]
REQUIRED_TEXT = {
    "id",
    "title",
    "organization",
    "location",
    "country",
    "type",
    "focus",
    "deadline_label",
    "apply_url",
    "source_url",
    "description",
    "verified",
}
ALLOWED_TYPES = {"postdoc", "fellowship", "faculty", "industry", "research"}
TYPE_NAMES = {
    "faculty": "Faculty",
    "postdoc": "Postdoc",
    "fellowship": "Fellowship",
    "industry": "Industry",
    "research": "Research",
}
TYPE_ICONS = {
    "faculty": "◎",
    "postdoc": "△",
    "fellowship": "✦",
    "industry": "◫",
    "research": "◇",
}
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class JobDataError(ValueError):
    """Raised when the CSV cannot safely be rendered."""


def parse_bool(value: str, field: str, row_number: int) -> bool:
    normalized = value.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise JobDataError(f"row {row_number}: {field} must be true or false")


def parse_iso_date(value: str, field: str, row_number: int) -> date | None:
    if not value.strip():
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError as exc:
        raise JobDataError(f"row {row_number}: {field} must be YYYY-MM-DD") from exc


def valid_https_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def load_jobs() -> list[dict[str, object]]:
    try:
        handle = CSV_FILE.open(newline="", encoding="utf-8-sig")
    except OSError as exc:
        raise JobDataError(f"cannot read {CSV_FILE}: {exc}") from exc

    with handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != FIELDNAMES:
            expected = ",".join(FIELDNAMES)
            found = ",".join(reader.fieldnames or [])
            raise JobDataError(f"CSV columns must be exactly:\n{expected}\nFound:\n{found}")

        jobs: list[dict[str, object]] = []
        seen_ids: set[str] = set()
        seen_roles: set[tuple[str, str]] = set()
        for row_number, raw in enumerate(reader, start=2):
            if raw.get(None):
                raise JobDataError(f"row {row_number}: found more values than CSV columns")
            row = {key: (raw.get(key) or "").strip() for key in FIELDNAMES}
            missing = sorted(field for field in REQUIRED_TEXT if not row[field])
            if missing:
                raise JobDataError(f"row {row_number}: blank required fields: {', '.join(missing)}")

            job_id = row["id"]
            if not ID_PATTERN.fullmatch(job_id):
                raise JobDataError(f"row {row_number}: id must be a lowercase hyphenated slug")
            if job_id in seen_ids:
                raise JobDataError(f"row {row_number}: duplicate id {job_id}")
            seen_ids.add(job_id)

            role_key = (
                re.sub(r"[^a-z0-9]+", " ", row["organization"].casefold()).strip(),
                re.sub(r"[^a-z0-9]+", " ", row["title"].casefold()).strip(),
            )
            if role_key in seen_roles:
                raise JobDataError(
                    f"row {row_number}: duplicate organization/title pair "
                    f"{row['organization']} / {row['title']}"
                )
            seen_roles.add(role_key)

            if row["type"] not in ALLOWED_TYPES:
                allowed = ", ".join(sorted(ALLOWED_TYPES))
                raise JobDataError(f"row {row_number}: type must be one of {allowed}")

            focus = [item.strip() for item in row["focus"].split("|") if item.strip()]
            if not focus:
                raise JobDataError(f"row {row_number}: focus must contain at least one value")

            for field in ("apply_url", "source_url"):
                if not valid_https_url(row[field]):
                    raise JobDataError(f"row {row_number}: {field} must be an https URL")

            deadline = parse_iso_date(row["deadline"], "deadline", row_number)
            posted = parse_iso_date(row["posted"], "posted", row_number)
            verified = parse_iso_date(row["verified"], "verified", row_number)
            if verified is None:
                raise JobDataError(f"row {row_number}: verified is required")

            jobs.append(
                {
                    **row,
                    "focus_items": focus,
                    "posted_date": posted,
                    "deadline_date": deadline,
                    "verified_date": verified,
                    "remote_value": parse_bool(row["remote"], "remote", row_number),
                    "featured_value": parse_bool(row["featured"], "featured", row_number),
                }
            )

    if not jobs:
        raise JobDataError("CSV must contain at least one job")
    return jobs


def deadline_status(job: dict[str, object], today: date) -> str:
    deadline = job["deadline_date"]
    if deadline is None:
        label = str(job["deadline_label"]).casefold()
        if "rolling" in label or "open" in label:
            return "open"
        return "unknown"
    days = (deadline - today).days
    if days < 0:
        return "expired"
    if days <= 14:
        return "urgent"
    if days <= 30:
        return "soon"
    return "later"


def deadline_copy(job: dict[str, object], today: date) -> str:
    deadline = job["deadline_date"]
    label = str(job["deadline_label"])
    if deadline is None:
        return label
    days = (deadline - today).days
    if days == 0:
        return f"{label} · today"
    if days == 1:
        return f"{label} · 1 day left"
    return f"{label} · {days} days left"


def attr(value: object) -> str:
    return html.escape(str(value), quote=True)


def text(value: object) -> str:
    return html.escape(str(value), quote=False)


def render_card(job: dict[str, object], today: date) -> str:
    kind = str(job["type"])
    focus_items = list(job["focus_items"])
    tags = "".join(f'<span class="tag">{text(tag)}</span>' for tag in focus_items)
    compensation = ""
    if job["compensation"]:
        compensation = (
            '\n              <div class="meta-line"><span class="meta-icon">$</span>'
            f'<span>{text(job["compensation"])}</span></div>'
        )
    remote = " · remote-friendly" if job["remote_value"] else ""
    search = " ".join(
        [
            str(job["title"]),
            str(job["organization"]),
            str(job["location"]),
            str(job["country"]),
            str(job["description"]),
            *[str(item) for item in focus_items],
        ]
    ).lower()
    deadline = job["deadline_date"]
    deadline_iso = deadline.isoformat() if isinstance(deadline, date) else ""
    featured = "true" if job["featured_value"] else "false"
    status = deadline_status(job, today)
    posted = job["posted_date"]
    posted_copy = ""
    if isinstance(posted, date):
        posted_copy = f"posted {posted.strftime('%b')} {posted.day} · "

    return f'''        <article class="job-card" data-id="{attr(job['id'])}" data-kind="{attr(kind)}" data-focus="{attr('|'.join(focus_items))}" data-country="{attr(job['country'])}" data-search="{attr(search)}" data-posted="{attr(job['posted'])}" data-deadline="{attr(deadline_iso)}" data-deadline-label="{attr(job['deadline_label'])}" data-verified="{attr(job['verified'])}" data-featured="{featured}" data-organization="{attr(job['organization'])}">
          <div class="card-top">
            <span class="type-badge">{TYPE_ICONS[kind]} {TYPE_NAMES[kind]}</span>
            <button class="bookmark" type="button" data-save="{attr(job['id'])}" aria-label="Save to bookmarks" title="Save this job">☆</button>
          </div>
          <h3>{text(job['title'])}</h3>
          <div class="org">{text(job['organization'])}</div>
          <p class="description">{text(job['description'])}</p>
          <div class="tags">{tags}</div>
          <div class="meta">
            <div class="meta-lines">
              <div class="meta-line"><span class="meta-icon">⌖</span><span>{text(job['location'])}{remote}</span></div>
              <div class="meta-line"><span class="meta-icon">◷</span><span class="deadline {status}" data-deadline-copy>{text(deadline_copy(job, today))}</span></div>{compensation}
            </div>
            <a class="apply" href="{attr(job['apply_url'])}" target="_blank" rel="noopener">View role <span aria-hidden="true">↗</span></a>
          </div>
          <div class="card-foot">
            <span class="verified">{text(posted_copy)}checked {text(job['verified'])}</span>
            <a class="source" href="{attr(job['source_url'])}" target="_blank" rel="noopener">source</a>
          </div>
        </article>'''


def replace_generated(document: str, name: str, content: str) -> str:
    start = f"<!-- GENERATED:{name}:START -->"
    end = f"<!-- GENERATED:{name}:END -->"
    pattern = re.compile(f"({re.escape(start)})(.*?)({re.escape(end)})", re.DOTALL)
    if len(pattern.findall(document)) != 1:
        raise JobDataError(f"jobs.html must contain exactly one {name} generated block")
    return pattern.sub(lambda match: f"{match.group(1)}{content}{match.group(3)}", document)


def build_document(document: str, jobs: list[dict[str, object]]) -> tuple[str, int]:
    today = date.today()
    active = [job for job in jobs if deadline_status(job, today) != "expired"]
    active.sort(
        key=lambda job: (
            job["deadline_date"] is None,
            job["deadline_date"] or date.max,
            not bool(job["featured_value"]),
            str(job["organization"]).casefold(),
        )
    )
    soon = sum(
        1
        for job in active
        if isinstance(job["deadline_date"], date)
        and 0 <= (job["deadline_date"] - today).days <= 30
    )
    faculty = sum(job["type"] == "faculty" for job in active)
    regions = len({str(job["country"]) for job in active})
    last_verified = max(job["verified_date"] for job in (active or jobs))
    updated = f"Last checked {last_verified.strftime('%B')} {last_verified.day}, {last_verified.year}"

    replacements = {
        "TOTAL": str(len(active)),
        "SOON": str(soon),
        "FACULTY": str(faculty),
        "REGIONS": str(regions),
        "UPDATED": updated,
        "RESULT_COUNT": f"{len(active)} {'opportunity' if len(active) == 1 else 'opportunities'} shown",
        "JOBS": "\n" + "\n".join(render_card(job, today) for job in active) + "\n        ",
    }
    for name, content in replacements.items():
        document = replace_generated(document, name, content)
    return document, len(active)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if jobs.html is not up to date")
    args = parser.parse_args()

    try:
        jobs = load_jobs()
        current = HTML_FILE.read_text(encoding="utf-8")
        generated, active_count = build_document(current, jobs)
    except (OSError, JobDataError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if args.check:
        if generated != current:
            print("ERROR: jobs.html is out of date; run python3 scripts/build_jobs.py", file=sys.stderr)
            return 1
        print(f"jobs.html is current with {active_count} active jobs from {CSV_FILE}")
        return 0

    HTML_FILE.write_text(generated, encoding="utf-8")
    print(f"Rendered {active_count} active jobs from {CSV_FILE} into {HTML_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
