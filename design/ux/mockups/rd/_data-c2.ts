// Monitor parts per AI staff job (one monitor formula: watched share × flag rate × acted-on rate), believed; day 400.
//   npx tsx design/ux/mockups/rd/_data-c2.ts → design/ux/mockups/rd/data400c-mon.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import type { GameStateV2 } from '../../../../src/engine/v2';
import { useMonitor, monitorVersion, agentVersion, agentSplitShare } from '../../../../src/engine/v2/departments/agents';
import { believedInternalOversight, believedOversightParts } from '../../../../src/engine/v2/safety/believedOversight';
import { AGENT_USES } from '../../../../src/data/v2/agents';
import { aiRdShare } from '../../../../src/engine/v2/safety/incidents';
const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8')) as GameStateV2;
const out: Record<string, unknown> = {};
for (const u of AGENT_USES) {
  try {
    const v = agentVersion(s, u);
    const m = useMonitor(s, u, undefined, true);
    out[u] = { model: v?.name, watcher: monitorVersion(s, u)?.name, monitorId: s.player.agents[u].monitorId, split: agentSplitShare(s, u), watched: m.watched, flag: m.flag, flagColl: m.flagColl, actedOn: m.actedOn, stop: m.stop, stopColl: m.stopColl, c: m.c,
      internal: v ? believedInternalOversight(s, v, 'SCHEME', aiRdShare(s)) : undefined,
      parts: v ? believedOversightParts(s, v, true, aiRdShare(s)) : undefined };
  } catch (e) { out[u] = String(e); }
}
out.aiRd = aiRdShare(s);
writeFileSync('design/ux/mockups/rd/data400c-mon.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
