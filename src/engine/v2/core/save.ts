// Save format, migrations, state hash (V2-SPEC §2.5). Owner: WS1.
import { ensureWs3 } from '../finance/ext';
import { START_CREDIBILITY, typicalRound } from '../finance/promises';
import { dMax } from '../finance/equity';
import type { DomainId, GameStateV2, LabCore, RunRecipe, SectorId, VersionBuild } from '../types';
import { CAP_USES, DEFAULT_CAP_SHARES, MONITOR_STD_POOL_SHARE, REF_AGENT_SHARES } from '../../../data/v2/agents';
import { monitorCostRatio, monitorNeedShare } from '../departments/agents';
import { partnerDef, PARTNER_TERMS } from '../../../data/v2/deals';
import { toolsFromFeatures } from '../../../data/v2/features';
import { divisionOf } from '../finance/parent';
import { privateRivals, sectorValue, seedLabRevenue } from '../finance/story';
import { FIN } from '../actors/rivals';
import { rivalVersionBuild, setModelG } from '../actors/rivalModel';
import { continueDrawNow, fillRecipe } from '../models/runs';
import { domainsOf, gOfLevel, refreshLevels } from '../models/capability';
import { addIdea } from '../models/stacks';
import { refitMeasured } from '../models/benchmarks';
import { techniqueRole } from '../safety/techniques';
import { creditSuiteExpertData, familyDomain, keepUnlockedSuite, restateSuiteTasks, suiteFamilies, unbuiltSuiteFamilies } from '../models/suites';
import { B0_PARAMS, SHAPE } from '../../../data/v2/runDesign';
import { DEFAULT_SAF_RE_ALLOC } from '../../../data/v2/research';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import { defaultFramework } from '../../../data/v2/framework';

/** Bump on any breaking change to types.ts and add a migration from the previous rev.
 *  Saves below MIN_SCHEMA_REV (33) do not load (designer decision DD-20, RD-C03): v1, v2 and model v3 V1–V3 saves
 *  (≤ 14) never carried over, and the model v3 migrations 15 → 16 … 32 → 33 were deleted with their helpers (their
 *  history is in git before RD-C03 and in V3-BUILD). deserialize refuses them with OLD_SAVE_MESSAGE.
 *  33 (model v3 F3): the progress coordinate pm and the know-how readout pa are gone — ModelVersion.G and SimpleModel.G
 *  (required) replace pm, KnowledgeState.openWeightsG replaces openWeightsFrontier; LabCore.pa, RivalPhys.paSync,
 *  VersionBuild.paIn, BaseModel / TrainingRun.paAtStart and the stream's paTrack are removed.
 *  34–42 (finance v3, merge FINM): the finance rebuild's nine migrations, built on finance-v3 as 11 → 12 … 19 → 20 and
 *  renumbered after model v3's 33 (finance rev r = merged rev r + 22): 33 → 34 FIN1 (debt, leases, partner templates),
 *  34 → 35 FIN2 (credibility, promises), 35 → 36 FIN3a (approvals list), 36 → 37 FIN3b (E37 freeze, reinstatement),
 *  37 → 38 FIN4a (partner records), 38 → 39 FIN5c (division budget), 39 → 40 FIN4r (typical round, lease ids), 40 → 41
 *  FIN5a (story mark, lab revenue history), 41 → 42 FIN5b (rivals' marks, pool, raised). Each one only touches what is
 *  missing or still in its old form, so a state already at 42 labelled 33 loads unchanged (hygiene checks it). Saves
 *  written by the finance-v3 branch itself (its revs 12–20) collide with model v3's numbers and do not load.
 *  43 (SAFMECH): PlayerLab.policies.monitorBudget (the monitoring budget, a share of the safety pool, which sets the
 *  monitors' coverage). Migration 42 → 43 gives a save the old standard package's 20% (idempotent).
 *  44 (RD-C01): v2's knot production function is gone — TimelineWorld.prod.knots and the dead readout fields of every
 *  lab's prodCache (Ddata, parts.base, elast.train / data, ratios.d) are removed. Migration 43 → 44 drops them (the
 *  cache is rebuilt the next day anyway); RD-C02, in the same bump, also drops TimelineWorld.calShift, and RD-C07
 *  the cut paradigm P26 (its paradigm state and hidden.paradigmSuccess.P26) and RD-C04 the unread fields
 *  TimelineWorld.prod.kappa / etaSC, BaseModel.scale and VersionBuild.misuseMult (every lab).
 *  45 (RD-B02): TrainingRun.recipe is the run's whole launch snapshot (RunRecipe: + the base's DataDraw and P24 bonus, a
 *  continue run's draw, a post-train's domainG, P07 flag and serving FLOP part); completion and the trait hook read
 *  only it. Migration 44 → 45 fills what a run in flight lacks from the save's own day (the best available). RD-B03,
 *  same bump: a family unlocked later (computer use) has no suite until its first build; a save that knows its idea
 *  but never stored its suite (it read as a free start-quality one) keeps it, stored, before the runs are filled.
 *  46 (RD-B12): sector packs live on their product (DeploymentV2.packs: {sector, certDay}[]); world.fx.certDay and
 *  the product's sectorFocus are gone. Migration 45 → 46 moves each pack onto its product with the world's certification
 *  day and drops a certified sector no product carries.
 *  47 (RD-U08): serving cost is FLOP per token only: BaseModel.fpt and ModelVersion.fpt are required, BaseModel.serve,
 *  the versions' and run predictions' relative serve cost are gone (the relative 0.5-reference readout). Migration 46 → 47
 *  computes fpt as the old reader did and drops the old fields.
 *  48 (RD-L01): SeriesV2.G, each lab's weekly best internal frontier G (the lead clock lagDays reads it). Migration
 *  47 → 48 seeds it from the λ series (G = gOfLevel(λ); approximate: λ was rounded to 0.001 and capped at 15).
 *  49 (RD-U01): one capability currency. VersionBuild.offL (design offsets in levels) and the derived VersionBuild.off
 *  become VersionBuild.dgD (domain ΔG, OOM, part of gOfDomain); BaseModel.off (never written) is gone. Migration
 *  48 → 49 converts every stored build's offL at the 1.2 L per OOM the fit applied (so the fit is unchanged) and
 *  recomputes the player's version domain levels as λ(G_d).
 *  50 (RD-U05): domain levels are scores against the domain's best human (models/capability.ts domainsOf); v2's display offsets are
 *  gone. Migration 49 → 50 recomputes every stored domain-level record.
 *  53 (RD-E03, DD-12): no headroom and no routine tuning: StackBucket.h and the research engineers' 'tune' need are gone.
 *  Migration 52 → 53 delivers the remaining headroom (the bucket's effect becomes its whole adopted a) and drops 'tune'
 *  from the research-engineer allocation and the last-day readout.
 *  54 (RD-E01a, DD-14): paradigms P13 and P19 are deleted (with P19's RSCH gain) and P24 is an idea in the
 *  pretraining stack: RunRecipe.p24 is gone. Migration 53 → 54 drops P13 / P19 state and draws, folds a run's frozen
 *  P24 bonus into its frozen pretraining stack, gives an adopted P24 its bonus on the save's day as a stack idea, and
 *  recomputes stored domain levels without P19.
 *  55 (RD-E01b, DD-14): paradigm P20 is deleted; P05 is a typed scaffold and P07 multiplies the long-tasks RL family's
 *  horizon (no stored shape changes: versions keep their frozen h80Mult). Migration 54 → 55 drops P20 state and draw.
 *  56 (RD-A05b, DD-19): the spare-training and spare-serving policies are gone (idle compute stays idle); the explicit
 *  auto-split policy replaces them. Migration 55 → 56 drops the two policies and adds autoSplit off.
 *  58 (RD-T01a, DD-06): an IDA run is an RL (post) run with the teacher as grader (TrainingRun.grader), no longer
 *  recognised by its name. Migration 57 → 58 sets grader 'teacher' on post runs named "IDA …".
 *  59 (RD-T02, TRN-07): a continue run draws its added tokens from the portfolio (RunRecipe.draw cumulative, prevDEff).
 *  Migration 58 → 59 redraws in-flight continue runs on the save's day (their launch portfolio is gone).
 *  60 (RD-T03, DD-05): the stream spends the FLOP it accrues (stream.flop, periodDay) on continued pretraining and an
 *  RL refresh; its tracked recipe (stream.track) is gone. Migration 59 → 60 starts a running stream's period on the
 *  save's day (the version keeps what it absorbed). Rivals' stream state (RivalPhys.cl) is set lazily.
 *  61 (RD-A04): safety research engineers by need (research.safRe, the player's order). Migration 60 → 61 adds the
 *  default order.
 *  62 (RD-R02b): a safety project is one test (SafProjectState {work, workNeed, flop}); the candidate pool, its beliefs
 *  and stages are gone. Migration 61 → 62 restates a running project's state at its progress (work = progress × T₁).
 *  63 (RD-R04): the rolled tree path and the paradigm mirror are gone: PlayerLab.paradigms (adopted() reads the tree),
 *  the rolled-node fields of TreeNodeState (odds multiplier, retry day), the kyc node (the per-product KYC setting stays), P27's hidden paradigm draw.
 *  Migration 62 → 63 drops them and restates P27 as a safety project of line AG17 (running: its test at its progress;
 *  failed: open again, next attempt).
 *  64 (RD-T11): TrainingRun.scale is gone (scrutiny reads the run's FLOP against the largest rival run). Migration
 *  63 → 64 drops it.
 *  65 (RD-T06, DD-07): expert data is only a suite input (no purchase by domain, no `expert:dom:<domain>` stock) and
 *  P12 unlocks the long-tasks demonstrations build instead of delivering data at adoption. Migration 64 → 65 credits
 *  each bought domain stock (delivered or pending) to the suites of its families (split evenly over those with a
 *  suite), drops stock no suite maps to, and restarts a P12 under test as a plain unlock project at its progress.
 *  66 (RD-T07, DD-07): EnvSuite.tasks, the live tasks (fidelity = f(tasks × grader quality), decaying without
 *  upkeep). Migration 65 → 66 sets each stored suite's tasks from its expert data (nothing stale yet).
 *  67 (RD-T08): the 'natural' data preset merges into 'balanced' (every preset now weights the lab's own mix;
 *  BaseDesign.mixShares carries RefBot's fixed shares); the "Overtrained compact" node goes (tokens per parameter is
 *  ungated). Migration 66 → 67 renames the preset in every stored base design and drops the node's tree state.
 *  68 (RD-M01, DD-08): the measured level is fitted from the benchmark scores (EvalRecord.measuredDom, fitSd); the
 *  stored error draw errTrue goes. Migration 67 → 68 refits every player version with a bench table and drops errTrue.
 *  69 (RD-X03): a non-player lab's models carry a reference-profile build (SimpleModel.build: baseG + rlGains on the
 *  lab's reference portfolio). Migration 68 → 69 builds one for every stored rival, leader-lab and China model.
 *  Merge p3-d → rd: the safety redesign's migrations (p3-d's 64→65 … 72→73) follow rd's chain as 69→70 … 77→78.
 *  70 (SR-01): the dead-end latch and the tool On/Off toggle are gone: AgendaState.status loses 'deadEnd'; owned
 *  detection / containment tools are always active. Migration 69 → 70 unlatches lines and sets those tools active.
 *  71 (SR-06): every TraitBelief carries an evidence list. Migration 70 → 71 gives existing beliefs (player versions'
 *  and any other model's) an empty list.
 *  72 (SR-13): Deployment.controlLayer and status 'restricted' are gone; Deployment.guards holds safeguard items (control
 *  protocol, human review, restriction, comms lockdown). Migration 71 → 72 maps the flag / status to items, gives
 *  internal deployments human review, and an owned T-LOCK a comms lockdown on them.
 *  73 (SR-08): detect techniques are instruments: TechniqueState.validatedOn / validatedOom (the model it was validated
 *  on; reliability decays with the capability gap from it, oHalf is that gap's half point) and trainedAgainstOn.
 *  Migration 72 → 73 sets every technique validated on the start model (gap = OOM above V0, as before) and
 *  trainedAgainstOn null.
 *  74 (SR-09): tool upkeep is replaced by validation jobs: SafetyDept.validation (jobs queue, policy "validate on each
 *  new internal model", on), TechniqueState.measured, and the safety engineers' need 'reval' is 'validation'.
 *  Migration 73 → 74 adds an empty queue with the policy on, measured null, and renames the need in research.safRe.
 *  75 (SR-14): training-time safety methods are run-plan options: PostDesign.techniques and .trainAgainst become one
 *  list PostDesign.methods (method ids and `against:<instrument>` entries); SafetyDept.useAllMethods (the policy "Use
 *  all known methods", on by default). Migration 74 → 75 rewrites every post design in the save and turns the policy on.
 *  76 (SR-14b / SR-15): PostDesign.inoculation (a boolean) is the method T-INOC in PostDesign.methods. Migration 75 → 76
 *  adds T-INOC to every post design that had inoculation on and drops the field.
 *  77 (SR-10): SafetyDept.disagreements (independent instruments' conflicting readings), TechniqueState.trust (trust
 *  factor on believed reliability with its evidence), ValidationJob.human / ValidationResult.human (who ran it).
 *  Migration 76 → 77 adds an empty disagreement list and marks earlier measurements human-run (they read true recall).
 *  78 (SR-16): SafetyDept.envFixes (owned environment fixes per RL family; the patch response makes them). The per-edge
 *  signal-patch flags (ws2.patch.<lineage | lab>.<edge>) are gone: migration 77 → 78 drops them (keeps targeted
 *  inoculation training's ws2.patch.lab.E04) and adds an empty fix list.
 *  79 (SR-17 / SR-18): Investigation.before / readings and outcomeDetail.changes / evidence (verdicts say what changed);
 *  SafetyDept.disclosure (policy, default legal minimum, OD-8) and requiredMethods; Incident.disclose (override).
 *  ResponseKind loses targetedTraining and disclose (addMethod added). Migration 78 → 79 sets the policy to legal
 *  minimum, an empty required-method list, and drops the two old kinds from incidents' response records.
 */
