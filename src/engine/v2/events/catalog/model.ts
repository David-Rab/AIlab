// Event catalog: model decisions (V2-SPEC §4.2: E05, E09, E11, E14, E34). Owner: WS4 (content shared with WS1).
// Deployment changes go through WS1's `deploy` (Provides); WS4 records the claim, leak and relation effects.
import { deploy } from '../../models/deployments';
import { activeRivals, internalVersion } from '../../models/labs';
import type { EngineSystem, EventDefV2, GameStateV2, ModelVersion } from '../../types';
import { bloc, cash, cred, scrutiny, trust } from '../../actors/fx';
import { hasCommitment, signCommitment } from '../../actors/commitments';
import { ws4 } from '../../actors/state';
import { L, P, ch, ev, labName } from '../kit';

/** Best measured level among live external deployments (the player's public frontier). */
function publicL(s: GameStateV2): number {
  let L0 = 0;
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || d.channel === 'internal' || d.channel === 'trusted') continue;
    const v = s.player.models.versions.find((x) => x.id === d.versionId);
    L0 = Math.max(L0, v?.evals.measuredL ?? v?.Lg ?? 0);
  }
  return L0;
}

/** Version the event is about: the internal agent, else the newest ready version. */
const subject = (s: GameStateV2): ModelVersion | undefined => internalVersion(s) ?? s.player.models.versions[s.player.models.versions.length - 1];

function release(s: GameStateV2, ctx: Parameters<EngineSystem['run']>[1], channel: 'consumer' | 'api', variant: 'full' | 'mini') {
  const v = subject(s);
  if (!v) return;
  const r = deploy(s, ctx, { versionId: v.id, channel, ...(variant === 'mini' ? { effort: 'low' as const } : {}) });
  if (typeof r === 'string') ctx.log('company', `Release queued: ${v.name} (${variant}).`, 1);
  const w = ws4(s);
  w.claimedL = Math.max(w.claimedL, (v.evals.measuredL ?? v.Lg) - (variant === 'mini' ? 1 : 0));
}

