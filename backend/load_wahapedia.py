#!/usr/bin/env python3
"""
Wahapedia Database Loader (PostgreSQL)
Downloads all CSVs from wahapedia.ru and loads them into a PostgreSQL database.

Usage:
    python load_wahapedia.py
"""

import csv
import io
import urllib.request

import psycopg2

DB_CONFIG = {
    "dbname": "wahapedia",
    "user": "wahapedia_user",
    "password": "changeme",
    "host": "localhost",
    "port": 5432,
}

BASE_URL = "http://wahapedia.ru/wh40k10ed/"

TABLES = [
    "Factions",
    "Source",
    "Detachments",
    "Abilities",
    "Stratagems",
    "Enhancements",
    "Detachment_abilities",
    "Datasheets",
    "Datasheets_abilities",
    "Datasheets_keywords",
    "Datasheets_models",
    "Datasheets_options",
    "Datasheets_wargear",
    "Datasheets_unit_composition",
    "Datasheets_models_cost",
    "Datasheets_stratagems",
    "Datasheets_enhancements",
    "Datasheets_detachment_abilities",
    "Datasheets_leader",
    "Last_update",
]


def fetch_csv(table_name):
    url = BASE_URL + table_name + ".csv"
    print(f"  Fetching {url} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw), delimiter="|")
    rows = list(reader)
    fieldnames = [f for f in reader.fieldnames if f]
    return fieldnames, rows


def load_table(cur, table_name, fieldnames, rows):
    db_table = table_name.lower()
    if not rows:
        print(f"  [!] {table_name}: 0 rows — skipping insert")
        return

    cols = ", ".join(f'"{f.lower()}"' for f in fieldnames)
    placeholders = ", ".join("%s" for _ in fieldnames)
    sql = (
        f'INSERT INTO "{db_table}" ({cols}) VALUES ({placeholders})'
        f" ON CONFLICT DO NOTHING"
    )

    data = [tuple(row.get(f) or None for f in fieldnames) for row in rows]
    cur.executemany(sql, data)
    print(f"  [✓] {table_name}: {len(data)} rows inserted")


def main():
    print(f"Connecting to PostgreSQL database '{DB_CONFIG['dbname']}' ...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    for table in TABLES:
        try:
            fieldnames, rows = fetch_csv(table)
            load_table(cur, table, fieldnames, rows)
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"  [✗] {table}: ERROR — {e}")

    cur.close()
    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
