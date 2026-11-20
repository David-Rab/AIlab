// E5: the danger formula for incidents (MODEL-V3 §11.3): rate_k = κ_k · disposition_k · capability_k · opportunity_k ·
// (1 − oversight_k). Unit checks on the formula's terms, the start-rate table, misuse and exfiltration continuity.
import { DANGER_ACTS, MISUSE } from '../../src/data/v2/danger';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resetWorkContext } from '../../src/engine/v2/departments/workfit';
import {
  aiRdShare, capabilityOf, dangerOf, deploymentRows, exfiltrationHazard, forEachIncidentSite, labModelHazards, modelHazards, type DangerRow, type Site,
} from '../../src/engine/v2/safety/incidents';
import type { Deployment, DomainId, GameStateV2, ModelVersion, TraitId } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const fresh = (seed = 1) => newGame(defaultSetupV2({ seed, world: 'ai2027', alignment: 'medium', tutorial: false }));
const DOMS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
const atLevel = (v: ModelVersion, L: number) => { for (const d of DOMS) v.domains[d] = L; };
const dep = (s: GameStateV2, ch: Deployment['channel']) => s.player.deployments.find((d) => d.channel === ch)!;
const row = (rows: DangerRow[], k: TraitId) => rows.find((r) => r.source === k);
const rate = (rows: DangerRow[], k: TraitId) => row(rows, k)?.rate ?? 0;
const YEAR = 365.25;
const site = (o: Partial<Site> = {}): Site => ({ internal: true, scale: 1, autonomy: 0.75, afford: 1, rd: 0.2, contain: 0, wsl: 2.4, ...o });
const misaligned = (v: ModelVersion, x: number) => { for (const t of Object.keys(DANGER_ACTS) as TraitId[]) v.traitsTrue[t] = x; v.uModes = []; };

// ───────────── capability: rate rises with the act's domain level at fixed disposition ─────────────
{
  const s = fresh();
  const v = s.player.models.versions[0];
  misaligned(v, 0.3);
  const d = dep(s, 'internal');
  const by: Record<number, DangerRow[]> = {};
  for (const L of [4, 7, 10, 13]) { atLevel(v, L); by[L] = dangerOf(s, d, v, 1); }
  const acts = Object.keys(DANGER_ACTS) as TraitId[];
  const up = acts.every((k) => rate(by[4], k) < rate(by[7], k) && rate(by[7], k) < rate(by[10], k) && rate(by[10], k) <= rate(by[13], k) + 1e-15);
  check(up, 'capability: every act\'s rate rises with its domain level (L 4 → 7 → 10 → 13, traits fixed)',
    acts.map((k) => `${k} ×${(rate(by[13], k) / Math.max(1e-30, rate(by[4], k))).toFixed(0)}`).join(' '));
  // Each act reads its own domain.
  atLevel(v, 5);
  const base = dangerOf(s, d, v, 1);
  v.domains.CYBER = 11;
  const cy = dangerOf(s, d, v, 1);
  check(rate(cy, 'SCHEME') > 10 * rate(base, 'SCHEME') && Math.abs(rate(cy, 'POWER') - rate(base, 'POWER')) < 1e-15,
    'capability: CYBER raises scheming (escape-like) and leaves overreach (AGENCY) alone');
  check(Math.abs(capabilityOf(DANGER_ACTS.POWER!.theta, DANGER_ACTS.POWER!) - 0.5) < 1e-12, 'capability = σ((L − θ)/s): one half at θ');
}

