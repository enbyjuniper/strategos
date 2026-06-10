import { useMemo } from "react";
import type { WeaponOption } from "../../utils/combatCalc";
import type { WeaponConfig, WeaponSlot } from "./types";
import { KW_TOGGLES } from "./types";
import { initConfig } from "./weaponUtils";
import styles from "./WeaponSlotPanel.module.scss";

interface Props {
  slot: WeaponSlot;
  weaponOptions: WeaponOption[];
  disabledIndices: Set<number>;
  modelCount: number;
  onChange: (updates: Partial<WeaponSlot>) => void;
  onRemove: () => void;
  showRemove: boolean;
}

export function WeaponSlotPanel({
  slot,
  weaponOptions,
  disabledIndices,
  modelCount,
  onChange,
  onRemove,
  showRemove,
}: Props) {
  const selected = slot.idx >= 0 ? (weaponOptions[slot.idx] ?? null) : null;
  const cfg = slot.config;

  function handleWeaponSelect(idx: number) {
    if (idx >= 0 && weaponOptions[idx]) {
      onChange({ idx, config: initConfig(weaponOptions[idx].weapon) });
    } else {
      onChange({ idx: -1, config: null });
    }
  }

  function setField<K extends keyof WeaponConfig>(key: K, value: WeaponConfig[K]) {
    if (!cfg) return;
    onChange({ config: { ...cfg, [key]: value } });
  }

  const weaponKwInfo = useMemo(() => {
    const kws = (selected?.weapon.Keywords ?? "")
      .toUpperCase()
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    return {
      hasRapidFire: kws.some((k) => /^RAPID FIRE \d+$/.test(k)),
      hasMelta: kws.some((k) => /^MELTA \d+$/.test(k)),
      hasBlast: kws.includes("BLAST"),
    };
  }, [selected]);

  return (
    <div className={styles.weaponSlot}>
      <div className={styles.slotHeader}>
        <select
          className={styles.select}
          value={slot.idx}
          onChange={(e) => handleWeaponSelect(parseInt(e.target.value))}
          disabled={weaponOptions.length === 0}
        >
          <option value={-1}>— Weapon —</option>
          {(["BS", "WS"] as const).map((skill) => {
            const group = weaponOptions
              .map((opt, i) => ({ opt, i }))
              .filter(({ opt }) => opt.skill === skill);
            if (group.length === 0) return null;
            return (
              <optgroup key={skill} label={skill === "BS" ? "Ranged" : "Melee"}>
                {group.map(({ opt, i }) => (
                  <option key={i} value={i} disabled={disabledIndices.has(i)}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {showRemove && (
          <button
            className={styles.removeBtn}
            onClick={onRemove}
            aria-label="Remove weapon"
          >
            ✕
          </button>
        )}
      </div>

      {cfg && selected && (
        <div className={styles.customize}>
          <div className={styles.customizeLabel}>
            <span>{modelCount > 1 ? `${modelCount} models` : "1 model"}</span>
            <button
              className={styles.resetBtn}
              onClick={() => onChange({ config: initConfig(selected.weapon) })}
            >
              Reset
            </button>
          </div>

          <div className={styles.statGrid}>
            <span className={styles.statHeader}>A</span>
            <span className={styles.statHeader}>{selected.skill}+</span>
            <span className={styles.statHeader}>S</span>
            <span className={styles.statHeader}>AP</span>
            <span className={styles.statHeader}>D</span>

            <input
              className={styles.statInput}
              value={cfg.A}
              onChange={(e) => setField("A", e.target.value)}
              placeholder={selected.weapon.A ?? "—"}
            />
            <input
              className={styles.statInput}
              value={cfg.skill}
              onChange={(e) => setField("skill", e.target.value.replace(/\+/g, ""))}
              placeholder={
                (selected.weapon[selected.skill] ?? "").replace(/\+/g, "") || "—"
              }
            />
            <input
              className={styles.statInput}
              value={cfg.S}
              onChange={(e) => setField("S", e.target.value)}
              placeholder={selected.weapon.S ?? "—"}
            />
            <input
              className={styles.statInput}
              value={cfg.AP}
              onChange={(e) => setField("AP", e.target.value)}
              placeholder={selected.weapon.AP ?? "—"}
            />
            <input
              className={styles.statInput}
              value={cfg.D}
              onChange={(e) => setField("D", e.target.value)}
              placeholder={selected.weapon.D ?? "—"}
            />
          </div>

          <div className={styles.critRow}>
            <label className={styles.critItem}>
              <span>Crit hit on</span>
              <input
                className={styles.critInput}
                value={cfg.critHit}
                onChange={(e) => setField("critHit", e.target.value)}
                placeholder="6"
              />
              <span>+</span>
            </label>
            <label className={styles.critItem}>
              <span>Crit wound on</span>
              <input
                className={styles.critInput}
                value={cfg.critWound}
                onChange={(e) => setField("critWound", e.target.value)}
                placeholder="6"
              />
              <span>+</span>
            </label>
          </div>

          <div className={styles.kwRow}>
            {KW_TOGGLES.map(({ key, label }) => (
              <button
                key={key}
                className={styles.kwToggle}
                data-active={cfg[key] ? "" : undefined}
                onClick={() =>
                  setField(key, !cfg[key as keyof WeaponConfig] as WeaponConfig[typeof key])
                }
              >
                {label}
              </button>
            ))}
            <span className={styles.kwGroup}>
              <button
                className={styles.kwToggle}
                data-active={cfg.sustainedHits ? "" : undefined}
                onClick={() => setField("sustainedHits", !cfg.sustainedHits)}
              >
                Sustained
              </button>
              {cfg.sustainedHits && (
                <input
                  className={styles.sustainedInput}
                  type="text"
                  value={cfg.sustainedN}
                  onChange={(e) => setField("sustainedN", e.target.value)}
                  placeholder="N"
                />
              )}
            </span>
            {weaponKwInfo.hasRapidFire && (
              <span className={styles.kwGroup}>
                <button
                  className={styles.kwToggle}
                  data-active={cfg.rapidFire ? "" : undefined}
                  onClick={() => setField("rapidFire", !cfg.rapidFire)}
                >
                  Rapid Fire
                </button>
                {cfg.rapidFire && (
                  <input
                    className={styles.sustainedInput}
                    type="text"
                    value={cfg.rapidFireN}
                    onChange={(e) => setField("rapidFireN", e.target.value)}
                    placeholder="N"
                  />
                )}
              </span>
            )}
            {weaponKwInfo.hasMelta && (
              <span className={styles.kwGroup}>
                <button
                  className={styles.kwToggle}
                  data-active={cfg.melta ? "" : undefined}
                  onClick={() => setField("melta", !cfg.melta)}
                >
                  Melta
                </button>
                {cfg.melta && (
                  <input
                    className={styles.sustainedInput}
                    type="text"
                    value={cfg.meltaN}
                    onChange={(e) => setField("meltaN", e.target.value)}
                    placeholder="N"
                  />
                )}
              </span>
            )}
            {weaponKwInfo.hasBlast && (
              <button
                className={styles.kwToggle}
                data-active={cfg.blast ? "" : undefined}
                onClick={() => setField("blast", !cfg.blast)}
              >
                Blast
              </button>
            )}
          </div>

          <div className={styles.rerollRow}>
            <span className={styles.rerollLabel}>Battle</span>
            <div className={styles.rerollBtns}>
              <button
                className={styles.kwToggle}
                data-active={cfg.halfRange ? "" : undefined}
                onClick={() => setField("halfRange", !cfg.halfRange)}
              >
                Half range
              </button>
              <button
                className={styles.kwToggle}
                data-active={cfg.lanceCharged ? "" : undefined}
                onClick={() => setField("lanceCharged", !cfg.lanceCharged)}
              >
                Has Charged
              </button>
              <button
                className={styles.kwToggle}
                data-active={cfg.heavyStationary ? "" : undefined}
                onClick={() => setField("heavyStationary", !cfg.heavyStationary)}
              >
                Stayed Stationary
              </button>
            </div>
          </div>

          <div className={styles.rerollRow}>
            <span className={styles.rerollLabel}>Reroll hits</span>
            <div className={styles.rerollBtns}>
              {(["none", "ones", "all", "noncrits"] as const).map((v) => (
                <button
                  key={v}
                  className={styles.kwToggle}
                  data-active={cfg.rerollHits === v && v !== "none" ? "" : undefined}
                  onClick={() => setField("rerollHits", v)}
                >
                  {v === "none" ? "None" : v === "ones" ? "1s" : v === "all" ? "All" : "Non-crit"}
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
                  data-active={cfg.rerollWounds === v && v !== "none" ? "" : undefined}
                  onClick={() => setField("rerollWounds", v)}
                >
                  {v === "none" ? "None" : v === "ones" ? "1s" : v === "all" ? "All" : "Non-crit"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
