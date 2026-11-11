// Runtime: owns the game state, real-time loop (1 tick = 1 day), speeds, autosave, subscriptions.
import { useSyncExternalStore } from 'react';
import { newGame } from '../engine/init';
import { resolveEvent } from '../engine/events';
import { tick } from '../engine/sim';
import type { GameState, Setup } from '../engine/types';

export type Screen = 'start' | 'setup' | 'game';
/** ms per in-game day for speeds 1..5 (0 = paused) */
export const SPEED_MS = [Infinity, 900, 400, 160, 60, 20];
const SAVE_KEY = 'ai27.save.v1';
const PREFS_KEY = 'ai27.prefs.v1';

export interface Prefs {
  pauseOnMilestone: boolean;
  pauseOnIncident: boolean;
}

class Store {
  state: GameState | null = null;
  screen: Screen = 'start';
  speed = 0;
  lastSpeed = 2;
  version = 0;
  panel: string = 'overview';
  prefs: Prefs = { pauseOnMilestone: true, pauseOnIncident: true };
  private listeners = new Set<() => void>();
  private acc = 0;
  private lastT = 0;
  private raf = 0;
  private dirty = false;

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
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;

  notify() {
    this.version++;
    for (const l of this.listeners) l();
  }

  go(screen: Screen) {
    this.screen = screen;
    if (screen !== 'game') this.setSpeed(0);
    this.notify();
  }

  start(setup: Setup) {
    this.state = newGame(setup);
    this.screen = 'game';
    this.panel = 'overview';
    this.speed = 0;
    this.save();
    this.loop();
    this.notify();
  }

  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    this.state = JSON.parse(raw);
    this.screen = 'game';
    this.speed = 0;
    this.loop();
    this.notify();
  }

  save() {
    if (this.state) localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
  }

  exportSave() {
    return this.state ? JSON.stringify(this.state) : '';
  }

  setSpeed(n: number) {
    if (n > 0) this.lastSpeed = n;
    this.speed = n;
    this.acc = 0;
    this.notify();
  }

  togglePause() {
    this.setSpeed(this.speed === 0 ? this.lastSpeed : 0);
  }

  setPrefs(p: Partial<Prefs>) {
    this.prefs = { ...this.prefs, ...p };
    localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    this.notify();
  }

  setPanel(id: string) {
    this.panel = id;
    this.notify();
  }

  /** Apply a player action to the state and re-render. */
  act(fn: (s: GameState) => void) {
    if (!this.state) return;
    fn(this.state);
    this.notify();
  }

  choose(choiceIdx: number) {
    if (!this.state) return;
    resolveEvent(this.state, choiceIdx);
    this.notify();
  }

  private loop() {
    cancelAnimationFrame(this.raf);
    this.lastT = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(250, t - this.lastT);
      this.lastT = t;
      const s = this.state;
      if (s && this.screen === 'game' && this.speed > 0 && !s.ending && s.events.length === 0) {
        this.acc += dt;
        const ms = SPEED_MS[this.speed];
        let n = 0;
        while (this.acc >= ms && n < 40) {
          this.acc -= ms;
          const logLen = s.log.length;
          const ms0 = s.model.milestone;
          tick(s);
          n++;
          this.dirty = true;
          if (s.events.length || s.ending) break;
          const fresh = s.log.slice(logLen);
          if (this.prefs.pauseOnMilestone && s.model.milestone > ms0) {
            this.speed = 0;
            break;
          }
          if (this.prefs.pauseOnIncident && fresh.some((e) => (e.kind === 'alert' || e.kind === 'incident') && (e.severity ?? 0) >= 4)) {
            this.speed = 0;
            break;
          }
        }
        if (s.day % 30 === 0 && n > 0) this.save();
      }
      if (this.dirty) {
        this.dirty = false;
        this.notify();
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
}

export const store = new Store();

/** Re-render on any store change. Returns the store for convenience. */
export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

export function useGame(): GameState {
  useStore();
  return store.state as GameState;
}
