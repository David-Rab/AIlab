// A binding pledge's three answers (OUTSIDE-WORLD §8.2: E30 "Framework threshold" is no event any more): Honour, Amend or
// Break, on the pledge's row in the Relations commitments list while it shows "binding now". Left alone, a binding pledge
// has no automatic effect of its own: the deploy gate (commitmentDeployBlock) already refuses what it forbids. Owner: WS4.
import type { ActionDef, Commitment, GameStateV2, SystemCtx } from '../types';
import { strParam } from '../core/actionDef';
import { addSafeguard } from '../safety/safeguards';
import { withdraw } from '../models/deployments';
import { cash, L, pv } from './fx';
import { amendCommitment, blockingCommitments, breakCommitment, latentVersion, pledgeBreachRun, PREDICATES } from './commitments';
import { approvalScaled, PUBLIC } from '../world/public';

type P = Record<string, number | string | boolean>;
const target = (s: GameStateV2, p: P): Commitment | undefined => {
  const live = blockingCommitments(s);
  return live.find((c) => c.id === strParam(p, 'cid', '')) ?? (strParam(p, 'cid', '') === '' ? live[0] : undefined);
};
const available = (s: GameStateV2): boolean | string => (blockingCommitments(s).length ? true : 'No pledge binds now');

/** Honour a binding commitment as written. */
export function honour(s: GameStateV2, ctx: SystemCtx, c: Commitment) {
  const ext = (ch: string) => ch !== 'internal'; // Vetted is external too (MARKET.md M10)
  switch (c.condition.predicate) {
    case 'preDeployTesting':
      for (const d of s.player.deployments) if (d.status === 'live' && ext(d.channel) && d.startDay >= ctx.day - 30) addSafeguard(s, d, 'restrict');
      break;
    case 'monitorabilityPledge': {
      // Cancel the offending runs still in training and pull latent releases (WS1 withdraw); a finished run or an
      // open-weights release cannot be undone, so the pledge is broken (normal break costs).
      for (const r of s.player.models.runs) if (r.startDay >= c.signedDay && (r.status === 'running' || r.status === 'paused') && pledgeBreachRun(r)) r.status = 'cancelled';
      for (const d of s.player.deployments) if (d.status !== 'withdrawn' && d.channel !== 'internal' && d.startDay >= c.signedDay && latentVersion(s, d.versionId)) withdraw(s, d.id);
      if (PREDICATES.monitorabilityPledge(s, c.condition.params, c)) breakCommitment(s, ctx, c);
      break;
    }
    case 'noSurveillance':
    case 'noAutonomousWeapons':
      for (const d of s.player.deployments) if (d.channel === 'vetted') {
        d.usagePolicy.noSurveillance = true;
        d.usagePolicy.noAutonomousWeapons = true;
      }
      break;
    case 'incidentReporting':
      for (const i of s.player.safety.incidents) if (i.status === 'open' || i.status === 'covered') i.status = 'disclosed';
      break;
    case 'whistleblower':
      delete s.player.security.internalReport;
      break;
    case 'communityPledge':
      for (const x of s.player.sites) if (!x.communityPackage) {
        x.communityPackage = true;
        cash(s, ctx, -0.03 * x.capex, 'community package');
      }
      break;
  }
}

const act = (id: string, title: string, verb: ActionDef['verb'], preview: ActionDef['preview'], run: (s: GameStateV2, ctx: SystemCtx, c: Commitment) => void): ActionDef => ({
  id, verb, system: 'relations', sphere: 'relations', owner: 'WS4', title, available, preview,
  apply(s, ctx, p) {
    const c = target(s, p);
    if (!c) return 'That pledge does not bind now';
    run(s, ctx, c);
  },
});

export const COMMITMENT_ACTIONS: ActionDef[] = [
  act('CMT_HONOUR', 'Honour', 'respond', () => pv([L('revenue', 0.5, 'delay or mitigation'), L('leadDays', 14)]), honour),
  act('CMT_AMEND', 'Amend', 'respond', () => pv([]), (s, ctx, c) => amendCommitment(s, ctx, c, false)),
  act('CMT_BREAK', 'Break', 'respond', (s) => pv([L('approval', Math.abs(approvalScaled(s, PUBLIC.pledgeBroken)), 'a public pledge broken')]), breakCommitment),
];
