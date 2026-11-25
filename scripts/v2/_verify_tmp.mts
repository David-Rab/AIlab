import { TARGETS } from '../../balance/targets';
const by: Record<string, number> = {}; for (const t of TARGETS) by[t.type] = (by[t.type] ?? 0) + 1;
console.log(TARGETS.length, JSON.stringify(by));
const g = (p: string) => TARGETS.filter((t) => t.id.startsWith(p)).length;
console.log('T1', g('T1.'), 'T1L', g('T1L.'), 'GOLD', g('GOLD.'), 'noLabels', TARGETS.filter((t) => t.checkLabels.length === 0).length, 'info', TARGETS.filter((t) => t.role === 'info').length);
