import type { DefenderProfile } from "../../utils/combatCalc";
import type { DefenderConfig } from "./types";

export function defenderConfigFromProfile(profile: DefenderProfile): DefenderConfig {
  return {
    T: String(profile.T),
    Sv: String(profile.Sv),
    W: Number.isInteger(profile.W) ? String(profile.W) : profile.W.toFixed(2),
    inv: profile.inv !== null ? String(profile.inv) : "",
    fnp: profile.fnp !== null ? String(profile.fnp) : "",
    cover: false,
    woundPenaltyIfSGtT: false,
  };
}

export function buildEffectiveDefender(
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
