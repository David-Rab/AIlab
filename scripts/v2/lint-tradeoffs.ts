// Trade-off contract lint (V2-SPEC §2.7): every ActionDef and ChoiceV2 preview must show ≥ 1 cost in a currency
// that is not among its gains, on 3 canned states (the M0 fixtures). Owner: WS4 (seeded by WS1).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIONS, EVENTS } from '../../src/engine/v2/core/registry';
import { deserialize } from '../../src/engine/v2/core/save';
import type { CostLine, GameStateV2 } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const states: GameStateV2[] = [0, 400, 900].map((d) => deserialize(readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8')));

function ok(p: { costs: CostLine[]; gains: CostLine[] }) {
  const gains = new Set(p.gains.map((g) => g.currency));
  return p.costs.some((c) => !gains.has(c.currency));
}

let n = 0;
for (const a of ACTIONS) {
  for (const s of states) {
    n++;
    let pass = false;
    let why = '';
    try {
      pass = ok(a.preview(s, {}));
    } catch (e) {
      why = String(e);
    }
    check(pass, `action ${a.id} @day ${s.time.day}`, why);
  }
}
for (const e of EVENTS) {
  check(e.choices.length >= 2, `event ${e.id} has ≥ 2 choices`);
  e.choices.forEach((c, i) => {
    for (const s of states) {
      n++;
      let pass = false;
      let why = '';
      try {
        pass = ok(c.preview(s));
      } catch (err) {
        why = String(err);
      }
      check(pass, `event ${e.id} choice ${i} "${c.label}" @day ${s.time.day}`, why);
    }
  });
}
console.log(`lint-tradeoffs: ${ACTIONS.length} actions, ${EVENTS.length} events, ${n} previews checked`);
finish('lint-tradeoffs');
