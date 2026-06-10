import type { CombatResult } from "../../utils/combatCalc";
import styles from "./ResultRow.module.scss";

export function ResultRow({
  label,
  detail,
  pct,
  value,
  integer,
  critValue,
}: {
  label: string;
  detail: string;
  pct?: number;
  value: number;
  integer?: boolean;
  critValue?: number;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowDetail}>
        {detail}
        {pct !== undefined && <span className={styles.rowPct}> · {pct}%</span>}
      </span>
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

export function KeywordBadges({ result }: { result: CombatResult }) {
  const active = [
    result.torrent && "Torrent",
    result.benefitOfCover && "Cover",
    result.ignoresCover && "Ignores Cover",
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
