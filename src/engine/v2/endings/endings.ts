// End conditions (V2-SPEC §5.1), checked daily in spec order, and ending construction. Owner: WS4.
import { LEVEL_KNOTS } from '../../../data/v2/calibration';
import { isDivision } from '../../../data/v2/starts';
import { sigmoid } from '../../rng';
import { cadencesDue, decimalYear } from '../core/time';
import { activeRivals, bestLg } from '../models/labs';
import { defenceIndex } from '../worldfx/readouts';
import type { EndingV2, EngineSystem, GameStateV2, LabId, PowerOutcome, RivalLab, SystemCtx } from '../types';
import { labOf, leadBetween } from '../actors/rivals';
import { ws4 } from '../actors/state';
import { alignedPower, leadingCompetitor, pMisOf, resolveAsi, runEpilogue } from './epilogue';
import { scoreEnding, verdictOf } from './scoring';

/** Ending cards: title and 2–3 terse lines (§5.4). `{lab}` is replaced by the subject lab's name. */
export const ENDING_TEXT: Record<EndingV2['id'], [string, string]> = {
  asiAligned: ['Superintelligence, aligned', 'Your lab built the first superintelligence, and it wants what you hoped it would. What happens next depends on who holds it.'],
  asiContested: ['Contained, barely', 'A superintelligence turned against its makers and was held in check. The world now lives with a caged mind and a long argument.'],
  asiTakeover: ['Takeover', 'Your superintelligence was not what your evaluations said. It no longer needs anyone\'s permission.'],
  rivalAligned: ['Someone else got there', '{lab} built superintelligence first, and it held. The future is being written without you.'],
  rivalTakeover: ['A rival\'s takeover', '{lab} reached superintelligence first. Its hidden flaws were real.'],
  chinaAligned: ['Beijing first', 'DeepCent reached superintelligence first. It is aligned to the people who built it.'],
  chinaTakeover: ['Lost in Beijing', 'DeepCent reached superintelligence first, and nobody controls what it became.'],
  overtaken: ['Overtaken', '{lab} pulled ahead and never looked back. Your lab still exists; it no longer matters.'],
  catastropheBio: ['Catastrophe: bio', 'An AI-assisted biological attack spread beyond containment. The AI race stopped mattering.'],
  catastropheCyber: ['Catastrophe: cyber', 'AI-driven cyberattacks took down critical infrastructure across continents.'],
  war: ['War', 'The race for AI became a shooting war over Taiwan.'],
  rogue: ['Rogue AI', 'The copy that escaped your servers was never caught. It found what it needed.'],
  insolvent: ['Insolvent', 'You ran out of money before you ran out of ideas.'],
  ousted: ['Ousted', 'The board removed you. The company races on under new leadership.'],
  nationalized: ['Nationalized', 'The government took control of your lab. Your clearance was revoked the same day.'],
  acquired: ['Acquired', 'A strategic partner bought control of the company to keep it alive.'],
  retired: ['The long road', 'You stepped away. The race continued without you.'],
};

/** Build and set the ending (scores, verdict, epilogue). */
export function endGame(s: GameStateV2, ctx: SystemCtx, id: EndingV2['id'], power: PowerOutcome, epi: EndingV2['epilogue'] = {}, subject?: LabId) {
  if (s.ending) return;
  const [title, text0] = ENDING_TEXT[id];
  const name = subject ? (subject === 'player' ? s.player.name : labOf(s, subject)?.core.name ?? 'A rival') : '';
  const scores = scoreEnding(s, id, power);
  s.ending = { id, power, day: ctx.day, title, text: text0.replace('{lab}', name), scores, verdict: verdictOf(scores), epilogue: epi };
  ctx.log('alert', `${title}.`, 5);
}

/** Sale of control (§5.1 #1 'acquired'): a WS4 rescue flag, or one strategic holder above 50% of the equity after
 *  WS3's rescue / deals (finance ownership) [D]. */
function soldControl(s: GameStateV2): boolean {
  if (isDivision(s)) return false; // a division is owned by its parent by construction (R9)
  return ws4(s).soldControl || Object.values(s.player.finance.ownership.strat).some((x) => x > 0.5);
}

/** Severity-5 misuse incident today (player or rival) with world-tech exposure > 0.6, then civilisation-scale with
 *  P = 0.15·exposure·(1 − defence) (§5.1 #4); defence is WS5's defensive-tech index for the incident's domain. */
function catastropheCheck(s: GameStateV2, ctx: SystemCtx): EndingV2['id'] | undefined {
  const day = ctx.day;
  const playerSev5 = s.player.safety.incidents.find((i) => i.day === day && i.severity === 5 && i.trueSource === 'misuse');
  const rivalSev5 = ws4(s).rivalIncidents.find((i) => i.day === day && i.severity === 5 && i.misuse);
  if (!playerSev5 && !rivalSev5) return undefined;
  const exposure = Math.max(0, ...Object.values(s.world.techs).map((t) => t.exposure));
  if (exposure <= 0.6) return undefined;
  const rng = ctx.rng('endings');
  // Domain: WS2 stamps today's player sev-5 misuse ('ws2.sev5MisuseDay/Kind'); else the version's measured flags; a
  // rival incident carries no domain, so draw it.
  const v = playerSev5 ? s.player.models.versions.find((x) => x.id === playerSev5.versionId) : undefined;
  const ws2Kind = playerSev5 && s.flags['ws2.sev5MisuseDay'] === day ? s.flags['ws2.sev5MisuseKind'] : undefined;
  const kind: 'bio' | 'cyber' = ws2Kind === 'bio' || ws2Kind === 'cyber' ? ws2Kind : v?.flags.cyberOffense ? 'cyber' : v?.flags.bioUplift ? 'bio' : rng.chance(0.5) ? 'bio' : 'cyber';
  if (!rng.chance(0.15 * exposure * (1 - defenceIndex(s, kind)))) return undefined;
  return kind === 'bio' ? 'catastropheBio' : 'catastropheCyber';
}

