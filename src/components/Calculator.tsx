import { useState, useMemo, useEffect } from "react";
import type { Army, WeaponStats } from "../types";
import { parseNR } from "../utils/parseNR";
import type { NRJson } from "../utils/parseNR";
import { readStore } from "../utils/storage";
import { buildDefender, flattenWeapons, calcCombat } from "../utils/combatCalc";
import type {
  CombatResult,
  CalcOptions,
  DefenderProfile,
} from "../utils/combatCalc";
import styles from "./Calculator.module.scss";

interface Props {
  savedLists: Record<string, string>;
}

// ── Weapon configuration state ────────────────────────────────────────────────

interface WeaponConfig {
  A: string;
  skill: string; // value of BS or WS (e.g. "3+")
  S: string;
  AP: string;
  D: string;
  lethalHits: boolean;
  devastatingWounds: boolean;
  twinLinked: boolean;
  torrent: boolean;
  indirectFire: boolean;
  sustainedHits: boolean;
  sustainedN: string;
  critHit: string; // crit hit threshold (default "6")
  critWound: string; // crit wound threshold (default "6")
  rerollHits: "none" | "ones" | "all" | "noncrits";
  rerollWounds: "none" | "ones" | "all" | "noncrits";
  halfRange: boolean; // rapid fire / melta: within half range
  lanceCharged: boolean; // lance: bearer charged this turn
  heavyStationary: boolean; // heavy: unit remained stationary
}

const KW_TOGGLES: { key: keyof WeaponConfig; label: string }[] = [
  { key: "lethalHits", label: "Lethal Hits" },
  { key: "devastatingWounds", label: "Dev. Wounds" },
  { key: "twinLinked", label: "Twin-linked" },
  { key: "torrent", label: "Torrent" },
  { key: "indirectFire", label: "Indirect" },
  { key: "lanceCharged", label: "Lance" },
  { key: "heavyStationary", label: "Heavy" },
];

// Keywords managed by toggles — preserved from base if not in this set
const MANAGED_KWS = new Set([
  "TORRENT",
  "LETHAL HITS",
  "DEVASTATING WOUNDS",
  "TWIN-LINKED",
  "INDIRECT FIRE",
  "LANCE",
  "HEAVY",
]);

function initConfig(weapon: WeaponStats): WeaponConfig {
  const parts = (weapon.Keywords ?? "")
    .toUpperCase()
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const kwSet = new Set(parts);
  const sustained = parts.find((k) => /^SUSTAINED HITS \d+$/.test(k));
  return {
    A: "",
    skill: "",
    S: "",
    AP: "",
    D: "",
    lethalHits: kwSet.has("LETHAL HITS"),
    devastatingWounds: kwSet.has("DEVASTATING WOUNDS"),
    twinLinked: kwSet.has("TWIN-LINKED"),
    torrent: kwSet.has("TORRENT"),
    indirectFire: kwSet.has("INDIRECT FIRE"),
    sustainedHits: sustained !== undefined,
    sustainedN: sustained ? (sustained.split(" ")[2] ?? "1") : "1",
    critHit: "6",
    critWound: "6",
    rerollHits: "none",
    rerollWounds: "none",
    halfRange: false,
    lanceCharged: false,
    heavyStationary: false,
  };
}

function buildEffectiveWeapon(
  base: WeaponStats,
  skill: "BS" | "WS",
  cfg: WeaponConfig,
): WeaponStats {
  const kws: string[] = [];
  if (cfg.torrent) kws.push("TORRENT");
  if (cfg.lethalHits) kws.push("LETHAL HITS");
  if (cfg.devastatingWounds) kws.push("DEVASTATING WOUNDS");
  if (cfg.sustainedHits) kws.push(`SUSTAINED HITS ${cfg.sustainedN || "1"}`);
  if (cfg.twinLinked) kws.push("TWIN-LINKED");
  if (cfg.indirectFire) kws.push("INDIRECT FIRE");
  if (cfg.lanceCharged) kws.push("LANCE");
  if (cfg.heavyStationary) kws.push("HEAVY");
  // Preserve unmanaged base keywords (e.g. RAPID FIRE, BLAST, PISTOL…)
  for (const k of (base.Keywords ?? "")
    .toUpperCase()
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)) {
    if (!MANAGED_KWS.has(k) && !/^SUSTAINED HITS/.test(k)) kws.push(k);
  }
  return {
    ...base,
    A: cfg.A || base.A,
    [skill]: cfg.skill || base[skill],
    S: cfg.S || base.S,
    AP: cfg.AP || base.AP,
    D: cfg.D || base.D,
    Keywords: kws.join(", "),
  };
}

