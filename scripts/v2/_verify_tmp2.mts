import * as c from '../../balance/params/capability';
const all = Object.values(c).flat() as any[];
for (const p of all) if (/V3_CAL/.test(p.id)) console.log(p.id, p.kind, JSON.stringify(p.fit?.targets ?? null));
