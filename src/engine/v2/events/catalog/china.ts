// Event catalog: China decisions (V2-SPEC §4.2: E10; E23 deleted in W1d). Owner: WS4.
// The trust, scrutiny, talent-pull and bloc effects went with the relation stocks (W1c); the public rally, the US
// retaliation and the China meters went with the government, public and China actors (W1d); W6/W7 redo them.
import type { EventDefV2 } from '../../types';
import { morale } from '../../actors/fx';
import { addCoverup, COVERUP_DISCOVERY_ODDS } from '../coverups';
import { ws4 } from '../../actors/state';
import { L, P, ch, ev, requestOnly } from '../kit';

export const CHINA_EVENTS: EventDefV2[] = [
  ev({
    id: 'E10', title: 'Weights stolen', icon: 'china', crisis: true, deadlineDays: 7, defaultChoice: 1,
    when: requestOnly,
    text: (s, d) => `Security confirms that the weights of ${s.player.models.versions.find((v) => v.id === d.versionId)?.name ?? 'your best model'} were stolen, almost certainly by Chinese intelligence.`,
    choices: [
      ch('Go public', ['hawk', 'disclose'], P([]), (s) => {
        ws4(s).disclosed++;
      }),
      ch('Quiet hardening', ['quiet', 'security'], P([L('cash', 0.5, 'WSL target +1')], [L('security', 1)]), (s) => {
        const sec = s.player.security;
        sec.target = Math.min(5, sec.target + 1);
        sec.spendRate += 0.5;
        addCoverup(s, 'a weight theft', COVERUP_DISCOVERY_ODDS);
      }),
      ch('Purge insiders', ['security', 'hawk'], P([L('morale', 15)], [L('security', 0.5, 'spies ×0.3')]), (s, ctx) => {
        ws4(s).spyMult *= 0.3;
        s.flags['ws4:purged'] = true;
        morale(ctx, -15, 'E10 purge');
      }),
    ],
  }),
];