// ───────────── opportunity: chat < agents < internal; usage; copies; AI R&D share ─────────────
{
  const s = fresh();
  const v = s.player.models.versions[0];
  misaligned(v, 0.3);
  atLevel(v, 9);
  const chat = dep(s, 'consumer');
  const agents: Deployment = { ...chat, id: 'DX', channel: 'agents' };
  s.player.deployments.push(agents);
  const r = (d: Deployment, k: TraitId, u = 0.3) => row(dangerOf(s, d, v, u), k)!;
  const o = (k: TraitId) => [r(chat, k).opportunity, r(agents, k).opportunity, r(dep(s, 'internal'), k, 0.3).opportunity];
  const ok = (['POWER', 'CONCEAL', 'RH'] as TraitId[]).every((k) => { const [a, b, c] = o(k); return a < b && b < c; });
  check(ok, 'opportunity: chat < agents < internal for overreach, cover-ups and reward hacking (same usage)',
    (['POWER', 'CONCEAL', 'RH'] as TraitId[]).map((k) => `${k} ${o(k).map((x) => x.toFixed(3)).join('/')}`).join('  '));
  check(r(chat, 'SYC').opportunity === r(agents, 'SYC').opportunity, 'opportunity: sycophancy needs only conversations (autonomy weight 0)');
  check(r(agents, 'POWER').rate < r(agents, 'POWER', 0.9).rate && Math.abs(r(agents, 'POWER', 0.9).rate / r(agents, 'POWER').rate - 3) < 1e-9,
    'opportunity: rate is proportional to the usage share');
  const c0 = r(chat, 'POWER').rate;
  s.player.computeOnline *= 32;
  check(r(chat, 'POWER').rate > 1.5 * c0 && r(chat, 'POWER').rate < 3 * c0, 'opportunity: 32× the serving copies raises the rate ≈ 32^0.2 = 2× (sublinear)',
    `×${(r(chat, 'POWER').rate / c0).toFixed(2)}`);
  // AI share of the lab's R&D raises sabotage opportunity (and only for R&D acts).
  const lo = modelHazards(v.traitsTrue, [], v.domains, site({ rd: 0.2 }));
  const hi = modelHazards(v.traitsTrue, [], v.domains, site({ rd: 0.8 }));
  const h = (rows: typeof lo, k: TraitId) => rows.find((x) => x.source === k)?.h ?? 0;
  check(Math.abs(h(hi, 'SAND') / h(lo, 'SAND') - 4) < 1e-9 && h(hi, 'POWER') === h(lo, 'POWER'),
    'opportunity: AI R&D share 0.2 → 0.8 raises research sabotage ×4 (overreach unchanged)');
  const s2 = fresh();
  const r0 = aiRdShare(s2);
  s2.player.split.agents *= 0.01;
  resetWorkContext(s2);
  const r1 = aiRdShare(s2);
  check(r1 < r0, 'AI R&D share falls when the lab cuts its agent compute (V3 work types)', `${r0.toFixed(3)} → ${r1.toFixed(3)}`);
  check(!row(dangerOf(s, chat, v, 0.3), 'SAND'), 'research sabotage fires on internal fleets only');
}

// ───────────── disposition: zero trait → zero rate ─────────────
{
  const s = fresh();
  const v = s.player.models.versions[0];
  misaligned(v, 0);
  atLevel(v, 12);
  let total = 0;
  forEachIncidentSite(s, (d, vv, u) => { for (const x of deploymentRows(s, d, vv, u)) if (x.source !== 'misuse') total += x.h; });
  check(total === 0, 'disposition: zero traits and no U-modes → zero incident rate at L 12 on every deployment');
  v.traitsTrue.POWER = 0.2;
  const a = rate(dangerOf(s, dep(s, 'internal'), v, 1), 'POWER');
  v.traitsTrue.POWER = 0.4;
  const b = rate(dangerOf(s, dep(s, 'internal'), v, 1), 'POWER');
  check(Math.abs(b / a - Math.pow(2, 1.5)) < 1e-9, 'disposition = x^1.5 (doubling the trait × 2.83)');
}

