// SR-13b targeted check (run alone: npx tsx scripts/v2/_sr13b/check.ts): safeguard costs are charged as shown.
//  1. adding a control protocol lowers the internal package's effective AI labour by its Slowdown (AI FTE × usefulness)
//     and bills its compute (Σ agent compute × deferred share × trusted cost) to the monitors' line;
//  2. a comms lockdown can be added (Respond › Add comms lockdown) and costs its 3% Slowdown;
//  3. a product's control protocol cuts its usage by the same Slowdown and adds its compute to its serving overhead.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { AGENT_USES } from '../../../src/data/v2/agents';
import { agentSplitShare, agentVersion, monitorBudget, monitorVersion } from '../../../src/engine/v2/departments/agents';
import { resetWorkContext, workContext } from '../../../src/engine/v2/departments/workfit';
import { useControl } from '../../../src/engine/v2/safety/oversight';
import { applyResponse } from '../../../src/engine/v2/safety/responses';
import { LOCKDOWN_SLOWDOWN, controlComputeShare, lockdownOn, productSafeguardOverhead, productUsageMult, setControl, controlTerms } from '../../../src/engine/v2/safety/safeguards';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const internal = s.player.deployments.filter((d) => d.channel === 'internal' && d.status === 'live');
const slot = 'EXP' as const;
const fte = () => { resetWorkContext(s); return workContext(s).slots[slot].aiFte; };
s.player.split.monitors = Math.max(s.player.split.monitors, 0.05); // room on the line for the control compute
for (const d of internal) setControl(d, false);
const f0 = fte();
const b0 = monitorBudget(s);
for (const d of internal) setControl(d, true, 'defer10');
const f1 = fte();
const b1 = monitorBudget(s);
const u = useControl(s, agentVersion(s, 'capRoutine'), monitorVersion(s, 'capRoutine')).usefulness;
check(f0 > 0 && near(f1 / f0, u, 1e-6), 'control: the package\'s AI labour × usefulness (Slowdown charged)', `FTE ${f0.toFixed(1)} → ${f1.toFixed(1)}, ×${(f1 / f0).toFixed(4)} vs ${u.toFixed(4)}`);
const want = AGENT_USES.reduce((a, x) => a + agentSplitShare(s, x), 0) * controlComputeShare('defer10');
check(b0.control === 0 && near(b1.control, want) && near(b1.used - b0.used, want) && b1.controlShort === 0, 'control: its compute comes out of the monitors\' line', `control ${(b1.control * 100).toFixed(3)}% of compute; used ${(b0.used * 100).toFixed(3)}% → ${(b1.used * 100).toFixed(3)}%`);
s.player.safety.techniques['T-LOCK'] = { ...(s.player.safety.techniques['T-LOCK'] ?? ({} as never)), unlocked: true } as never;
const vid = internal[0].versionId;
const err = applyResponse(s, makeCtx(s), 'addLockdown', vid);
const f2 = fte();
check(!err && lockdownOn(s) && near(f2 / f1, 1 - LOCKDOWN_SLOWDOWN, 1e-6), 'lockdown: can be added and costs its Slowdown', `${err ?? 'added'}; ×${(f2 / f1).toFixed(4)}`);
const prod = s.player.deployments.find((d) => d.channel !== 'internal' && d.status === 'live');
if (prod) {
  setControl(prod, true, 'defer10');
  check(near(productUsageMult(prod), (prod.guards?.some((g) => g.kind === 'restrict') ? 0.3 : 1) * (1 - controlTerms('defer10', undefined).slowdown)) && near(productSafeguardOverhead(prod), 0.01), 'product control: usage × (1 − Slowdown), +1% serving compute', `×${productUsageMult(prod).toFixed(3)}`);
}
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
