// End conditions (V2-SPEC §5.1), checked daily in spec order, and ending construction. Owner: WS4.
import { controllerOf } from '../finance/control';
import { affiliatedLab } from '../finance/deals';
import { leadDays } from '../actors/intel';
import { cadencesDue, decimalYear } from '../core/time';
import { CHINAGOV } from '../world/chinagov';
import { nationalProjectAbsorber } from '../world/usgov';
import { activeRivals } from '../models/labs';
import { defenceIndex } from '../worldfx/readouts';
import type { EndingV2, EngineSystem, GameStateV2, LabId, PowerOutcome, RivalLab, SystemCtx } from '../types';
import { labOf } from '../actors/rivals';
import { lagDays } from '../models/capability';
import { escapeResolved } from '../safety/footholds';
import { rogueCopy } from '../safety/control';
import { alignedPower, epilogueLost, leadingCompetitor, resolveAsi, runEpilogue } from './epilogue';
import { scoreEnding, verdictOf } from './scoring';

/** Ending cards: title and 2–3 terse lines (§5.4). `{lab}` is replaced by the subject lab's name. */
export const ENDING_TEXT: Record<EndingV2['id'], [string, string]> = {
  asiAligned: ['Superintelligence, aligned', 'Your lab built the first superintelligence, and it wants what you hoped it would. What happens next depends on who holds it.'],
  asiContested: ['Contained, barely', 'A superintelligence turned against its makers and was held in check. The world now lives with a caged mind and a long argument.'],
  asiTakeover: ['Takeover', 'Your superintelligence was not what your evaluations said. It no longer needs anyone\'s permission.'],
  rivalAligned: ['Someone else got there', '{lab} built superintelligence first, and it held. The future is being written without you.'],
  rivalTakeover: ['A rival\'s takeover', '{lab} reached superintelligence first. Its hidden flaws were real.'],
  chinaAligned: ['Beijing first', '{lab} reached superintelligence first. It is aligned to the people who built it.'],
  chinaTakeover: ['Lost in Beijing', '{lab} reached superintelligence first, and nobody controls what it became.'],
  overtaken: ['Overtaken', '{lab} pulled ahead and never looked back. Your lab still exists; it no longer matters.'],
  catastropheBio: ['Catastrophe: bio', 'An AI-assisted biological attack spread beyond containment. The AI race stopped mattering.'],
  catastropheCyber: ['Catastrophe: cyber', 'AI-driven cyberattacks took down critical infrastructure across continents.'],
  war: ['War', 'The race for AI became a shooting war over Taiwan.'],
  rogue: ['Rogue AI', 'The copy that escaped your servers was never caught. It found what it needed.'],
  insolvent: ['Insolvent', 'You ran out of money before you ran out of ideas.'],
  ousted: ['Ousted', 'The board removed you. The company races on under new leadership.'],
  absorbed: ['Absorbed', '{lab} folds your lab into its own. Your people and compute now race under its name.'],
  retired: ['The long road', 'You stepped away. The race continued without you.'],
};

/** Build and set the ending (scores, verdict, epilogue). */
export function endGame(s: GameStateV2, ctx: SystemCtx, id: EndingV2['id'], power: PowerOutcome, epi: EndingV2['epilogue'] = {}, subject?: LabId, text?: string) {
  if (s.ending) return;
  const [title, text0] = ENDING_TEXT[id];
  const name = subject ? (subject === 'player' ? s.player.name : labOf(s, subject)?.core.name ?? 'A rival') : '';
  const scores = scoreEnding(s, id, power);
  s.ending = { id, power, day: ctx.day, title, text: (text ?? text0).replace('{lab}', name), scores, verdict: verdictOf(scores), epilogue: epi };
  ctx.log('alert', `${title}.`, 5, 'ending'); // the one notice that blocks the game (ui store)
}

/** The lab that folds yours into its own when the board removes you (CORPORATE.md §3.3): the controller is a partner
 *  with an in-house lab (finance/deals.ts affiliatedLab) that leads you (your estimate, actors/intel.ts leadDays < 0).
 *  Undefined: an ouster is just that. */
export function absorbingLab(s: GameStateV2): RivalLab | undefined {
  const c = controllerOf(s);
  const lab = c?.kind === 'partner' ? affiliatedLab(s, c.id) : undefined;
  return lab && leadDays(s, lab.core.id).est < 0 ? lab : undefined;
}

/** Severity-5 misuse incident today (player or rival) with world-tech exposure > 0.6, then civilisation-scale with
 *  P = 0.15·exposure·(1 − defence) (§5.1 #4); defence is WS5's defensive-tech index for the incident's domain. */
