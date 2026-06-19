"""
NCDOT Vendor Directory Splitter
Splits VendorDirectoryPBS.csv into filtered CSV files:
  1. By Firm Type
  2. Vehicle-transport-relevant firms (hauling/trucking work codes)
  3. By Prequalification Status
"""

import csv
import os
from collections import defaultdict

INPUT_FILE = r"C:\Users\HP\Downloads\VendorDirectoryPBS.csv"
OUTPUT_DIR = r"C:\Users\HP\Downloads\NCDOT_Filtered"

# Work codes and NAICS codes that are relevant to vehicle/cargo transport
TRANSPORT_KEYWORDS = [
    "HAULING",
    "TRUCKING",
    "FREIGHT",
    "TRANSPORT",
    "TOW AND RECOVERY",
    "484110",  # GENERAL FREIGHT TRUCKING, LOCAL
    "484121",  # GENERAL FREIGHT TRUCKING, LONG-DISTANCE
    "484122",
    "484210",  # USED HOUSEHOLD AND OFFICE GOODS MOVING
    "484220",  # SPECIALIZED FREIGHT TRUCKING, LOCAL
    "484230",  # SPECIALIZED FREIGHT TRUCKING, LONG-DISTANCE
    "488490",  # OTHER SUPPORT ACTIVITIES FOR ROAD TRANSPORTATION
]

os.makedirs(OUTPUT_DIR, exist_ok=True)


def is_transport_relevant(row):
    """Check if a firm does hauling/trucking/transport work."""
    fields_to_check = [
        row.get("Construction Work Codes") or "",
        row.get("SBE Work codes") or "",
        row.get("NAICS") or "",
    ]
    combined = " ".join(fields_to_check).upper()
    return any(kw.upper() in combined for kw in TRANSPORT_KEYWORDS)


def normalize_firm_type(firm_type):
    """Return a safe filename-friendly firm type label."""
    if not firm_type:
        return "Unclassified"
    mapping = {
        "road & street construction": "Road_and_Street_Construction",
        "architectural/engineering":  "Architectural_Engineering",
        "other professional services": "Other_Professional_Services",
        "goods and services":          "Goods_and_Services",
        "vertical /building construction": "Vertical_Building_Construction",
        "none":                        "Unclassified",
        "":                            "Unclassified",
    }
    return mapping.get(firm_type.strip().lower(), "Other")


def normalize_status(status_raw):
    """
    Prequalification Status can be combined, e.g. 'Subcontractor, Professional Consultant'.
    Return a list of individual statuses.
    """
    parts = [s.strip() for s in status_raw.split(",")]
    return parts


def write_csv(filepath, rows, fieldnames):
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written: {os.path.basename(filepath)}  ({len(rows)} records)")


def main():
    with open(INPUT_FILE, newline="", encoding="utf-8") as f:
        # Skip the 2 title rows before the real header
        next(f)
        next(f)
        reader = csv.DictReader(f)
        # Strip None keys caused by trailing commas in the CSV header
        fieldnames = [col for col in reader.fieldnames if col is not None]
        rows = []
        for row in reader:
            row.pop(None, None)
            rows.append(row)

    print(f"Total records loaded: {len(rows)}\n")

    # ── 1. By Firm Type ────────────────────────────────────────────────
    print("=== By Firm Type ===")
    by_firm_type = defaultdict(list)
    for row in rows:
        key = normalize_firm_type(row.get("Firm Type") or "")
        by_firm_type[key].append(row)

    firm_type_dir = os.path.join(OUTPUT_DIR, "1_By_Firm_Type")
    os.makedirs(firm_type_dir, exist_ok=True)
    for firm_type, firm_rows in sorted(by_firm_type.items()):
        filepath = os.path.join(firm_type_dir, f"{firm_type}.csv")
        write_csv(filepath, firm_rows, fieldnames)

    # ── 2. Vehicle/Transport-relevant firms ───────────────────────────
    print("\n=== Vehicle & Transport Relevant Firms ===")
    transport_rows = [r for r in rows if is_transport_relevant(r)]
    transport_dir = os.path.join(OUTPUT_DIR, "2_Transport_and_Hauling")
    os.makedirs(transport_dir, exist_ok=True)

    # All transport firms
    write_csv(
        os.path.join(transport_dir, "All_Transport_Hauling_Firms.csv"),
        transport_rows, fieldnames
    )

    # Sub-split: Statewide vs local
    statewide = [r for r in transport_rows if "STATEWIDE" in (r.get("Work Locations") or "").upper()]
    local_only = [r for r in transport_rows if "STATEWIDE" not in (r.get("Work Locations") or "").upper()]
    write_csv(os.path.join(transport_dir, "Transport_Statewide.csv"), statewide, fieldnames)
    write_csv(os.path.join(transport_dir, "Transport_Local_Only.csv"), local_only, fieldnames)

    # Sub-split: MBE/DBE/HUB certified transport firms (often preferred for partnerships)
    certified_transport = [
        r for r in transport_rows
        if any(c in (r.get("Certifications") or "") for c in ["DBE", "MBE", "WBE", "HUB", "SBE"])
    ]
    write_csv(
        os.path.join(transport_dir, "Transport_Certified_MBE_DBE_HUB.csv"),
        certified_transport, fieldnames
    )

    # ── 3. By Prequalification Status ────────────────────────────────
    print("\n=== By Prequalification Status ===")
    by_status = defaultdict(list)
    for row in rows:
        statuses = normalize_status(row.get("Prequalification Status") or "Unknown")
        for status in statuses:
            key = status.replace(" ", "_").replace("/", "_") or "Unknown"
            by_status[key].append(row)

    status_dir = os.path.join(OUTPUT_DIR, "3_By_Prequalification_Status")
    os.makedirs(status_dir, exist_ok=True)
    for status, status_rows in sorted(by_status.items()):
        filepath = os.path.join(status_dir, f"{status}.csv")
        write_csv(filepath, status_rows, fieldnames)

    # ── Summary ──────────────────────────────────────────────────────
    print(f"\n✅ All files written to: {OUTPUT_DIR}")
    print(f"\nQuick summary:")
    print(f"  Transport/Hauling firms total : {len(transport_rows)}")
    print(f"    - Statewide                 : {len(statewide)}")
    print(f"    - Local only                : {len(local_only)}")
    print(f"    - Certified (DBE/MBE/HUB)   : {len(certified_transport)}")
    print(f"  Firm types found              : {len(by_firm_type)}")
    print(f"  Prequalification statuses     : {len(by_status)}")


if __name__ == "__main__":
    main()
