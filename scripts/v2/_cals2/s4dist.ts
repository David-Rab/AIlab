// CAL-S2 probe: S4's per-world P_mis / Mis from the simulation cache (run after safety.ts), with each world's q draws.
import { cached } from '../simcache';
import { fileURLToPath } from 'node:url';
import { methodScaleOf } from '../../../src/engine/v2/world/hidden';
import { REF, play, type Outcome } from '../safety-emu';
const SAFETY = fileURLToPath(new URL('../safety.ts', import.meta.url));
const EMU = fileURLToPath(new URL('../safety-emu.ts', import.meta.url));
const rows = Array.from({ length: 40 }, (_, i) => { const seed = 500 + i; const o: Outcome = cached('safety-play', { bot: REF.id, variant: '', seed, stopAt: 'asi', alignment: 'medium' }, [SAFETY, EMU], () => play(REF, seed, 'asi')); return { seed, o, q: methodScaleOf(seed) }; });
rows.sort((a, b) => b.o.pmis - a.o.pmis);
for (const r of rows) console.log(r.seed, `Mis ${r.o.mis.toFixed(3)} P ${r.o.pmis.toFixed(3)}`, Object.entries(r.q).map(([k, v]) => `${k.replace('T-', '')} ${v.toFixed(2)}`).join(' '));
const n = (f: (x: typeof rows[number]) => boolean) => rows.filter(f).length;
console.log(`P>0.5: ${n((r) => r.o.pmis > 0.5)}; P<0.1: ${n((r) => r.o.pmis < 0.1)}; mean Mis ${(rows.reduce((a, r) => a + r.o.mis, 0) / 40).toFixed(3)}`);
const corr = (a: number[], b: number[]) => { const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length; let sab = 0, saa = 0, sbb = 0; a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); saa += (x - ma) ** 2; sbb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(saa * sbb); };
console.log('corr(Mis, q):', Object.keys(rows[0].q).map((k) => `${k.replace('T-', '')} ${corr(rows.map((r) => r.o.mis), rows.map((r) => r.q[k])).toFixed(2)}`).join(' '));
