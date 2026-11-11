// Nested tooltips (CK3 / Victoria 3 style).
// - Hover a trigger: tooltip appears after a short delay.
// - Keep hovering: after LOCK_MS the tooltip "locks" (thin bar fills) and you can move the mouse into it.
// - Inside a locked tooltip, hover further <Tip>/<Term> triggers to open child tooltips (unlimited depth).
// - Leaving a locked tooltip (and its children) closes it. Unlocked tooltips close as soon as you leave the trigger.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useStore } from './store';

const OPEN_MS = 250;
const LOCK_MS = 700;
const CLOSE_GRACE_MS = 120;

interface TipEntry {
  id: number;
  depth: number;
  rect: DOMRect;
  content: () => ReactNode;
  locked: boolean;
  triggerHover: boolean;
}

interface TipApi {
  open: (depth: number, rect: DOMRect, content: () => ReactNode) => number;
  lock: (id: number) => void;
  triggerLeft: (id: number) => void;
  setHover: (id: number, inside: boolean) => void;
}

const TipCtx = createContext<TipApi | null>(null);
const DepthCtx = createContext(0);

let nextId = 1;

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<TipEntry[]>([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const hoverInside = useRef(new Set<number>());
  const closeTimer = useRef<number | null>(null);

  // Remove every tooltip from the topmost down to (but not including) the deepest one that should stay.
  const prune = useCallback(() => {
    setStack((s) => {
      let keep = s.length;
      for (let i = s.length - 1; i >= 0; i--) {
        const t = s[i];
        const childKept = i + 1 < keep;
        const alive = hoverInside.current.has(t.id) || childKept || t.triggerHover;
        if (!alive) keep = i;
        else break;
      }
      // anything above a removed entry also goes
      return keep === s.length ? s : s.slice(0, keep);
    });
  }, []);

  const schedulePrune = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(prune, CLOSE_GRACE_MS);
  }, [prune]);

  const api: TipApi = {
    open: (depth, rect, content) => {
      const id = nextId++;
      setStack((s) => [...s.slice(0, depth), { id, depth, rect, content, locked: false, triggerHover: true }]);
      return id;
    },
    lock: (id) => setStack((s) => s.map((t) => (t.id === id ? { ...t, locked: true } : t))),
    triggerLeft: (id) => {
      setStack((s) => {
        const t = s.find((x) => x.id === id);
        if (!t) return s;
        if (!t.locked) return s.filter((x) => x.depth < t.depth);
        return s.map((x) => (x.id === id ? { ...x, triggerHover: false } : x));
      });
      schedulePrune();
    },
    setHover: (id, inside) => {
      if (inside) hoverInside.current.add(id);
      else hoverInside.current.delete(id);
      if (!inside) schedulePrune();
    },
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStack([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <TipCtx.Provider value={api}>
      {children}
      {createPortal(
        stack.map((t) => <TipBox key={t.id} entry={t} api={api} />),
        document.body,
      )}
    </TipCtx.Provider>
  );
}

function TipBox({ entry, api }: { entry: TipEntry; api: TipApi }) {
  useStore(); // re-render with live game state
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { rect } = entry;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
    if (top + h > vh - 8) top = Math.max(8, rect.top - h - 6);
    setPos({ left, top });
  }, [entry]);

  return (
    <div
      ref={ref}
      className={`tip ${entry.locked ? 'tip-locked' : ''}`}
      style={{ left: pos.left, top: pos.top, zIndex: 1000 + entry.depth }}
      onMouseEnter={() => api.setHover(entry.id, true)}
      onMouseLeave={() => api.setHover(entry.id, false)}
    >
      <DepthCtx.Provider value={entry.depth + 1}>{entry.content()}</DepthCtx.Provider>
      <div className="tip-lockbar" />
    </div>
  );
}

/** Wrap any element; hovering shows `content` (a render function so it reflects live state). */
export function Tip({
  content,
  children,
  className,
  as: As = 'span',
}: {
  content: () => ReactNode;
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div';
}) {
  const api = useContext(TipCtx);
  const depth = useContext(DepthCtx);
  const ref = useRef<HTMLElement>(null);
  const openTimer = useRef<number | null>(null);
  const lockTimer = useRef<number | null>(null);
  const tipId = useRef<number | null>(null);

  const clear = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (lockTimer.current) window.clearTimeout(lockTimer.current);
  };
  useEffect(() => clear, []);

  if (!api) return <As className={className}>{children}</As>;

  return (
    <As
      ref={ref as never}
      className={className}
      onMouseEnter={() => {
        clear();
        openTimer.current = window.setTimeout(() => {
          if (!ref.current) return;
          tipId.current = api.open(depth, ref.current.getBoundingClientRect(), content);
          lockTimer.current = window.setTimeout(() => {
            if (tipId.current) api.lock(tipId.current);
          }, LOCK_MS);
        }, depth === 0 ? OPEN_MS : OPEN_MS / 2);
      }}
      onMouseLeave={() => {
        clear();
        if (tipId.current) api.triggerLeft(tipId.current);
        tipId.current = null;
      }}
    >
      {children}
    </As>
  );
}

/** Standard tooltip layout: title row, optional value, body, optional breakdown rows. */
export function TipCard({
  title,
  value,
  children,
  rows,
  footer,
}: {
  title: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
  rows?: { label: ReactNode; value: ReactNode; tone?: 'pos' | 'neg' | 'neutral' }[];
  footer?: ReactNode;
}) {
  return (
    <div className="tipcard">
      <div className="tipcard-head">
        <span className="tipcard-title">{title}</span>
        {value !== undefined && <span className="tipcard-value">{value}</span>}
      </div>
      {children && <div className="tipcard-body">{children}</div>}
      {rows && rows.length > 0 && (
        <div className="tipcard-rows">
          {rows.map((r, i) => (
            <div key={i} className="tipcard-row">
              <span>{r.label}</span>
              <span className={r.tone ? `tone-${r.tone}` : ''}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
      {footer && <div className="tipcard-foot">{footer}</div>}
    </div>
  );
}
