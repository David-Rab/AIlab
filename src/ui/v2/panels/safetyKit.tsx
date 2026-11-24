// UB-C: shared pieces of the SAFETY sub-tabs (Model, Instruments, Safeguards, Incidents & cases): the L2 side drawer and
// the belief range cell (best guess + 90% range, or Unknown per VOCAB's rule). Display only.
import { useEffect, type ReactNode } from 'react';
import { isUnknown } from '../../../engine/v2';
import * as F from '../fmt';
import { X } from 'lucide-react';

/** An L2 side drawer (Esc or the scrim closes it). */
export function SfDrawer({ open, onClose, title, sub, home, test, children }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; home?: string; test?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.tip')) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sfd-scrim" onClick={onClose} />
      <aside className="sfd" data-test={test ?? 'sf-drawer'} {...(home ? { 'data-home': home } : {})}>
        <div className="sfd-hd"><h2>{title}</h2>{sub && <span className="sfd-sub">{sub}</span>}<span className="sp" /><button className="btn btn-sm" data-test="sf-drawer-close" onClick={onClose}><X size={14} /></button></div>
        {children}
      </aside>
    </>
  );
}

/** "14% 8–21%" or "Unknown 0–46%" (range wider than 30 points). */
export function RangeVal({ est, lo, hi }: { est: number; lo: number; hi: number }) {
  return isUnknown(lo, hi)
    ? <span className="sf-rv"><span className="sf-unk" data-test="unknown">Unknown</span> <span className="lo">{F.pct(lo).replace("%", "")}–{F.pct(hi)}</span></span>
    : <span className="sf-rv"><b>{F.pct(est)}</b> <span className="lo">{F.pct(lo).replace("%", "")}–{F.pct(hi)}</span></span>;
}
