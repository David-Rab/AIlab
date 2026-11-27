# Verification: products.md (models as products)

Checked against master at ea624ae. General note: several cited line numbers have drifted. data/v2/serving.ts has 264 lines, so its citations 250/277-280/299/325-350 are wrong (real: AGENT_WORK :98-103, SAFEGUARD_DG/CONTROL_LAYER_DG :131-132, CUSTOMER_TAU :151, FREE_TIER :188, LINEUP :202). models/deployments.ts has 225 lines (the agents gate call is at :63, not :252-255). The substance was checked at the real locations.

PRD-01 · CONFIRMED · high (but see note) · `productLineup` (worldfx/serving.ts:449-464) adds `lineupOf` rungs (serving.ts:398-410, LINEUP ratios 1/2.83, 1/5.66, 1/80 at data/v2/serving.ts:202) under every non-consumer player product (mix.ts:483-496) and every rival/China model (mix.ts:512-523). No run, no evals, no upkeep. Incidents read only `d.versionId`. UI footer at Products.tsx:420. Note: this is the deliberate, sourced TIERS design that merged in M11 (pricing-page rungs), and the UI is honest about it. So the fix is a design call for the user, in line with the "owned things" tycoon direction, not a bug fix.

PRD-02 · CONFIRMED · medium · `chatFreeTier` (serving.ts:500-513) falls back to `freeTierOf` (one-year gap, serving.ts:493-496). It feeds the user logit (mix.ts:776-779, revenue.ts:470-477) and free-user serving (revenue.ts:493). Rivals get the same rule (mix.ts:764). Severity lowered: it is the same phantom-student mechanism as PRD-01 (a near-duplicate), and the code says so openly.

PRD-03 · PARTLY · medium · The four paths and the MINI_CHANNELS limit are real (features.ts:53; serving.ts:375-379; TierKind at mix.ts:136; mini gap on SWE fit at productView.ts:77). But `cheapestAt` is not fully dead: scripts/v2/serving.ts:49 imports it and calls it at :596-599 (a check script). It has no engine caller. Mostly duplicates PRD-01/02.

PRD-04 · CONFIRMED · medium · `productUses` blends the mini at 0.6 when one is set (serving.ts:366-372), and so does `productDomains` (models/products.ts:47-56). Chat's `cFit`/`cCover` (mix.ts:772-776) come from that blend and feed `paidShareTarget` (mix.ts:821). The display `c.v`, from capVec(productDomains), feeds cLevel/cSocial (mix.ts:785-786). The default phantom student is not blended. Detail: bestCover is a max over providers (mix.ts:804), and the reach target is set in sectors.ts:348 (not mix.ts:803). The blend lowers reach only when the player has the best coverage. control.ts:104 is only the no-mix fallback, but the mix path (socials = blended cSocial) has the same effect.

PRD-05 · CONFIRMED · medium · `makeVariant` is a JSON deep copy with only the variant label changed (deployments.ts:156-170). Its preview shows staffTime +10, revenue +0.5 and approval −1 p0.2. `apply` only copies (models/actions.ts:217-229). `'internal'` is never constructed (only read, at charter.ts:91). Extra point: the open-variant preview (leadDays −60, security −1, trust +3) is also not applied by the copy. The real open release happens at launch.

PRD-06 · CONFIRMED · high · `depOffset` (mix.ts:171-176) enters the player's `cd.v` (mix.ts:417-419) and `vecs` (mix.ts:564). Through the share-weighted `dom` it reaches α (`alphaOf(def, le.AGENCY)`, sectors.ts:56-58 and :247), the Bass q (sectors.ts:232), PHYS F, control (control.ts:150-158 and :205-206) and bestPublic (mix.ts:375-383, actions.ts:155 and :226). Detail: `bestPublicLg` (hype, macro.ts:170) reads `version.Lg` without depOffset, so the settings do not move it. It is still a display-level path.

PRD-07 · CONFIRMED · medium · The three gates exist. `agentsGate` is defined at products.ts:141-146 and called in deployGate (deployments.ts:63, not :252-255). The display sigmoid is at revenue.ts:311-313 and `pSuccess` at revenue.ts:317-323. The fix is sound.

PRD-08 · CONFIRMED · high · Sector side: `en` multiplies adopted hours, agent hours and seats through `fOf` (revenue.ts:366-372 and :403-443). Adopted hours have no room cap (only agent hours get `pScale`). Chat side: `cApp` × (1+en) in the logit (mix.ts:779), then `u` × en again (revenue.ts:481). The double count is real.