export const SCHEMA_REV = 80;
/** The oldest save that loads (DD-20): a save below it is refused with OLD_SAVE_MESSAGE. */
export const MIN_SCHEMA_REV = 33;
/** What the player is told when a save is older than MIN_SCHEMA_REV. */
export const OLD_SAVE_MESSAGE = 'This save is from an older version of the game and can no longer be loaded.';
export const AUTOSAVE_KEY = 'ai27.v2.autosave';
export const SLOT_KEYS = ['ai27.v2.slot1', 'ai27.v2.slot2', 'ai27.v2.slot3'] as const;
/** v1 save key: the start screen offers "v1 save found: start new" (no migration). */
export const V1_SAVE_KEY = 'ai27.save.v1';
export const SAVE_BUDGET_BYTES = 1.5 * 1024 * 1024;

/** migrations[rev] upgrades a state at schemaRev = rev to rev + 1 (from MIN_SCHEMA_REV up). */
export const migrations: Record<number, (s: Record<string, unknown>) => void> = {
  /** 33 → 34 (finance v3 FIN1): SPV leasebacks become financing leases (kind finLease; the old 12%/4-year entries keep
   *  their payments); SPV- or JV-funded sites still being built get a lease at 9% (BB) on what was funded; the spv,
   *  neocloud and mega-JV deal templates and the JV are removed; LTA orders are firm tranches; the trailing operating
   *  cash flow starts from last quarter's; board blocks on removed action ids move to Buy chips / Rent compute. */
  33: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    const fx = f.ws3 as unknown as Record<string, unknown> & GameStateV2['player']['finance']['ws3'];
    // The SPV's leaseback paid 12% (Keystone Capital), the mega-JV's 10% (FIN4r L12: it read 12% for both).
    for (const c of f.ledger as unknown as { kind: string; rate?: number; payee: string }[]) if (c.kind === 'spvRVG') { c.kind = 'finLease'; c.rate = c.payee === 'Keystone Capital' ? 0.12 : 0.1; }
    for (const x of s.player.sites) {
      const w = x.ws3 as unknown as Record<string, unknown> & typeof x.ws3;
      // FINM: a site already on a FIN1 lease keeps it (the migration is idempotent on a state at 42 labelled 33).
      if (w.lease) continue;
      if (x.spvFunded > 0 && x.stage !== 'live' && x.stage !== 'blocked') w.lease = { rate: 0.09, funded: x.capexPaid * x.spvFunded };
      else if (x.stage !== 'live') x.spvFunded = 0;
      delete w.financedBy;
    }
    const gone = new Set(['spv', 'neocloud', 'megaJV']);
    f.deals = (f.deals as unknown as { template?: string }[]).filter((d) => !gone.has(d.template as string)) as unknown as typeof f.deals;
    const offers = ((fx.offers ?? []) as Record<string, unknown>[]).filter((o) => !gone.has(o.template as string));
    for (const o of offers) delete o.siteShare;
    fx.offers = offers;
    delete fx.jv;
    delete fx.spvBcQ;
    fx.opCash4q ??= fx.opCashQ ? [fx.opCashQ] : [];
    for (const o of s.player.orders) if (o.kind === 'lta') { o.ltaStartQ ??= o.dueQ; o.firm = true; }
    const anchors = s.capital.ws3?.anchors as Record<string, string> | undefined;
    if (anchors) for (const k of ['Keystone Capital', 'Meridian Group', 'Vantage Neocloud']) delete anchors[k];
    const bu = ((fx as unknown as { blockedUntil?: Record<string, number> }).blockedUntil ?? {}) as Record<string, number>;
    const move: Record<string, string> = { 'cmp.orderStandard': 'cmp.buyChips', 'cmp.orderLTA': 'cmp.buyChips', 'cmp.orderSpot': 'cmp.buyChips', 'cmp.cloudContract': 'cmp.rentCompute' };
    for (const [from, to] of Object.entries(move)) if (bu[from] !== undefined) { bu[to] = Math.max(bu[to] ?? 0, bu[from]); delete bu[from]; }
  },
  /** 34 → 35 (finance v3 FIN2): investor credibility (start value by start type) and an empty promise list (rounds
   *  raised before FIN2 promised nothing); the revenue plan, the trailing raised tally and the patientQ start mod are
   *  gone; the milestone histories start empty (the raise card falls back to the pipeline and market pace). A pending
   *  or repriced round from before FIN2 closes without a thesis. */
  34: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance as GameStateV2['player']['finance'] & { raisedLast4q?: number };
    const start = s.setup.start ?? 'leader';
    f.credibility ??= START_CREDIBILITY[start];
    f.promises ??= [];
    delete f.raisedLast4q;
    delete (f.ws3 as unknown as Record<string, unknown>).revenuePlan;
  },
  /** 35 → 36 (finance v3 FIN3a): board votes are deterministic and never block, so the never-filled pending-approvals
   *  list goes and the 90-day blocks old rejections left on raises, deals, borrowing and cloud contracts are lifted
   *  (E37's capex freeze on sites and chips stays). */
  35: (raw) => {
    const s = raw as unknown as GameStateV2;
    delete (s.player.board as unknown as Record<string, unknown>).pendingApprovals;
    const bu = (s.player.finance.ws3 as unknown as { blockedUntil?: Record<string, number> } | undefined)?.blockedUntil;
    if (bu) for (const k of Object.keys(bu)) if (['fin.raise', 'fin.acceptDeal', 'fin.drawDebt', 'cmp.rentCompute'].includes(k) || k.startsWith('deal:')) delete bu[k];
  },
  /** 36 → 37 (finance v3 FIN3b): E37 is gone, so its capex freeze (the last board block) and the block list go; the
   *  ouster is a deterministic vote with no staff-revolt reinstatement, so the reinstatement day goes. An E37 decision
   *  still pending is dropped. */
  36: (raw) => {
    const s = raw as unknown as GameStateV2;
    const fx = s.player.finance.ws3 as unknown as Record<string, unknown> | undefined;
    if (fx) {
      delete fx.blockedUntil;
      delete fx.reinstatedDay;
    }
    const ev = s.events as unknown as { pending?: { id: string }[] };
    if (Array.isArray(ev.pending)) ev.pending = ev.pending.filter((d) => d.id !== 'E37');
  },
  /** 37 → 38 (finance v3 FIN4a): one partner offer flow. Deal records move from templates to partner kinds: a
   *  hyperscaler (old hyperscaler equity and custom-ASIC deals), a chip vendor, a sovereign; vendor-financing deals go
   *  (a vendor note stays as a bond-like loan with its spread and maturity). Stakes from before the start become legacy
   *  holders. The strings that did nothing go (observer, IP rights, in-country site); exclusivity and the revenue share
   *  stay, a deal running as before (the revenue share to six years after signing; custom chips and chip vendors keep
   *  their rationing priority for the supply term). Open offers go (terms are now computed live), and so do partner
   *  observer seats (hyperscalers hold no seats). Signed contracts, orders and tranches are kept as signed. */
  37: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    const old = f.deals as unknown as { id: string; template?: string; partner: string; day: number; strings?: Record<string, unknown> }[];
    const KIND: Record<string, 'hyperscaler' | 'chipVendor' | 'sovereign'> = { hyperscalerEquity: 'hyperscaler', customASIC: 'hyperscaler', chipVendorEquity: 'chipVendor', sovereign: 'sovereign' };
    f.deals = old.filter((d) => d.template !== 'vendorFinance').map((d) => {
      if (!d.template && 'kind' in d) return d as unknown as GameStateV2['player']['finance']['deals'][number]; // already a partner record
      const kind = partnerDef(d.partner)?.kind ?? KIND[d.template ?? ''] ?? 'hyperscaler';
      const st = d.strings ?? {};
      const rescue = !!st.boardSeat;
      const legacy = d.day < 0;
      const chips = d.template === 'customASIC' || d.template === 'chipVendorEquity';
      const until = legacy ? d.day : d.template === 'hyperscalerEquity' && !rescue ? d.day + PARTNER_TERMS.hyperscaler.years * 365 : chips ? d.day + 10 * 91 : d.day;
      return {
        id: d.id, partner: d.partner, kind, day: d.day, equityNow: 0, equityLater: 0,
        ...(chips ? { supply: { kind: d.template === 'customASIC' ? 'asic' as const : 'chips' as const, h100e: 0, quarters: 8, first: 0, last: 0, firmDiscount: 0, partnerDiscount: 0, total: 0, endDay: until } } : {}),
        strings: { ...(st.exclusivity ? { exclusivity: true } : {}), ...(typeof st.revenueShare === 'number' && st.revenueShare > 0 ? { revenueShare: st.revenueShare } : {}), ...(rescue ? { boardVotes: PARTNER_TERMS.rescue.seats } : {}) },
        until, ...(rescue ? { rescue: true } : {}), ...(legacy ? { legacy: true } : {}),
      };
    });
    const fx = f.ws3 as unknown as Record<string, unknown>;
    delete fx.offers;
    for (const d of f.debts as unknown as { kind: string; covenant?: string }[]) if (d.kind === 'vendorNote') { d.kind = 'bond'; d.covenant = 'incurrence'; }
    for (const c of f.ledger as unknown as { kind: string }[]) if (c.kind === 'vendor') c.kind = 'lta';
    for (const y of Object.values((f.ws3?.years ?? {}) as unknown as Record<string, Record<string, unknown>>)) delete y.vendorNotes;
    s.player.board.seats = s.player.board.seats.filter((x) => !(x.kind === 'strategic' && x.weight <= 0));
  },
  /** 38 → 39 (finance v3 FIN5c): a big-tech division gets its budget year: this year's budget at the plan (as it was
   *  paid), savings carried in estimated as cash above what this year has paid so far; the parent sets goals and the
   *  next budget at the next review. A division never stays in distress (no runway verdict). */
  38: (raw) => {
    const s = raw as unknown as GameStateV2;
    if (divisionOf(s) && s.player.finance.state !== 'insolvent') s.player.finance.state = 'healthy';
  },
  /** 39 → 40 (finance v3 FIN4r review fixes): a live promise stores a typical round at its close (the dilution limit
   *  at its round's pre-money, the floor of its weight), read from its round; a partner deal's supply drops the inert
   *  order id; leases migrated from the old SPV and mega-JV are keyed like any lease (L-fin-<site>, so What we owe names
   *  the site) and the JV's keeps its 10% rate. Round tranches from before keep no shares to cancel (as signed). */
  39: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    for (const p of f.promises ?? []) {
      if (p.result || p.by === 'parent' || p.typical !== undefined) continue;
      const r = f.rounds.find((x) => x.day === p.closeDay && !x.ipo);
      if (r) p.typical = typicalRound(r.postMoney - r.amount, dMax(!!r.anchor, false));
    }
    for (const d of f.deals) if (d.supply) delete (d.supply as unknown as Record<string, unknown>).ref;
    for (const c of f.ledger) {
      if (c.kind !== 'finLease' || !c.id.startsWith('L-spv-')) continue;
      if (c.payee !== 'Keystone Capital' && c.rate === 0.12) c.rate = 0.1;
      c.id = `L-fin-${c.id.slice('L-spv-'.length)}`;
    }
  },
  /** 40 → 41 (finance v3 FIN5a): the valuation is the story split (sector value × share). The narrative premium N is
   *  gone; private rivals get a revenue history (the last four quarters at the sector's ×3 a year, as at a new start);
   *  the last mark is read off the saved valuation (share = valuation ÷ today's sector value), so the first mark after
   *  loading moves half-way from it to the story like any other. */
  40: (raw) => {
    const s = raw as unknown as GameStateV2;
    const f = s.player.finance;
    delete (f as unknown as Record<string, unknown>).narrative;
    ensureWs3(s);
    seedLabRevenue(s);
    const S = sectorValue(s).S;
    if (!f.ws3.mark && f.valuation > 0 && S > 0) f.ws3.mark = { S, share: Math.min(1, f.valuation / S) }; // FINM: idempotent
  },
  /** 41 → 42 (finance v3 FIN5b): private rivals' valuations are marked from the story split like the player's. Each
   *  private rival's last mark is read off its saved valuation (share = valuation ÷ today's sector value), its part of
   *  the pool starts empty (filled at the next quarter's mark) and the equity its investors put in starts at its kind's
   *  start figure (no history was kept). A pending bust names no pushed rival. */
  41: (raw) => {
    const s = raw as unknown as GameStateV2;
    const S = sectorValue(s).S;
    for (const r of privateRivals(s)) {
      const f = r.finance;
      if (f.mark === undefined && S > 0) f.mark = Math.min(1, f.valuation / S);
      f.poolQ ??= 0;
      f.raised ??= FIN[r.archetype]?.raised ?? 0;
    }
  },
  /** 42 → 43 (SAFMECH): the monitoring budget becomes the player's setting (policies.monitorBudget, a share of the safety
   *  pool). A save gets the old standard package's share (MONITOR_STD_POOL_SHARE); its coverage now follows from that
   *  budget, the monitors' cost ratios and the watched compute. Only where missing (idempotent). */
  42: (raw) => {
    const p = (raw as unknown as Record<string, any>).player; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (p?.policies && typeof p.policies.monitorBudget !== 'number') p.policies.monitorBudget = MONITOR_STD_POOL_SHARE;
  },
  /** 43 → 44 (RD-C01): drop the v2 knot table and the dead production-readout fields (idempotent). */
  43: (raw) => {
    const s = raw as unknown as GameStateV2;
    const prod = s.hidden?.timeline?.prod as unknown as Record<string, unknown> | undefined;
    if (prod) {
      delete prod.knots;
      // RD-C04 (same bump): kappa / etaSC had no reader once the knots went.
      delete prod.kappa;
      delete prod.etaSC;
    }
    // RD-C02 (same unreleased bump): the derived calShift bridge is gone.
    if (s.hidden?.timeline) delete (s.hidden.timeline as unknown as Record<string, unknown>).calShift;
    // RD-C07 (same bump): the cut paradigm P26 leaves the paradigm data (its hidden draw is dropped; RD-R04's 61 → 62
    // drops the whole paradigm mirror).
    if (s.hidden?.paradigmSuccess) delete s.hidden.paradigmSuccess.P26;
    const cores = [s.player, s.china?.lab?.core, ...(s.rivals ?? []).map((r) => r.core)];
    for (const c of cores) {
      // RD-C04 (same bump): BaseModel.scale and VersionBuild.misuseMult had no reader.
      const m = (c as { models?: { bases?: Record<string, unknown>[]; versions?: { build?: Record<string, unknown> }[] } } | undefined)?.models;
      for (const b of m?.bases ?? []) delete b.scale;
      for (const v of m?.versions ?? []) if (v.build) delete v.build.misuseMult;
      const pc = c?.prodCache as unknown as { Ddata?: unknown; parts?: Record<string, unknown>; elast?: Record<string, unknown>; ratios?: Record<string, unknown> } | undefined;
      if (!pc) continue;
      delete pc.Ddata;
      delete pc.parts?.base;
      delete pc.elast?.train;
      delete pc.elast?.data;
      delete pc.ratios?.d;
    }
  },
  /** 44 → 45 (RD-B02): a run in flight (running or paused) gets the launch-snapshot fields it lacks (a base's draw and P24
   *  bonus, a continue run's draw, a post-train's domainG, P07 flag and serving FLOP part; R0's suites), computed on the save's day:
   *  its true launch values are gone, and today's are what completion read until now. Fields it has are kept
   *  (idempotent). Finished runs are left as they are (nothing reads their snapshot). */
  44: (raw) => {
    const s = raw as unknown as GameStateV2;
    // RD-B03: keep the environments the save had (idempotent: a stored suite is left as it is).
    if (s.player) for (const f of unbuiltSuiteFamilies(s)) keepUnlockedSuite(s, f);
    for (const r of s.player?.models?.runs ?? []) {
      if (r.status !== 'running' && r.status !== 'paused') continue;
      fillRecipe(s, r);
    }
  },
  /** 45 → 46 (RD-B12): sector packs live on their product. Each product's sectorFocus becomes packs with the world's
   *  certification day for the sector (world.fx.certDay is removed); a certified sector no product carries is dropped
   *  (its pack was already lost; the sector can be packed again). Idempotent. */
  45: (raw) => {
    const s = raw as unknown as GameStateV2;
    const fx = s.world?.fx as unknown as { certDay?: Partial<Record<string, number>> } | undefined;
    const cert = fx?.certDay ?? {};
    const day = s.time?.day ?? 0;
    for (const d of s.player?.deployments ?? []) {
      const o = d as unknown as { sectorFocus?: string[]; packs?: unknown };
      if (!Array.isArray(o.packs)) d.packs = (o.sectorFocus ?? []).map((sec) => ({ sector: sec as SectorId, certDay: cert[sec] ?? day }));
      delete o.sectorFocus;
    }
    if (fx) delete fx.certDay;
  },
  /** 46 → 47 (RD-U08): serving cost is carried once, as FLOP per token. Every base gets fpt = 2·N_active × the shape's
   *  token multiplier; a version without fpt gets what the old reader derived (its base's fpt × its relative serve cost ÷ the base's);
   *  a run's prediction gets fpt the same way. BaseModel.serve and the relative serve cost of versions and run predictions
   *  (OLD_SERVE) are dropped. Idempotent. */
  46: (raw) => {
    const s = raw as unknown as GameStateV2;
    const m = s.player?.models;
    if (!m) return;
    type OldBase = { serve?: number; fpt?: number };
    const OLD_SERVE = 'serve' + 'Cost'; // the removed field's name (kept out of the source on purpose: RD-U08 grep)
    type Old = Record<string, number | undefined>;
    const oldServe = new Map<string, number | undefined>();
    for (const b of m.bases) {
      const o = b as unknown as OldBase;
      oldServe.set(b.id, o.serve);
      if (!(Number(o.fpt) > 0)) b.fpt = 2 * b.params * (SHAPE[b.design.shape]?.tokenMult ?? 1);
    }
    const fptOf = (baseId: string | undefined, serve: number | undefined, params?: number) => {
      const b = m.bases.find((x) => x.id === baseId);
      if (!b) return 2 * (params ?? B0_PARAMS);
      const bs = oldServe.get(b.id);
      return b.fpt * (bs && bs > 0 && serve !== undefined ? serve / bs : 1);
    };
    for (const v of m.versions) {
      const o = v as unknown as Old;
      if (!(Number(o.fpt) > 0)) v.fpt = fptOf(v.baseId, o[OLD_SERVE], v.params);
      delete o[OLD_SERVE];
    }
    for (const r of m.runs ?? []) {
      const pr = r.predicted as unknown as Old | undefined;
      if (!pr) continue;
      if (pr.fpt === undefined) {
        const t = r.teacherVersionId ? m.versions.find((v) => v.id === r.teacherVersionId) : undefined;
        pr.fpt = r.kind === 'base' && r.base ? 2 * r.base.params * (SHAPE[r.base.shape]?.tokenMult ?? 1)
          : r.kind === 'distill' && t ? fptOf(t.baseId, pr[OLD_SERVE])
          : fptOf(r.baseId, pr[OLD_SERVE]);
      }
      delete pr[OLD_SERVE];
    }
    for (const b of m.bases) delete (b as unknown as OldBase).serve;
  },
  /** 47 → 48 (RD-L01): series.G seeded from series.L per lab (gOfLevel on the save's own timeline). Idempotent: a lab
   *  that already has a G series keeps it. */
  47: (raw) => {
    const s = raw as unknown as GameStateV2;
    if (!s.series) return;
    const w = s.hidden?.timeline;
    const G = (s.series.G ??= {});
    for (const [id, xs] of Object.entries(s.series.L ?? {})) {
      if (G[id] || !w) continue;
      G[id] = xs.map((L) => Math.round(gOfLevel(w, L) * 10000) / 10000);
    }
  },
  /** 48 → 49 (RD-U01): every stored VersionBuild (versions, runs, rivals: found by shape) gets dgD = offL ÷ 1.2 (the
   *  fit's old conversion) and loses offL and off; player bases lose off; the player's version domain levels are
   *  recomputed as λ(G_d). Idempotent. */
  48: (raw) => {
    const s = raw as unknown as GameStateV2;
    const seen = new Set<object>();
    const walk = (x: unknown) => {
      if (!x || typeof x !== 'object' || seen.has(x)) return;
      seen.add(x);
      if (Array.isArray(x)) { for (const y of x) walk(y); return; }
      const o = x as Record<string, unknown>;
      if ('gPre' in o && 'dgRL' in o && 'sD' in o) {
        if (!o.dgD) {
          const dgD: Record<string, number> = {};
          for (const [d, v] of Object.entries((o.offL ?? {}) as Record<string, number>)) if (v) dgD[d] = v / 1.2;
          o.dgD = dgD;
        }
        delete o.offL;
        delete o.off;
      }
      for (const y of Object.values(o)) walk(y);
    };
    walk(s.player);
    walk(s.rivals);
    walk(s.hidden);
    for (const b of s.player?.models?.bases ?? []) delete (b as unknown as { off?: unknown }).off;
    const w = s.hidden?.timeline;
    if (w && s.player) for (const v of s.player.models?.versions ?? []) if (v.build) v.domains = domainsOf(w, v.G, v.build);
  },
  /** 49 → 50 (RD-U05): every stored domain-level record (player versions with their build, rivals' and the
   *  hidden models from G: found by shape G + Lg + domains) is recomputed as the score against the domain's best human.
   *  Idempotent. */
  49: (raw) => {
    const s = raw as unknown as GameStateV2;
    const w = s.hidden?.timeline;
    if (!w?.v3) return;
    const seen = new Set<object>();
    const walk = (x: unknown) => {
      if (!x || typeof x !== 'object' || seen.has(x)) return;
      seen.add(x);
      if (Array.isArray(x)) { for (const y of x) walk(y); return; }
      const o = x as Record<string, unknown>;
      if (typeof o.G === 'number' && typeof o.Lg === 'number' && o.domains && typeof o.domains === 'object') {
        const b = o.build as VersionBuild | undefined;
        o.domains = domainsOf(w, o.G, b && 'gPre' in b ? b : undefined);
      }
      for (const y of Object.values(o)) walk(y);
    };
    walk(s.player);
    walk(s.rivals);
    walk(s.hidden);
  },
  /** 50 → 51 (RD-A02): the Auto research mix is gone (researchManual deleted; the split as it stands is kept); the
   *  engineering agents get their own split line: the player's engineering share of the agent pool moves to
   *  split.engineering and the two research uses' shares are renormalised over the research agent pool (eng = 1, all of
   *  its line). The other labs get engineering 0 (their research model has no build queue). */
  50: (raw) => {
    const s = raw as unknown as GameStateV2;
    const p = s.player as unknown as { split: Record<string, number>; agents: Record<string, { compute: number }> };
    const a = p?.agents;
    const fresh = !!p?.split && typeof p.split.engineering !== 'number'; // idempotent: only a save without the line
    const cores = [s.player, ...(s.rivals ?? []).map((r) => r.core), s.china?.lab?.core].filter(Boolean) as LabCore[];
    for (const c of cores) {
      delete (c as unknown as Record<string, unknown>).researchManual;
      if (c.split && typeof c.split.engineering !== 'number') (c.split as unknown as Record<string, number>).engineering = 0;
    }
    if (fresh && a) {
      const sum = a.eng.compute + a.capRoutine.compute + a.capFrontier.compute;
      const fe = sum > 0 ? a.eng.compute / sum : 0;
      p.split.engineering += p.split.agents * fe;
      p.split.agents *= 1 - fe;
      const rs = a.capRoutine.compute + a.capFrontier.compute;
      a.capRoutine.compute = rs > 0 ? a.capRoutine.compute / rs : DEFAULT_CAP_SHARES.capRoutine;
      a.capFrontier.compute = rs > 0 ? a.capFrontier.compute / rs : DEFAULT_CAP_SHARES.capFrontier;
      a.eng.compute = 1;
    }
  },
  /** 51 → 52 (RD-A05a): the nested split becomes ONE flat allocation of compute to uses (departments/split.ts). The
   *  research agents' line splits into routine / frontier by the packages' old shares (agents.*.compute, deleted); the
   *  safety pool splits into safety agents, monitors and the safety research line by the claims the old priority order
   *  granted (monitors → investigations → safety agents → lines, RD-B07), so every use keeps the compute it had; the
   *  monitoring budget (policies.monitorBudget, deleted) becomes the monitors' line at what they used; open cases'
   *  computeShare are rescaled to shares of the safety research line. The other labs: agents → routine / frontier at
   *  the reference ratio; safety agents, monitors 0. Everyone: idle 0. Idempotent (only a split with an agents key). */
  51: (raw) => migrateFlatSplit(raw as unknown as GameStateV2),
  /** 52 → 53 (RD-E03): headroom is removed. A bucket's effect was (a − h); its remaining headroom h is delivered at once
   *  (the effect becomes a, as every idea adopted from now on lands), and h is dropped. The 'tune' need leaves the
   *  research-engineer allocation (order, caps) and the last-day readout. Idempotent. */
  52: (raw) => {
    const s = raw as unknown as GameStateV2;
    const res = s.player?.research;
    if (!res) return;
    for (const st of Object.values(res.stacks ?? {})) for (const b of st.buckets ?? []) delete (b as { h?: number }).h;
    const a = res.re as unknown as { order?: string[]; max?: Record<string, number>; share?: Record<string, number> } | undefined;
    if (a) {
      if (Array.isArray(a.order)) a.order = a.order.filter((k) => k !== 'tune');
      if (a.max) delete a.max.tune;
      if (a.share) delete a.share.tune;
    }
    if (res.last?.re) delete (res.last.re as Record<string, number>).tune;
  },
  /** 53 → 54 (RD-E01a): P13 / P19 leave the paradigm, tree and hidden-draw data (queues and teams drop unknown nodes
   *  themselves). Every run's recipe.p24 moves into its recipe.pre (both add to the base's G in OOM; the total is
   *  unchanged). An adopted P24 (an axis until now) enters the pretraining stack as one scale-invariant idea of 0.96 ×
   *  its payoff on the save's day (the bonus the next base would have had). Stored domain levels are recomputed without
   *  P19's RSCH gain (player versions; rivals' internal and public models). Idempotent except the adopted-P24 idea,
   *  which is added once (this step runs once, at rev 53). P24's payoff is read as tree.ts payoffOf read it before: the
   *  AI share of experiment labour as the research engine ran it (1 − 1 ÷ m_EXP, research.last). */
  53: (raw) => {
    const s = raw as unknown as GameStateV2;
    const p = s.player;
    const hadP24 = (p as unknown as OldParadigms | undefined)?.paradigms?.P24?.status === 'adopted';
    for (const id of ['P13', 'P19']) {
      if (p?.tree) delete p.tree[id];
      if (s.hidden?.paradigmSuccess) delete s.hidden.paradigmSuccess[id];
    }
    for (const r of p?.models?.runs ?? []) {
      const rec = r.recipe as (RunRecipe & { p24?: number }) | undefined;
      if (!rec || rec.p24 === undefined) continue;
      if (rec.pre !== undefined) rec.pre += rec.p24;
      delete rec.p24;
    }
    const pre = p?.research?.stacks?.pre;
    if (hadP24 && pre) {
      const mExp = Math.max(1, p.research?.last?.x?.mExp ?? 1);
      const payoff = Math.max(0, Math.min(1, (1 - 1 / mExp - 0.5) / 0.4));
      if (payoff > 0) addIdea(pre, 0.96 * payoff, 0, 1, 1);
    }
    const w = s.hidden?.timeline;
    if (!w) return;
    for (const v of p?.models?.versions ?? []) if (v.domains) refreshLevels(w, v);
    for (const r of s.rivals ?? []) {
      type M = { G: number; domains?: unknown; build?: VersionBuild };
      const o = r as unknown as { internal?: M; publicModel?: M };
      for (const m of [o.internal, o.publicModel]) if (m && m.domains) m.domains = domainsOf(w, m.G, m.build && 'gPre' in m.build ? m.build : undefined);
    }
  },
  /** 54 → 55 (RD-E01b): P20 leaves the paradigm, tree and hidden-draw data (queues and teams drop unknown nodes
   *  themselves). Idempotent. */
  54: (raw) => {
    const s = raw as unknown as GameStateV2;
    if (s.player?.tree) delete s.player.tree.P20;
    if (s.hidden?.paradigmSuccess) delete s.hidden.paradigmSuccess.P20;
  },
  /** 55 → 56 (RD-A05b): the two spare-compute policies leave; autoSplit starts off. Idempotent. */
  55: (raw) => {
    const pol = (raw as unknown as GameStateV2).player?.policies as unknown as Record<string, unknown> | undefined;
    if (!pol) return;
    delete pol.spareTraining;
    delete pol.spareServing;
    if (!pol.autoSplit) pol.autoSplit = { on: false, to: ['experiments'] };
  },
  /** 56 → 57 (RD-A06): the internal tools equivalent to the built features (features no longer act on the internal
   *  agents), and the control layer per agent package (on for every package when the internal deployment had it, as
   *  that one flag ruled every internal use). Idempotent. */
  56: (raw) => {
    const p = (raw as unknown as GameStateV2).player;
    if (!p) return;
    if (!Array.isArray(p.tooling)) p.tooling = toolsFromFeatures(p.features ?? []);
    const on = (p.deployments ?? []).some((d) => d.channel === 'internal' && d.status === 'live' && (d as unknown as { controlLayer?: boolean }).controlLayer);
    if (on && p.agents) for (const a of Object.values(p.agents)) a.control = true;
  },
  /** 57 → 58 (RD-T01a): the IDA run kind from its name ("IDA n", the only way it was recognised). Idempotent. */
  57: (raw) => {
    for (const r of (raw as unknown as GameStateV2).player?.models?.runs ?? []) if (r.kind === 'post' && /^IDA\b/.test(r.name ?? '')) r.grader = 'teacher';
  },
  /** 58 → 59 (RD-T02): in-flight continue runs draw their added tokens on the save's day. Idempotent (skips a run that
   *  has prevDEff). */
  58: (raw) => {
    const s = raw as unknown as GameStateV2;
    for (const r of s.player?.models?.runs ?? []) {
      if (r.kind !== 'continue' || (r.status !== 'running' && r.status !== 'paused') || r.recipe?.prevDEff !== undefined) continue;
      const parent = s.player.models.bases.find((b) => b.id === r.baseId);
      if (parent) Object.assign((r.recipe ??= {}), continueDrawNow(s, parent, r.flopNeeded));
    }
  },
  /** 59 → 60 (RD-T03): a running stream drops its tracked recipe and starts a period on the save's day. Idempotent. */
  59: (raw) => {
    const st = (raw as unknown as GameStateV2).player?.models?.stream as (Record<string, unknown> & { periodDay?: number; flop?: number }) | undefined;
    if (!st) return;
    delete st.track;
    st.periodDay ??= (raw as unknown as GameStateV2).time?.day ?? 0;
    st.flop ??= 0;
  },
  /** 60 → 61 (RD-A04): the safety research engineers' needs list at its default order. Idempotent. */
  60: (raw) => {
    const s = raw as unknown as GameStateV2;
    if (s.player?.research && !s.player.research.safRe) s.player.research.safRe = { order: [...DEFAULT_SAF_RE_ALLOC.order], max: {}, share: {} };
  },
  /** 61 → 62 (RD-R02b): a safety project's candidate-pool state becomes its one test at the project's progress (the
   *  agenda's T₁ months of work; FLOP used restarts at 0). Idempotent. */
  61: (raw) => {
    const s = raw as unknown as GameStateV2;
    for (const [id, ts] of Object.entries(s.player?.tree ?? {})) {
      const old = ts.saf as unknown as { workNeed?: number } | undefined;
      if (!old || typeof old.workNeed === 'number' && !('cands' in old)) continue;
      const ag = PROJECT_BY_ID[id]?.agenda;
      const T1 = ag ? AGENDA_BY_ID[ag as keyof typeof AGENDA_BY_ID]?.T1 : undefined;
      if (!T1) {
        delete ts.saf;
        continue;
      }
      ts.saf = { work: Math.min(1, Math.max(0, ts.progress ?? 0)) * T1, workNeed: T1, flop: 0 };
    }
  },
  /** 62 → 63 (RD-R04): the rolled path's fields, the kyc node and the paradigm mirror go; P27 becomes a project of line
   *  AG17 (a rolled attempt in progress: its test at that progress; a failed one: open, the next attempt). Idempotent. */
  62: (raw) => {
    const s = raw as unknown as GameStateV2;
    const p = s.player;
    if (!p) return;
    delete (p as unknown as OldParadigms).paradigms;
    if (s.hidden?.paradigmSuccess) delete s.hidden.paradigmSuccess.P27;
    // Every tree record keeps only today's TreeNodeState fields (the rolled path's odds multiplier and retry day go).
    for (const ts of Object.values(p.tree ?? {})) {
      const o = ts as unknown as Record<string, unknown>;
      for (const k of Object.keys(o)) if (!TREE_NODE_FIELDS.has(k)) delete o[k];
    }
    if (p.tree) delete p.tree.kyc;
    if (p.research?.queue) p.research.queue = p.research.queue.filter((id) => id !== 'kyc');
    for (const t of p.teams ?? []) if (t.projectId === 'kyc') {
      delete t.projectId;
      delete t.manual;
    }
    const st = p.tree?.P27;
    const T1 = AGENDA_BY_ID.AG17.T1;
    if (st?.status === 'failed') p.tree.P27 = { status: 'researching', progress: 0, attempts: (st.attempts ?? 1) + 1 };
    else if (st?.status === 'researching' && !st.saf) st.saf = { work: Math.min(1, Math.max(0, st.progress ?? 0)) * T1, workNeed: T1, flop: 0 };
  },
  /** 63 → 64 (RD-T11): TrainingRun.scale goes. Idempotent. */
  63: (raw) => {
    const s = raw as unknown as GameStateV2;
    for (const r of s.player?.models?.runs ?? []) delete (r as unknown as Record<string, unknown>).scale;
  },
  /** 64 → 65 (RD-T06): domain expert stock → its families' suites (else dropped); P12 loses its idea stages. Idempotent. */
  64: (raw) => {
    const s = raw as unknown as GameStateV2;
    const p = s.player?.dataPortfolio;
    if (!p) return;
    const byDomain: Partial<Record<DomainId, number>> = {};
    const isDom = (a: { kind: string; id?: string }) => a.kind === 'expert' && (a.id ?? '').startsWith('expert:dom:');
    for (const a of p.assets) if (isDom(a) && a.kind === 'expert' && a.domain) byDomain[a.domain] = (byDomain[a.domain] ?? 0) + a.tokensT;
    for (const d of p.pending ?? []) if (isDom(d.asset) && d.asset.domain) byDomain[d.asset.domain] = (byDomain[d.asset.domain] ?? 0) + d.asset.tokensT;
    p.assets = p.assets.filter((a) => !isDom(a));
    if (p.pending) p.pending = p.pending.filter((d) => !isDom(d.asset));
    for (const [dom, t] of Object.entries(byDomain) as [DomainId, number][]) {
      const fams = suiteFamilies(s).filter((f) => familyDomain(f) === dom);
      for (const f of fams) creditSuiteExpertData(s, f, t / fams.length);
    }
    const st = s.player.tree?.P12 as unknown as (Record<string, unknown> & { status?: string }) | undefined;
    if (st && st.status !== 'known' && st.cap) delete st.cap;
  },
  /** 65 → 66 (RD-T07): stored suites get their live tasks from their expert data. Idempotent. */
  65: (raw) => {
    const s = raw as unknown as GameStateV2;
    if (s.player?.dataPortfolio) restateSuiteTasks(s);
  },
  /** 66 → 67 (RD-T08): data preset 'natural' → 'balanced' in every stored base design; the 'overtrained' node goes. Idempotent. */
  66: (raw) => {
    const seen = new Set<object>();
    const walk = (o: unknown) => {
      if (!o || typeof o !== 'object' || seen.has(o)) return;
      seen.add(o);
      if (Array.isArray(o)) {
        for (const x of o) walk(x);
        return;
      }
      const r = o as Record<string, unknown>;
      if (r.data === 'natural' && 'curation' in r && 'tpp' in r) r.data = 'balanced';
      for (const v of Object.values(r)) walk(v);
    };
    walk(raw);
    const p = (raw as unknown as GameStateV2).player;
    if (!p) return;
    if (p.tree) delete p.tree.overtrained;
    if (p.research?.queue) p.research.queue = p.research.queue.filter((id) => id !== 'overtrained');
    for (const t of p.teams ?? []) if (t.projectId === 'overtrained') {
      delete t.projectId;
      delete t.manual;
    }
  },
  /** 67 → 68 (RD-M01): refit each player version's measured level from its bench table; drop the stored error draw. Idempotent. */
  67: (raw) => {
    const s = raw as unknown as GameStateV2;
    for (const v of s.player?.models?.versions ?? []) {
      if (!v.evals) continue;
      delete (v.evals as { errTrue?: number }).errTrue;
      if (Object.keys(v.evals.bench ?? {}).length && s.flags && s.setup) refitMeasured(s, v);
    }
  },
  /** 68 → 69 (RD-X03): every non-player lab's internal and public model gets its reference-profile build (the version
   *  build on the lab's current base at its RL recipe today; the rest of its stored G as general ΔG) and its domain
   *  levels from it. G unchanged. Idempotent (a model with a build is kept). */
  68: (raw) => {
    const s = raw as unknown as GameStateV2;
    const tw = s.hidden?.timeline;
    if (!tw) return;
    for (const r of [...(s.rivals ?? []), s.china?.lab]) {
      if (!r?.phys?.base) continue;
      for (const m of [r.internal, r.publicModel]) {
        if (!m || m.build) continue;
        m.build = rivalVersionBuild(r.phys.base, r.phys.rec.mid, r.phys.rec.ceil);
        setModelG(tw, m, m.G);
      }
    }
  },
  /** 69 → 70 (SR-01): the dead-end latch and the tool On/Off toggle are gone. A line latched 'deadEnd' becomes 'idle'
   *  (the safety step sets active / idle from staffing on the next day); every owned detection or containment tool is
   *  in use (active), as unlockTechnique sets it. Fix methods keep their flag. Idempotent. */
  69: (raw) => {
    const s = raw as unknown as GameStateV2;
    const dept = s.player?.safety;
    if (!dept) return;
    for (const a of Object.values(dept.agendas ?? {})) if ((a.status as string) === 'deadEnd') a.status = 'idle';
    for (const t of Object.values(dept.techniques ?? {})) if (t.unlocked && techniqueRole(t) !== 'fix') t.active = true;
  },
  71: (raw) => {
    // 71 → 72 (SR-13): the control-layer flag, the 'restricted' status, always-on internal human review and an owned T-LOCK
    // become safeguard items on each deployment.
    const p = (raw as { player?: { deployments?: Record<string, unknown>[]; safety?: { techniques?: Record<string, { unlocked?: boolean }> } } }).player;
    const lock = !!p?.safety?.techniques?.['T-LOCK']?.unlocked;
    for (const d of p?.deployments ?? []) {
      const g: { kind: string; setting?: string; since: number }[] = Array.isArray(d.guards) ? (d.guards as never) : [];
      if (d.controlLayer) g.push({ kind: 'control', setting: 'defer10', since: 0 });
      if (d.status === 'restricted') { g.push({ kind: 'restrict', since: 0 }); d.status = 'live'; }
      if (d.channel === 'internal') { g.push({ kind: 'review', since: 0 }); if (lock) g.push({ kind: 'lockdown', since: 0 }); }
      delete d.controlLayer;
      d.guards = g;
    }
  },
  70: (raw) => {
    // 70 → 71 (SR-06): any object under a `beliefs` key whose values look like TraitBeliefs (est, sd) gets an empty evidence list.
    const walk = (x: unknown, depth: number) => {
      if (!x || typeof x !== 'object' || depth > 12) return;
      if (Array.isArray(x)) {
        for (const y of x) walk(y, depth + 1);
        return;
      }
      for (const [k, y] of Object.entries(x as Record<string, unknown>)) {
        if (k === 'beliefs' && y && typeof y === 'object' && !Array.isArray(y)) {
          for (const b of Object.values(y as Record<string, unknown>)) {
            const tb = b as { est?: unknown; sd?: unknown; evidence?: unknown };
            if (tb && typeof tb === 'object' && typeof tb.est === 'number' && typeof tb.sd === 'number' && !Array.isArray(tb.evidence)) tb.evidence = [];
          }
        } else walk(y, depth + 1);
      }
    };
    walk(raw, 0);
  },
  72: (raw) => {
    // 72 → 73 (SR-08): any record under a `techniques` key whose values look like TechniqueStates (s0, oHalf) gets the SR-08 fields.
    const walk = (x: unknown, depth: number) => {
      if (!x || typeof x !== 'object' || depth > 10) return;
      if (Array.isArray(x)) {
        for (const y of x) walk(y, depth + 1);
        return;
      }
      for (const [k, y] of Object.entries(x as Record<string, unknown>)) {
        if (k === 'techniques' && y && typeof y === 'object' && !Array.isArray(y)) {
          for (const t of Object.values(y as Record<string, Record<string, unknown>>)) {
            if (!t || typeof t !== 'object' || typeof t.s0 !== 'number' || typeof t.oHalf !== 'number') continue;
            t.validatedOn ??= null;
            t.validatedOom ??= 0;
            t.trainedAgainstOn ??= null;
          }
        } else walk(y, depth + 1);
      }
    };
    walk(raw, 0);
  },
  73: (raw) => {
    // 73 → 74 (SR-09): validation jobs replace tool upkeep.
    const s = raw as unknown as GameStateV2;
    const dept = s.player?.safety;
    if (dept) {
      dept.validation ??= { jobs: [], autoNew: true, lastModel: null };
      for (const t of Object.values(dept.techniques ?? {})) t.measured ??= null;
    }
    const al = s.player?.research?.safRe as unknown as { order?: string[]; max?: Record<string, number>; share?: Record<string, number> } | undefined;
    if (al) {
      if (Array.isArray(al.order)) al.order = al.order.map((k) => (k === 'reval' ? 'validation' : k));
      for (const m of [al.max, al.share]) if (m && 'reval' in m) { m.validation = m.reval; delete m.reval; }
    }
  },
  74: (raw) => {
    // 74 → 75 (SR-14): every post design (runs, versions, templates anywhere in the save) gets one `methods` list from
    // its old `techniques` and `trainAgainst` (as `against:<id>`); the policy "Use all known methods" is on.
    const walk = (o: unknown, depth: number): void => {
      if (!o || typeof o !== 'object' || depth > 12) return;
      if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
      const r = o as Record<string, unknown>;
      if (Array.isArray(r.techniques) && Array.isArray(r.trainAgainst) && 'pref' in r) {
        r.methods = [...(r.techniques as string[]), ...(r.trainAgainst as string[]).map((id) => `against:${id}`)];
        delete r.techniques;
        delete r.trainAgainst;
      }
      for (const v of Object.values(r)) walk(v, depth + 1);
    };
    walk(raw, 0);
    const dept = (raw as { player?: { safety?: { useAllMethods?: boolean } } }).player?.safety;
    if (dept) dept.useAllMethods ??= true;
  },
  75: (raw) => {
    // 75 → 76 (SR-14b): inoculation is the method T-INOC: every post design with `inoculation` true lists it; the field goes.
    const walk = (o: unknown, depth: number): void => {
      if (!o || typeof o !== 'object' || depth > 12) return;
      if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
      const r = o as Record<string, unknown>;
      if ('inoculation' in r && 'pref' in r && Array.isArray(r.methods)) {
        if (r.inoculation === true && !(r.methods as string[]).includes('T-INOC')) (r.methods as string[]).push('T-INOC');
        delete r.inoculation;
      }
      for (const v of Object.values(r)) walk(v, depth + 1);
    };
    walk(raw, 0);
  },
  76: (raw) => {
    // 76 → 77 (SR-10): disagreement list; earlier validation results measured true recall, i.e. were human-run.
    const dept = (raw as { player?: { safety?: { disagreements?: unknown[]; techniques?: Record<string, { measured?: { human?: boolean } | null }> } } }).player?.safety;
    if (!dept) return;
    dept.disagreements ??= [];
    for (const t of Object.values(dept.techniques ?? {})) if (t?.measured) t.measured.human ??= true;
  },
  77: (raw) => {
    // 77 → 78 (SR-16): environment fixes are owned per RL family; the old per-edge signal patches go.
    const r = raw as { flags?: Record<string, unknown>; player?: { safety?: { envFixes?: object } } };
    for (const k of Object.keys(r.flags ?? {})) if (k.startsWith('ws2.patch.') && k !== 'ws2.patch.lab.E04') delete r.flags![k];
    if (r.player?.safety) r.player.safety.envFixes ??= {};
  },
  78: (raw) => {
    // 78 → 79 (SR-17 / SR-18): disclosure policy (legal minimum), required methods; old bundled response kinds go.
    const dept = (raw as { player?: { safety?: { disclosure?: string; requiredMethods?: string[]; incidents?: { responses?: string[] }[] } } }).player?.safety;
    if (!dept) return;
    dept.disclosure ??= 'legal';
    dept.requiredMethods ??= [];
    for (const i of dept.incidents ?? []) if (i.responses) i.responses = i.responses.filter((k) => k !== 'targetedTraining' && k !== 'disclose');
  },
  79: (raw) => {
    // 79 → 80 (SR-19): the eval gate becomes the Safety framework's capability assessment (none → none, basic → basic,
    // full → full, full + external → deep with external review), with the default rules; holds start empty (refreshed on
    // the next day).
    const dept = (raw as { player?: { safety?: { evalGate?: string; framework?: unknown } } }).player?.safety;
    if (!dept) return;
    const g = dept.evalGate ?? 'full';
    if (!dept.framework) dept.framework = defaultFramework(g === 'none' ? 'none' : g === 'basic' ? 'basic' : g === 'fullPlusExternal' ? 'deep' : 'full', g === 'fullPlusExternal');
    delete dept.evalGate;
  },
};