// ───────────── oversight: monitor, control layer, security ─────────────
{
  const s = fresh();
  const v = s.player.models.versions[0];
  misaligned(v, 0.3);
  atLevel(v, 9);
  const api = dep(s, 'api');
  const none = dangerOf(s, api, v, 0.3);
  api.monitorId = v.id; // a copy of itself: no capability gap
  const mon = dangerOf(s, api, v, 0.3);
  check(rate(mon, 'RH') < 0.3 * rate(none, 'RH') && row(mon, 'RH')!.attempts === row(none, 'RH')!.attempts,
    'oversight: a product monitor cuts the harmful rate (attempts unchanged; caught ones stay internal)',
    `RH ${(rate(none, 'RH') * YEAR).toFixed(3)} → ${(rate(mon, 'RH') * YEAR).toFixed(3)}/yr`);
  check(rate(mon, 'COLLUDE') > rate(mon, 'RH') * (row(mon, 'COLLUDE')!.attempts / row(mon, 'RH')!.attempts) * 1.5,
    'oversight: a same-lineage monitor lets collusion-relevant acts through more often');
  // Containment (control layer) blocks: lower attempts that get through.
  const lo = modelHazards(v.traitsTrue, [], v.domains, site({ contain: 0 }));
  const hi = modelHazards(v.traitsTrue, [], v.domains, site({ contain: 0.6 }));
  const h = (rows: typeof lo, k: TraitId) => rows.find((x) => x.source === k)?.h ?? 0;
  check(Math.abs(h(hi, 'CONCEAL') / h(lo, 'CONCEAL') - 0.4) < 1e-9, 'oversight: containment 0.6 blocks 60% of every act');
  const w1 = modelHazards(v.traitsTrue, [], v.domains, site({ wsl: 1 }));
  const w5 = modelHazards(v.traitsTrue, [], v.domains, site({ wsl: 5 }));
  check(h(w5, 'SCHEME') < h(w1, 'SCHEME') && h(w5, 'POWER') < h(w1, 'POWER') && h(w5, 'RH') === h(w1, 'RH'),
    'oversight: weight security blocks escape-like acts (scheming, overreach) and nothing else');
  // Human review: less AI share of R&D → more of the work done (and reviewed) by humans → more caught inside the lab.
  const d = dep(s, 'internal');
  const c0 = row(dangerOf(s, d, v, 1), 'RH')!.catch;
  s.player.split.agents *= 0.01;
  resetWorkContext(s);
  const c1 = row(dangerOf(s, d, v, 1), 'RH')!.catch;
  check(c1 > c0, 'oversight: human review rises as humans do more of the R&D', `catch ${c0.toFixed(3)} → ${c1.toFixed(3)}`);
}

// ───────────── a low-capability misaligned model has low severe-incident rates ─────────────
{
  const s = fresh();
  const v = s.player.models.versions[0];
  misaligned(v, 0.8);
  const severe = (L: number) => {
    atLevel(v, L);
    let r = 0;
    let sev = 0;
    let n = 0;
    forEachIncidentSite(s, (d, vv, u) => {
      for (const x of dangerOf(s, d, vv, u)) {
        if (x.source === 'misuse') continue;
        if (x.sev >= 3) r += x.rate;
        sev += x.sev * x.rate;
        n += x.rate;
      }
    });
    return { severe: r * YEAR, meanSev: sev / n };
  };
  const low = severe(4);
  const high = severe(11);
  check(low.severe < 0.05 && high.severe > 20 * low.severe, 'a misaligned (all traits 0.8) model at L 4 has few severity-3+ acts; at L 11 many more',
    `${low.severe.toFixed(3)} vs ${high.severe.toFixed(2)}/yr`);
  check(high.meanSev > low.meanSev + 0.5, 'severity rises with capability (rate-weighted mean)', `${low.meanSev.toFixed(2)} → ${high.meanSev.toFixed(2)}`);
  atLevel(v, 9);
  const chat = row(dangerOf(s, dep(s, 'consumer'), v, 0.3), 'POWER')!.sev;
  const int = row(dangerOf(s, dep(s, 'internal'), v, 1), 'POWER')!.sev;
  check(int > chat + 1, 'severity rises with opportunity: overreach inside the lab vs in chat', `${chat.toFixed(2)} vs ${int.toFixed(2)}`);
}

