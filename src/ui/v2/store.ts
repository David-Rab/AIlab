// v2 runtime (WS6): owns the game state, the real-time loop (1 tick = 1 day), speeds, fast-forward with targets and
// auto-stop rules (V2-SPEC §1.4), autosave, save slots, export/import, and UI-only selection state.
import { useSyncExternalStore } from 'react';
import {
  act as engineAct, activeRivals, AUTOSAVE_KEY, dateOf, engine, leadDays, measuredL, defaultSetupV2, deserialize, newGame, quarterIndex, resolve as engineResolve,
  serialize, SLOT_KEYS, spotPrice, successorPullView, tick, evalQueueView, evalMeasureView, evalDepthView, actionView,
} from '../../engine/v2';
import type { GameStateV2, LogEntry, SetupV2 } from '../../engine/v2';

export type Screen = 'start' | 'setup' | 'game';
export interface QSnap { q: number; L: number; U: number; cash: number; lead: number }
/** ms per in-game day for speeds 0..5 (§1.4). */
export const SPEED_MS = [Infinity, 1000, 450, 180, 70, 12];
/** Fast-forward batches up to this many ticks per animation frame. */
const FF_BATCH = 8;
const PREFS_KEY = 'ai27.v2.prefs';

export type FfKind = 'event' | 'runDone' | 'quarter' | 'day' | 'milestone';
export interface FfTarget { kind: FfKind; day?: number }
export interface Prefs { pauseOnMilestone: boolean; pauseOnIncident: boolean; pauseOnDecision: boolean }
export interface Flash { text: string; tone: 'neg' | 'pos' | 'neutral'; at: number }

/** Snapshot of the counters the stop rules watch (§1.4). */
interface Sig {
  pending: number; incidents3: number; runsDone: number; runway: number; findings: number; otherMs: number;
  statutes: number; thefts: number; playerMs: number; q: number;
}
const RUNWAY_RANK: Record<string, number> = { healthy: 0, tight: 1, distress: 2, insolvent: 3 };
/** Anchors that live on a tab other than the panel's first (links name the anchor, the store opens its tab). */
const ANCHOR_TAB: Record<string, string> = {
  'finance#raise': 'cash', 'finance#parent': 'cash', 'finance#ledger': 'contracts', 'finance#board': 'owners', 'finance#partner': 'deals', 'finance#borrow': 'deals',
};

function sig(s: GameStateV2): Sig {
  const p = s.player;
  let otherMs = 0;
  for (const r of s.rivals) otherMs += Object.keys(r.core.milestoneDays).length;
  otherMs += Object.keys(s.china.lab.core.milestoneDays).length;
  return {
    pending: s.events.pending.length,
    incidents3: p.safety.incidents.filter((i) => i.severity >= 3).length,
    runsDone: p.models.runs.filter((r) => r.status === 'done').length,
    runway: p.board.preset === 'parent' ? 0 : RUNWAY_RANK[p.finance.state] ?? 0, // a division never stops on runway (jank F2)
    findings: p.safety.findings.filter((f) => f.type === 'DISC' || f.type === 'NEG' || f.revealedFalseDay !== undefined).length,
    otherMs,
    statutes: Object.values(s.gov.statutes).filter(Boolean).length,
    thefts: p.security.detectedThefts.length,
    playerMs: Object.keys(p.milestoneDays).length,
    q: quarterIndex(s.time.startDate, s.time.day),
  };
}

/** Why fast-forward / auto-pause stopped (shown as a flash). */
function stopReason(a: Sig, b: Sig, s: GameStateV2, ff: FfTarget | undefined): string | undefined {
  if (b.pending > a.pending) return 'New decision';
  if (b.incidents3 > a.incidents3) return 'Incident ≥ 3';
  if (b.runsDone > a.runsDone) return 'Run complete';
  if (b.runway > a.runway && b.runway >= 1) return 'Runway tight';
  if (b.findings > a.findings) return 'Key finding';
  if (b.otherMs > a.otherMs) return 'Rival milestone';
  if (b.statutes > a.statutes) return 'New law';
  if (b.thefts > a.thefts) return 'Theft';
  if (b.playerMs > a.playerMs) return 'Milestone';
  if (ff?.kind === 'quarter' && b.q > a.q) return 'New quarter';
  if (ff?.kind === 'day' && ff.day !== undefined && s.time.day >= ff.day) return 'Date reached';
  return undefined;
}

