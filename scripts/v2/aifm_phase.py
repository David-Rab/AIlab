#!/usr/bin/env python3
"""By-phase AIFM series (R3.2): the AI Futures Model's speed-up, 80% horizon and effective compute read at AC + tau for every
rollout of a SAR-split group (fast / central / slow), tau in PHASES (years). The group is the one balance/scenarios.ts uses
(aifm-runs/out/_scratch/fixc/recs.json 'groups', the SAR-percentile split). Rollouts are read ONE LINE AT A TIME (they are large).

  <aifm-runs>/venv/Scripts/python.exe -I scripts/v2/aifm_phase.py [--out .scratch/aifm-phase.json]

Output: {group: {tau: {speedup|h80|ec: {n, q: [p10,p25,p50,p75,p90]}}}}. Quantities as balance/scenarios.ts:
speedup = ai_sw_progress_mult_ref_present_day (log-linear in time), h80 = horizon_lengths minutes (log-linear), ec = effective_compute
OOM (linear). A rollout that does not reach AC + tau inside its time axis is left out of that cell (n counts the rest).
"""
import json, re, sys
from pathlib import Path
import numpy as np

R = Path('C:/Users/david/Documents/projects/aifm-runs/out')
JOBS = {"eli_1": "20261125_200520", "eli_2": "20261125_203610", "eli_3": "20261125_211211"}
PHASES = [-1.0, 0.0, 0.5, 1.0, 2.0]
KEYS = {'speedup': ('ai_sw_progress_mult_ref_present_day', True), 'h80': ('horizon_lengths', True), 'ec': ('effective_compute', False)}

def interp(t, y, x, log):
    ok = np.isfinite(y) & (y > 0 if log else True)
    if ok.sum() < 2 or x < t[ok][0] or x > t[ok][-1]:
        return None
    return float(np.exp(np.interp(x, t[ok], np.log(y[ok])))) if log else float(np.interp(x, t[ok], y[ok]))

def main():
    out_path = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else '.scratch/aifm-phase.json'
    recs = json.load(open(R / '_scratch' / 'fixc' / 'recs.json'))
    member = {}
    for r in recs:
        for g in r['groups']:
            member[(r['job'], r['id'])] = (g, r['AC_date'])
    vals = {g: {str(p): {k: [] for k in KEYS} for p in PHASES} for g in ('fast', 'central', 'slow')}
    n = 0
    for job, ts in JOBS.items():
        with (R / job / ts / 'rollouts.jsonl').open('rb') as f:
            for line in f:
                m = re.match(rb'\{"sample_id":\s*(\d+)', line[:60])
                if not m or (job, int(m.group(1))) not in member:
                    continue
                g, ac = member[(job, int(m.group(1)))]
                res = json.loads(line)['results']
                t = np.array(res['times'], float)
                ser = {k: np.array(res[key], float) for k, (key, _) in KEYS.items()}
                for p in PHASES:
                    for k, (_, log) in KEYS.items():
                        v = interp(t, ser[k], ac + p, log)
                        if v is not None:
                            vals[g][str(p)][k].append(v)
                n += 1
    out = {}
    for g, byp in vals.items():
        out[g] = {}
        for p, byk in byp.items():
            out[g][p] = {k: {'n': len(v), 'q': [float(x) for x in np.percentile(v, [10, 25, 50, 75, 90])] if v else None} for k, v in byk.items()}
    json.dump(out, open(out_path, 'w'), indent=1)
    print(n, 'rollouts', {g: len([1 for x in member.values() if x[0] == g]) for g in vals})

if __name__ == '__main__':
    main()