// ── Defender configuration ────────────────────────────────────────────────────

interface DefenderConfig {
  T: string;
  Sv: string;
  W: string;
  inv: string;
  fnp: string;
}

const EMPTY_DEF: DefenderConfig = { T: "", Sv: "", W: "", inv: "", fnp: "" };

function defenderConfigFromProfile(profile: DefenderProfile): DefenderConfig {
  return {
    T: String(profile.T),
    Sv: String(profile.Sv),
    W: Number.isInteger(profile.W) ? String(profile.W) : profile.W.toFixed(2),
    inv: profile.inv !== null ? String(profile.inv) : "",
    fnp: profile.fnp !== null ? String(profile.fnp) : "",
  };
}

function buildEffectiveDefender(
  cfg: DefenderConfig,
  base: DefenderConfig,
): DefenderProfile | null {
  const T = parseInt(cfg.T || base.T);
  const Sv = parseInt(cfg.Sv || base.Sv);
  const W = parseFloat(cfg.W || base.W);
  if (isNaN(T) || isNaN(Sv) || isNaN(W)) return null;
  const invStr = cfg.inv.trim() || base.inv.trim();
  const fnpStr = cfg.fnp.trim() || base.fnp.trim();
  const inv = invStr ? parseInt(invStr) : null;
  const fnp = fnpStr ? parseInt(fnpStr) : null;
  return {
    T,
    Sv,
    W,
    inv: inv !== null && !isNaN(inv) ? inv : null,
    fnp: fnp !== null && !isNaN(fnp) ? fnp : null,
  };
}

// ── Persistence ──────────────────────────────────────────────────────────────

const CALC_KEY = "strategos_calc";