PRD-09 · CONFIRMED · high · The hours split is fixed by `CH_WEIGHT`/`AGENT_WORK.channel`/`SEAT_WEIGHT`, normalised by `wsum`/`agSum`/`seatSum` (revenue.ts:50, :310-353, :403-449). Only the tier weights inside each product come from the choice. Enterprise focus ×3 is zero-sum among the player's own products (revenue.ts:333).

PRD-10 · CONFIRMED · medium · Every touchpoint is as described: features.ts:142-144 (0 TW, $0, share 0), worldfx/actions.ts:15/58-92, build.ts:258-266, serving.ts:477-482, revenue.ts:333, sectors.ts:86-88 (US friction −0.1 for everyone), and sectors.ts:312. 120 days is defined twice (actions.ts:15 `PRODUCT.days`, build.ts:72 `SECTOR_CERT_DAYS`). Lowered to medium: it is messy but works, with no wrong numbers beyond PRD-12.

PRD-11 · PARTLY · medium · The core is right. `certDay` is world-level, the fit bonus needs the host's `sectorFocus`, new deployments start with `sectorFocus: []`, and `defaultSector` skips certified sectors (actions.ts:32), so the pack cannot be rebuilt. Two details are wrong. (a) The US friction cut (sectors.ts:87-88) survives the host's retirement, so not all of the pack is lost. (b) The "+ pack" button (Products.tsx:600) passes no sector, so the player is not shown "Every sector already has a product" unless every sector is taken. The button just picks another sector.

PRD-12 · CONFIRMED · medium · `productGain` uses exp(1.05), 0.06, ×35 and ×2.8 (actions.ts:43-50). The preview lists 15 product-team staff time and a labour-bloc approval exposure (actions.ts:69-77) that `apply` never books (actions.ts:81-91). Nit: `s.world.shares` is not legacy. It is rewritten every tick from the mix's US shares (sectors.ts:326-333), but it is still a different model from how the pack acts.

PRD-13 · CONFIRMED · medium · `act()` runs only `apply` (core/loop.ts:93-107). Nothing consumes preview `exposure`. The cited staffTime, leadDays, approval and trust lines are at productOps.ts:207-224, :267, :276, :293-295, :316, :360, :406 and :418. Also unapplied: `autoEvaluate=false` "monitorability −0.05" (productOps.ts:419). The open-launch leadDays −60 is backed by a mechanism (open G absorbed outright, deployments.ts:216-218).

PRD-14 · CONFIRMED · medium · `editedProduct` keeps effort and the deepThink feature in sync (productOps.ts:70-78). The feature's fx is only `{kind:'effort'}` (features.ts:118-120). The UI lock combines three reasons (Products.tsx:232). See PRD-V01 for a bypass.

PRD-15 · CONFIRMED · medium · `internalFx` reads the lab-wide `s.player.features` (serving.ts:206-213). It is used for SWE/EXP/IDEAS labour (workfit.ts:290), the IDEAS SD (:328) and safety SAF_EXP/SAF_IDEAS (:387). Memory's `work: 'all'` therefore reaches safety. `featureInUse` counts these features as always in use (build.ts:88-95).

PRD-16 · CONFIRMED · low · The flat hazard multipliers (features.ts:117, 124, 138, 141) are applied through `productHazardMult` (products.ts:60-64; incidents.ts:341; dangerView.ts:96).

PRD-17 · CONFIRMED · low · data/v2/serving.ts:131-132 (not :277-280), and serving.ts:477. The UI prints "classifiers −0.05 L · hardened −0.2 L" (Products.tsx:217).

PRD-18 · CONFIRMED · medium · The leak formula has no usage term (deployments.ts:208-224). KYC is a flat 2% on API/Agents (revenue.ts:368-369).

PRD-19 · PARTLY · medium · The premium is applied only in revenue (revenue.ts:411-418), and the mix prices Trusted at its normal markup (serving.ts:478-482 via mix.ts:486). But "the ×3 is not shown" is wrong. The product's binding-cause tooltip lists "Demand modifiers: Trusted channel price ×3.00" (Products.tsx:522; core/limitsView.ts:120). It is mislabelled as a demand factor, which is a separate defect (PRD-V02).

