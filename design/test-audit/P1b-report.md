# P1b report: scratch dirs removed

- Removed from git: 129 tracked files under `scripts/v2/_*/` (94 dirs), 2,871,846 bytes (about 2.9 MB; 8 PNGs are 2.28 MB). History keeps them.
- Kept (to re-point by the balance session, named as `fit.script`): `scripts/v2/_mk6/` (balance/params/market.ts:82), `scripts/v2/_w1b/` (balance/params/worldfx.ts:61).
- Strings re-pointed to `path @ sha` (comments/strings only):
  - src/data/v2/sectors.ts:127 `_cal2x/hire.ts @ fe28d849`; balance/params/market.ts:167 same.
  - src/engine/v2/models/capability.ts:51 `_cals/medexp.ts @ 54c393bb`
  - src/engine/v2/worldfx/economy.ts:7 `_w1b/before.txt vs after.txt @ fe28d849`
  - src/engine/v2/worldfx/mix.ts:80 `_mk5/check.ts @ af8ee983`; :82 `_mk5b/check.ts @ 826d6bb4`
  - src/engine/v2/worldfx/productView.ts:445 `_mk12/check.ts @ cd352aaa`
  - scripts/v2/oversight.ts:181 `_sr13/check.ts @ d212135c`
  - src/data/v2/serving.ts:155 cites `_mk6/check.ts`, which is kept, so unchanged.
- .gitignore: `scripts/v2/_*` plus `!scripts/v2/_mk6/` and `!scripts/v2/_w1b/`. Checked: `scripts/v2/_zz/x.ts` is ignored, and the two kept dirs are not ignored and are still tracked.
- tsc main: clean. tsc scripts: the same 8 errors as before the change (npcShocks, research, safetyresearch x3, tastecurve, worldChina x2, worldUiReadouts), so nothing new.
