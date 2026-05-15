import { ImageIcon, LinkIcon } from "@phosphor-icons/react";
import type { Unit, Phase } from "../types";
import { getInv, getFNP, isKeyword } from "../utils/abilities";
import { renderRichText } from "../utils/richText";
import { Badge } from "./Badge";
import { WeaponBlock } from "./WeaponBlock";
import styles from "./UnitCard.module.scss";

const UNIT_TYPES = new Set([
  "Infantry",
  "Swarm",
  "Beast",
  "Vehicle",
  "Monster",
  "Mounted",
  "Titanic",
]);

const TYPE_COLOR: Record<string, string> = {
  Infantry: "#5b8dd9",
  Swarm: "#a0c830",
  Beast: "#d07030",
  Vehicle: "#40c0d8",
  Monster: "#d04060",
  Mounted: "#c09050",
  Titanic: "#ff5540",
};
const MOVE_TAG_PREFIXES = [
  "Fly",
  "Deep Strike",
  "Infiltrators",
  "Scouts",
  "Walker",
];
const DUR_TAG_PREFIXES = ["Deadly Demise"];
const DUR_OVERLAY_PREFIXES = ["Lone Operative", "Stealth"];
const MELEE_OVERLAY_PREFIXES = ["Fights First"];

function findTags(prefixes: string[], pool: string[]): string[] {
  return prefixes.flatMap((prefix) => {
    const lower = prefix.toLowerCase();
    const match = pool.find((s) => {
      const sl = s.toLowerCase();
      return sl === lower || sl.startsWith(lower + " ");
    });
    return match ? [match] : [];
  });
}

interface Props {
  unit: Unit;
  phase: Phase;
  onOpenImagePicker?: () => void;
  onOpenPicker?: () => void;
  imageUrl?: string;
  acted?: boolean;
  onToggleActed?: () => void;
  clusterNameColor?: string;
}