PRD-20 · CONFIRMED · medium · `blendTiers` keeps the main model's a/k/lam (serving.ts:467-479). `agentDemandOf` then uses `o.k`/`o.lam` with the blended `priceAg` (serving.ts:338-343; revenue.ts:383-389 and :425-427).

PRD-21 · CONFIRMED · low · Under Auto, `servingShare` = servedH100e ÷ pool (revenue.ts:631-634). The served figure includes the pro-rata spare (revenue.ts:249-252, `h: g + spare`). It is read by misuse reach (incidents.ts:118) and dangerView.ts:123. On the auditor's open question: the `spareServing` policy changes only the recovery speed, so spare always counts.

PRD-22 · CONFIRMED · low · A built launch calls `deploy` with no features, mini or sectorFocus (build.ts:250-256). A second live product per channel is refused (productOps.ts:231), yet revenue (revenue.ts:456-476) and the mix (mix.ts:483-504 and :766-789) handle several per channel.

PRD-23 · CONFIRMED · low · `leader`/`LEADER_FEATURES` (features.ts:13, :100-101, :147-148; init.ts:257; save.ts:271). The `serveCost` fallback is at workfit.ts:131-142, and runs.ts:372 sizes the student's serveCost. The stale comments are at types.ts:546 and :566. Stickiness is per segment (CUSTOMER_TAU at data/v2/serving.ts:151, not :299).

PRD-24 · PARTLY · low · The constants are real (mix.ts:46-47, 179-187, 233-242; revenue.ts:371, :482). But "not shown as numbers" is wrong for Restricted ×0.3, which the Demand modifiers row shows (Products.tsx:522, limitsView.ts:121). The appeal constants are also contradicted by a second appeal table (PRD-V03).

PRD-25 · CONFIRMED · medium · An accurate synthesis. It duplicates PRD-01/05/06/09/10/15 and adds no new defect.

## Missed issues

### PRD-V01 Launch with effort "deep" skips building Deep think
- What: `product.launch` checks only `effortLock` (the tree option) for the effort param (productOps.ts:237-238). `deploy` then sets `effort: 'deep'` with `features: []` (build.ts:250-256; deployments.ts:91-94). The edit path requires the deepThink feature to be built (featureToggleBlock via editedProduct, productOps.ts:72-73 and :113-116). Deep effort is applied from `d.effort` (effortTokens), so the +0.24 OOM applies without the feature.
- Evidence: models/productOps.ts:237-246; models/productOps.ts:70-78 and :113-116.
- Severity: low · Effort: S (it goes away with PRD-14's fix)

### PRD-V02 The "Demand modifiers" row mislabels a price ×3 as demand and omits the enabler factor
- What: `demandModifiers` lists the Trusted premium as a demand ×3.00, but it multiplies price, not demand. The row leaves out the enabler multiplier (1 + share), which sits in the same `fOf` demand factor as KYC and Restricted (revenue.ts:366-372). The player sees ×3 demand on Trusted and no line for feature enablers.
- Evidence: core/limitsView.ts:116-124; ui/v2/panels/Products.tsx:522; worldfx/revenue.ts:366-372.
- Severity: low · Effort: S

### PRD-V03 Two appeal tables: the Models card shows one, the market uses another
- What: Each version stores `appeal` from POST_PREF (minimal 0.7, engagement 1.2, constitution 1.0, persuasion 1.1; data/v2/runDesign.ts:172-176). The Models card shows it (Models.tsx:143), and the glossary says it "Scales consumer market share" (glossary.ts:330). Nothing in the market reads `v.appeal`. The consumer logit uses `appealOf(v.design.pref)`, a separate table (minimal 0.9, engagement 1.25, persuasion 1.15; mix.ts:179-187, used at mix.ts:779). So the number shown is not the number used. For example, the card shows 0.7 for minimal while the market applies 0.9.
- Evidence: data/v2/runDesign.ts:172-176; models/design.ts:77; worldfx/mix.ts:179-187, 779; ui/v2/panels/Models.tsx:143; data/v2/glossary.ts:330.
- Severity: medium · Effort: S (have `appealOf` read `v.appeal`, then delete the switch)

### PRD-V04 A sector pack finished with no live host silently loses its cash and certification
- What: When the sectorPack build item completes and neither the recorded host nor any enterprise/API/agents product is live, the handler just returns. The $0.4B is already booked, nothing is certified, and nothing is logged.
- Evidence: departments/build.ts:258-262; worldfx/actions.ts:87-89.
- Severity: low · Effort: S