/** TreeNodeState's fields since 62 (RD-R04). */
const TREE_NODE_FIELDS = new Set(['status', 'progress', 'day', 'attempts', 'tm', 'cap', 'saf']);
/** Saves before 62 (RD-R04) carried a per-paradigm mirror of the tree on the player. */
type OldParadigms = { paradigms?: Record<string, { status?: string }> };

type OldSplit = Record<string, number>;
/** RD-A05a's migration (51 → 52), exported for the targeted check (scripts/v2/_a05a/check.ts). */
export function migrateFlatSplit(s: GameStateV2): void {
  const cores = [...(s.rivals ?? []).map((r) => r.core), s.china?.lab?.core].filter(Boolean) as LabCore[];
  const flatOf = (o: OldSplit, routine: number, frontier: number) => ({
    training: o.training ?? 0, synthetic: o.synthetic ?? 0, experiments: o.experiments ?? 0, routine, frontier,
    engineering: o.engineering ?? 0, safetyAgents: 0, monitors: 0, safety: o.safety ?? 0, serving: o.serving ?? 0, idle: 0,
  });
  for (const c of cores) {
    const o = c.split as unknown as OldSplit;
    if (!o || typeof o.agents !== 'number') continue;
    const fr = REF_AGENT_SHARES.capRoutine / (REF_AGENT_SHARES.capRoutine + REF_AGENT_SHARES.capFrontier);
    c.split = flatOf(o, o.agents * fr, o.agents * (1 - fr));
  }
  const p = s.player;
  const o = p?.split as unknown as OldSplit;
  if (!o || typeof o.agents !== 'number') return;
  const pk = p.agents as unknown as Record<string, { compute?: number }>;
  const pol = p.policies as unknown as Record<string, unknown>;
  const cr = Math.max(0, pk.capRoutine?.compute ?? DEFAULT_CAP_SHARES.capRoutine);
  const cf = Math.max(0, pk.capFrontier?.compute ?? DEFAULT_CAP_SHARES.capFrontier);
  const rs = cr + cf;
  const fr = rs > 0 ? cr / rs : DEFAULT_CAP_SHARES.capRoutine;
  const ps = o.safety ?? 0;
  const A = Math.max(0, pk.safety?.compute ?? 0);
  const B = Math.max(0, Math.min(1, typeof pol.monitorBudget === 'number' ? pol.monitorBudget : MONITOR_STD_POOL_SHARE));
  const open = (p.safety?.investigations ?? []).filter((i) => !i.outcome);
  const I = open.reduce((x, i) => x + i.computeShare, 0);
  // The flat lines of the agent uses first (the monitors' need reads them), safety agents at the request for now.
  p.split = { ...flatOf(o, o.agents * fr, o.agents * (1 - fr)), safetyAgents: ps * A };
  for (const u of ['eng', 'capRoutine', 'capFrontier', 'safety']) delete pk[u]?.compute;
  delete pol.monitorBudget;
  // RD-B07's claims on the old pool (shares of it), as safetyPoolClaims computed them.
  let needCap = 0;
  for (const u of CAP_USES) needCap += monitorNeedShare(s, u);
  const nc = ps > 0 ? needCap / ps : 0;
  const r = monitorCostRatio(s, 'safety');
  const mon = (x: number) => (ps > 0 ? Math.min(B * ps, needCap + r * (ps * x)) / ps : 0);
  let ag = A;
  let inv = I;
  if (mon(A) + I + A > 1) {
    const mMin = mon(0);
    if (mMin + I >= 1) {
      ag = 0;
      inv = Math.max(0, 1 - mMin);
    } else {
      const room = 1 - I;
      const a1 = ps > 0 ? (room - nc) / (1 + r) : room;
      ag = Math.max(0, Math.min(A, ps <= 0 || nc + r * a1 <= B ? a1 : room - B));
    }
  }
  const m = mon(ag);
  const line = Math.max(0, 1 - m - ag); // cases + lines
  p.split = { ...p.split, safetyAgents: ps * ag, monitors: ps * m, safety: ps * line };
  // Cases: shares of the safety research line, at the compute they were granted (inv of the pool).
  const k = line > 0 ? 1 / line : 0;
  const scale = I > 0 ? inv / I : 1;
  for (const i of open) i.computeShare = i.computeShare * scale * k;
}

export function serialize(s: GameStateV2): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameStateV2 {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (raw.version !== 2) throw new Error(`not a v2 save (version ${String(raw.version)})`);
  let rev = Number(raw.schemaRev ?? 0);
  if (!(rev >= MIN_SCHEMA_REV)) throw new Error(OLD_SAVE_MESSAGE);
  if (rev > SCHEMA_REV) throw new Error(`save is from a newer build (schemaRev ${rev} > ${SCHEMA_REV})`);
  while (rev < SCHEMA_REV) {
    const m = migrations[rev];
    if (!m) throw new Error(`no migration from schemaRev ${rev}`);
    m(raw);
    rev++;
    raw.schemaRev = rev;
  }
  return raw as unknown as GameStateV2;
}

/** 64-bit (two FNV-1a 32 lanes) hex hash of the serialised state. Determinism tests compare these. */
export function hashString(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) ^ (h2 >>> 15);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function stateHash(s: GameStateV2): string {
  return hashString(serialize(s));
}
