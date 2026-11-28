// Model naming (design/MODEL-NAMING.md): start names, names through a RefBot game, theme change.
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { rungOfLevel, setNaming, tierOfRatio, versionLabel } from '../../src/engine/v2/models/naming';
import { runRef } from './lib';
import type { GameStateV2 } from '../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
};
const names = (s: GameStateV2) => s.player.models.versions.map((v) => v.name);
const unique = (xs: string[]) => new Set(xs).size === xs.length;

// Pure parts.
check(rungOfLevel(5) === 1 && rungOfLevel(6.5) === 2 && rungOfLevel(11) === 4 && rungOfLevel(15) === 7 && rungOfLevel(99) === 7 && rungOfLevel(undefined) === 1, 'rung edges');
check(tierOfRatio(1 / 2.8) === 1 && tierOfRatio(1 / 5.7) === 2 && tierOfRatio(1 / 80) === 3 && tierOfRatio(0.6) === 0 && tierOfRatio(1 / 6) === 2, 'tier bands');

// Start: Agent-n and generic tiers by default.
const s = newGame(defaultSetupV2());
console.log('start:', s.player.models.bases.map((b) => b.name).join(', '), '|', names(s).join(', '));
check(s.player.models.bases[0].name === 'Agent-1-1', 'start base is Agent-1-1', s.player.models.bases[0].name);
check(names(s)[0] === 'Agent-1-1.0', 'start model is Agent-1-1.0', names(s)[0]);
check(names(s).slice(1).join(',') === 'Agent-1-1.0-mini,Agent-1-1.0-micro,Agent-1-1.0-nano', 'start students mini/micro/nano', names(s).slice(1).join(','));

// Theme change re-renders everything.
check(setNaming(s, 'warships', 'speed') === undefined, 'setNaming accepts a theme');
check(names(s)[0] === 'Cutter-1.0' && names(s)[3] === 'Cutter-1.0-blink', 'warships + speed', names(s).join(', '));
check(setNaming(s, 'nope', undefined) !== undefined, 'unknown theme refused');
setNaming(s, 'agent', 'generic');

// Spinout: the imported family keeps its own name.
const sp = newGame(defaultSetupV2({ start: 'spinout' } as never));
const imp = sp.player.models.versions.find((v) => v.variant === 'imported');
console.log('spinout:', sp.player.models.bases.map((b) => b.name).join(', '), '|', names(sp).join(', '));
check(!imp || imp.name.startsWith('Import-1.'), 'imported family', imp?.name ?? 'no import');

// Through a RefBot game: unique names, post-trains count from .1 on the start base, bases follow the grammar.
runRef(s, 600);
const vs = s.player.models.versions;
console.log('day 600 bases:', s.player.models.bases.map((b) => b.name).join(', '));
console.log('day 600 versions:', names(s).join(', '));
check(unique(names(s)), 'version names unique');
const off = vs.filter((v) => v.name !== versionLabel(s, v)).map((v) => `${v.name} vs ${versionLabel(s, v)} ${JSON.stringify(v.nm)}`);
check(!off.length, 'stored names match the render', off.join('; '));
check(s.player.models.bases.every((b) => /^Agent-\d-\d+C*$/.test(b.name)), 'base names follow the grammar');
const onB0 = vs.filter((v) => v.baseId === 'B0' && v.variant === 'full').map((v) => v.nm?.minor);
check(onB0.every((m, i) => m === i), 'B0 full versions number .0, .1, … with no skips', onB0.join(','));

// Save round trip.
const back = deserialize(serialize(s));
check(names(back).join() === names(s).join(), 'save round trip keeps names');

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