class StoreV2 {
  state: GameStateV2 | null = null;
  /** Read-only selector probes for the UI test (E12: the successor pull shown equals its selector). */
  readonly probe = { successorPullView: () => (this.state ? successorPullView(this.state) : undefined) };
  screen: Screen = 'start';
  speed = 0;
  lastSpeed = 2;
  ff: FfTarget | undefined;
  version = 0;
  panel = 'overview';
  /** Active tab per panel (UI only). */
  tab: Record<string, string> = {};
  /** Help overlay open. */
  help = false;
  /** Coach card index dismissed per act (UI only; persisted in tutorial.seen as coach:<id>). */
  prefs: Prefs = { pauseOnMilestone: true, pauseOnIncident: true, pauseOnDecision: true };
  flash: Flash | undefined;
  /** Decision instance shown in the modal (crisis decisions open it automatically). */
  modal: string | undefined;
  /** Severity 4–5 log entries waiting for acknowledgement (§6.5). */
  notices: LogEntry[] = [];
  /** UI selections shared across panels. */
  sel: { versionId?: string; codex?: string } = {};
  draftSetup: SetupV2 = defaultSetupV2();
  private listeners = new Set<() => void>();
  private acc = 0;
  private lastT = 0;
  private raf = 0;
  private lastSave = 0;

  constructor() {
    try {
      const p = localStorage.getItem(PREFS_KEY);
      if (p) this.prefs = { ...this.prefs, ...JSON.parse(p) };
    } catch {
      /* ignore */
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getVersion = () => this.version;
  notify() {
    this.version++;
    for (const l of this.listeners) l();
  }

  go(screen: Screen) {
    this.screen = screen;
    if (screen !== 'game') this.setSpeed(0);
    if (screen === 'setup') this.draftSetup = defaultSetupV2({ ...this.draftSetup, seed: Math.floor(Math.random() * 1e9) });
    this.notify();
  }

  start(setup: SetupV2) {
    this.state = newGame(setup);
    this.enter();
  }

  private enter() {
    this.screen = 'game';
    this.panel = 'overview';
    this.tab = {};
    this.speed = 0;
    this.ff = undefined;
    this.modal = undefined;
    this.notices = [];
    this.sel = {};
    this.hist = {};
    this.recap = undefined;
    this.qSnap = this.state ? this.snap(this.state) : undefined;
    this.autosave(true);
    this.loop();
    this.notify();
  }

  // ───── saves ─────
  hasSave(key: string = AUTOSAVE_KEY) {
    try {
      return !!localStorage.getItem(key);
    } catch {
      return false;
    }
  }
  saveInfo(key: string): string | undefined {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      const m = /"companyName":"([^"]*)"/.exec(raw);
      const d = /"time":\{"day":(\d+)/.exec(raw);
      return `${m?.[1] ?? '?'} · day ${d?.[1] ?? '?'}`;
    } catch {
      return undefined;
    }
  }
  save(key: string = AUTOSAVE_KEY) {
    if (!this.state) return;
    try {
      localStorage.setItem(key, serialize(this.state));
      if (key !== AUTOSAVE_KEY) this.say(`Saved to slot ${SLOT_KEYS.indexOf(key as (typeof SLOT_KEYS)[number]) + 1}`, 'pos');
    } catch (e) {
      this.say(`Save failed: ${e instanceof Error ? e.message : e}`, 'neg');
    }
  }
  private autosave(force = false) {
    const now = performance.now();
    if (!force && now - this.lastSave < 3000) return;
    this.lastSave = now;
    this.save(AUTOSAVE_KEY);
  }
  load(key: string = AUTOSAVE_KEY) {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    this.importJson(raw);
  }
  importJson(json: string): string | undefined {
    try {
      this.state = deserialize(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.say(`Load failed: ${msg}`, 'neg');
      return msg;
    }
    this.enter();
    return undefined;
  }
  exportJson() {
    return this.state ? serialize(this.state) : '';
  }
  download(name: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ───── time ─────
  setSpeed(n: number) {
    if (n > 0 && n < 5) this.lastSpeed = n;
    if (n !== 5) this.ff = undefined;
    this.speed = n;
    this.acc = 0;
    if (this.state) this.state.time.speed = n as GameStateV2['time']['speed'];
    if (n === 0 && this.state) this.autosave();
    this.notify();
  }
  togglePause() {
    this.setSpeed(this.speed === 0 ? this.lastSpeed : 0);
  }
  fastForward(t: FfTarget) {
    this.ff = t;
    if (this.state) {
      const f: NonNullable<GameStateV2['time']['ffUntil']> = { kind: t.kind === 'event' ? 'event' : t.kind };
      if (t.day !== undefined) f.day = t.day;
      this.state.time.ffUntil = f;
    }
    this.speed = 5;
    this.acc = 0;
    this.notify();
  }
  private stop(reason: string) {
    this.speed = 0;
    this.ff = undefined;
    if (this.state) {
      this.state.time.speed = 0;
      delete this.state.time.ffUntil;
    }
    this.say(reason, 'neutral');
    this.autosave();
  }

  setPrefs(p: Partial<Prefs>) {
    this.prefs = { ...this.prefs, ...p };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* ignore */
    }
    this.notify();
  }
  setPanel(id: string) {
    this.panel = id === 'map' ? 'overview' : id === 'departments' ? 'company' : id;
    if (id === 'departments') this.tab.company = 'people';
    const s = this.state;
    if (s && !s.tutorial.seen.includes(`panel:${this.panel}`)) s.tutorial.seen.push(`panel:${this.panel}`);
    this.notify();
  }
  setTab(panel: string, tab: string) {
    this.tab = { ...this.tab, [panel]: tab };
    this.notify();
  }
  /** Click = go (IA §4): open the panel (and tab), scroll to #ctl-<anchor> and pulse it once. */
  goto(panel: string, opts: { tab?: string; anchor?: string } = {}) {
    const tab = opts.tab ?? (opts.anchor ? ANCHOR_TAB[`${panel}#${opts.anchor}`] : undefined);
    if (tab) this.tab = { ...this.tab, [panel]: tab };
    this.setPanel(panel);
    if (opts.anchor) {
      const id = 'ctl-' + opts.anchor;
      setTimeout(() => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.remove('pulse-once');
        void el.offsetWidth;
        el.classList.add('pulse-once');
      }, 60);
    }
  }
  setHelp(open: boolean) {
    this.help = open;
    this.notify();
  }
  select(sel: Partial<StoreV2['sel']>) {
    this.sel = { ...this.sel, ...sel };
    this.notify();
  }
  say(text: string, tone: Flash['tone'] = 'neutral') {
    this.flash = { text, tone, at: performance.now() };
    this.notify();
  }

