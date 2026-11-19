// Limit registry (STRUCTURE R11, design/LIMITS.md "Show" verdicts). Every cap, floor, threshold or gate the player can
// hit is listed here once, with its rule, its source and the screen where it binds. The UI marks the element that shows
// it with `data-limit="<id>"` (component `Limit` in src/ui/v2/ui.tsx, which also renders the rule and source as a
// tooltip); scripts/v2/uitest.mjs checks every id appears on its home screen. Limits whose home is the codex (internal
// rules the player cannot act on) are listed in the codex's Limits category.

export interface LimitDef {
  id: string;
  /** One to four words. */
  title: string;
  /** The rule, terse, with its numbers. */
  rule: string;
  /** Where the number comes from ([D] = design value with no direct empirical estimate). */
  source: string;
  /** Engine file that enforces it. */
  engine: string;
  /** Home screen (panel id, optional tab). 'codex' = shown in the codex only. */
  home: { panel: string; tab?: string };
}

export const LIMITS: readonly LimitDef[] = [
  // ── models and research ──
  { id: 'tree.retry', title: 'Retry after a failure', rule: 'A safety idea that fails can be retried after 180 days; each failure halves its odds. (Capability projects reopen as speculative at once.)', source: 'TECH-TREE T5 [D]', engine: 'models/tree.ts', home: { panel: 'research', tab: 'tree' } },
  { id: 'research.maxTeams', title: 'Teams per project', rule: 'One capability project takes at most 6 science teams (teams wanted 0–6); progress grows with the square root of capacity.', source: 'MODEL-V3 §5.6 [D]', engine: 'models/research.ts', home: { panel: 'research', tab: 'projects' } },
  { id: 'research.rePerProject', title: 'Research engineers per project', rule: 'A project in experiments uses at most 2 research-engineer team-equivalents; the rest go to routine tuning.', source: 'MODEL-V3 §5.6 [D]', engine: 'models/research.ts', home: { panel: 'research', tab: 'projects' } },
  { id: 'run.stream', title: 'Continual-learning share', rule: 'A continual-learning stream takes 15% of the training pool before any run.', source: 'V2-SPEC §3.3.6 [D]', engine: 'models/runs.ts', home: { panel: 'models' } },
  { id: 'model.designOffset', title: 'Design boost cap', rule: 'Design offsets (code and research skill) move a model\'s research boost by at most ±0.5 years.', source: 'V2-SPEC §3.1.5', engine: 'models/capability.ts', home: { panel: 'models' } },
  { id: 'speed.serialCap', title: 'Agent serial speed', rule: 'Research agents think at most 50× human serial speed.', source: 'R11 #23', engine: 'production/production.ts', home: { panel: 'company', tab: 'flow' } },
  { id: 'speed.pause', title: 'Research pause', rule: 'While a pause of frontier experiments is in force, research runs at ×0.1.', source: 'V2-SPEC §3.1.2', engine: 'production/production.ts', home: { panel: 'company', tab: 'flow' } },
  { id: 'speed.diffusion', title: 'Knowledge diffusion', rule: 'While the frontier leader\'s public model is ahead of your best model, its published ideas add 2.0 × the gap to your pretraining recipe per year (public ideas, no headroom).', source: 'research/18 §0.2 catch-up [D, fit]', engine: 'production/production.ts', home: { panel: 'company', tab: 'flow' } },
  // ── compute ──
  { id: 'order.terms', title: 'Order terms', rule: 'LTAs run 4–12 quarters; a standard order pays a 30–100% deposit.', source: 'research/15 (vendor terms)', engine: 'compute/orders.ts', home: { panel: 'compute', tab: 'overview' } },
  { id: 'rent.spotCap', title: 'Spot rental cap', rule: 'Spot rentals are capped at 10% of the global rental pool (15% of the world\'s chips); a larger rental gets only what is left.', source: 'research/15 [D]', engine: 'compute/orders.ts', home: { panel: 'compute', tab: 'overview' } },
  { id: 'site.mw', title: 'Site size', rule: 'A site is 50 MW to the power source\'s largest; colocation leases draw on this quarter\'s lease pool.', source: 'research/15 §2', engine: 'compute/sites.ts', home: { panel: 'compute', tab: 'overview' } },
  // ── products ──
  { id: 'moonshot.serving', title: 'Moonshot compute', rule: 'Moonshot projects take their compute out of serving first, at most 30% of your compute.', source: 'research/16 §3.1 [D]', engine: 'worldfx/actions.ts', home: { panel: 'world' } },
  { id: 'price.valueCap', title: 'Price at value', rule: 'A product\'s price is its markup × its own cost per work-hour, never above the value of the work (the sector\'s wage per hour; a subscription at most $200 a month).', source: 'research/20 D3; MODEL-V3 §7.3 [D]', engine: 'worldfx/serving.ts', home: { panel: 'products' } },
  { id: 'product.erosion', title: 'Share erosion', rule: 'A capacity-bound product loses share at 0.5%/day of its unserved demand, at most 75%; it recovers when serving has slack.', source: 'research/16 [D]', engine: 'worldfx/revenue.ts', home: { panel: 'products' } },
  { id: 'product.demandMods', title: 'Demand modifiers', rule: 'Demand ×(1 − 2% per KYC level) on API and Agents; Trusted channel at ×3 the price; restricted ×0.3; "no drop-in agents" caps automated share at 50%.', source: 'research/16 §2', engine: 'worldfx/revenue.ts', home: { panel: 'products' } },
  // ── safety ──
  { id: 'trusted.cap', title: 'Trusted to AI cap', rule: 'Safety work trusted to AI needs a safety model at L ≥ 8.5 and is capped at 50% until Automated alignment research works.', source: 'research/14 §3; STRUCTURE §4.9', engine: 'departments/agents.ts', home: { panel: 'company', tab: 'people' } },
  { id: 'case.staffing', title: 'Case staffing', rule: 'An investigation takes 5–40 safety research engineers and closes after 120 days at most.', source: 'research/14 §2 [D]', engine: 'safety/investigations.ts', home: { panel: 'safety', tab: 'cases' } },
  { id: 'response.patchFloor', title: 'Diminishing patches', rule: 'Each signal patch multiplies the edges into a trait by 0.3–0.6, down to a floor of ×0.2: some of every pressure is irreducible.', source: 'M4 balance [D]', engine: 'safety/responses.ts', home: { panel: 'safety', tab: 'cases' } },
  { id: 'incident.publicTimer', title: 'Disclosure deadline', rule: 'A customer incident goes public in 14–60 days; SB 53 caps it at 15 days and RAISE at 3; each outside evaluator with access shortens it 10%.', source: 'CA SB 53 (2025); NY RAISE Act (2025)', engine: 'safety/incidents.ts', home: { panel: 'safety', tab: 'cases' } },
  { id: 'understanding.gapCap', title: 'Understanding-gap penalty', rule: 'The misalignment pressure from capability outrunning understanding counts at most 2.5 levels of gap.', source: 'M4 balance [D]', engine: 'safety/traits.ts', home: { panel: 'codex' } },
  // ── finance, relations, world ──
  { id: 'board.incidentCap', title: 'Incident hit cap', rule: 'Public incidents cost board confidence −10 to −30 each, at most −20 per quarterly review.', source: 'M4 balance [D]', engine: 'finance/board.ts', home: { panel: 'finance', tab: 'owners' } },
  { id: 'security.floor', title: 'Security floor', rule: 'Weight security never falls below the industry status quo: WSL 2.2 in 2025, rising to 3.3 by 2027.', source: 'R11 #17; RAND SL framework', engine: 'security/security.ts', home: { panel: 'company', tab: 'security' } },
  { id: 'rivals.simplified', title: 'Rivals are simplified', rule: 'Rival labs and China are simulated from the outside as a continuous frontier: none of your run, data, eval, board or commitment gates apply to them.', source: 'STRUCTURE §4.8 (decided 2026-11-16)', engine: 'actors/rivals.ts', home: { panel: 'codex' } },
  { id: 'rivals.slowdown', title: 'Bound leader slows', rule: 'A rival leader bound by its own commitments slows itself; your commitments bind you through their predicates instead.', source: 'V2-SPEC §3.10.3', engine: 'actors/rivals.ts', home: { panel: 'codex' } },
];

export const LIMIT_BY_ID: Record<string, LimitDef> = Object.fromEntries(LIMITS.map((l) => [l.id, l]));
