import { useState, useMemo, useEffect } from "react";
import { buildDefender, flattenWeapons, calcCombat } from "../../utils/combatCalc";
import type { CalcOptions, DefenderProfile, WeaponOption } from "../../utils/combatCalc";
import type { WeaponSlot, DefenderConfig } from "./types";
import { EMPTY_DEF } from "./types";
import {
  CALC_KEY,
  loadCalcState,
  sanitizeDefenderConfig,
  sanitizeWeaponConfig,
  sanitizeWeaponSlots,
} from "./persistence";
import { buildEffectiveWeapon, attackDetail, loadArmy } from "./weaponUtils";
import { defenderConfigFromProfile, buildEffectiveDefender } from "./defenderUtils";
import { WeaponSlotPanel } from "./WeaponSlotPanel";
import { ResultRow, KeywordBadges } from "./ResultRow";
import styles from "./Calculator.module.scss";

interface Props {
  savedLists: Record<string, string>;
}

export function Calculator({ savedLists }: Props) {
  const listEntries = Object.entries(savedLists);
  const saved = useMemo(() => loadCalcState(), []);

  const [attackerListId, setAttackerListId] = useState<string>(() =>
    String(saved.attackerListId ?? ""),
  );
  const [attackerUnitId, setAttackerUnitId] = useState<string>(() =>
    String(saved.attackerUnitId ?? ""),
  );
  const [weaponSlots, setWeaponSlots] = useState<WeaponSlot[]>(() => {
    const sanitized = sanitizeWeaponSlots(saved.weaponSlots);
    if (sanitized) return sanitized;
    // backward compat: old single-weapon format
    return [
      {
        idx: Number(saved.attackerWeaponIdx ?? -1),
        config: sanitizeWeaponConfig(saved.weaponConfig),
      },
    ];
  });
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
          weaponSlots,
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
    weaponSlots,
    defenderListId,
    defenderUnitId,
    defenderConfig,
    defenderBase,
  ]);

  const attackerArmy = useMemo(
    () => (attackerListId ? loadArmy(attackerListId) : null),
    [attackerListId],
  );
  const defenderArmy = useMemo(
    () => (defenderListId ? loadArmy(defenderListId) : null),
    [defenderListId],
  );

  const attackerUnit = attackerArmy?.units.find((u) => u.id === attackerUnitId) ?? null;
  const defenderUnit = defenderArmy?.units.find((u) => u.id === defenderUnitId) ?? null;

  const weaponOptions = useMemo<WeaponOption[]>(
    () => (attackerUnit ? flattenWeapons(attackerUnit) : []),
    [attackerUnit],
  );

  const defenderProfile =
    defenderConfig && defenderBase
      ? buildEffectiveDefender(defenderConfig, defenderBase)
      : null;

  function setDefField<K extends keyof DefenderConfig>(key: K, value: DefenderConfig[K]) {
    setDefenderConfig((c) => (c ? { ...c, [key]: value } : null));
  }

  // ── Per-slot computed results ──────────────────────────────────────────────

  const slotResults = useMemo(() => {
    return weaponSlots.map((slot) => {
      const selected = slot.idx >= 0 ? (weaponOptions[slot.idx] ?? null) : null;
      if (!selected || !slot.config) return null;
      if (!defenderProfile || !attackerUnit) return null;

      const cfg = slot.config;
      const effective = buildEffectiveWeapon(selected.weapon, selected.skill, cfg);
      const modelCount = attackerUnit.modelCount ?? 1;

      const blastBonus = cfg.blast
        ? Math.floor((defenderUnit?.modelCount ?? 0) / 5)
        : 0;
      const opts: CalcOptions = {
        critHitThresh: Math.max(2, Math.min(6, parseInt(cfg.critHit) || 6)),
        critWoundThresh: Math.max(2, Math.min(6, parseInt(cfg.critWound) || 6)),
        rerollHits: cfg.rerollHits,
        rerollWounds: cfg.rerollWounds,
        rapidFireBonus:
          cfg.halfRange && cfg.rapidFire ? parseInt(cfg.rapidFireN) || 0 : 0,
        meltaBonus: cfg.halfRange && cfg.melta ? parseInt(cfg.meltaN) || 0 : 0,
        blastBonus,
        benefitOfCover: defenderConfig?.cover ?? false,
        woundPenaltyIfSGtT: defenderConfig?.woundPenaltyIfSGtT ?? false,
      };

      const result = calcCombat(effective, selected.skill, modelCount, defenderProfile, opts);

      const hints: string[] = [];
      if (result.valid) {
        if (opts.rerollHits === "all" || opts.rerollHits === "noncrits") {
          const altType = opts.rerollHits === "all" ? "noncrits" : "all";
          const alt = calcCombat(effective, selected.skill, modelCount, defenderProfile, {
            ...opts,
            rerollHits: altType,
          });
          if (alt.valid && alt.expectedModelsKilled > result.expectedModelsKilled + 0.001)
            hints.push(
              `Rerolling ${altType === "noncrits" ? "non-crit" : "missed"} hits would be better (${alt.expectedModelsKilled.toFixed(2)} kills)`,
            );
        }
        if (opts.rerollWounds === "all" || opts.rerollWounds === "noncrits") {
          const altType = opts.rerollWounds === "all" ? "noncrits" : "all";
          const alt = calcCombat(effective, selected.skill, modelCount, defenderProfile, {
            ...opts,
            rerollWounds: altType,
          });
          if (alt.valid && alt.expectedModelsKilled > result.expectedModelsKilled + 0.001)
            hints.push(
              `Rerolling ${altType === "noncrits" ? "non-crit" : "failed"} wounds would be better (${alt.expectedModelsKilled.toFixed(2)} kills)`,
            );
        }
      }

      const derived = result.valid
        ? {
            hitPct:
              result.torrent || result.totalAttacks < 0.001
                ? undefined
                : Math.round((result.expectedHits / result.totalAttacks) * 100),
            woundPct:
              result.expectedHits < 0.001
                ? undefined
                : Math.round((result.expectedWounds / result.expectedHits) * 100),
            savePct:
              result.expectedWounds < 0.001
                ? undefined
                : Math.round(
                    (result.expectedWoundsAfterSave / result.expectedWounds) * 100,
                  ),
            fnpPct:
              result.fnpThresh !== null && result.expectedWoundsAfterSave >= 0.001
                ? Math.round(
                    (result.expectedFinalWounds / result.expectedWoundsAfterSave) * 100,
                  )
                : undefined,
            roundsToKill:
              defenderUnit != null && result.expectedModelsKilled > 0.001
                ? (defenderUnit.modelCount ?? 1) / result.expectedModelsKilled
                : null,
            overkillPct:
              defenderProfile && result.expectedDamage > 0.001
                ? Math.round(
                    ((result.expectedDamage -
                      result.expectedModelsKilled * defenderProfile.W) /
                      result.expectedDamage) *
                      100,
                  )
                : null,
          }
        : null;

      return { selected, effective, opts, result, hints, derived };
    });
  }, [
    weaponSlots,
    weaponOptions,
    attackerUnit,
    defenderProfile,
    defenderUnit,
    defenderConfig,
  ]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAttackerList(id: string) {
    setAttackerListId(id);
    setAttackerUnitId("");
    setWeaponSlots([{ idx: -1, config: null }]);
  }
  function handleAttackerUnit(id: string) {
    setAttackerUnitId(id);
    setWeaponSlots([{ idx: -1, config: null }]);
  }
  function updateSlot(i: number, updates: Partial<WeaponSlot>) {
    setWeaponSlots((slots) =>
      slots.map((s, j) => (j === i ? { ...s, ...updates } : s)),
    );
  }
  function addWeaponSlot() {
    setWeaponSlots((slots) => [...slots, { idx: -1, config: null }]);
  }
  function removeWeaponSlot(i: number) {
    setWeaponSlots((slots) => slots.filter((_, j) => j !== i));
  }

  // ── Derived render values ─────────────────────────────────────────────────

  const validSlotResults = slotResults.filter(
    (sr): sr is NonNullable<typeof sr> => sr !== null && sr.result !== null,
  );
  const anyResult = slotResults.some((sr) => sr !== null);
  const multipleWeapons = validSlotResults.filter((sr) => sr.result.valid).length > 1;
  const totalKills = validSlotResults
    .filter((sr) => sr.result.valid)
    .reduce((sum, sr) => sum + sr.result.expectedModelsKilled, 0);
  const combinedRoundsToKill =
    multipleWeapons && defenderUnit && totalKills > 0.001
      ? (defenderUnit.modelCount ?? 1) / totalKills
      : null;

  return (
    <div className={styles.page}>
      {/* ── Attacker ───────────────────────────────────────────────── */}
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
        </div>

        {attackerUnit && weaponSlots.every((s) => !s.config) && (
          <div className={styles.meta}>
            {attackerUnit.modelCount ? `${attackerUnit.modelCount} models` : "1 model"}
          </div>
        )}

        {(() => {
          const usedIndices = new Set(
            weaponSlots.map((s) => s.idx).filter((idx) => idx >= 0),
          );
          return weaponSlots.map((slot, i) => (
            <WeaponSlotPanel
              key={i}
              slot={slot}
              weaponOptions={weaponOptions}
              disabledIndices={
                new Set([...usedIndices].filter((idx) => idx !== slot.idx))
              }
              modelCount={attackerUnit?.modelCount ?? 1}
              onChange={(updates) => updateSlot(i, updates)}
              onRemove={() => removeWeaponSlot(i)}
              showRemove={weaponSlots.length > 1}
            />
          ));
        })()}

        {attackerUnit && (
          <button className={styles.addWeaponBtn} onClick={addWeaponSlot}>
            + Add weapon
          </button>
        )}
      </section>

      {/* ── Defender ───────────────────────────────────────────────── */}
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
              const profile: DefenderProfile | null = unit ? buildDefender(unit) : null;
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
          <>
            <div className={styles.customizeLabel}>
              <span>Override</span>
              <button
                className={styles.resetBtn}
                onClick={() => setDefenderConfig(EMPTY_DEF)}
              >
                Reset
              </button>
            </div>
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
            <div className={styles.kwRow}>
              <button
                className={styles.kwToggle}
                data-active={defenderConfig.cover ? "" : undefined}
                onClick={() => setDefField("cover", !defenderConfig.cover)}
              >
                Benefit of Cover
              </button>
              <button
                className={styles.kwToggle}
                data-active={defenderConfig.woundPenaltyIfSGtT ? "" : undefined}
                onClick={() => setDefField("woundPenaltyIfSGtT", !defenderConfig.woundPenaltyIfSGtT)}
              >
                −1 Wound (if S&gt;T)
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── Results ────────────────────────────────────────────────── */}
      {anyResult && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Result</div>
          {slotResults.map((sr, i) => {
            if (!sr) return null;
            const { selected, result, opts, derived, hints } = sr;
            const cfg = weaponSlots[i].config!;

            if (!result.valid) {
              return (
                <div key={i} className={styles.invalid}>
                  {result.invalidReason}
                </div>
              );
            }

            return (
              <div key={i} className={multipleWeapons ? styles.resultBlock : undefined}>
                {multipleWeapons && (
                  <div className={styles.resultWeaponLabel}>{selected.label}</div>
                )}
                <div className={styles.breakdown}>
                  <ResultRow
                    label="Attacks"
                    detail={
                      attackDetail(
                        attackerUnit!.modelCount ?? 1,
                        selected.weapon.count,
                        cfg.A || selected.weapon.A || "?",
                      ) + (opts.blastBonus ? ` +${opts.blastBonus} blast` : "")
                    }
                    value={result.totalAttacks}
                    integer
                  />
                  <ResultRow
                    label="Hit"
                    detail={
                      result.torrent
                        ? "Torrent"
                        : cfg.skill || selected.weapon[selected.skill] || "?"
                    }
                    pct={derived?.hitPct}
                    value={result.expectedHits}
                    critValue={result.expectedCritHits}
                  />
                  <ResultRow
                    label="Wound"
                    detail={`${result.woundThresh}+`}
                    pct={derived?.woundPct}
                    value={result.expectedWounds}
                    critValue={
                      result.devastatingWounds ? result.expectedCritWounds : undefined
                    }
                  />
                  <ResultRow
                    label="Save"
                    detail={
                      result.effectiveSave >= 7 ? "No save" : `${result.effectiveSave}+`
                    }
                    pct={derived?.savePct}
                    value={result.expectedWoundsAfterSave}
                  />
                  {result.fnpThresh !== null && (
                    <ResultRow
                      label="FNP"
                      detail={`${result.fnpThresh}+`}
                      pct={derived?.fnpPct}
                      value={result.expectedFinalWounds}
                    />
                  )}
                  <ResultRow
                    label="Damage"
                    detail={cfg.D || selected.weapon.D || "?"}
                    value={result.expectedDamage}
                  />
                </div>

                {!multipleWeapons && (
                  <>
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
                    {(derived?.roundsToKill != null || derived?.overkillPct != null) && (
                      <div className={styles.extraStats}>
                        {derived.roundsToKill != null && (
                          <span className={styles.extraStat}>
                            ~{derived.roundsToKill.toFixed(1)} turns to wipe
                          </span>
                        )}
                        {derived.overkillPct != null && (
                          <span className={styles.extraStat}>
                            {derived.overkillPct}% wasted
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}

                {multipleWeapons && (
                  <div className={styles.weaponKills}>
                    <span className={styles.weaponKillsLabel}>≈ kills</span>
                    <span className={styles.weaponKillsValue}>
                      {result.expectedModelsKilled.toFixed(2)}
                    </span>
                  </div>
                )}

                {hints.map((msg) => (
                  <div key={msg} className={styles.hint}>
                    {msg}
                  </div>
                ))}
                <KeywordBadges result={result} />
              </div>
            );
          })}

          {multipleWeapons && (
            <>
              <div className={styles.total}>
                <span className={styles.totalLabel}>≈ total models killed</span>
                <span className={styles.totalValue}>
                  {totalKills.toFixed(2)}
                  {defenderUnit?.modelCount != null && (
                    <span className={styles.totalOf}>/ {defenderUnit.modelCount}</span>
                  )}
                </span>
              </div>
              {combinedRoundsToKill != null && (
                <div className={styles.extraStats}>
                  <span className={styles.extraStat}>
                    ~{combinedRoundsToKill.toFixed(1)} turns to wipe
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {!anyResult && listEntries.length === 0 && (
        <div className={styles.empty}>
          Import at least one army list to use the calculator.
        </div>
      )}
    </div>
  );
}