function loadCalcState(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(CALC_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sanitizeDefenderConfig(raw: unknown): DefenderConfig | null {
  if (!raw || typeof raw !== "object") return null;
  return { ...EMPTY_DEF, ...(raw as Partial<DefenderConfig>) };
}

function sanitizeWeaponConfig(raw: unknown): WeaponConfig | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    A: "",
    skill: "",
    S: "",
    AP: "",
    D: "",
    lethalHits: false,
    devastatingWounds: false,
    twinLinked: false,
    torrent: false,
    indirectFire: false,
    sustainedHits: false,
    sustainedN: "1",
    critHit: "6",
    critWound: "6",
    rerollHits: "none",
    rerollWounds: "none",
    halfRange: false,
    lanceCharged: false,
    heavyStationary: false,
    ...(raw as Partial<WeaponConfig>),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadArmy(listId: string): Army | null {
  try {
    const entry = readStore()[listId];
    return entry ? parseNR(JSON.parse(entry.raw) as NRJson) : null;
  } catch {
    return null;
  }
}

function attackDetail(
  modelCount: number,
  count: number | undefined,
  A: string,
): string {
  const c = count ?? 1;
  if (c > 1) return `${modelCount} × ${c}× ${A || "?"}`;
  return `${modelCount} × ${A || "?"}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Calculator({ savedLists }: Props) {
  const listEntries = Object.entries(savedLists);
  const saved = useMemo(() => loadCalcState(), []);

  const [attackerListId, setAttackerListId] = useState<string>(() =>
    String(saved.attackerListId ?? ""),
  );
  const [attackerUnitId, setAttackerUnitId] = useState<string>(() =>
    String(saved.attackerUnitId ?? ""),
  );
  const [attackerWeaponIdx, setAttackerWeaponIdx] = useState<number>(() =>
    Number(saved.attackerWeaponIdx ?? -1),
  );
  const [weaponConfig, setWeaponConfig] = useState<WeaponConfig | null>(() =>
    sanitizeWeaponConfig(saved.weaponConfig),
  );
  const [defenderListId, setDefenderListId] = useState<string>(() =>
    String(saved.defenderListId ?? ""),
  );
  const [defenderUnitId, setDefenderUnitId] = useState<string>(() =>
    String(saved.defenderUnitId ?? ""),
  );
  const [defenderConfig, setDefenderConfig] = useState<DefenderConfig | null>(
    () => sanitizeDefenderConfig(saved.defenderConfig),
  );
  const [defenderBase, setDefenderBase] = useState<DefenderConfig | null>(() =>
    sanitizeDefenderConfig(saved.defenderBase),
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        CALC_KEY,
        JSON.stringify({
          attackerListId,
          attackerUnitId,
          attackerWeaponIdx,
          weaponConfig,
          defenderListId,
          defenderUnitId,
          defenderConfig,
          defenderBase,
        }),
      );
    } catch {
      /* storage full */
    }
  }, [
    attackerListId,
    attackerUnitId,
    attackerWeaponIdx,
    weaponConfig,
    defenderListId,
    defenderUnitId,
    defenderConfig,
    defenderBase,
  ]);

  const attackerArmy = useMemo<Army | null>(
    () => (attackerListId ? loadArmy(attackerListId) : null),
    [attackerListId],
  );
  const defenderArmy = useMemo<Army | null>(
    () => (defenderListId ? loadArmy(defenderListId) : null),
    [defenderListId],
  );

  const attackerUnit =
    attackerArmy?.units.find((u) => u.id === attackerUnitId) ?? null;
  const defenderUnit =
    defenderArmy?.units.find((u) => u.id === defenderUnitId) ?? null;

  const weaponOptions = useMemo(
    () => (attackerUnit ? flattenWeapons(attackerUnit) : []),
    [attackerUnit],
  );

  const selectedWeapon =
    attackerWeaponIdx >= 0 ? (weaponOptions[attackerWeaponIdx] ?? null) : null;
  const defenderProfile =
    defenderConfig && defenderBase
      ? buildEffectiveDefender(defenderConfig, defenderBase)
      : null;

  function setDefField<K extends keyof DefenderConfig>(key: K, value: string) {
    setDefenderConfig((c) => (c ? { ...c, [key]: value } : null));
  }

  const effectiveWeapon = useMemo(() => {
    if (!selectedWeapon || !weaponConfig) return null;
    return buildEffectiveWeapon(
      selectedWeapon.weapon,
      selectedWeapon.skill,
      weaponConfig,
    );
  }, [selectedWeapon, weaponConfig]);

  // Parse variable-X keywords from the base weapon (not managed by toggles)
  const weaponKwInfo = useMemo(() => {
    const kws = (selectedWeapon?.weapon.Keywords ?? "")
      .toUpperCase()
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const rfKw = kws.find((k) => /^RAPID FIRE \d+$/.test(k));
    const meltaKw = kws.find((k) => /^MELTA \d+$/.test(k));
    return {
      rapidFireX: rfKw ? parseInt(rfKw.split(" ")[2]) : 0,
      meltaX: meltaKw ? parseInt(meltaKw.split(" ")[1]) : 0,
      hasBlast: kws.includes("BLAST"),
    };
  }, [selectedWeapon]);

  const calcOpts = useMemo<CalcOptions | null>(() => {
    if (!weaponConfig) return null;
    const blastBonus = weaponKwInfo.hasBlast
      ? Math.floor((defenderUnit?.modelCount ?? 0) / 5)
      : 0;
    return {
      critHitThresh: Math.max(
        2,
        Math.min(6, parseInt(weaponConfig.critHit) || 6),
      ),
      critWoundThresh: Math.max(
        2,
        Math.min(6, parseInt(weaponConfig.critWound) || 6),
      ),
      rerollHits: weaponConfig.rerollHits,
      rerollWounds: weaponConfig.rerollWounds,
      rapidFireBonus:
        weaponConfig.halfRange && weaponKwInfo.rapidFireX > 0
          ? weaponKwInfo.rapidFireX
          : 0,
      meltaBonus:
        weaponConfig.halfRange && weaponKwInfo.meltaX > 0
          ? weaponKwInfo.meltaX
          : 0,
      blastBonus,
    };
  }, [weaponConfig, weaponKwInfo, defenderUnit]);

  const result = useMemo<CombatResult | null>(() => {
    if (
      !effectiveWeapon ||
      !defenderProfile ||
      !attackerUnit ||
      !selectedWeapon ||
      !calcOpts
    )
      return null;
    return calcCombat(
      effectiveWeapon,
      selectedWeapon.skill,
      attackerUnit.modelCount ?? 1,
      defenderProfile,
      calcOpts,
    );
  }, [
    effectiveWeapon,
    defenderProfile,
    attackerUnit,
    selectedWeapon,
    calcOpts,
  ]);

  const hints = useMemo(() => {
    if (
      !effectiveWeapon ||
      !defenderProfile ||
      !attackerUnit ||
      !selectedWeapon ||
      !calcOpts ||
      !result?.valid
    )
      return [];
    const modelCount = attackerUnit.modelCount ?? 1;
    const messages: string[] = [];

    if (calcOpts.rerollHits === "all" || calcOpts.rerollHits === "noncrits") {
      const altType = calcOpts.rerollHits === "all" ? "noncrits" : "all";
      const alt = calcCombat(
        effectiveWeapon,
        selectedWeapon.skill,
        modelCount,
        defenderProfile,
        { ...calcOpts, rerollHits: altType },
      );
      if (
        alt.valid &&
        alt.expectedModelsKilled > result.expectedModelsKilled + 0.001
      )
        messages.push(
          `Rerolling ${altType === "noncrits" ? "non-crit" : "missed"} hits would be better (${alt.expectedModelsKilled.toFixed(2)} kills)`,
        );
    }

    if (
      calcOpts.rerollWounds === "all" ||
      calcOpts.rerollWounds === "noncrits"
    ) {
      const altType = calcOpts.rerollWounds === "all" ? "noncrits" : "all";
      const alt = calcCombat(
        effectiveWeapon,
        selectedWeapon.skill,
        modelCount,
        defenderProfile,
        { ...calcOpts, rerollWounds: altType },
      );
      if (
        alt.valid &&
        alt.expectedModelsKilled > result.expectedModelsKilled + 0.001
      )
        messages.push(
          `Rerolling ${altType === "noncrits" ? "non-crit" : "failed"} wounds would be better (${alt.expectedModelsKilled.toFixed(2)} kills)`,
        );
    }

    return messages;
  }, [
    effectiveWeapon,
    defenderProfile,
    attackerUnit,
    selectedWeapon,
    calcOpts,
    result,
  ]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleAttackerList(id: string) {
    setAttackerListId(id);
    setAttackerUnitId("");
    setAttackerWeaponIdx(-1);
    setWeaponConfig(null);
  }
  function handleAttackerUnit(id: string) {
    setAttackerUnitId(id);
    setAttackerWeaponIdx(-1);
    setWeaponConfig(null);
  }
  function handleWeaponSelect(idx: number) {
    setAttackerWeaponIdx(idx);
    if (idx >= 0 && weaponOptions[idx]) {
      const opt = weaponOptions[idx];
      setWeaponConfig(initConfig(opt.weapon));
    } else {
      setWeaponConfig(null);
    }
  }
  function setField<K extends keyof WeaponConfig>(
    key: K,
    value: WeaponConfig[K],
  ) {
    setWeaponConfig((c) => (c ? { ...c, [key]: value } : null));
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* ── Attacker ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Attacker</div>
        <div className={styles.selects}>
          <select
            className={styles.select}
            value={attackerListId}
            onChange={(e) => handleAttackerList(e.target.value)}
          >
            <option value="">— List —</option>
            {listEntries.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={attackerUnitId}
            onChange={(e) => handleAttackerUnit(e.target.value)}
            disabled={!attackerArmy}
          >
            <option value="">— Unit —</option>
            {attackerArmy?.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={attackerWeaponIdx}
            onChange={(e) => handleWeaponSelect(parseInt(e.target.value))}
            disabled={weaponOptions.length === 0}
          >
            <option value={-1}>— Weapon —</option>
            {weaponOptions.map((opt, i) => (
              <option key={i} value={i}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {attackerUnit && !weaponConfig && (
          <div className={styles.meta}>
            {attackerUnit.modelCount
              ? `${attackerUnit.modelCount} models`
              : "1 model"}
          </div>
        )}

        {/* ── Weapon customisation ───────────────────────────────── */}
        {weaponConfig && selectedWeapon && (
          <div className={styles.customize}>
            <div className={styles.customizeLabel}>
              {attackerUnit!.modelCount
                ? `${attackerUnit!.modelCount} models`
                : "1 model"}
            </div>

            <div className={styles.statGrid}>
              <span className={styles.statHeader}>A</span>
              <span className={styles.statHeader}>{selectedWeapon.skill}+</span>
              <span className={styles.statHeader}>S</span>
              <span className={styles.statHeader}>AP</span>
              <span className={styles.statHeader}>D</span>

              <input
                className={styles.statInput}
                value={weaponConfig.A}
                onChange={(e) => setField("A", e.target.value)}
                placeholder={selectedWeapon.weapon.A ?? "—"}
              />
              <input
                className={styles.statInput}
                value={weaponConfig.skill}
                onChange={(e) =>
                  setField("skill", e.target.value.replace(/\+/g, ""))
                }
                placeholder={
                  (selectedWeapon.weapon[selectedWeapon.skill] ?? "").replace(
                    /\+/g,
                    "",
                  ) || "—"
                }
              />
              <input
                className={styles.statInput}
                value={weaponConfig.S}
                onChange={(e) => setField("S", e.target.value)}
                placeholder={selectedWeapon.weapon.S ?? "—"}
              />
              <input
                className={styles.statInput}
                value={weaponConfig.AP}
                onChange={(e) => setField("AP", e.target.value)}
                placeholder={selectedWeapon.weapon.AP ?? "—"}
              />
              <input
                className={styles.statInput}
                value={weaponConfig.D}
                onChange={(e) => setField("D", e.target.value)}
                placeholder={selectedWeapon.weapon.D ?? "—"}
              />
            </div>

            <div className={styles.critRow}>
              <label className={styles.critItem}>
                <span>Crit hit on</span>
                <input
                  className={styles.critInput}
                  value={weaponConfig.critHit}
                  onChange={(e) => setField("critHit", e.target.value)}
                />
                <span>+</span>
              </label>
              <label className={styles.critItem}>
                <span>Crit wound on</span>
                <input
                  className={styles.critInput}
                  value={weaponConfig.critWound}
                  onChange={(e) => setField("critWound", e.target.value)}
                />
                <span>+</span>
              </label>
            </div>

            <div className={styles.kwRow}>
              {KW_TOGGLES.map(({ key, label }) => (
                <button
                  key={key}
                  className={styles.kwToggle}
                  data-active={weaponConfig[key] ? "" : undefined}
                  onClick={() =>
                    setField(
                      key,
                      !weaponConfig[
                        key as keyof WeaponConfig
                      ] as WeaponConfig[typeof key],
                    )
                  }
                >
                  {label}
                </button>
              ))}
              <button
                className={styles.kwToggle}
                data-active={weaponConfig.sustainedHits ? "" : undefined}
                onClick={() =>
                  setField("sustainedHits", !weaponConfig.sustainedHits)
                }
              >
                Sustained
              </button>
              {weaponConfig.sustainedHits && (
                <input
                  className={styles.sustainedInput}
                  type="text"
                  value={weaponConfig.sustainedN}
                  onChange={(e) => setField("sustainedN", e.target.value)}
                  placeholder="N"
                />
              )}
              {(weaponKwInfo.rapidFireX > 0 || weaponKwInfo.meltaX > 0) && (
                <button
                  className={styles.kwToggle}
                  data-active={weaponConfig.halfRange ? "" : undefined}
                  onClick={() => setField("halfRange", !weaponConfig.halfRange)}
                >
                  Half range
                  {weaponKwInfo.rapidFireX > 0
                    ? ` +${weaponKwInfo.rapidFireX}A`
                    : ""}
                  {weaponKwInfo.meltaX > 0 ? ` +${weaponKwInfo.meltaX}D` : ""}
                </button>
              )}
              {weaponKwInfo.hasBlast && defenderUnit && (
                <span className={styles.blastNote}>
                  Blast +{Math.floor((defenderUnit.modelCount ?? 0) / 5)}A
                </span>
              )}
            </div>

            <div className={styles.rerollRow}>
              <span className={styles.rerollLabel}>Reroll hits</span>
              <div className={styles.rerollBtns}>
                {(["none", "ones", "all", "noncrits"] as const).map((v) => (
                  <button
                    key={v}
                    className={styles.kwToggle}
                    data-active={
                      weaponConfig.rerollHits === v && v !== "none"
                        ? ""
                        : undefined
                    }
                    onClick={() => setField("rerollHits", v)}
                  >
                    {v === "none"
                      ? "None"
                      : v === "ones"
                        ? "1s"
                        : v === "all"
                          ? "All"
                          : "Non-crit"}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.rerollRow}>
              <span className={styles.rerollLabel}>Reroll wounds</span>
              <div className={styles.rerollBtns}>
                {(["none", "ones", "all", "noncrits"] as const).map((v) => (
                  <button
                    key={v}
                    className={styles.kwToggle}
                    data-active={
                      weaponConfig.rerollWounds === v && v !== "none"
                        ? ""
                        : undefined
                    }
                    onClick={() => setField("rerollWounds", v)}
                  >
                    {v === "none"
                      ? "None"
                      : v === "ones"
                        ? "1s"
                        : v === "all"
                          ? "All"
                          : "Non-crit"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Defender ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Defender</div>
        <div className={styles.selects}>
          <select
            className={styles.select}
            value={defenderListId}
            onChange={(e) => {
              setDefenderListId(e.target.value);
              setDefenderUnitId("");
              setDefenderConfig(null);
              setDefenderBase(null);
            }}
          >
            <option value="">— List —</option>
            {listEntries.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={defenderUnitId}
            onChange={(e) => {
              const id = e.target.value;
              setDefenderUnitId(id);
              const unit = id
                ? (defenderArmy?.units.find((u) => u.id === id) ?? null)
                : null;
              const profile = unit ? buildDefender(unit) : null;
              const base = profile
                ? defenderConfigFromProfile(profile)
                : id
                  ? EMPTY_DEF
                  : null;
              setDefenderBase(base);
              setDefenderConfig(base ? EMPTY_DEF : null);
            }}
            disabled={!defenderArmy}
          >
            <option value="">— Unit —</option>
            {defenderArmy?.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        {defenderConfig && (
          <div className={styles.statGrid}>
            <span className={styles.statHeader}>T</span>
            <span className={styles.statHeader}>Sv+</span>
            <span className={styles.statHeader}>W</span>
            <span className={styles.statHeader}>Inv+</span>
            <span className={styles.statHeader}>FNP+</span>
            <input
              className={styles.statInput}
              value={defenderConfig.T}
              onChange={(e) => setDefField("T", e.target.value)}
              placeholder={defenderBase?.T ?? "—"}
            />
            <input
              className={styles.statInput}
              value={defenderConfig.Sv}
              onChange={(e) => setDefField("Sv", e.target.value)}
              placeholder={defenderBase?.Sv ?? "—"}
            />
            <input
              className={styles.statInput}
              value={defenderConfig.W}
              onChange={(e) => setDefField("W", e.target.value)}
              placeholder={defenderBase?.W ?? "—"}
            />
            <input
              className={styles.statInput}
              value={defenderConfig.inv}
              onChange={(e) => setDefField("inv", e.target.value)}
              placeholder={defenderBase?.inv || "—"}
            />
            <input
              className={styles.statInput}
              value={defenderConfig.fnp}
              onChange={(e) => setDefField("fnp", e.target.value)}
              placeholder={defenderBase?.fnp || "—"}
            />
          </div>
        )}
      </section>

      {/* ── Results ──────────────────────────────────────────────── */}
      {result && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Result</div>
          {!result.valid ? (
            <div className={styles.invalid}>{result.invalidReason}</div>
          ) : (
            <>
              <div className={styles.breakdown}>
                <ResultRow
                  label="Attacks"
                  detail={attackDetail(
                    attackerUnit!.modelCount ?? 1,
                    selectedWeapon!.weapon.count,
                    weaponConfig!.A || selectedWeapon!.weapon.A || '?',
                  )}
                  value={result.totalAttacks}
                  integer
                />
                <ResultRow
                  label="Hit"
                  detail={
                    result.torrent
                      ? "Torrent"
                      : weaponConfig!.skill ||
                        selectedWeapon!.weapon[selectedWeapon!.skill] ||
                        "?"
                  }
                  value={result.expectedHits}
                  critValue={result.expectedCritHits}
                />
                <ResultRow
                  label="Wound"
                  detail={`${result.woundThresh}+`}
                  value={result.expectedWounds}
                  critValue={
                    result.devastatingWounds
                      ? result.expectedCritWounds
                      : undefined
                  }
                />
                <ResultRow
                  label="Save"
                  detail={
                    result.effectiveSave >= 7
                      ? "No save"
                      : `${result.effectiveSave}+`
                  }
                  value={result.expectedWoundsAfterSave}
                />
                {result.fnpThresh !== null && (
                  <ResultRow
                    label="FNP"
                    detail={`${result.fnpThresh}+`}
                    value={result.expectedFinalWounds}
                  />
                )}
                <ResultRow
                  label="Damage"
                  detail={weaponConfig!.D || selectedWeapon!.weapon.D || "?"}
                  value={result.expectedDamage}
                />
              </div>

              <div className={styles.total}>
                <span className={styles.totalLabel}>≈ models killed</span>
                <span className={styles.totalValue}>
                  {result.expectedModelsKilled.toFixed(2)}
                  {defenderUnit?.modelCount != null && (
                    <span className={styles.totalOf}>
                      / {defenderUnit.modelCount}
                    </span>
                  )}
                </span>
              </div>

              {hints.map((msg) => (
                <div key={msg} className={styles.hint}>
                  {msg}
                </div>
              ))}
              <KeywordBadges result={result} />
            </>
          )}
        </section>
      )}

      {!result && listEntries.length === 0 && (
        <div className={styles.empty}>
          Import at least one army list to use the calculator.
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultRow({
  label,
  detail,
  value,
  integer,
  critValue,
}: {
  label: string;
  detail: string;
  value: number;
  integer?: boolean;
  critValue?: number;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowDetail}>{detail}</span>
      <span className={styles.rowArrow}>→</span>
      <span className={styles.rowValue}>
        {integer ? Math.round(value) : value.toFixed(2)}
        {critValue !== undefined && (
          <span className={styles.rowCrit}>{critValue.toFixed(2)} crit</span>
        )}
      </span>
    </div>
  );
}

function KeywordBadges({ result }: { result: CombatResult }) {
  const active = [
    result.torrent && "Torrent",
    result.benefitOfCover && "Cover",
    result.lance && "Lance",
    result.heavy && "Heavy",
    result.rapidFireBonus > 0 && `Rapid Fire +${result.rapidFireBonus}A`,
    result.meltaBonus > 0 && `Melta +${result.meltaBonus}D`,
    result.blastBonus > 0 && `Blast +${result.blastBonus}A`,
    result.lethalHits && "Lethal Hits",
    result.devastatingWounds && "Dev. Wounds",
    result.sustainedHitsX > 0 && `Sustained ${result.sustainedHitsX}`,
    result.twinLinked && "Twin-linked",
    result.critHitThresh < 6 && `Crit hit ${result.critHitThresh}+`,
    result.critWoundThresh < 6 && `Crit wound ${result.critWoundThresh}+`,
    result.rerollHits !== "none" &&
      (result.rerollHits === "ones"
        ? "Reroll hit 1s"
        : result.rerollHits === "all"
          ? "Reroll hits"
          : "Reroll non-crit hits"),
    result.rerollWounds !== "none" &&
      (result.rerollWounds === "ones"
        ? "Reroll wound 1s"
        : result.rerollWounds === "all"
          ? "Reroll wounds"
          : "Reroll non-crit wounds"),
  ].filter(Boolean) as string[];
  if (active.length === 0) return null;
  return (
    <div className={styles.badges}>
      {active.map((k) => (
        <span key={k} className={styles.badge}>
          {k}
        </span>
      ))}
    </div>
  );
}
