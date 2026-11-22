# Audit: models as products (variants, distillation, lineup, products, features, sector packs, serving, market capability)

Scope read: src/engine/v2/models/{deployments,productOps,products,labs}.ts; worldfx/{serving,mix,choice,revenue,sectors,actions,productView}.ts; departments/build.ts (packs, upkeep); data/v2/{features,serving,sectors}.ts; ui/v2/panels/{Products,Models}.tsx; glossary entries. Paths are relative to src/. "[D]" means the code marks the number as a design value.

---

### PRD-01 Lineup students are phantom products sold under every model
- Test(s): 1, 4, 6
- What: Every sector product (API, Enterprise, Agents, Gov, Trusted) and every rival or China model also sells three distilled "students" at 1/2.8, 1/5.7 and 1/80 of its active parameters. Nobody trains them. They have no run, no eval, no traits, no incidents, no build cost and no upkeep. Their fit comes from the distillation formula, and their price and serving cost are the main model's multiplied by the size ratio. They are the biggest phantom in the area: they take a large share of the hours on easy work.
- Evidence: engine/v2/worldfx/serving.ts:390-455 (`lineupOf`, `rungOffer`, `productLineup`: "lineup students of the main model"); data/v2/serving.ts:338-350 (`LINEUP.ratios`); worldfx/mix.ts:488-496 (player tiers pushed into the choice), mix.ts:512-526 (rivals' students); worldfx/productView.ts:74 (row named "`<model> student`"); incidents/hazards read only `d.versionId` (models/products.ts:126-130, safety/incidents.ts:116-118). The 1B floor (serving.ts:403) is the only limit.
- Player sees: a "Lineup" block on the sector product card (ui/v2/panels/Products.tsx:199, 403-420). Its tooltip footer says "Sold under every main model by the same rule: no distil run needed." The glossary `lineup` entry (data/v2/glossary.ts:560) says the same. The UI is honest that they are free. The player never made them.
- Fix: Remove the phantom rungs for the player. A product's tiers should be the models the player actually distilled (real `mini` versions), assigned to the product as tiers. Rivals can keep a modelled lineup (they are simulated actors), but make it a field of their lab state (`publicLineup: SimpleModel[]`) produced by their own distill step, not a free rule applied at read time. If cheap tiers must exist at day 0, start the player with real distilled versions in `models.versions`.
- Severity: high · Effort: L

### PRD-02 Chat's "student free tier" is a phantom model
- Test(s): 1, 4, 6
- What: If Chat has no mini, its free users (about 94% of users) run on a student that does not exist. It is sized to sit one year of frontier progress below the main model (`FREE_TIER.years = 1`), and its fit and FLOP per token are computed on the fly. Users choose an app on this phantom's fit. Rivals get the same rule. It is a second rule for phantom students, separate from the lineup rungs (sized to a capability gap, not to fixed ratios).
- Evidence: engine/v2/worldfx/serving.ts:489-513 (`freeTierOf`, `chatFreeTier`: "else the free tier of its model"); data/v2/serving.ts:325-336 (`FREE_TIER`); worldfx/revenue.ts:469-475 and 492-493 (free-user serving need and the user-share logit use it); worldfx/mix.ts:764 (rivals), mix.ts:776 (player).
- Player sees: in the mini picker the default option reads "student free tier" (Products.tsx:168). The tooltip (Products.tsx:166) explains it.
- Fix: Merge with PRD-01. Chat's free tier is a slot that holds a real mini version. With no mini, free users run on the main model at its real cost. That is a real choice: distil a mini or pay to serve free users on the frontier model.
- Severity: high · Effort: M

### PRD-03 Four ways to make a "smaller model": real distill, lineup rungs, free-tier student, and dead `cheapestAt`
- Test(s): 4, 5
- What: There are four parallel ways to get a student:
  - The real "Distill a mini" run: `distillGap` with tokens, a real version with traits, needs evals.
  - The lineup rungs: `DISTILL.a + b·log10(1/r)` at fixed ratios.
  - The free-tier student: `studentParamsFor` at a one-year gap.
  - `cheapestAt`: "what the lab could sell at G". It is now dead code.

  The real mini is also restricted to Chat and API (`MINI_CHANNELS`), while phantom students sell on every channel. "mini", "student", "cheap tier" and "free tier" name overlapping things.
- Evidence: models/runs.ts:363-373 (real distill); worldfx/serving.ts:97-117 (`cheapestAt`, `studentParamsFor`), :398-410 (`lineupOf`), :493-496 (`freeTierOf`). `cheapestAt` has no caller outside its own file (grep). data/v2/features.ts:53-54 (`MINI_CHANNELS = ['consumer','api']`); worldfx/serving.ts:375-379 (`productMiniUses` only on MINI_CHANNELS); mix.ts:136 (`TierKind = 'model' | 'mini' | 'student'`); productView.ts:77 (the mini row's gap is measured on SWE fit, while the students' gap is the domain-wide δ).
- Player sees: the "Distill a mini" button (ui/v2/panels/Models.tsx:183), a mini picker on Chat and API only, and "student" rows on every lineup. Glossary `cheapTier` (glossary.ts:559) defines a cheap tier as "the students … and an API mini of your own".
- Fix: Keep one path, the real distill run. Delete `cheapestAt`, `freeTierOf` and the rungs for the player. Let any product hold an ordered list of tiers, each one a real version. Use one name ("mini" or "small model").
- Severity: high · Effort: M

### PRD-04 FREE_TIER_SHARE 0.6 still blends a set mini into Chat's "quality", which contradicts the free-tier rule
- Test(s): 2, 5, 6
- What: Two incompatible Chat models are live at once:
  - The newer rule: paying users run the main model, free users run the mini or the phantom student (revenue.ts:466-470).
  - The older rule: `FREE_TIER_SHARE.consumer = 0.6` is still read by `productUses` and `productDomains`. When a mini is set, Chat's fit, coverage and display domains become 0.4 × main + 0.6 × mini.

  Those blended values then feed several places:
  - The player's consumer `cFit`/`cCover` (mix.ts:774). These set the paid-share target (mix.ts:823) and the region's `bestCover`, which sets the reach target (mix.ts:803).
  - The display levels `cLevel`/`cSocial` (mix.ts:786-787).
  - `control.ts:104` (best product SOCIAL).

  Result: setting a mini lowers subscriber conversion, even though subscribers never use it. Leaving the default phantom student set does not lower it.
- Evidence: data/v2/features.ts:55-59; worldfx/serving.ts:364-373; models/products.ts:37-57; worldfx/mix.ts:417-419, 774, 803, 823; worldfx/control.ts:104; production/data.ts:445.
- Player sees: the tooltip claims "A mini of your own replaces it and weighs 60% in Chat's quality" (Products.tsx:166; glossary.ts:548 `freeTier`). It does not say this cuts the paid share.
- Fix: Remove `FREE_TIER_SHARE`, `freeTierShare` and the blend in `productUses` and `productDomains`. Paid metrics should read the main model and free-user metrics the free-tier model. Each should have one home.
- Severity: medium · Effort: S

### PRD-05 Gov, Trusted and Open "variants" are free, instant, identical copies; "internal" is never created
- Test(s): 1, 2, 5, 6
- What: `makeVariant` deep-copies a version (same G, domains, traits and fpt) and renames it. Gov and Trusted copies differ from the original only by the label that `CHANNEL_VARIANTS` checks, so a variant is a permission token that looks like a model. The glossary says gov means "relaxed refusals", but nothing reads that. The `makeVariant` preview invents effects: a positive "staffTime +10" (wrong sign, and never charged), "revenue +0.5", and "approval −1 p0.2". Apply charges nothing. The `'internal'` variant is in the type and in the internal channel's accepted list but is never constructed.
- Evidence: models/deployments.ts:12-16 (`CHANNEL_VARIANTS`), :156-170 (`makeVariant`: `JSON.parse(JSON.stringify(v))`); models/actions.ts:217-229 (preview vs apply); types.ts:424; grep finds no `variant: 'internal'` anywhere. data/v2/glossary.ts:257.
- Player sees: the Gov, Trusted and Open weights buttons on the model card (Models.tsx:179-182), and the variant chip (Models.tsx:93). The preview shows a revenue gain that never happens.
- Fix: Drop gov and trusted as variants. Make them product settings: refusal policy and usage policy already exist on the deployment (`usagePolicy`, `safeguards`). Any full version can then go on any channel. If a gov model should differ, make it a real post-train run with a cost and a trait effect. Keep "open" as a release act on a version, not a copy. Delete `'internal'`.
- Severity: medium · Effort: S

### PRD-06 Two capability models run side by side: OOM fit for the market, v2 display levels for everything else
- Test(s): 3, 4, 5, 6
- What: The market chooses on OOM fit, coverage and price (serving.ts, choice.ts). At the same time, `computeMix` builds v2 display-level vectors (`capVec`, the horizon cap `AGENCY + 2`, `sectorLevel`, `level[]`, the share-weighted `dom`). These come from each product's `productDomains` plus `depOffset`, which is a second set of setting offsets in display levels: effort low −0.4 / deep +0.3, safeguards −0.05 / −0.2, control −0.1. They do not match the OOM effects (deep +0.24 OOM, low −0.21).

  The display path still drives:
  - Substitution α. It sets tokens per adopted hour, value per hour and jobs (sectors.ts:225, 247, `alphaOf(def, le.AGENCY)` with `sigmoid((L−8)/1.5)`).
  - The PHYS part of feasibility F (mix.ts:723).
  - Control (control.ts:157-158, 205-206).
  - `bestPublic` for the tech tree and moonshots (actions.ts:155-162, mix.ts:372-395).
  - The hype term through `bestPublicLg` (macro.ts:170).
  - The consumer display level and SOCIAL.

  So switching on Deep think moves the world's "best public level" through a hidden +0.3 L.
- Evidence: worldfx/mix.ts:21-22 (header admits it), :171-177 (`depOffset`), :210-231, :411-420, :439-442, :562-564, :634-638, :675, :702, :723; worldfx/sectors.ts:56-58, 225, 247; worldfx/control.ts:104, 157-158, 205-206.
- Player sees: nothing names the second path. The product card shows only fit in OOM.
- Fix: Recompute α, the PHYS gate, control and tech gates from the same OOM fit, horizon and coverage that the market uses (α from coverage or h50 on the sector's horizon domain). Then delete `depOffset`, `capVec`, `sectorLevel`, `SectorMix.level/dom/best` and `productDomains`.
- Severity: high · Effort: L

### PRD-07 The Agents product is gated three times on one idea, once through a v2 display level
- Test(s): 3, 4, 5
- What: Three separate gates express "the model must handle half-day tasks":
  1. Launch and swap need a measured time horizon of at least 4 h (`agentsGate`).
  2. The adopted-hours weight is multiplied by `sigmoid((AGENCY display level − 6)/1)`, a v2 constant on display levels.
  3. The agent-hours weight is multiplied by `pSuccess(4 h | h50)` on the true horizon.
- Evidence: models/products.ts:140-146; models/deployments.ts:252-255; worldfx/revenue.ts:310-314 (display sigmoid) and :317-324 (pSuccess).
- Player sees: only gate 1 ("Agents needs a time horizon of 4 h"). The other two quietly scale revenue.
- Fix: Keep gate 3 (physical, sourced). Delete the display sigmoid. Gate 1 can stay as a launch rule, but say on the card that revenue scales with p(4 h).
- Severity: medium · Effort: S

### PRD-08 Feature "enablers" add revenue outside the market and count twice on Chat
- Test(s): 2, 3, 6
- What: Enablers are described as "opening a segment of the listed markets that only products with it can sell into". In code they are a flat multiplier (1 + share) on the player's hours or users after the market share has been computed.
  - Sector side: they are not in the buyers' choice, not in `marketSpend`, and not taken from rivals. The adopted hours are not capped, so with a large share the player can sell more hours than the sector adopts.
  - Chat side: the same factor is applied twice. It multiplies the player's appeal in the user-share logit (mix.ts:785) and then multiplies the users again (revenue.ts:481). With Memory, Voice and Companion all on, that is ×1.45 twice.
  - The values (10/15/20%) have no mechanism behind them, and rivals have no features.
- Evidence: data/v2/features.ts:115-116, 122-123, 128-129, 140; worldfx/serving.ts:214-220 (`enablerShare`); worldfx/revenue.ts:348, 368-373, 403-408 (sector hours × en), 471, 481 (users × en); worldfx/mix.ts:785 (appeal × en); revenue.ts:359 (`marketSpend` excludes it).
- Player sees: "+15% reachable work" and "+20% Chat users" (productView.ts:211-214; glossary `featEnabler` "Rivals have none yet"). The double count and the spill past the market are invisible.
- Fix: Make an enabler a real capability. Computer use and voice add coverage on the listed sectors' GUI or media tasks (a ΔG or a coverage term in `offerOf`), so they win share through the same choice everyone uses. Let rivals get the same features over time. Apply each effect once.
- Severity: high · Effort: M

### PRD-09 The player's products split its market share by fixed channel weights, not by what buyers choose
- Test(s): 2, 3, 6, design
- What: In the market the player is one provider. Its offer in a sector is its best product's offer (by utility), and all products' lineups are pooled into its tiers (mix.ts:482-504). Revenue then splits the player's share among its sector products by `CH_WEIGHT` (API 1, Agents 1.5, Enterprise 1, Trusted 0.15, Gov 2) and `AGENT_WORK.channel` (API 1, Agents 1.5, Enterprise 0.5). It does not use which product buyers picked. So:
  - Launching a second product with a weak model takes hours from the strong one, at its own worse price.
  - The Enterprise sector-focus ×3 only moves hours among the player's own products (the weights are normalised by `wsum`). It wins no share.
  - Products differ only in these weights, the seat rule (Enterprise and Gov sell seats) and the gates. All are labelled "sector spend".
- Evidence: worldfx/revenue.ts:50, 285-286, 310-353 (incl. :333 `focus = … ? 3 : 1`), :403-449; data/v2/serving.ts:250; data/v2/features.ts:41-49 (`segment: 'sector spend'` for API, Enterprise, Agents and Trusted).
- Player sees: separate cards per product with their own revenue. It looks like each product competes on its own, but the split is fixed.
- Fix: Make each product its own provider row (or its own set of tiers) in the surplus choice, so buyers allocate hours between the player's products by fit and price. Alternatively, collapse API, Enterprise and Agents into one "sector product" with sales channels as settings. Remove focus ×3. A pack's real effect should be through fit (PRD-10).
- Severity: high · Effort: M

### PRD-10 Sector packs are spread over about eight places, with three unrelated effects and a fake feature
- Test(s): 2, 3, 5, 6
- What: One sector pack touches:
  - A "feature" `sectorPacks` with 0 team-weeks, $0 and an enabler `share: 0`. It does nothing except gate an action, and switching it on or off per product changes nothing, because `productOffer` never checks it.
  - A World-sphere action `wfx.sectorProduct` (owner WS5) launched from the Products card.
  - A build-queue item.
  - A world-level `certDay`.
  - A host product's `sectorFocus`.

  It then has three effects:
  1. `SECTOR_PACK_DG = 0.5/1.2`: a v2 "+0.5 L" turned into OOM by a level-per-OOM ratio. It is a made-up fit bonus on the host product only.
  2. A ×3 weight, on Enterprise hosts only (zero-sum, PRD-09).
  3. US friction −0.1 for the whole sector. It helps every provider, rivals included.

  The 120-day certification constant is defined twice. `sectorFocus` also routes incident friction (sectors.ts:312).
- Evidence: data/v2/features.ts:142-144; worldfx/actions.ts:15, 19-24, 58-92; departments/build.ts:69-73, 258-266; worldfx/serving.ts:476-482; worldfx/revenue.ts:299-302, 333; worldfx/sectors.ts:86-88, 312; worldfx/mix.ts:433-437; types.ts:566 (comment still "+0.5 L"); glossary.ts:373 and 384 (two entries, `sectorPack` and `sectorProduct`).
- Player sees: a "+ pack" button and a tooltip "+0.42 OOM fit per certified pack". The ×3 and the friction cut appear only in the glossary or not at all. The feature toggle looks real.
- Fix: Make a pack a thing the player owns: a sector adaptation of one product with a cost, a build and certification. Give it one effect with a mechanism, for example a scaffold on that sector's work (ΔG and tokens, like Deep research) plus a certification gate that lifts that sector's friction for the player's product only. Delete the `sectorPacks` feature, the ×3, the world-level `certDay` and the duplicate constant. Keep it on one panel and in one engine module.
- Severity: high · Effort: M

### PRD-11 A certified pack is lost for good when its host product is retired or relaunched
- Test(s): design (bug)
- What: Certification is stored per sector for the whole world (`fx.certDay`). The fit bonus applies only to a product whose `sectorFocus` lists the sector, and only the host gets it (build.ts:263). If the host is retired, or a product is relaunched (new deployments start with `sectorFocus: []`), no product carries the focus. The action then refuses a new pack because `certDay` is already set. Swapping the host's model keeps the pack, which is fine. I found no other code that writes `sectorFocus`.
- Evidence: departments/build.ts:258-264; worldfx/actions.ts:32, 85; models/deployments.ts:94; grep for `sectorFocus` (writers: init.ts:201, build.ts:263, deployments.ts:94, 150).
- Player sees: the pack disappears from the card, and "Every sector already has a product" blocks a rebuild.
- Fix: Store the pack on the product (or as a lab-owned asset assignable to a product). Clear or move it when the host is withdrawn.
- Severity: medium · Effort: S

### PRD-12 The sector-product preview uses v2 arithmetic and costs that are never charged
- Test(s): 2, 5, 6
- What: `productGain` estimates the revenue gain from "+0.5 L" with v2's 2.1-per-level share elasticity (`exp(1.05)`), the legacy `world.shares`, and constants 0.06, ×35 and ×2.8 ("US + ROW"). None of this is how the pack acts now (PRD-10). The preview also shows 15 product-team staff time and a labour-bloc approval exposure (p 0.5). `apply` only queues the build and books $0.4B.
- Evidence: worldfx/actions.ts:43-50, 69-80 vs 81-91.
- Player sees: a revenue gain number on the "+ pack" button that does not match the effect.
- Fix: Compute the preview with `previewDeployments` on a hypothetical state, as the other product actions do. Remove the made-up costs, or make them real.
- Severity: medium · Effort: S

### PRD-13 Product action previews list costs and risks that nothing applies
- Test(s): 2, 6
- What: `act()` runs `apply` only and does not charge preview cost lines (core/loop.ts:93-107). The following are shown but never applied:
  - Several product actions show staff-time costs that are never booked: update "−2 product team", feature toggle "−1", serving share "−1 Auto serving off", products policy "−1".
  - Launch shows "lead days −10 p 0.6" and "approval −2 p 0.2". Update shows "lead days −5 p 0.5". Retire shows "trust −1 p 0.3". The open-weights launch shows "trust +3 academia".

  Lead loss is partly real through `distillationLeak`, but these probabilities are invented. I found no code applying the approval or trust items. This breaks the "previews match effects" rule.
- Evidence: models/productOps.ts:207, 221-224, 267, 276, 292-296, 316, 360, 406, 418-419; core/loop.ts:93-107.
- Player sees: the risk and cost chips in previews.
- Fix: Delete lines with no mechanism. Show the lead effect from `distillationLeak` itself (ΔG per day for this product).
- Severity: medium · Effort: S

### PRD-14 Deep think is a feature, an effort setting and a tree lock at once
- Test(s): 3, 4
- What: "Effort deep" can be set three ways, each with its own gate:
  1. The effort selector, gated by `effortLock`, i.e. a tree option.
  2. The Deep think feature: tree node P05, then build, then a per-product toggle.
  3. `editedProduct`, which keeps the two in sync (turning effort to deep adds the feature, and the reverse).

  The feature's typed effect kind `'effort'` exists only to duplicate the selector. The UI lock text has to combine three conditions.
- Evidence: data/v2/features.ts:88, 118-120 (`effortDeep: true`); models/productOps.ts:70-78; models/deployments.ts:227-229; ui/v2/panels/Products.tsx:229-233; productOps.ts:334 (build preview sets effort).
- Player sees: an effort selector where "deep" is locked with one of three reasons, and a feature row that toggles the same thing.
- Fix: Delete the Deep think feature and the `effort` feature kind. Effort is a product setting, unlocked by its tree node.
- Severity: medium · Effort: S

### PRD-15 Product features silently boost internal R&D, regardless of the product toggles
- Test(s): 3, 6
- What: `internalFx` reads the lab-wide built list (`s.player.features`), not any product's switch. So building Memory gives ×1.3 horizon to every internal work type, safety work included. Coding agent gives +0.3 OOM on SWE, and Deep research +0.3 OOM on IDEAS. The internal agents pay only the token multiplier as lost throughput. These features count as "always in use" for upkeep. One product feature therefore does three jobs: a product effect, an internal research effect, and an engineering upkeep line.
- Evidence: worldfx/serving.ts:204-213; departments/workfit.ts:289-294, 328, 387; departments/build.ts:86-95 (`featureInternal`, `featureInUse`); data/v2/features.ts:11-12, 115, 132-133, 136.
- Player sees: a line in the feature tooltip listing the internal work types (productView.ts:166-168, `internal`). The R&D speed-up is not traceable from the research side.
- Fix: Split them. Internal agent tooling (harnesses, memory) becomes an R&D or agent-package item owned on the research side. Product features act only on products. Or keep one item but show it in both places with its effect on research speed.
- Severity: medium · Effort: M

### PRD-16 Feature hazard multipliers are flat numbers with no mechanism
- Test(s): 2
- What: Memory gives successor-alignment ×1.2, computer use power-seeking ×1.3, coding agent reward hacking ×1.2, and companion sycophancy ×1.5. These are unsourced flat multipliers on incident hazard, applied per product.
- Evidence: data/v2/features.ts:117, 124, 138, 141; models/products.ts:59-64; safety/incidents.ts:341; safety/dangerView.ts:96.
- Player sees: a "Cost / risk" line in the feature tooltip (Products.tsx:566).
- Fix: Tie them to a quantity the feature changes, for example hazard rising with the horizon multiplier or the autonomous-hours share it adds. Otherwise mark them [D] in the UI.
- Severity: low · Effort: S

### PRD-17 Safeguard, control-layer and pack fit costs are v2 level offsets converted at "1.2 L per OOM"
- Test(s): 2, 5
- What: `SAFEGUARD_DG` (classifiers −0.05/1.2, hardened −0.2/1.2), `CONTROL_LAYER_DG` (−0.1/1.2) and `SECTOR_PACK_DG` (0.5/1.2) are display-level numbers divided by a level-per-OOM ratio. The UI still prints them in levels ("−0.05 L · −0.2 L") while the engine applies OOM.
- Evidence: data/v2/serving.ts:277-280; worldfx/serving.ts:474, 477; ui/v2/panels/Products.tsx:217.
- Player sees: "Quality: classifiers −0.05 L · hardened −0.2 L" next to a card that otherwise speaks OOM.
- Fix: Restate them in OOM, ideally from a measured refusal or overhead cost (classifier latency and false-refusal share as lost coverage). Show OOM in the UI.
- Severity: low · Effort: S

### PRD-18 KYC and distillation leak: flat percentages and a leak that ignores volume
- Test(s): 2, design
- What:
  - Each KYC level cuts API and Agents demand by a flat 2% and cuts the leak by 25%.
  - The leak to each rival is `LEAK_COEF[channel] · gap · DA · (1 − 0.25·kyc) · 0.5 / 365`, with channel coefficients 0.3 / 1 / 0.5 / 0.2 / 0.05.
  - The leak has no usage term. A product with no customers leaks as much as one serving millions, and phantom students served at scale add nothing.
- Evidence: worldfx/revenue.ts:368-373; models/deployments.ts:17-18, 196-224.
- Player sees: a KYC tooltip, "Each level cuts distillation access by a quarter and this product's demand by 2%" (Products.tsx:225; glossary.ts:48).
- Fix: Make the leak scale with tokens served to outside customers (hours × tokens, available in the revenue readout) times a per-channel access share. Let KYC remove the anonymous share of buyers, so its demand cost is the share of buyers who fail it, not a flat 2%.
- Severity: medium · Effort: M

### PRD-19 Trusted access's ×3 price premium is invisible to buyers
- Test(s): 2, 6
- What: Trusted access charges `TRUSTED_PREMIUM = 3` times the price on adopted hours, capped at value, but only inside the revenue loop. The market choice in mix.ts prices Trusted at its normal markup, so buyers never react to the premium. Its volume comes only from the fixed weight 0.15.
- Evidence: worldfx/revenue.ts:50-52, 411-418; worldfx/mix.ts:486 (`productOffer` without the premium).
- Player sees: the blurb "Vetted partners only, at a premium" (features.ts:47). The ×3 is not shown.
- Fix: Either price Trusted through the same offer (premium tier, real markup) so the choice responds, or model it as contracts with a volume, as the Gov comment says (revenue.ts:29).
- Severity: medium · Effort: S

### PRD-20 A blended lineup offer keeps the main model's capability at the students' price
- Test(s): 1, 2
- What: `blendTiers` blends costs and prices by the hours each tier takes, but keeps fit, coverage, agent leverage λ and agent-hours k from the main model. Revenue then computes agent-hour demand from the main model's coverage at the blended (cheaper) agent price. The phantom students therefore lower the price without lowering the capability of the agent work sold.
- Evidence: worldfx/serving.ts:456-469; worldfx/revenue.ts:365, 383-389, 425-427.
- Player sees: nothing. Revenue per hour just looks cheaper.
- Fix: Compute agent demand per tier (each tier's own k at its own price) and sum. This goes away with PRD-01.
- Severity: medium · Effort: S

### PRD-21 Serving share does double duty as a misuse-exposure proxy
- Test(s): 3, 6
- What: `servingShare` is the manual slice of the pool when Auto is off. When Auto is on, the revenue system overwrites it with served H100e ÷ pool, spare included. Misuse incident reach and the danger view read it as "how much this product is used". So misuse exposure follows the compute slice, not users or tokens. Spare compute spread pro rata raises exposure, and a cheap mini lowers it. I am unsure whether spare lent to research is subtracted. `servingSplit` adds spare to `h` either way (revenue.ts:249-252).
- Evidence: worldfx/revenue.ts:224-263, 630-634; safety/incidents.ts:118; safety/dangerView.ts:123; models/deployments.ts:20 (`DEFAULT_SERVING` [D]).
- Player sees: a serving-share bar. The link to incidents is not shown.
- Fix: Use a usage measure for exposure (billed hours or users from the revenue readout). Keep `servingShare` only as the manual allocation.
- Severity: low · Effort: S

### PRD-22 Launches drop built features, minis and settings; there is unused support for several products per channel
- Test(s): 5, design
- What:
  - A launch goes through the build queue. When it completes, `deploy` is called without features, mini or sector focus, so a new product starts with every built feature off and must be toggled one by one.
  - Revenue's consumer loop splits users across several Chat products, and mix picks the best of several products per channel. But `product.launch` forbids a second live product on a channel, so that code has no use.
- Evidence: departments/build.ts:250-256; models/productOps.ts:231, 242-249; worldfx/revenue.ts:456-476; worldfx/mix.ts:482-504, 768-789.
- Player sees: a new product with all features off.
- Fix: Carry features and settings into the launch spec (default: every built feature the channel offers). Remove the multi-product-per-channel code, or allow it on purpose.
- Severity: low · Effort: S

### PRD-23 Leftover concepts and code tags
- Test(s): 5
- What:
  - "D5: the frontier-leader start's set is the neutral ×1 baseline": the `leader` flag exists only to start one fake feature (sector packs) as built.
  - `serveCost` still sets FLOP per token for versions without `fpt`, and sizes distilled students (`serve = teacher.serveCost · nS/nT`).
  - `types.ts` comments still say "+0.5 L" and "FREE_TIER_SHARE of its usage".
  - Code-name tags (B4, A5, A7, A2c, TIERS, D5, D7, J2 P1, C2) fill comments that the player-facing blurbs mirror.
  - `PRODUCT_DEFS.enterprise` says "with sector packs. Sticky, little leak". Stickiness is not modelled per product (the customer τ is per segment).
- Evidence: data/v2/features.ts:13, 100-101, 147-148; data/v2/starts.ts:130; core/save.ts:271; departments/workfit.ts:131-142; models/runs.ts:372; types.ts:546, 566; data/v2/features.ts:44; data/v2/serving.ts:299.
- Player sees: mostly nothing (only the blurbs).
- Fix: Delete `leader` and `LEADER_FEATURES` together with the sectorPacks feature. Set `fpt` on every version at creation and drop the `serveCost` fallback. Refresh the comments and blurbs.
- Severity: low · Effort: S

### PRD-24 Hard-coded market multipliers around the player's products
- Test(s): 2
- What:
  - Character training gives consumer appeal ×1.25 (engagement), ×1.15 (persuasion) or ×0.9 (minimal).
  - The player's brand is a flat "1.2 incumbent ± 0.1 with approval".
  - A hand-written regional access table sets China at 0.05 / 0.3 / 0.4 / 0.7 and others at 0.6 / 0.05 in CN.
  - Open weights are served at ×1.2 markup.
  - A "restricted" product is ×0.3.
- Evidence: worldfx/mix.ts:46-47, 179-187, 233-242; worldfx/revenue.ts:371, 482.
- Player sees: not shown as numbers.
- Fix: Source them or derive them. For example, brand from the customer stock and reach, which already exist, rather than a flat 1.2. At least show them in the share tooltip.
- Severity: low · Effort: S

### PRD-25 Design: a "product" is a channel, so the player cannot say what they own
- Test(s): design
- What: A product equals a channel (one per channel), a package of a model plus a phantom lineup and free tier plus settings plus lab-wide features plus world certifications. API, Enterprise and Agents sell the same "sector spend" and differ only by hidden weights (PRD-09), the seat rule and gates. Gov and Trusted need copy-variants (PRD-05). Features are built lab-wide, toggled per product, and also act on R&D (PRD-15). Packs live half on Products and half in the World sphere. Capability enters the market by two paths (PRD-06). The questions "which of my models does this customer use, and why did this product earn X?" have no single answer.
- Evidence: data/v2/features.ts:1-14, 32-51; worldfx/mix.ts:4-22; worldfx/revenue.ts:14-16, 49-50.
- Player sees: cards that look independent but are coupled through fixed weights and phantom tiers.
- Fix: See the model below.
- Severity: medium · Effort: L

---

## Counts
High 7 (PRD-01, 02, 03, 06, 08, 09, 10) · Medium 12 (04, 05, 07, 11, 12, 13, 14, 15, 18, 19, 20, 25) · Low 6 (16, 17, 21, 22, 23, 24). Total 25.

## Simplest coherent model

**Models.** A model is a version the player trained. Its size (active parameters, so FLOP per token) and its fit by domain are set by its run.

**Sizes.** Smaller sizes exist only as real distillation runs of a teacher. They cost compute and engineering, carry their teacher's traits, need their own evals, and show up in the lineage. There are no phantom students and no free-tier rule. Rivals model their small models the same way, as entries in their own lab state.

**Products.** A product is an owned offering: one model per tier (an ordered list of the player's versions, e.g. frontier, mid, small), a price tier, safeguards, KYC and a usage policy. It sells to one market: sector work (per hour, per seat, per agent-hour) or consumer chat (subscriptions, with the free tier being whichever tier the player assigns). Gov and Trusted are buyer segments or contracts chosen by product settings, not model copies.

**Market.** Each product is a seller in the same surplus choice as every rival, so the player's products compete with each other and with rivals on fit and price. There are no channel weights, focus ×3 or post-hoc premiums. Capability reaches the world by one path: OOM fit, horizon and coverage. α, feasibility, control and tech gates read the same numbers.

**Tools (features).** A tool is a built item with a typed physical effect: a scaffold (+ΔG and × tokens on listed work), a horizon extender (× h50), or a coverage opener (coverage on listed tasks such as GUI or media). Each is applied once, inside the offer, so it wins share only through the choice. Rivals acquire the same tools over time. Product tools and internal-agent tools are separate items, each shown where it acts. Effort is a product setting, not a tool.

**Certification.** A sector pack is a sector adaptation the player owns and attaches to one product. It costs a build plus certification time, acts as a scaffold on that sector's work, and lifts the friction for that product's buyers. It stays with the product, moves when the product changes model, and ends when the product is retired.