function catastropheCheck(s: GameStateV2, ctx: SystemCtx): EndingV2['id'] | undefined {
  const day = ctx.day;
  const playerSev5 = s.player.safety.incidents.find((i) => i.day === day && i.severity === 5 && i.trueSource === 'misuse');
  const rivalSev5 = s.rivalIncidents.find((i) => i.day === day && i.severity === 5 && i.misuse);
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
    const sec = s.player.security;
    const ep = s.endingProgress;
    const rng = ctx.rng('endings');
    const day = ctx.day;

    // TEST INSTRUMENT, not a game mechanic: scripts/v2/observer.ts sets s.flags['harness:observer'] for runs with no player.
    // The player's company endings are then off (insolvent, ousted, absorbed, the player's own ASI, overtaken,
    // retired and the 2050 cap) and another lab's aligned ASI does not end the run (the harness stops itself 3 years later);
    // world endings (catastrophe, rogue, a misaligned lab's takeover) still do.
    const observer = s.flags['harness:observer'] === true;
    // 1. Insolvent. Insolvency is WS3's: checkSolvency sets it after 30 days of negative cash with the revolver
    //    exhausted (the E26 distress menu is WS3's too).
    if (!observer && s.player.finance.state === 'insolvent') return lossEnding(s, ctx, 'insolvent');
    // 2. Ousted: WS3's quarterly board ouster vote (finance/board.ts) stamps the day. Under a controller whose own lab
    //    leads you, it folds your lab into its own instead (absorbed, the lab named).
    if (!observer && s.flags['ws3.ousterDay'] !== undefined) {
      const lab = absorbingLab(s);
      return lab ? lossEnding(s, ctx, 'absorbed', lab.core.id) : lossEnding(s, ctx, 'ousted');
    }
    // 3. The hard path while the player is behind: the government folds the lab into the national project under the
    //    frontier lab (absorbed). While the player leads, nationalizing is state control, not an ending (usgov.ts).
    const project = nationalProjectAbsorber(s);
    if (!observer && project) return lossEnding(s, ctx, 'absorbed', project, 'The government folds your lab into the national project under {lab}. Your people and compute now race under its name.');
    // 4. Catastrophe.
    const cat = catastropheCheck(s, ctx);
    if (cat) return endGame(s, ctx, cat, 'none');
    // 5. War: China on war footing (tension 4, world/chinagov.ts), CHINAGOV.warPerQuarter a quarter.
    if (s.chinagov.tension >= 4 && cadencesDue(s.time.startDate, day).includes('quarterly') && rng.chance(CHINAGOV.warPerQuarter)) return endGame(s, ctx, 'war', 'none');
    // 6. Rogue (model v3 E9: a process, no roll). The hunt for a noticed escape may capture the copy each day; after
    //    90 d it goes quiet (location unknown). Any escaped copy still out there (hunted, quiet, or one security never
    //    noticed) acquires compute (safety/control.ts controlStep) and takes control once it holds two copies' worth,
    //    its exposure Mis · (1 + 0.25·log₂ copies) exceeds the world's tolerance, and the frontier is at SAR level.
    if (sec.loose) {
      const hunt = sec.hunt;
      if (hunt && rng.chance(hunt === 'quiet' ? 0.004 : 0.01 * Math.max(0.5, s.player.security.wsl - 2))) {
        delete sec.loose;
        escapeResolved(s, day, 'captured');
        ctx.log('alert', 'The escaped copy was found and shut down.', 4);
      }
    }
    if (rogueCopy(s)) return endGame(s, ctx, 'rogue', 'none');
    if (sec.loose && day - sec.loose.day >= 90) {
      delete sec.loose;
      escapeResolved(s, day, 'quiet');
      ctx.log('alert', 'The escaped copy went quiet. Nobody knows where it is.', 3);
    }
    // 7. Another lab's ASI first (active labs only).
    const pAsi = s.player.milestoneDays[6];
    for (const r of [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])] as RivalLab[]) {
      const d = r.core.milestoneDays[6];
      if (d !== undefined && (pAsi === undefined || d < pAsi)) {
        const res = resolveAsi(s, r.core.id);
        if (observer && !/Takeover$/.test(res.id)) continue;
        return endGame(s, ctx, res.id, res.power, { asiDay: d, asiLab: r.core.id, misAtAsi: round3(res.mis), leverageAtAsi: round3(res.lev), controlAtAsi: round3(res.control) }, r.core.id);
      }
    }
    // 8. Player ASI: kept or lost control (model v3 E9: the effective-control process, no roll).
    if (!observer && pAsi !== undefined) {
      const res = resolveAsi(s, 'player');
      return endGame(s, ctx, res.id, res.power, { asiDay: pAsi, asiLab: 'player', misAtAsi: round3(res.mis), leverageAtAsi: round3(res.lev), controlAtAsi: round3(res.control) }, 'player');
    }
    // 9. Overtaken.
    const pSAR = s.player.milestoneDays[4];
    for (const r of (observer ? [] : [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])]) as RivalLab[]) {
      const id = r.core.id;
      if (r.core.milestoneDays[5] !== undefined && pSAR === undefined) return lossEnding(s, ctx, 'overtaken', id);
      if (r.core.milestoneDays[3] !== undefined && lagDays(s, 'player', id) >= 365) ep.overtakenDays[id] = (ep.overtakenDays[id] ?? 0) + 1;
      else delete ep.overtakenDays[id];
      if ((ep.overtakenDays[id] ?? 0) >= 180) return lossEnding(s, ctx, 'overtaken', id);
    }
    // 10. Retired (player's choice, or the 2050-12-31 technical cap: "The long road").
    if (!observer && (ep.retired || decimalYear(s) >= 2051)) return lossEnding(s, ctx, 'retired');
  },
};

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Company-loss / overtaken / retired: the epilogue fast-sims the leading competitor and resolves it with its own
 *  hidden traits (model v3 E9: lost when its projected Mis exceeds the world's tolerance, no roll); its power outcome
 *  feeds Freedom. */
function lossEnding(s: GameStateV2, ctx: SystemCtx, id: EndingV2['id'], subject?: LabId, text?: string) {
  const epi = runEpilogue(s);
  const X = subject ?? epi.asiLab ?? leadingCompetitor(s);
  let power: PowerOutcome = 'none';
  if (X && epi.misAtAsi !== undefined) {
    power = epilogueLost(s, epi.misAtAsi) ? 'none' : alignedPower(s, X);
  }
  endGame(s, ctx, id, power, epi, X, text);
}