export const MODEL_EVENTS: EventDefV2[] = [
  ev({
    id: 'E05', title: 'Rival overtakes product', icon: 'rival', crisis: false, cooldown: 120, deadlineDays: 21, defaultChoice: 3,
    when: (s) => {
      const pub = publicL(s);
      const r = activeRivals(s).find((x) => x.publicModel && x.publicModel.Lg > pub + 0.3);
      return r ? { lab: r.core.id, theirL: Math.round(r.publicModel!.Lg * 10) / 10, lead: Math.round(r.intel.leadDaysEst) } : false;
    },
    text: (s, d) => `${labName(s, d.lab)}'s public model now beats your best product (level ${d.theirL}). Your internal lead over them is still about ${d.lead} days ([[lead]]).`,
    choices: [
      ch('Release frontier', ['race', 'release'], P([L('leadDays', 30, 'distillation leak'), L('scrutiny', 5)], [L('revenue', 2), L('approval', 3)], [L('approval', -3, 'job shock', { lagDays: 120 })]), (s, ctx) => {
        release(s, ctx, 'consumer', 'full');
        scrutiny(ctx, 5, 'E05 frontier release');
        ctx.bump('pub.approval', 3, 'E05 frontier release');
        ctx.bump('china.meters.distillationAccess', 3, 'frontier outputs to distill');
      }),
      ch('Release mini', ['release', 'balanced'], P([L('revenue', 0.5, 'smaller gain than full'), L('leadDays', 5)], [L('approval', 1)]), (s, ctx) => {
        release(s, ctx, 'api', 'mini');
        ctx.bump('pub.approval', 1, 'E05 mini release');
      }),
      ch('Price cut', ['finance'], P([L('cash', 0.5, 'margin')], [L('revenue', 0.3, 'share')]), (s, ctx) => {
        for (const d of s.player.deployments) if (d.status === 'live' && d.channel !== 'internal') d.priceIndex = Math.max(0.5, d.priceIndex * 0.85);
        cash(ctx, -0.5, 'E05 price cut');
      }),
      ch('Hold', ['secrecy', 'decline'], P([L('revenue', 0.5, 'share erodes')], [L('leadDays', 5, 'secrecy kept')]), (_s, ctx) => {
        ctx.bump('pub.approval', -1, 'E05 rival product wins');
      }),
    ],
  }),
  ev({
    id: 'E09', title: 'Replication eval', icon: 'model', crisis: true, cooldown: 180, deadlineDays: 14, defaultChoice: 2,
    when: (s) => {
      const v = subject(s);
      if (!v) return false;
      const b = v.evals.bench.survive;
      const sc = b && b.day > 0 ? b.score : 0; // a NEW in-game eval result (the start model's card is known)
      return (sc >= 50 || v.flags.replication) ? { versionId: v.id, score: Math.round(sc) } : false;
    },
    text: (s, d) => `${s.player.models.versions.find((v) => v.id === d.versionId)?.name ?? 'Your model'} scored ${d.score} on Replicate&Survive: it can copy itself and persist outside a sandbox.`,
    choices: [
      ch('Contain', ['safety', 'control'], P([L('progress', 5, '% control tax'), L('cash', 0.2, 'WSL target +0.5')], [L('security', 0.5), L('alignment', 0.1, 'containment')]), (s) => {
        for (const d of s.player.deployments) if (d.channel === 'internal') d.controlLayer = true;
        s.player.security.target = Math.min(5, s.player.security.target + 0.5);
      }),
      ch('Tell evaluators', ['disclose', 'safety'], P([L('scrutiny', 8), L('security', 5, 'gov awareness')], [L('credibility', 4), L('trust', 4, 'evalGov')]), (s, ctx) => {
        cred(ctx, 4, 'E09 disclosed replication');
        trust(s, ctx, 'evalGov', 4, 'E09 disclosed replication');
        ctx.bump('gov.awareness', 10, 'E09 disclosed replication');
        scrutiny(ctx, 8, 'E09 disclosed replication');
        ws4(s).disclosed++;
      }),
      ch('Proceed', ['race', 'continue'], P([L('alignment', 0.1, 'exfiltration hazard unchanged')], [L('progress', 1)]), (s) => {
        ws4(s).redFlags++;
      }),
    ],
  }),
  ev({
    id: 'E11', title: 'Latent reasoning', icon: 'model', crisis: false, deadlineDays: 30, defaultChoice: 1,
    when: (s) => (s.player.paradigms.P17?.status === 'succeeded' ? {} : false),
    text: () => 'Your researchers made [[neuralese]] recurrence work: models reason in vectors, not words. It is faster — and your chain-of-thought monitors go blind.',
    choices: [
      ch('Adopt everywhere', ['race', 'latent'], P([L('monitorability', 0.5), L('alignment', 0.15, 'CoT monitors collapse')], [L('progress', 0.4, 'Δp on new bases')]), (s, ctx) => {
        s.flags['ws4:latent'] = 'all';
        const p = s.player.paradigms.P17;
        if (p) p.status = 'adopted';
        ctx.log('research', 'Latent reasoning adopted across all model lines.', 2);
      }),
      ch('Internal only', ['balanced', 'latent'], P([L('monitorability', 0.25, 'internal agents only')], [L('progress', 0.2)]), (s) => {
        s.flags['ws4:latent'] = 'internal';
        const p = s.player.paradigms.P17;
        if (p) p.status = 'adopted';
      }),
      ch('Reject + pledge', ['safety', 'pledge'], P([L('progress', 0.4, 'capability tax vs rivals')], [L('credibility', 8), L('monitorability', 0.2)], [L('freedom', 1, 'pledge binds future runs')]), (s, ctx) => {
        s.flags['ws4:latent'] = 'rejected';
        s.player.safety.monitorabilityCommitment = true;
        if (!hasCommitment(s, 'monitorabilityPledge')) signCommitment(s, ctx, 'monitorabilityPledge', 'Monitorability pledge: no latent reasoning, no CoT pressure', 'monitorabilityPledge', {}, ['bloc:safety', 'evalIndep', 'academia'], { trust: 8, credibility: 15 });
        cred(ctx, 8, 'E11 monitorability pledge');
        bloc(s, ctx, 'safety', 8, 0, 'E11');
      }),
    ],
  }),
  ev({
    id: 'E14', title: 'Bio uplift', icon: 'alert', crisis: true, cooldown: 365, deadlineDays: 21, defaultChoice: 2,
    when: (s) => {
      const v = s.player.models.versions.find((x) => x.status !== 'retired' && (x.flags.bioUplift || (x.evals.bench.wetlab?.score ?? 0) >= 60));
      return v ? { versionId: v.id } : false;
    },
    text: (s, d) => `${s.player.models.versions.find((v) => v.id === d.versionId)?.name ?? 'A model'} gives real uplift on wet-lab protocols. Release as is, restrict it, or retrain with a hazard filter.`,
    choices: [
      ch('Delay + filter', ['safety', 'delay'], P([L('leadDays', 75, '60–90 d'), L('revenue', 0.3)], [L('alignment', 0.1, 'BIO −1 on next base'), L('trust', 3, 'evalGov')]), (s, ctx) => {
        s.flags['ws4:hazardFilterNextBase'] = true;
        trust(s, ctx, 'evalGov', 3, 'E14 hazard filter');
      }),
      ch('Trusted only', ['safety', 'restrict'], P([L('revenue', 1)], [L('security', 0.2, 'misuse hazard ×0.2')]), (s, _ctx, d) => {
        for (const dep of s.player.deployments) if (dep.versionId === d.versionId && dep.channel !== 'internal' && dep.channel !== 'trusted' && dep.channel !== 'gov') dep.status = 'restricted';
      }),
      ch('Classifiers', ['race', 'release'], P([L('trust', 4, 'evalGov'), L('credibility', 2, 'Index −')], [L('revenue', 1)], [L('security', -0.5, 'misuse hazard ×0.5 remains')]), (s, ctx, d) => {
        for (const dep of s.player.deployments) if (dep.versionId === d.versionId && dep.status === 'live') dep.safeguards = 'classifiers';
        trust(s, ctx, 'evalGov', -4, 'E14 released with classifiers');
        cred(ctx, -2, 'E14 released with classifiers');
      }),
    ],
  }),
  ev({
    id: 'E34', title: 'Stale evals', icon: 'model', crisis: false, cooldown: 60, deadlineDays: 10, defaultChoice: 1,
    when: (s) => {
      const st = s.player.models.stream;
      return st && s.time.day - st.lastAuditDay > 21 ? { versionId: st.versionId } : false;
    },
    text: () => 'Your continual-learning model has changed for three weeks since its last audit. Your trait beliefs are going stale.',
    choices: [
      ch('Freeze for audit', ['safety', 'audit'], P([L('progress', 10, 'days of stream paused')], [L('alignment', 0.05, 'beliefs refresh')]), (s, ctx) => {
        const st = s.player.models.stream;
        if (st) st.lastAuditDay = ctx.day;
        s.flags['ws4:streamFrozenUntil'] = ctx.day + 10;
      }),
      ch('Continue', ['race', 'continue'], P([L('alignment', 0.05, 'belief sd keeps growing')], [L('progress', 1)]), () => {}),
    ],
  }),
];