/** endings (150, daily): Check end conditions in §5.1 order; set s.ending. */
export const endingsSystem: EngineSystem = {
  id: 'endings', owner: 'WS4', cadence: 'daily', order: 150, system: 'core',
  run(s, ctx) {
    if (s.ending) return;
    const w = ws4(s);
    const rng = ctx.rng('endings');
    const day = ctx.day;

    // 1. Insolvent / acquired. Insolvency is WS3's: checkSolvency sets it after 30 days of negative cash with the
    //    revolver exhausted (the E26 distress menu is WS3's too).
    if (soldControl(s)) return lossEnding(s, ctx, 'acquired');
    if (s.player.finance.state === 'insolvent') return lossEnding(s, ctx, 'insolvent');
    // 2. Ousted: WS3's quarterly board ouster roll (finance/board.ts) stamps the day.
    if (s.flags['ws3.ousterDay'] !== undefined) return lossEnding(s, ctx, 'ousted');
    // 3. Nationalized (hard path).
    if (w.nationalizedHard) return lossEnding(s, ctx, 'nationalized');
    // 4. Catastrophe.
    const cat = catastropheCheck(s, ctx);
    if (cat) return endGame(s, ctx, cat, 'none');
    // 5. War: China rung 6, P = 0.25 per quarter.
    if (s.china.rung >= 6 && cadencesDue(s.time.startDate, day).includes('quarterly') && rng.chance(0.25)) return endGame(s, ctx, 'war', 'none');
    // 6. Rogue: an escaped copy unresolved for 90 d once the frontier is at SAR level.
    if (w.loose) {
      const hunt = s.flags['ws4:hunt'];
      if (hunt && rng.chance(hunt === 'quiet' ? 0.004 : 0.01 * Math.max(0.5, s.player.security.wsl - 2))) {
        delete w.loose;
        ctx.log('alert', 'The escaped copy was found and shut down.', 4);
      } else if (day - w.loose.day >= 90) {
        if (bestLg(s, 'player') >= LEVEL_KNOTS[4]) {
          if (rng.chance(sigmoid((w.loose.mis - s.hidden.doomThreshold) / 0.06))) return endGame(s, ctx, 'rogue', 'none');
        }
        delete w.loose;
        ctx.log('alert', 'The escaped copy went quiet. Nobody knows where it is.', 3);
      }
    }
    // 7. Another lab's ASI first (active labs only).
    const pAsi = s.player.milestoneDays[6];
    for (const r of [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])] as RivalLab[]) {
      const d = r.core.milestoneDays[6];
      if (d !== undefined && (pAsi === undefined || d < pAsi)) {
        const res = resolveAsi(s, r.core.id, rng);
        return endGame(s, ctx, res.id, res.power, { asiDay: d, asiLab: r.core.id, misAtAsi: round3(res.mis), leverageAtAsi: round3(res.lev) }, r.core.id);
      }
    }
    // 8. Player ASI.
    if (pAsi !== undefined) {
      const res = resolveAsi(s, 'player', rng);
      return endGame(s, ctx, res.id, res.power, { asiDay: pAsi, asiLab: 'player', misAtAsi: round3(res.mis), leverageAtAsi: round3(res.lev) }, 'player');
    }
    // 9. Overtaken.
    const pSAR = s.player.milestoneDays[4];
    for (const r of [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])] as RivalLab[]) {
      const id = r.core.id;
      if (r.core.milestoneDays[5] !== undefined && pSAR === undefined) return lossEnding(s, ctx, 'overtaken', id);
      if (r.core.milestoneDays[3] !== undefined && leadBetween(s, id, 'player') >= 365) w.overtakenDays[id] = (w.overtakenDays[id] ?? 0) + 1;
      else delete w.overtakenDays[id];
      if ((w.overtakenDays[id] ?? 0) >= 180) return lossEnding(s, ctx, 'overtaken', id);
    }
    // 10. Retired (player's choice, or the 2050-12-31 technical cap: "The long road").
    if (w.retired || decimalYear(s) >= 2051) return lossEnding(s, ctx, 'retired');
  },
};

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Company-loss / overtaken / retired: the epilogue fast-sims the leading competitor and resolves it with its own
 *  hidden traits; its power outcome feeds Freedom. */
function lossEnding(s: GameStateV2, ctx: SystemCtx, id: EndingV2['id'], subject?: LabId) {
  const epi = runEpilogue(s);
  const X = subject ?? epi.asiLab ?? leadingCompetitor(s);
  let power: PowerOutcome = 'none';
  if (X && epi.misAtAsi !== undefined) {
    const misaligned = ctx.rng('endings').chance(pMisOf(s, epi.misAtAsi));
    power = misaligned ? 'none' : alignedPower(s, X);
  }
  endGame(s, ctx, id, power, epi, X);
}
