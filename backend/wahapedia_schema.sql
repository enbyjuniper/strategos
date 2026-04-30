-- Wahapedia Warhammer 40k 10th Edition Database Schema
-- Source: wahapedia.ru/wh40k10ed/
-- CSVs use "|" as delimiter, UTF-8 encoded
-- FK constraints omitted — CSV data has referential inconsistencies (virtual datasheets,
-- cross-faction stratagems, etc.) that would block loading.

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS factions (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    link        TEXT
);

CREATE TABLE IF NOT EXISTS source (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    type        TEXT,
    edition     TEXT,
    version     TEXT,
    errata_date TEXT,
    errata_link TEXT
);

CREATE TABLE IF NOT EXISTS detachments (
    id          TEXT PRIMARY KEY,
    faction_id  TEXT,
    name        TEXT,
    legend      TEXT,
    type        TEXT
);

CREATE TABLE IF NOT EXISTS abilities (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    legend      TEXT,
    faction_id  TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS stratagems (
    id            TEXT PRIMARY KEY,
    faction_id    TEXT,
    name          TEXT,
    type          TEXT,
    cp_cost       TEXT,
    legend        TEXT,
    turn          TEXT,
    phase         TEXT,
    description   TEXT,
    detachment    TEXT,
    detachment_id TEXT
);

CREATE TABLE IF NOT EXISTS enhancements (
    id            TEXT PRIMARY KEY,
    faction_id    TEXT,
    name          TEXT,
    legend        TEXT,
    description   TEXT,
    cost          TEXT,
    detachment    TEXT,
    detachment_id TEXT
);

CREATE TABLE IF NOT EXISTS detachment_abilities (
    id            TEXT PRIMARY KEY,
    faction_id    TEXT,
    name          TEXT,
    legend        TEXT,
    description   TEXT,
    detachment    TEXT,
    detachment_id TEXT
);

-- ============================================================
-- DATASHEETS
-- ============================================================

CREATE TABLE IF NOT EXISTS datasheets (
    id                  TEXT PRIMARY KEY,
    name                TEXT,
    faction_id          TEXT,
    source_id           TEXT,
    legend              TEXT,
    role                TEXT,
    loadout             TEXT,
    transport           TEXT,
    virtual             TEXT,
    leader_head         TEXT,
    leader_footer       TEXT,
    damaged_w           TEXT,
    damaged_description TEXT,
    link                TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_abilities (
    datasheet_id TEXT,
    line         TEXT,
    ability_id   TEXT,
    model        TEXT,
    name         TEXT,
    description  TEXT,
    type         TEXT,
    parameter    TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_keywords (
    datasheet_id       TEXT,
    keyword            TEXT,
    model              TEXT,
    is_faction_keyword TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_models (
    datasheet_id    TEXT,
    line            TEXT,
    name            TEXT,
    m               TEXT,
    t               TEXT,
    sv              TEXT,
    inv_sv          TEXT,
    inv_sv_descr    TEXT,
    w               TEXT,
    ld              TEXT,
    oc              TEXT,
    base_size       TEXT,
    base_size_descr TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_options (
    datasheet_id TEXT,
    line         TEXT,
    button       TEXT,
    description  TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_wargear (
    datasheet_id    TEXT,
    line            TEXT,
    line_in_wargear TEXT,
    dice            TEXT,
    name            TEXT,
    description     TEXT,
    range           TEXT,
    type            TEXT,
    a               TEXT,
    bs_ws           TEXT,
    s               TEXT,
    ap              TEXT,
    d               TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_unit_composition (
    datasheet_id TEXT,
    line         TEXT,
    description  TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_models_cost (
    datasheet_id TEXT,
    line         TEXT,
    description  TEXT,
    cost         TEXT
);

-- Junction / link tables

CREATE TABLE IF NOT EXISTS datasheets_stratagems (
    datasheet_id TEXT,
    stratagem_id TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_enhancements (
    datasheet_id   TEXT,
    enhancement_id TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_detachment_abilities (
    datasheet_id          TEXT,
    detachment_ability_id TEXT
);

CREATE TABLE IF NOT EXISTS datasheets_leader (
    leader_id   TEXT,
    attached_id TEXT
);

-- ============================================================
-- METADATA
-- ============================================================

CREATE TABLE IF NOT EXISTS last_update (
    last_update TEXT
);

-- ============================================================
-- INDEXES for common query patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_datasheets_faction     ON datasheets (faction_id);
CREATE INDEX IF NOT EXISTS idx_stratagems_faction     ON stratagems (faction_id);
CREATE INDEX IF NOT EXISTS idx_enhancements_faction   ON enhancements (faction_id);
CREATE INDEX IF NOT EXISTS idx_detachments_faction    ON detachments (faction_id);
CREATE INDEX IF NOT EXISTS idx_ds_abilities_sheet     ON datasheets_abilities (datasheet_id);
CREATE INDEX IF NOT EXISTS idx_ds_keywords_sheet      ON datasheets_keywords (datasheet_id);
CREATE INDEX IF NOT EXISTS idx_ds_models_sheet        ON datasheets_models (datasheet_id);
CREATE INDEX IF NOT EXISTS idx_ds_wargear_sheet       ON datasheets_wargear (datasheet_id);
CREATE INDEX IF NOT EXISTS idx_ds_leader_leader       ON datasheets_leader (leader_id);
CREATE INDEX IF NOT EXISTS idx_ds_stratagems_sheet    ON datasheets_stratagems (datasheet_id);