  // ───── player input ─────
  /** Run an engine action; returns the error string (also flashed) or undefined. On success, flashes the last log line
   *  the action wrote (e.g. "Signed a chip LTA … first tranche Q1 2026"), so an action is never silent. */
  act(id: string, params: Record<string, number | string | boolean> = {}): string | undefined {
    if (!this.state) return 'No game';
    const log = this.state.log;
    const lastBefore = log[log.length - 1];
    const err = engineAct(this.state, id, params);
    if (err) {
      this.say(err, 'neg');
      return err;
    }
    const written = log.slice(log.lastIndexOf(lastBefore) + 1);
    if (written.length) this.say(written[written.length - 1].text, 'pos');
    else this.notify();
    return undefined;
  }
  resolve(instance: string, choice: number): string | undefined {
    if (!this.state) return 'No game';
    const err = engineResolve(this.state, instance, choice);
    if (err) this.say(err, 'neg');
    if (!err && this.modal === instance) this.modal = undefined;
    // Jank E2: the "New decision" stop message goes once the decision is made.
    if (!err && (this.flash?.text === 'New decision' || this.flash?.text === 'Crisis') && !(this.state.events.pending.length)) this.flash = undefined;
    this.notify();
    return err;
  }
  openDecision(instance: string | undefined) {
    this.modal = instance;
    this.notify();
  }
  ackNotice() {
    this.notices.shift();
    this.notify();
  }
  /** Advance n days now (used by the FF menu's "+1 d" and tests); obeys no stop rules. */
  step(n = 1) {
    const s = this.state;
    if (!s) return;
    for (let i = 0; i < n && !s.ending; i++) this.tickOnce();
    this.notify();
  }