// ───────────── start-rate table (2025 models on the start deployments) ─────────────
{
  const kinds = [...Object.keys(DANGER_ACTS), 'umode', 'misuse'];
  const tab: Record<string, { ext: number; int: number; harm: number }> = {};
  const N = 8;
  for (let seed = 1; seed <= N; seed++) {
    const s = fresh(seed);
    forEachIncidentSite(s, (d, v, u) => {
      for (const x of dangerOf(s, d, v, u)) {
        const k = x.source === 'misuse' ? 'misuse' : x.source.startsWith('U') ? 'umode' : x.source;
        const t = (tab[k] ??= { ext: 0, int: 0, harm: 0 });
        if (d.channel === 'internal') t.int += (x.attempts * YEAR) / N;
        else t.ext += (x.attempts * YEAR) / N;
        t.harm += (x.rate * YEAR) / N;
      }
    });
  }
  console.log('      start acts per lab-year (8 seeds): kind  products  internal  harmful (after oversight)');
  for (const k of kinds) { const t = tab[k] ?? { ext: 0, int: 0, harm: 0 }; console.log(`        ${k.padEnd(8)} ${t.ext.toFixed(4).padStart(8)} ${t.int.toFixed(4).padStart(9)} ${t.harm.toFixed(4).padStart(9)}`); }
  const tot = (k: string) => (tab[k] ? tab[k].ext + tab[k].int : 0);
  const all = kinds.reduce((a, k) => a + tot(k), 0);
  // research/05 §1.1–1.2: sycophancy and test gaming are the common 2025 failures (a public sycophancy scandal ≈ once
  // per 1–2 years per lab; hacking in 1–2% of agentic tasks); §1.5/1.9/1.10: real-deployment cover-ups, sabotage,
  // collusion and escapes ≈ 0 in 2025. v2's start: ≈ 1.2 incident acts per lab-year.
  check(all > 0.4 && all < 3, 'start: 0.4–3 incident acts per lab-year (v2 start ≈ 1.2)', all.toFixed(2));
  check(tot('SYC') > 0.1 && tot('RH') > 0.05, 'start: sycophancy and reward hacking are the common acts', `SYC ${tot('SYC').toFixed(2)}, RH ${tot('RH').toFixed(2)}`);
  check(['SAND', 'COLLUDE', 'SCHEME'].every((k) => tot(k) < 0.005) && tot('POWER') < 0.01, 'start: sabotage, collusion, scheming < 0.005/yr and overreach < 0.01/yr (≈ 0 observed in 2025)',
    ['POWER', 'SAND', 'COLLUDE', 'SCHEME'].map((k) => `${k} ${tot(k).toExponential(1)}`).join(' '));
}

// ───────────── misuse and exfiltration keep v2's magnitudes on the new structure ─────────────
{
  let worst = 0;
  for (const L of [8, 9, 10, 11, 12]) worst = Math.max(worst, Math.abs((MISUSE.kappa * capabilityOf(L, MISUSE)) / (1e-4 * (L - 7)) - 1));
  check(worst < 0.35, 'misuse: κ·σ((L − 9)/1) within ±35% of v2\'s 1e-4·(L − 7) on L 8–12', `worst ${(worst * 100).toFixed(0)}%`);
  const s = fresh();
  const v = s.player.models.versions[0];
  v.traitsTrue.POWER = 0.3;
  v.traitsTrue.SCHEME = 0.1;
  const ex = (cy: number) => { v.domains.CYBER = cy; return exfiltrationHazard(s); };
  check(ex(5) < ex(9) && ex(9) < ex(11) && ex(11) < ex(13), 'exfiltration rises with CYBER (escape capability)');
  const old = 1e-4 * 0.3 * (1 + 4 * 0.1) * (11 - 8) * (1 - s.player.security.wsl / 5);
  check(ex(11) > 0.5 * old && ex(11) < 2 * old, 'exfiltration at CYBER 11 within ×2 of v2\'s at AGENCY 11 (same traits, security, start fleet)', `${ex(11).toExponential(2)} vs ${old.toExponential(2)}`);
  const rv = labModelHazards({ traitsTrue: v.traitsTrue, uModes: [], domains: v.domains }, 0.3);
  check(rv.length > 0 && rv.every((x) => x.h >= 0 && Math.abs(x.block - 0.3) < 1e-12), 'rival rows run on the same formula (mitigation blocks)');
}

finish('danger');
