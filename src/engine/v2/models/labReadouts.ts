// UB-B: LAB readouts (Hiring & teams, AI staff & needs, Security; design/ux/mockups/rd/DATA-b.md). Pure views on facts,
// beliefs and measurements: no hidden truth (no spies, no true China capacity, no true model build).
import { clamp } from '../../rng';
import { decimalYear } from '../core/time';
import { reqSpend, wslFloor, WSL_TARGET_RANGE } from '../security/security';
import { theftIntent } from '../world/chinagov';
import { buildCapacity } from '../departments/teams';
import { upkeepLines } from '../departments/build';
import type { GameStateV2, LogEntry } from '../types';

/** How fast weight security climbs while funded (security/security.ts securitySystem: ≤ 0.006 a level a day). */
export const WSL_RISE_PER_DAY = 0.006;

/** The lab's own estimate of how likely a determined attempt on its weights gets through, at weight security `wsl`
 *  and China's public theft intent (0–100): the same rule as the theft row of the risk map (actors/intel.ts pTheft).
 *  It has no time span: it is a per-attempt odds, not a chance per year. */
export function believedTheftChance(wsl: number, theftIntent: number): number {
  return clamp(0.05 + (3.5 - wsl) * 0.15 + clamp(theftIntent, 0, 100) / 300, 0, 1);
}

export interface SecurityLevelRow {
  level: number;
  /** $B a year to reach and hold it (what Set charges: SEC_TARGET's 1.05 × the required spend). */
  spend: number;
  theft: number;
  /** Days to climb there at the funded rate (0 = at or above it now). */
  days: number;
  now: boolean;
}

/** "What a higher level costs": today's level, then 3.5 · 4 · 4.5 · 5 (those above today), each with its spend, the
 *  believed theft odds and the time to reach it. */
export function securityLevelsView(s: GameStateV2): { rows: SecurityLevelRow[]; floorNow: number; floor2027: number; rate: number } {
  const sec = s.player.security;
  const intent = theftIntent(s);
  const online = s.player.computeOnline;
  const now = Math.round(sec.wsl * 10) / 10;
  const rows: SecurityLevelRow[] = [{ level: now, spend: reqSpend(sec.wsl, online), theft: believedTheftChance(sec.wsl, intent), days: 0, now: true }];
  for (let L = 2.5; L <= WSL_TARGET_RANGE[1] + 1e-9; L += 0.5) {
    if (L <= now + 0.05) continue;
    rows.push({ level: L, spend: reqSpend(L, online) * 1.05, theft: believedTheftChance(L, intent), days: Math.ceil((L - sec.wsl) / WSL_RISE_PER_DAY), now: false });
  }
  const y = decimalYear(s) - 2025;
  return { rows, floorNow: wslFloor(y), floor2027: wslFloor(Math.max(y, 2)), rate: WSL_RISE_PER_DAY };
}

const SEC_LOG = /secur|theft|stole|spy|spies|siloing|clearance|counter-intel|exfiltrat|weights? (?:were|was) taken|leak/i;
/** Security log: the lab's log lines about security, newest first. */
export function securityLogView(s: GameStateV2, n = 8): LogEntry[] {
  return s.log.filter((l) => SEC_LOG.test(l.text)).slice(-n).reverse();
}

/** Engineers' upkeep by kind as shares of build capacity (products · watchers · tools · environments). */
export function upkeepShares(s: GameStateV2): { products: number; watchers: number; tools: number; environments: number; total: number } {
  const cap = Math.max(1e-9, buildCapacity(s).capacity);
  const o = { products: 0, watchers: 0, tools: 0, environments: 0, total: 0 };
  for (const l of upkeepLines(s)) {
    const k = l.kind === 'product' ? 'products' : l.kind === 'monitor' ? 'watchers' : l.kind === 'suite' ? 'environments' : 'tools';
    o[k] += l.tw / cap;
    o.total += l.tw / cap;
  }
  return o;
}
