#!/usr/bin/env python3
"""Review UF Statistics Jobs entries and merge current, in-scope roles into jobs.csv.

The UF board is a discovery source, not proof that a role remains open. This
importer applies conservative, reproducible screening rules and preserves the
UF detail page as the source link. Run without --update to review the audit
summary; pass --update only after reviewing the generated candidates.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CSV_FILE = ROOT / "data" / "jobs.csv"
UF_BOARD = "https://forms.stat.ufl.edu/statistics-jobs/"
VERIFY_DATE = date.today()

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

EXCLUDE_TITLE_PATTERNS = (
    r"\bph\.?d\.? candidate\b",
    r"\bresearch assistant\b",
    r"\bdepartment chair\b",
    r"\bdistinguished chair\b",
    r"\bendowed professor",
    r"\bassociate director\b",
    r"^associate or full professor",
    r"^tenured professor",
    r"^open rank tenured professor",
)

RELEVANCE_TERMS = (
    "statistic",
    "biostat",
    "data science",
    "machine learning",
    "artificial intelligence",
    "causal inference",
    "analytics",
    "epidemiology",
    "bioinformatics",
    "computational biology",
    "genomics",
)

# Confirmed against the employer page during the September 21, 2026 audit.
# Keep these explicit so a later review can remove them if a fresh requisition
# replaces the closed link.
CLOSED_IDS = {
    "13196",  # CUHK Taleo page reports the requisition unavailable.
    "13052",  # Moffitt application URL returns 404.
}

SOURCE_LINK_IDS = {
    "13213",  # Employer URL currently fails TLS checks; UF retains full instructions.
}

# Cross-source or semantically equivalent reposts that do not share the same
# title and organization spelling. The retained copies have a newer posting or
# a more direct, structured application page.
DUPLICATE_IDS = {
    "13239",  # Same NUS AI-for-science postdoc as AJO #32777.
    "13163",  # Same NUS faculty search as AJO #32423.
    "13080",  # Earlier copy of UF #13178 (UW–Madison postdoc).
    "12979",  # Earlier copy of UF #13202 (Southeast University faculty).
}

# Locations are deliberately explicit. Unknown institutions stay visible as
# "See posting" instead of being assigned a guessed city or country.
LOCATION_RULES = (
    ("Chinese University of Hong Kong, Shenzhen", "Shenzhen, China", "China"),
    ("Chinese University of Hong Kong", "Hong Kong", "Hong Kong"),
    ("Southeast University", "Nanjing, China", "China"),
    ("Renmin University", "Beijing, China", "China"),
    ("National University of Singapore", "Singapore", "Singapore"),
    ("KAUST", "Thuwal, Saudi Arabia", "Saudi Arabia"),
    ("Ahmedabad University", "Ahmedabad, India", "India"),
    ("Kalyan Singh Government Medical College", "Bulandshahr, India", "India"),
    ("SUNY Korea", "Incheon, South Korea", "South Korea"),
    ("The University of Hong Kong", "Hong Kong", "Hong Kong"),
    ("University of Toronto", "Toronto, ON, Canada", "Canada"),
    ("University of Guelph", "Guelph, ON, Canada", "Canada"),
    ("Rice University", "Houston, TX, USA", "United States"),
    ("Michigan State University", "East Lansing, MI, USA", "United States"),
    ("Pennsylvania State University", "University Park, PA, USA", "United States"),
    ("Harvard T.H. Chan", "Boston, MA, USA", "United States"),
    ("Harvard Department of Statistics", "Cambridge, MA, USA", "United States"),
    ("Columbia University", "New York, NY, USA", "United States"),
    ("Emory University", "Atlanta, GA, USA", "United States"),
    ("Wharton School", "Philadelphia, PA, USA", "United States"),
    ("University of California, San Francisco", "San Francisco, CA, USA", "United States"),
    ("University of Arkansas", "Fayetteville, AR, USA", "United States"),
    ("University of Notre Dame", "Notre Dame, IN, USA", "United States"),
    ("UNC-Chapel Hill", "Chapel Hill, NC, USA", "United States"),
    ("University of North Dakota", "Grand Forks, ND, USA", "United States"),
    ("Binghamton University", "Binghamton, NY, USA", "United States"),
    ("University of Virginia School of Medicine", "Charlottesville, VA, USA", "United States"),
    ("University of Virginia", "Charlottesville, VA, USA", "United States"),
    ("University of South Carolina", "Columbia, SC, USA", "United States"),
    ("University of California, Santa Cruz", "Santa Cruz, CA, USA", "United States"),
    ("Wake Forest University", "Winston-Salem, NC, USA", "United States"),
    ("University of Maryland, School of Medicine", "Baltimore, MD, USA", "United States"),
    ("University of Maryland, Baltimore", "Baltimore, MD, USA", "United States"),
    ("University of Maryland", "College Park, MD, USA", "United States"),
    ("Duke University", "Durham, NC, USA", "United States"),
    ("Southern Methodist University", "Dallas, TX, USA", "United States"),
    ("Stanford University", "Stanford, CA, USA", "United States"),
    ("Stanford Statistics", "Stanford, CA, USA", "United States"),
    ("University of California, Irvine", "Irvine, CA, USA", "United States"),
    ("University of Michigan", "Ann Arbor, MI, USA", "United States"),
    ("University of Rochester", "Rochester, NY, USA", "United States"),
    ("Villanova University", "Villanova, PA, USA", "United States"),
    ("University of Connecticut", "Storrs, CT, USA", "United States"),
    ("United States Naval Academy", "Annapolis, MD, USA", "United States"),
    ("University of Alabama", "Tuscaloosa, AL, USA", "United States"),
    ("University of Tennessee Health Science Center", "Memphis, TN, USA", "United States"),
    ("University of North Carolina at Greensboro", "Greensboro, NC, USA", "United States"),
    ("University of Wisconsin", "Madison, WI, USA", "United States"),
    ("Texas A&M University", "College Station, TX, USA", "United States"),
    ("Lawrence University", "Appleton, WI, USA", "United States"),
    ("University of Pittsburgh", "Pittsburgh, PA, USA", "United States"),
    ("BIOSTATISTICS AND HEALTH DATASCIENCE", "Pittsburgh, PA, USA", "United States"),
    ("Medpace", "Multiple locations", "United States"),
    ("Iowa State University", "Ames, IA, USA", "United States"),
    ("Washington University in St. Louis", "St. Louis, MO, USA", "United States"),
    ("Bowdoin College", "Brunswick, ME, USA", "United States"),
    ("Colgate University", "Hamilton, NY, USA", "United States"),
    ("University of Iowa", "Iowa City, IA, USA", "United States"),
    ("University of Missouri", "Columbia, MO, USA", "United States"),
    ("Yale School of Public Health", "New Haven, CT, USA", "United States"),
    ("Yale University", "New Haven, CT, USA", "United States"),
    ("University of Texas at El Paso", "El Paso, TX, USA", "United States"),
    ("Memorial Sloan", "New York, NY, USA", "United States"),
    ("NYU", "New York, NY, USA", "United States"),
    ("UCLA", "Los Angeles, CA, USA", "United States"),
    ("Baylor University", "Waco, TX, USA", "United States"),
    ("Vassar College", "Poughkeepsie, NY, USA", "United States"),
    ("University of Chicago", "Chicago, IL, USA", "United States"),
    ("San Diego State University", "San Diego, CA, USA", "United States"),
    ("St Olaf College", "Northfield, MN, USA", "United States"),
    ("Johns Hopkins", "Baltimore, MD, USA", "United States"),
    ("US Food And Drug Administration", "United States", "United States"),
    ("Gustavus Adolphus College", "Saint Peter, MN, USA", "United States"),
    ("Amherst College", "Amherst, MA, USA", "United States"),
    ("Fred Hutchinson", "Seattle, WA, USA", "United States"),
    ("Moffitt Cancer Center", "Tampa, FL, USA", "United States"),
    ("NIEHS", "Research Triangle Park, NC, USA", "United States"),
    ("Clemson University", "Clemson, SC, USA", "United States"),
    ("University of California - Santa Barbara", "Santa Barbara, CA, USA", "United States"),
    ("MD Anderson", "Houston, TX, USA", "United States"),
)

TITLE_OVERRIDES = {
    "13182": "Assistant Professor of Statistics",
}

ORGANIZATION_OVERRIDES = {
    "13174": "University of Pittsburgh · Biostatistics and Health Data Science",
    "13111": "Johns Hopkins University · Biostatistics",
}


def clean(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", " ", fragment, flags=re.IGNORECASE)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", html.unescape(fragment)).strip()


def get(url: str) -> str:
    request = Request(url, headers={"User-Agent": "Harsh-Parikh-job-board/1.0"})
    try:
        with urlopen(request, timeout=45) as response:
            return response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"could not fetch {url}: {exc}") from exc


def page_text(page: int, cache_dir: Path | None) -> str:
    if cache_dir:
        path = cache_dir / f"uf-jobs-{page}.html"
        if path.exists():
            return path.read_text(encoding="utf-8")
    return get(f"{UF_BOARD}?pagenum={page}")


def entry_text(entry_id: str, cache_dir: Path | None) -> str:
    if cache_dir:
        path = cache_dir / "uf-entries" / f"{entry_id}.html"
        if not path.exists():
            path = cache_dir / f"{entry_id}.html"
        if path.exists():
            return path.read_text(encoding="utf-8")
    return get(f"{UF_BOARD}entry/{entry_id}/")


def parse_date(value: str) -> date | None:
    value = value.strip()
    for fmt in ("%m/%d/%Y", "%B %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    return None


def parse_index(cache_dir: Path | None) -> dict[str, dict[str, object]]:
    entries: dict[str, dict[str, object]] = {}
    first_page = page_text(1, cache_dir)
    page_numbers = [int(value) for value in re.findall(r"[?&]pagenum=(\d+)", first_page)]
    final_page = max(page_numbers, default=1)
    for page in range(1, final_page + 1):
        document = first_page if page == 1 else page_text(page, cache_dir)
        matches = re.findall(
            r'entry/(\d+)/\?pagenum=\d+">(.*?)</a>.*?'
            r'Posted on:\s*</span><p>(.*?)</p>',
            document,
            flags=re.DOTALL,
        )
        if not matches or (page < final_page and len(matches) != 25):
            raise RuntimeError(
                f"unexpected UF row count on page {page} of {final_page}: {len(matches)}"
            )
        for entry_id, title, posted in matches:
            entries[entry_id] = {
                "entry_id": entry_id,
                "index_title": clean(title),
                "posted_date": parse_date(clean(posted)),
                "source_url": f"{UF_BOARD}entry/{entry_id}/",
            }
    return entries


def extract_urls(fragment: str) -> list[str]:
    decoded = html.unescape(fragment)
    values = re.findall(r'href=["\'](https?://[^"\']+)', decoded, flags=re.IGNORECASE)
    values.extend(re.findall(r"https?://[^\s<>\"']+", clean(decoded)))
    result: list[str] = []
    for value in values:
        value = value.rstrip(".,:;)]}>")
        if value.startswith("http://"):
            value = "https://" + value.removeprefix("http://")
        if value not in result:
            result.append(value)
    return result


def url_score(url: str, from_instructions: bool) -> int:
    parsed = urlparse(url)
    text_value = f"{parsed.netloc}{parsed.path}{parsed.query}".lower()
    score = 4 if from_instructions else 0
    score += 5 * any(
        token in text_value
        for token in ("apply", "career", "job", "posting", "position", "requisition", "mathjobs")
    )
    if parsed.path in ("", "/"):
        score -= 12
    if any(token in text_value for token in ("non-discrimination", "benefits", "strategicplan")):
        score -= 8
    return score


def parse_entry(base: dict[str, object], document: str) -> dict[str, object]:
    fields: dict[str, str] = {}
    raw_fields: dict[str, str] = {}
    for label, value in re.findall(
        r'<h4[^>]*><span class="gv-field-label">(.*?)</span>(.*?)</h4>',
        document,
        flags=re.DOTALL,
    ):
        fields[clean(label)] = clean(value)
        raw_fields[clean(label)] = value

    candidates: list[tuple[int, str]] = []
    for label in ("Application Instructions", "Position or Company Website"):
        for url in extract_urls(raw_fields.get(label, "")):
            candidates.append((url_score(url, label == "Application Instructions"), url))
    candidates.sort(reverse=True)

    entry_id = str(base["entry_id"])
    return {
        **base,
        "organization": ORGANIZATION_OVERRIDES.get(
            entry_id, fields.get("Company Name", "").strip()
        ),
        "title": TITLE_OVERRIDES.get(
            entry_id, fields.get("Position Title", str(base["index_title"])).strip()
        ),
        "company_information": fields.get("Company Information", ""),
        "duties": fields.get("Duties and Responsibilities", ""),
        "qualifications": fields.get("Position Qualifications", ""),
        "application_instructions": fields.get("Application Instructions", ""),
        "deadline_date": parse_date(fields.get("Application Deadline", "")),
        "salary": fields.get("Salary Range", ""),
        "apply_url": (
            candidates[0][1]
            if candidates
            and candidates[0][0] > 0
            and str(base["entry_id"]) not in SOURCE_LINK_IDS
            else str(base["source_url"])
        ),
    }


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def content_key(entry: dict[str, object]) -> str:
    material = "|".join(
        normalized(str(entry[field])) for field in ("organization", "title", "duties")
    )
    return hashlib.sha1(material.encode("utf-8")).hexdigest()


def screening_reason(entry: dict[str, object]) -> str:
    if str(entry["entry_id"]) in DUPLICATE_IDS:
        return "excluded: duplicate across source or title variant"
    if str(entry["entry_id"]) in CLOSED_IDS:
        return "excluded: official application page closed or missing"
    title = normalized(str(entry["title"]))
    full_text = normalized(
        " ".join(
            str(entry[field])
            for field in ("title", "company_information", "duties", "qualifications")
        )
    )
    if any(re.search(pattern, title, flags=re.IGNORECASE) for pattern in EXCLUDE_TITLE_PATTERNS):
        return "excluded: not an early-career post-PhD role"
    if not any(term in full_text for term in RELEVANCE_TERMS):
        return "excluded: outside board fields"
    deadline = entry["deadline_date"]
    if isinstance(deadline, date) and deadline < VERIFY_DATE:
        return "excluded: deadline passed"
    posted = entry["posted_date"]
    if deadline is None and isinstance(posted, date) and posted < VERIFY_DATE - timedelta(days=60):
        instructions = normalized(str(entry["application_instructions"]))
        if "open until filled" not in instructions and "until the position is filled" not in instructions:
            return "excluded: older than 60 days with no stated open deadline"
    return "include"


def infer_location(organization: str) -> tuple[str, str]:
    folded = organization.casefold()
    for needle, location, country in LOCATION_RULES:
        if needle.casefold() in folded:
            return location, country
    return "See posting", "Unspecified"


def infer_type(entry: dict[str, object]) -> str:
    title = normalized(str(entry["title"]))
    if "postdoc" in title or "post doctoral" in title:
        return "postdoc"
    if "fellowship" in title:
        return "fellowship"
    if any(
        term in title
        for term in ("professor", "lecturer", "instructor", "faculty", "tenure track", "tenured")
    ):
        return "faculty"
    if any(term in title for term in ("research scientist", "research associate", "researcher")):
        return "research"
    return "industry"


def infer_focus(entry: dict[str, object]) -> list[str]:
    text_value = normalized(
        " ".join(str(entry[field]) for field in ("title", "duties", "qualifications"))
    )
    rules = (
        ("Biostatistics", ("biostat",)),
        ("Statistics", ("statistic", "probability")),
        ("Data Science", ("data science", "data analytic")),
        ("Machine Learning", ("machine learning", "statistical learning")),
        ("AI", ("artificial intelligence", " ai ", " ai methods")),
        ("Causal Inference", ("causal inference",)),
        ("Computational Biology", ("computational biology", "bioinformatics")),
        ("Genomics", ("genomic",)),
        ("Public Health", ("public health", "epidemiology")),
        ("Business Analytics", ("business analytics", "operations management")),
    )
    focus = [label for label, terms in rules if any(term in f" {text_value} " for term in terms)]
    return focus[:4] or ["Statistics"]


def deadline_label(entry: dict[str, object]) -> str:
    deadline = entry["deadline_date"]
    if isinstance(deadline, date):
        return f"{deadline.strftime('%b')} {deadline.day}, {deadline.year}"
    instructions = normalized(str(entry["application_instructions"]))
    if "open until filled" in instructions or "until the position is filled" in instructions:
        return "Open until filled"
    return "Deadline not listed · check source"


def compensation(value: str) -> str:
    value = value.strip()
    if not value or value.casefold() in {"see full advertisement", "competitive"}:
        return ""
    signal = re.compile(
        r"[$£€¥]|\b(?:salary|pay|grade|competitive|commensurate|nih|gs-?\d)\b|\d{2,3}[,\d]{2,}",
        flags=re.IGNORECASE,
    )
    sentences = re.split(r"(?<=[.!?])\s+", value)
    first = next((sentence for sentence in sentences if signal.search(sentence)), "")
    if not first:
        return ""
    first = re.sub(r"\bup ot\b", "Up to", first, flags=re.IGNORECASE)
    return first if len(first) <= 140 else first[:137].rstrip() + "…"


def describe(kind: str, focus: list[str]) -> str:
    areas = ", ".join(focus[:3])
    if kind == "faculty":
        return f"Faculty position spanning {areas}. Review the source for rank, research, teaching, and application requirements."
    if kind == "postdoc":
        return f"Postdoctoral opportunity spanning {areas}. Review the source for project details, eligibility, and application materials."
    if kind == "fellowship":
        return f"Fellowship opportunity spanning {areas}. Review the source for eligibility, funding, and application requirements."
    if kind == "research":
        return f"Research position spanning {areas}. Review the source for appointment terms, qualifications, and application materials."
    return f"Industry role spanning {areas}. Review the source for experience requirements, location, and application details."


def make_row(entry: dict[str, object]) -> dict[str, str]:
    kind = infer_type(entry)
    focus = infer_focus(entry)
    location, country = infer_location(str(entry["organization"]))
    posted = entry["posted_date"]
    deadline = entry["deadline_date"]
    all_text = normalized(
        " ".join(str(entry[field]) for field in ("duties", "application_instructions"))
    )
    return {
        "id": f"uf-{entry['entry_id']}",
        "title": str(entry["title"]),
        "organization": str(entry["organization"]),
        "location": location,
        "country": country,
        "type": kind,
        "focus": "|".join(focus),
        "posted": posted.isoformat() if isinstance(posted, date) else "",
        "deadline": deadline.isoformat() if isinstance(deadline, date) else "",
        "deadline_label": deadline_label(entry),
        "apply_url": str(entry["apply_url"]),
        "source_url": str(entry["source_url"]),
        "description": describe(kind, focus),
        "compensation": compensation(str(entry["salary"])),
        "remote": (
            "true"
            if any(
                phrase in all_text
                for phrase in ("fully remote", "remote position", "remote work", "work remotely")
            )
            else "false"
        ),
        "featured": "false",
        "verified": VERIFY_DATE.isoformat(),
    }


def load_existing() -> list[dict[str, str]]:
    with CSV_FILE.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for source in reader:
            row = {field: (source.get(field) or "").strip() for field in FIELDNAMES}
            rows.append(row)
        return rows


def write_rows(rows: list[dict[str, str]]) -> None:
    with CSV_FILE.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=FIELDNAMES, quoting=csv.QUOTE_ALL, lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache-dir",
        type=Path,
        help="read uf-jobs-N.html and uf-entries/*.html from this directory",
    )
    parser.add_argument("--update", action="store_true", help="merge included rows into data/jobs.csv")
    args = parser.parse_args()

    try:
        indexed = parse_index(args.cache_dir)
        def load_entry(item: tuple[str, dict[str, object]]) -> dict[str, object]:
            entry_id, base = item
            return parse_entry(base, entry_text(entry_id, args.cache_dir))

        with ThreadPoolExecutor(max_workers=8) as executor:
            entries = list(executor.map(load_entry, indexed.items()))
    except (OSError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    newest_by_content: dict[str, dict[str, object]] = {}
    newest_by_role: dict[tuple[str, str], dict[str, object]] = {}
    duplicate_ids: set[str] = set()
    for entry in sorted(entries, key=lambda item: item["posted_date"] or date.min, reverse=True):
        key = content_key(entry)
        role_key = (normalized(str(entry["organization"])), normalized(str(entry["title"])))
        if key in newest_by_content or role_key in newest_by_role:
            duplicate_ids.add(str(entry["entry_id"]))
        else:
            newest_by_content[key] = entry
            newest_by_role[role_key] = entry

    decisions: Counter[str] = Counter()
    included: list[dict[str, str]] = []
    for entry in entries:
        if str(entry["entry_id"]) in duplicate_ids:
            reason = "excluded: duplicate repost"
        else:
            reason = screening_reason(entry)
        decisions[reason] += 1
        if reason == "include":
            included.append(make_row(entry))

    included.sort(key=lambda row: (row["deadline"] == "", row["deadline"] or "9999-12-31", row["organization"]))
    unknown_locations = sum(row["country"] == "Unspecified" for row in included)
    source_only = sum(row["apply_url"] == row["source_url"] for row in included)

    print(f"UF rows reviewed: {len(entries)}")
    for reason, count in sorted(decisions.items()):
        print(f"  {count:3}  {reason}")
    print(f"Candidates after screening: {len(included)}")
    print(f"Candidates with unspecified country: {unknown_locations}")
    print(f"Candidates using UF as the application link: {source_only}")

    if not args.update:
        print("Dry run only. Re-run with --update after reviewing the candidates.")
        return 0

    existing = load_existing()
    base_rows = [row for row in existing if not row["id"].startswith("uf-")]
    existing_urls = {normalized(row["apply_url"]) for row in base_rows}
    existing_pairs = {
        (normalized(row["organization"]), normalized(row["title"])) for row in base_rows
    }
    additions = [
        row
        for row in included
        if normalized(row["apply_url"]) not in existing_urls
        and (normalized(row["organization"]), normalized(row["title"])) not in existing_pairs
    ]
    combined: list[dict[str, str]] = []
    combined_keys: set[tuple[str, str]] = set()
    for row in base_rows + additions:
        key = (normalized(row["organization"]), normalized(row["title"]))
        if key in combined_keys:
            continue
        combined_keys.add(key)
        combined.append(row)
    write_rows(combined)
    print(f"Published {len(additions)} reviewed UF candidates to {CSV_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
