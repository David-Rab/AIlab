// L0 shell values on the day-369 save (same selectors as rd/_data.ts). Run: ../AI27/node_modules/.bin/tsx design/ux/mockups/market/_shell.ts <save.json>
import { readFileSync } from 'node:fs';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { controlReadout, labSpeedView, dateOf, fmtDate } from '../../../../src/engine/v2';
import { nearestRival, runwayLive } from '../../../../src/ui/v2/shell/selectors';
const s = deserialize(readFileSync(process.argv[2], 'utf8'));
const rl = runwayLive(s), nr = nearestRival(s), sp = labSpeedView(s), cr = controlReadout(s);
const from = s.time.day - 30;
const alerts = s.log.filter((e) => e.day >= from && (e.severity ?? 1) >= 2);
const byKind: Record<string, number> = {};
for (const e of alerts) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
console.log(JSON.stringify({ date: fmtDate(dateOf(s)), cash: s.player.finance.cash, runwayQ: rl.rw.q, nearest: nr.nearest, speed: sp.rel,
  risk: cr.risk ? { p: cr.risk.p, name: cr.risk.name } : null, alerts: alerts.length, byKind }, null, 1));