export function UnitCard({
  unit,
  phase,
  onOpenImagePicker,
  onOpenPicker,
  imageUrl,
  acted,
  onToggleActed,
  clusterNameColor,
}: Props) {
  if (!unit.stats) return null;

  const inv = getInv(unit.abilities);
  const fnp = getFNP([...unit.abilities, ...unit.rules]);
  const regAbilities = unit.abilities.filter((a) => !isKeyword(a.name));

  const unitTypes = unit.keywords.filter((k) => UNIT_TYPES.has(k));
  const tagPool = [
    ...unit.keywords,
    ...unit.abilities.map((a) => a.name),
    ...unit.rules.map((a) => a.name),
  ];
  const moveTags = findTags(MOVE_TAG_PREFIXES, tagPool);
  const durTags = findTags(DUR_TAG_PREFIXES, tagPool);
  const durOverlayTags = findTags(DUR_OVERLAY_PREFIXES, tagPool);
  const meleeOverlayTags = findTags(MELEE_OVERLAY_PREFIXES, tagPool);

  const isInactive =
    (phase === "shoot" && unit.ranged.length === 0) ||
    (phase === "melee" && unit.melee.length === 0);

  const overlayTags =
    phase === "melee"
      ? meleeOverlayTags
      : phase === "dur"
        ? durOverlayTags
        : [];
  const overlayClass =
    phase === "melee" ? styles.meleeOverlay : styles.durOverlay;

  const cardClass = [
    styles.card,
    imageUrl ? styles.hasImage : "",
    overlayTags.length > 0 ? styles.hasCornerOverlay : "",
    acted ? styles.acted : "",
    isInactive ? styles.inactive : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} onClick={onToggleActed}>
      {overlayTags.length > 0 && (
        <div className={`${styles.cornerOverlay} ${overlayClass}`}>
          {overlayTags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      {imageUrl && (
        <div className={styles.imageWrapper}>
          <img
            src={imageUrl}
            className={styles.unitImage}
            alt=""
            aria-hidden="true"
          />
        </div>
      )}
      <div className={styles.cardContent}>
        <div className={styles.top}>
          <div className={styles.nameRow}>
            <div
              className={`${styles.name}${unit.isChar || unit.models?.some((m) => m.keywords.includes("Character")) ? ` ${styles.nameChar}` : ""}`}
              style={
                unit.isChar && clusterNameColor
                  ? { color: clusterNameColor }
                  : undefined
              }
            >
              {unit.name}
              {unit.modelCount && (
                <span className={styles.count}> ×{unit.modelCount}</span>
              )}
            </div>
            {onOpenImagePicker && (
              <button
                className={styles.button}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenImagePicker();
                }}
                title="Set unit image"
                disabled={acted}
              >
                <ImageIcon size={16} weight="fill" />
              </button>
            )}
            {onOpenPicker && (
              <button
                className={styles.button}
                onPointerDown={(e) => {
                  if (!acted) e.stopPropagation();
                }}
                onClick={(e) => {
                  if (!acted) {
                    e.stopPropagation();
                    onOpenPicker();
                  }
                }}
                title="Manage cluster"
                disabled={acted}
              >
                <LinkIcon size={16} weight="bold" />
              </button>
            )}
          </div>
          <div className={styles.topRight}>
            {unitTypes.map((t) => (
              <Badge size="regular" key={t} color={TYPE_COLOR[t]}>
                {t}
              </Badge>
            ))}
          </div>
        </div>

        {phase === "move" && (
          <>
            {unit.models ? (
              unit.models.map((m, i) => (
                <div key={i} className={styles.modelBlock}>
                  <div
                    className={styles.modelLabel}
                    style={
                      m.keywords.includes("Character")
                        ? { color: "var(--char)" }
                        : undefined
                    }
                  >
                    {m.name}
                    {m.number && m.number > 1 && (
                      <span className={styles.count}> ×{m.number}</span>
                    )}
                  </div>
                  <div className={styles.stats}>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>M</div>
                      <div className={styles.statValue}>{m.stats.M}</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>OC</div>
                      <div className={styles.statValue}>{m.stats.OC}</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>Ld</div>
                      <div className={styles.statValue}>{m.stats.Ld}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>M</div>
                  <div className={styles.statValue}>{unit.stats.M}</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>OC</div>
                  <div className={styles.statValue}>{unit.stats.OC}</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Ld</div>
                  <div className={styles.statValue}>{unit.stats.Ld}</div>
                </div>
              </div>
            )}
            {moveTags.length > 0 && (
              <div className={styles.tagRow}>
                {moveTags.map((t) => (
                  <Badge key={t} color="var(--move)">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}

        {phase === "dur" && (
          <>
            {unit.models ? (
              unit.models.map((m, i) => (
                <div key={i} className={styles.modelBlock}>
                  <div
                    className={styles.modelLabel}
                    style={
                      m.keywords.includes("Character")
                        ? { color: "var(--char)" }
                        : undefined
                    }
                  >
                    {m.name}
                    {m.number && m.number > 1 && (
                      <span className={styles.count}> ×{m.number}</span>
                    )}
                  </div>
                  <div className={styles.stats}>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>T</div>
                      <div className={styles.statValue}>{m.stats.T}</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>Sv</div>
                      <div className={styles.statValue}>{m.stats.Sv}</div>
                    </div>
                    <div
                      className={`${styles.stat}${!inv ? ` ${styles.absent}` : ""}`}
                    >
                      <div className={styles.statLabel}>INV</div>
                      <div className={styles.statValue}>{inv ?? "—"}</div>
                    </div>
                    <div
                      className={`${styles.stat}${!fnp ? ` ${styles.absent}` : ""}`}
                    >
                      <div className={styles.statLabel}>FNP</div>
                      <div className={styles.statValue}>{fnp ?? "—"}</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>W</div>
                      <div className={styles.statValue}>{m.stats.W}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>T</div>
                  <div className={styles.statValue}>{unit.stats.T}</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Sv</div>
                  <div className={styles.statValue}>{unit.stats.Sv}</div>
                </div>
                <div
                  className={`${styles.stat}${!inv ? ` ${styles.absent}` : ""}`}
                >
                  <div className={styles.statLabel}>INV</div>
                  <div className={styles.statValue}>{inv ?? "—"}</div>
                </div>
                <div
                  className={`${styles.stat}${!fnp ? ` ${styles.absent}` : ""}`}
                >
                  <div className={styles.statLabel}>FNP</div>
                  <div className={styles.statValue}>{fnp ?? "—"}</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>W</div>
                  <div className={styles.statValue}>{unit.stats.W}</div>
                </div>
              </div>
            )}
            {durTags.length > 0 && (
              <div className={styles.tagRow}>
                {durTags.map((t) => (
                  <Badge key={t} color="var(--dur)">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}

        {(phase === "shoot" || phase === "melee") && (
          <>
            {unit.models ? (
              unit.models.map((m, i) => {
                const mWeapons = phase === "shoot" ? m.ranged : m.melee;
                if (!mWeapons.length) return null;
                return (
                  <div key={i} className={styles.modelBlock}>
                    <div
                      className={styles.modelLabel}
                      style={
                        m.keywords.includes("Character")
                          ? { color: "var(--char)" }
                          : undefined
                      }
                    >
                      {m.name}
                      {m.number && m.number > 1 && (
                        <span className={styles.count}> ×{m.number}</span>
                      )}
                    </div>
                    <WeaponBlock
                      weapons={mWeapons}
                      accentColor={
                        phase === "shoot" ? "var(--shoot)" : "var(--melee)"
                      }
                    />
                  </div>
                );
              })
            ) : (
              <WeaponBlock
                weapons={phase === "shoot" ? unit.ranged : unit.melee}
                accentColor={
                  phase === "shoot" ? "var(--shoot)" : "var(--melee)"
                }
              />
            )}
          </>
        )}

        {phase === "abil" && (
          <>
            {unit.enhancement && (
              <div className={styles.enhancement}>
                <div className={styles.enhancementName}>
                  {unit.enhancement.name}
                </div>
                <div className={styles.abilDesc}>
                  {renderRichText(unit.enhancement.desc)}
                </div>
              </div>
            )}
            <div className={styles.abilities}>
              {regAbilities.length > 0 ? (
                regAbilities.map((a, i) => (
                  <div key={`${a.name}-${i}`}>
                    <div className={styles.abilName}>{a.name}</div>
                    <div className={styles.abilDesc}>
                      {renderRichText(a.desc)}
                    </div>
                  </div>
                ))
              ) : !unit.enhancement ? (
                <div className={styles.nodata}>no listed abilities</div>
              ) : null}
            </div>
            <div className={styles.keywords}>
              {unit.keywords.map((k) => (
                <Badge size="small" key={k}>
                  {k}
                </Badge>
              ))}
            </div>
            {unit.models?.some((m) => m.keywords.length > 0) && (
              <div className={styles.modelKeywords}>
                {unit.models
                  .filter((m) => m.keywords.length > 0)
                  .map((m, i) => (
                    <div key={i} className={styles.modelBlock}>
                      <div
                        className={styles.modelLabel}
                        style={
                          m.keywords.includes("Character")
                            ? { color: "var(--char)" }
                            : undefined
                        }
                      >
                        {m.name}
                        {m.number && m.number > 1 && (
                          <span className={styles.count}> ×{m.number}</span>
                        )}
                      </div>
                      <div className={styles.keywords}>
                        {m.keywords.map((k) => (
                          <Badge key={k}>{k}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
