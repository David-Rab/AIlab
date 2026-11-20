import { readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { tick } from '../../../src/engine/v2/core/loop';
import { runwayOf } from '../../../src/engine/v2/finance/runway';
const s = deserialize(readFileSync('scripts/v2/tmp-fin1/old900.json', 'utf8'));
console.log('rev', (s as unknown as { schemaRev: number }).schemaRev, 'ledger kinds', [...new Set(s.player.finance.ledger.map((c) => c.kind))].join(','), 'lease sites', s.player.sites.filter((x) => x.ws3.lease).length, 'deals', s.player.finance.deals.map((d) => d.template).join(','));
for (let i = 0; i < 200; i++) tick(s, { skip: ['endings'] });
console.log('ok day', s.time.day, 'rating', s.player.finance.rating, 'runway', runwayOf(s).q.toFixed(2), 'opCash4q', s.player.finance.ws3.opCash4q.map((x) => x.toFixed(1)).join(','));
