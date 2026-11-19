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
  { id: 'tree.retry', title: 'Retry after a failure', rule: 'An idea that fails can be retried after 180 days; each failure halves its odds.', source: 'TECH-TREE T5 [D]', engine: 'models/tree.ts', home: { panel: 'research' } },
  { id: 'run.stream', title: 'Continual-learning share', rule: 'A continual-learning stream takes 15% of the training pool before any run.', source: 'V2-SPEC §3.3.6 [D]', engine: 'models/runs.ts', home: { panel: 'models' } },
  { id: 'model.designOffset', title: 'Design boost cap', rule: 'Design offsets (code and research skill) move a model\'s research boost by at most ±0.5 years.', source: 'V2-SPEC §3.1.5', engine: 'models/capability.ts', home: { panel: 'models' } },
  { id: 'speed.frontierMethods', title: 'Frontier methods', rule: 'From 100 to 280 days after your SC, research speed is measured against a lab with automated research agents (experiments ×1.5) and latent reasoning (agents ×2.5). Without Automated AI research agents and a Neuralese base you fall behind it. The same rule holds for every lab.', source: 'AI 2027 (Agent-3 at SC); V2-SPEC §9 #4', engine: 'production/production.ts', home: { panel: 'company', tab: 'flow' } },
  { id: 'speed.serialCap', title: 'Agent serial speed', rule: 'Research agents think at most 50× human serial speed.', source: 'R11 #23', engine: 'production/production.ts', home: { panel: 'company', tab: 'flow' } },
  { id: 'speed.etaMod', title: 'Serving-cost benefit', rule: 'Cheaper-to-serve research models run more copies: ×(0.5 ÷ serve cost), held between ×0.5 and ×2.5.', source: 'V2-SPEC §3.3.3', engine: 'production/production.ts', home: { panel: 'company', tab: 'flow' } },
  { id: 'speed.pause', title: 'Research pause', rule: 'While a pause of frontier experiments is in force, research runs at ×0.1.', source: 'V2-SPEC §3.1.2', engine: 'production/production.ts', home: { panel: 'company', tab: 'flow' } },
  { id: 'speed.diffusion', title: 'Knowledge diffusion', rule: 'While the frontier leader\'s public model is ahead of your best model, its published ideas add 2.0 × the gap to your know-how per year.', source: 'research/18 §0.2 catch-up [D, fit]', engine: 'production/production.ts', home: { panel: 'company', tab: 'flow' } },
  // ── compute ──
  { id: 'order.terms', title: 'Order terms', rule: 'Spot: next quarter at the spot price. One batch: delivered in 2 quarters, 30–100% deposit. Supply contracts: a tranche every quarter for 1–4 years, take-or-pay, 5% off from 2 years and 10% from 4. Every price follows the expected market path.', source: 'research/15 (vendor terms); FINANCE-V3 §5 [D]', engine: 'compute/orders.ts', home: { panel: 'compute', tab: 'overview' } },
  { id: 'rent.spotCap', title: 'Spot rental cap', rule: 'Spot rentals are capped at 10% of the global rental pool (15% of the world\'s chips); a larger rental gets only what is left.', source: 'research/15 [D]', engine: 'compute/orders.ts', home: { panel: 'compute', tab: 'overview' } },
  { id: 'lease.rating', title: 'Lessors price your rating', rule: 'A financing lease costs funded × CRF(r, n) a year: r = 7% at BBB, 9% at BB, 12% at B; no lessor funds you below B. Sites: 80% funded over 15 years; chips: the delivery balance over 5 years.', source: 'FINANCE-V3 §4 [D]; Meta–Blue Owl Hyperion 80/20', engine: 'finance/capex.ts', home: { panel: 'compute', tab: 'overview' } },
  { id: 'site.mw', title: 'Site size', rule: 'A site is 50 MW to the power source\'s largest; colocation leases draw on this quarter\'s lease pool.', source: 'research/15 §2', engine: 'compute/sites.ts', home: { panel: 'compute', tab: 'overview' } },
  // ── products ──
  { id: 'moonshot.serving', title: 'Moonshot compute', rule: 'Moonshot projects take their compute out of serving first, at most 30% of your compute.', source: 'research/16 §3.1 [D]', engine: 'worldfx/actions.ts', home: { panel: 'world' } },
  { id: 'revenue.speedCap', title: 'Revenue per chip cap', rule: 'Revenue per serving H100e grows with the served model\'s research speed up to 8×, then stops.', source: 'R11 #14', engine: 'worldfx/revenue.ts', home: { panel: 'products' } },
  { id: 'product.erosion', title: 'Share erosion', rule: 'A capacity-bound product loses share at 0.5%/day of its unserved demand, at most 75%; it recovers when serving has slack.', source: 'research/16 [D]', engine: 'worldfx/revenue.ts', home: { panel: 'products' } },
  { id: 'product.demandMods', title: 'Demand modifiers', rule: 'Demand ×(1 − 2% per KYC level) on API and Agents; Trusted channel ×3; restricted ×0.3; "no drop-in agents" caps automated share at 50%.', source: 'research/16 §2', engine: 'worldfx/revenue.ts', home: { panel: 'products' } },
  // ── safety ──
  { id: 'trusted.cap', title: 'Trusted to AI cap', rule: 'Safety work trusted to AI needs a safety model at L ≥ 8.5 and is capped at 50% until Automated alignment research works.', source: 'research/14 §3; STRUCTURE §4.9', engine: 'departments/agents.ts', home: { panel: 'company', tab: 'people' } },
  { id: 'case.staffing', title: 'Case staffing', rule: 'An investigation takes 5–40 safety research engineers and closes after 120 days at most.', source: 'research/14 §2 [D]', engine: 'safety/investigations.ts', home: { panel: 'safety', tab: 'cases' } },
  { id: 'response.patchFloor', title: 'Diminishing patches', rule: 'Each signal patch multiplies the edges into a trait by 0.3–0.6, down to a floor of ×0.2: some of every pressure is irreducible.', source: 'M4 balance [D]', engine: 'safety/responses.ts', home: { panel: 'safety', tab: 'cases' } },
  { id: 'incident.publicTimer', title: 'Disclosure deadline', rule: 'A customer incident goes public in 14–60 days; SB 53 caps it at 15 days and RAISE at 3; each outside evaluator with access shortens it 10%.', source: 'CA SB 53 (2025); NY RAISE Act (2025)', engine: 'safety/incidents.ts', home: { panel: 'safety', tab: 'cases' } },
  { id: 'understanding.gapCap', title: 'Understanding-gap penalty', rule: 'The misalignment pressure from capability outrunning understanding counts at most 2.5 levels of gap.', source: 'M4 balance [D]', engine: 'safety/traits.ts', home: { panel: 'codex' } },
  // ── finance, relations, world ──
  { id: 'debt.creditLine', title: 'Credit line size', rule: 'Banks lend 3% of your valuation, at most $15B, re-sized when you borrow or close a round; cash must stay above a third of the line at quarter ends while it is drawn. Frozen in distress or with the rating closed.', source: 'FINANCE-V3 §3 (OpenAI $4B at $157B; Anthropic $15B, $5B liquidity covenant)', engine: 'finance/debt.ts', home: { panel: 'finance', tab: 'deals' } },
  { id: 'debt.chipLoan', title: 'Chip loan size', rule: 'Up to 60% of your chips’ collateral value (installed and stocked chips at 70% of today’s list price). Below 1.2× the loan, cash is swept.', source: 'research/15 §1.7 (CoreWeave DDTL)', engine: 'finance/debt.ts', home: { panel: 'finance', tab: 'deals' } },
  { id: 'debt.bond', title: 'Bond size', rule: 'Bonds need positive operating cash flow over the last four quarters and are capped at 3× it.', source: 'FINANCE-V3 §3 [D]', engine: 'finance/debt.ts', home: { panel: 'finance', tab: 'deals' } },
  { id: 'board.incidentCap', title: 'Incident hit cap', rule: 'Public incidents cost board confidence −4 to −13 each by severity, at most −8 per quarterly review, then × the board\'s incident weight (mission seats ×2, independents ×1, financial ×0.5).', source: 'M4 balance; FINANCE-V3 §7.4, FIN3a [D]', engine: 'finance/board.ts', home: { panel: 'finance', tab: 'owners' } },
  { id: 'security.floor', title: 'Security floor', rule: 'Weight security never falls below the industry status quo: WSL 2.2 in 2025, rising to 3.3 by 2027.', source: 'R11 #17; RAND SL framework', engine: 'security/security.ts', home: { panel: 'company', tab: 'security' } },
  { id: 'rivals.simplified', title: 'Rivals are simplified', rule: 'Rival labs and China are simulated from the outside as a continuous frontier: none of your run, data, eval, board or commitment gates apply to them.', source: 'STRUCTURE §4.8 (decided 2026-11-16)', engine: 'actors/rivals.ts', home: { panel: 'codex' } },
  { id: 'rivals.slowdown', title: 'Bound leader slows', rule: 'A rival leader bound by its own commitments slows itself; your commitments bind you through their predicates instead.', source: 'V2-SPEC §3.10.3', engine: 'actors/rivals.ts', home: { panel: 'codex' } },
];

export const LIMIT_BY_ID: Record<string, LimitDef> = Object.fromEntries(LIMITS.map((l) => [l.id, l]));
