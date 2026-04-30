from flask import Flask, request, jsonify
from flask_cors import CORS

import db

app = Flask(__name__)
CORS(app)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/datasheet")
def get_datasheet():
    name = request.args.get("name", "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400

    conn = db.get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT * FROM datasheets WHERE name ILIKE %s AND (virtual IS NULL OR virtual != 'true') LIMIT 1",
            (name,),
        )
        sheet = cur.fetchone()

        if not sheet:
            cur.execute(
                "SELECT * FROM datasheets WHERE name ILIKE %s AND (virtual IS NULL OR virtual != 'true') LIMIT 1",
                (f"%{name}%",),
            )
            sheet = cur.fetchone()

        if not sheet:
            return jsonify({"error": "not found"}), 404

        ds_id = sheet["id"]

        cur.execute(
            "SELECT * FROM datasheets_models WHERE datasheet_id = %s ORDER BY line",
            (ds_id,),
        )
        models = cur.fetchall()

        cur.execute(
            """SELECT line, line_in_wargear, dice, name, description, range, type, a, bs_ws, s, ap, d
               FROM datasheets_wargear WHERE datasheet_id = %s AND name IS NOT NULL
               ORDER BY line, line_in_wargear""",
            (ds_id,),
        )
        wargear = cur.fetchall()

        cur.execute(
            "SELECT name, description, type FROM datasheets_abilities WHERE datasheet_id = %s ORDER BY line",
            (ds_id,),
        )
        abilities = cur.fetchall()

        cur.execute(
            "SELECT keyword, is_faction_keyword FROM datasheets_keywords WHERE datasheet_id = %s",
            (ds_id,),
        )
        keywords = cur.fetchall()

        cur.execute(
            "SELECT description FROM datasheets_unit_composition WHERE datasheet_id = %s ORDER BY line",
            (ds_id,),
        )
        composition = cur.fetchall()

        cur.execute(
            "SELECT description FROM datasheets_options WHERE datasheet_id = %s ORDER BY line",
            (ds_id,),
        )
        options = cur.fetchall()

        cur.execute(
            """SELECT s.name, s.type, s.cp_cost, s.turn, s.phase, s.description
               FROM stratagems s
               JOIN datasheets_stratagems ds ON ds.stratagem_id = s.id
               WHERE ds.datasheet_id = %s
               ORDER BY s.phase, s.name""",
            (ds_id,),
        )
        stratagems = cur.fetchall()

        cur.execute(
            """SELECT d.name FROM datasheets d
               JOIN datasheets_leader dl ON dl.attached_id = d.id
               WHERE dl.leader_id = %s ORDER BY d.name""",
            (ds_id,),
        )
        leads = cur.fetchall()

        return jsonify({
            "datasheet": dict(sheet),
            "models": [dict(m) for m in models],
            "wargear": [dict(w) for w in wargear],
            "abilities": [dict(a) for a in abilities],
            "keywords": [dict(k) for k in keywords],
            "composition": [dict(c) for c in composition],
            "options": [dict(o) for o in options],
            "stratagems": [dict(s) for s in stratagems],
            "leads": [dict(l) for l in leads],
        })
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    app.run(debug=True, port=5000)
