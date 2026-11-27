# N1 result (stopped at the decomposition check)

Status: STOPPED, nothing generated. The task said to stop and ask if progress(t) - progress(2025.445) != dS + dlogC.

Series in the rollouts: all present (`progress`, `effective_compute`, `software_efficiency`, `training_compute` log10 FLOP cumulative stock,
`training_system_performance` log10 FLOP/yr, `total_ai_company_H100e` etc.), 1831 points, 2017-2200.

Source relation (progress_model/metrics_computation.py steps 8-9, _impl.py ~1830):
- `progress` = `effective_compute` up to a constant (logE, the integrated state variable, log10 of the cumulative integral of 10^(TSP+SE)).
- `training_compute` = log10 of the cumulative integral of 10^TSP. `software_efficiency` = r_software*log10(RS/RS0), rebased at 2025.13.
- So logE - logTC = log10 of a TSP-weighted mean of 10^SE, NOT SE(t). The source comments say the same ("a fraction of an OOM apart").

Measured (all 869 runs, error = dprogress - dS - dlogC since 2025.445, OOM):
| timeline | at AC: median / p90 / max | at ASI: median / max | quarterly grid max |
|---|---|---|---|
| fast | 0.22 / 0.54 / 1.00 | 0.53 / 2.99 | large (>40 in a degenerate run) |
| central | 0.20 / 0.49 / 1.12 | 0.53 / 2.73 | 41.9 |
| slow | 0.21 / 0.49 / 1.35 | 0.35 / 2.81 | 16.5 |
Also the rollout `software_efficiency` is not monotone (min step -0.9 / -5.4 / -8.1 OOM per 0.1 yr), so it cannot serve as S_ref for clockOfS.

Exact alternative (not built): S_ref := progress - training_compute (the "effective recipe": logE - logTC). Then dprogress = dS_ref + dlogC holds
exactly by construction; monotone-ness of S_ref (min step of progress - training_compute) still to check.
Scripts (outside the repo): aifm-runs/scripts/n1_check.py, n1_sum.py.