  /** Quarter recap (tutorial on): snapshot at the start of each quarter, shown when the next one begins. */
  recap: { label: string; from: QSnap; to: QSnap } | undefined;
  private qSnap: QSnap | undefined;
  closeRecap() {
    this.recap = undefined;
    this.notify();
  }
  private snap(s: GameStateV2): QSnap {
    const leads = [...activeRivals(s).map((r) => leadDays(s, r.core.id).est), leadDays(s, 'china').est];
    return { q: quarterIndex(s.time.startDate, s.time.day), L: measuredL(s), U: engine.understanding(s).U, cash: s.player.finance.cash, lead: Math.min(...leads) };
  }

  /** UI-only weekly samples of visible market numbers (sparks); not saved. */
  hist: Record<string, number[]> = {};
  private sample(s: GameStateV2) {
    const push = (k: string, v: number) => {
      const a = (this.hist[k] ??= []);
      a.push(v);
      if (a.length > 160) a.shift();
    };
    push('list', s.market.listPrice);
    push('spot', spotPrice(s.market));
    push('rental', s.market.rental);
    push('supply', s.market.supplyQ);
  }

  private tickOnce(): string | undefined {
    const s = this.state!;
    const a = sig(s);
    const last = s.log[s.log.length - 1];
    tick(s);
    if (s.time.day % 7 === 0) this.sample(s);
    const b = sig(s);
    const start = last ? s.log.lastIndexOf(last) + 1 : 0;
    const fresh = s.log.slice(start);
    for (const e of fresh) if ((e.severity ?? 0) >= 4) this.notices.push(e);
    if (this.notices.length > 6) this.notices.splice(0, this.notices.length - 6);
    // Crisis decisions open the modal at once.
    if (b.pending > a.pending) {
      const crisis = s.events.pending.find((p) => p.crisis && p.day === s.time.day);
      if (crisis && !this.modal) this.modal = crisis.instance;
    }
    if (s.ending) return 'Game over';
    if (s.setup.tutorial && b.q > a.q && !s.events.pending.some((p) => p.crisis)) {
      const now = this.snap(s);
      if (this.qSnap && this.qSnap.q === a.q) {
        const d = dateOf(s, s.time.day - 1);
        this.recap = { label: `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`, from: this.qSnap, to: now };
      }
      this.qSnap = now;
      if (this.recap) return 'Quarter recap';
    }
    if (this.speed === 5) return stopReason(a, b, s, this.ff);
    // Speeds 1–4: auto-pause per preference (§1.4).
    if (this.modal) return 'Crisis';
    if (this.prefs.pauseOnDecision && b.pending > a.pending) return 'New decision';
    if (this.prefs.pauseOnMilestone && b.playerMs > a.playerMs) return 'Milestone';
    if (this.prefs.pauseOnIncident && (b.incidents3 > a.incidents3 || fresh.some((e) => (e.severity ?? 0) >= 3 && e.kind !== 'milestone'))) return 'Alert';
    if (this.notices.length && fresh.some((e) => (e.severity ?? 0) >= 4)) return 'Alert';
    return undefined;
  }

  private loop() {
    cancelAnimationFrame(this.raf);
    this.lastT = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(250, t - this.lastT);
      this.lastT = t;
      const s = this.state;
      let n = 0;
      if (s && this.screen === 'game' && this.speed > 0 && !s.ending) {
        this.acc += dt;
        const ms = SPEED_MS[this.speed];
        const cap = this.speed === 5 ? FF_BATCH : 4;
        while (this.acc >= ms && n < cap) {
          this.acc -= ms;
          const why = this.tickOnce();
          n++;
          if (why) {
            this.stop(why);
            break;
          }
        }
        if (n >= cap) this.acc = Math.min(this.acc, ms);
        if (n > 0 && s.time.day % 30 === 0) this.autosave();
        if (s.ending) this.autosave(true);
      }
      if (n > 0) this.notify();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
}

export const store = new StoreV2();
(window as unknown as { ai27v2: StoreV2 }).ai27v2 = store;

export function useV2() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}
/** The live game state (only call under the game screen). */
export function useGame(): GameStateV2 {
  useV2();
  return store.state as GameStateV2;
}
export const today = (s: GameStateV2) => dateOf(s);
// D8: read-only selectors for scripts/v2/uitest.mjs (the rendered values are checked against them).
(window as unknown as { ai27v2Views: object }).ai27v2Views = { evalQueueView, evalMeasureView, evalDepthView, actionView };
