// Browse mode after the ending: a slim banner over the normal game shell (read-only, time frozen) with the way back
// to the end screen. No Esc shortcut: panels already use Esc to close tooltips and drawers.
import { dateOf, fmtDate } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { ICON } from '../icons';
import { store } from '../store';

export function EndBanner({ s }: { s: GameStateV2 }) {
  const e = s.ending!;
  return (
    <div className="end-banner" data-test="end-banner">
      <ICON.locked size={13} />
      <span className="end-banner-kicker">Game over</span>
      <b>{e.title}</b>
      <span className="dim">{fmtDate(dateOf(s, e.day))} · read-only, time frozen</span>
      <button className="btn btn-sm btn-primary end-banner-back" data-test="back-to-ending" onClick={() => store.setEndView('ending')}>
        <ICON.back size={13} /> Back to ending
      </button>
    </div>
  );
}
