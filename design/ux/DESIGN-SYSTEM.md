# v2 visual design system

Sheet: `mockups/00-design-system.png`. Tokens and components as CSS: `mockups/kit.css`, which the implementation lifts into `src/ui/v2/v2.css`.

**Rule of thumb.**
- Level 0–1 shows an icon, a number and a word.
- Hover answers *why*; click answers *where to change it*.
- Prose lives only in the Codex and event cards.

## 1. Icon map (lucide-react; all names verified against lucide 1.x)

Each concept gets exactly one icon, used everywhere: top strip, panels, tooltips, cause chips and alerts. Implement it as one module, `src/ui/v2/icons.ts`, exporting `ICON: Record<ConceptId, LucideIcon>` so that no panel picks its own.

| Group | Concept → icon |
|---|---|
| Resources | cash `wallet` · runway `fuel` · revenue `trending-up` · valuation `gem` · compute (H100e) `cpu` · compute pool / serving `server` · idle chips `plug-zap` · power `zap` · no power `zap-off` · sites `factory` · cloud rental `cloud` · staff `users` · hiring `user-plus` · morale `smile` · talent/taste `sparkles` · data `database` · raise `hand-coins` · debt `banknote` |
| Spheres (also departments) | Capabilities `brain` · Safety `microscope` · Security `shield` · Product `boxes` · Ops `settings-2` · AI agents `bot` · experiments `flask-conical` · training run `rocket` |
| Race and top meters | Capability L `brain` · Understanding U `microscope` · blind gap `eye-off` · catastrophe risk `skull` · lead `timer` · scrutiny `eye` · R&D speed M `gauge` · control index `joystick` · trust `heart-handshake` · credibility `award` · approval `vote` · weight security `lock` |
| Model domains | CODE `code-xml` · RSCH `flask-conical` · REASON `lightbulb` · AGENCY `bot` · SOCIAL `users-round` · MEDIA `image` · CYBER `binary` · BIO `dna` · PHYS `atom` |
| Traits | SYC `thumbs-up` · RH `bug` · PROXY `target` · SA `scan-eye` · PERSONA `venetian-mask` · OBF `eye-off` · EA `glasses` · TGAME `gamepad-2` · CONCEAL `package-x` · POWER `crown` · AF `drama` · SAND `turtle` · SCHEME `ghost` · COLLUDE `network` · SUCC `git-fork` · HONEST `badge-check` · CORRIG `hand` |
| Training signals | S1 rater approval `star` · S2 hackable graders `clipboard-x` · S3 long-horizon RL `hourglass` · S4 CoT pressure `message-square-off` · S5 scale + AI data `database` · S6 narrow FT/distill `funnel` · S7 oversight-conditional `cctv` · S8 many copies `copy` |
| Actors | you `hexagon` (+ monogram) · US rival `building-2` (+ monogram) · China `flag` · Executive `landmark` · Congress `scale` · States `map` · gov evaluators `clipboard-check` · independent evaluators `search-check` · academia `graduation-cap` · public `users` · blocs `megaphone` · board `armchair` |
| Events | decision `split` · incident `siren` · finding `file-search` · milestone `milestone` · headline `newspaper` · security event `shield-alert` · theft `key-round` · commitment/law `scroll-text` · generic alert `triangle-alert` |
| Risk sources | own models `brain` · US rivals `building-2` · China `flag` · misuse `biohazard` · theft `key-round` · rogue copies `copy-x` · war `swords` |
| Time | pause `pause` · speed 1 `play` · 2 `chevrons-right` · 3 `fast-forward` · FF to target `skip-forward` |
| Actions | go to control `chevron-right` · re-validate `refresh-cw` · investigate `search` · compute split `sliders-horizontal` · help `circle-help` |

**Changes from today.**
- Lead uses `timer` (was `swords`); `swords` now means war only.
- The R&D multiplier uses `gauge` (was `cpu`).
- Incidents use `siren` (was a shared `AlertTriangle`).
- The nav adds `workflow` (Company) and `radar` (Overview).

## 2. Colour semantics

All hue sets were run through the dataviz palette validator on the panel surface `#161e29`, dark mode.

| Role | Tokens | Rule |
|---|---|---|
| **Status** (reserved) | good `#4cc38a` · watch `#e9b44c` · bad `#ef6b6b` · critical `#ff4d6d` | Only for state: gain/loss, healthy/tight, binding, sev 4–5. Always paired with an icon or ▲▼. Never used for identity. |
| **Race** | capability `#9b6be0` · understanding `#22a394` | The two racing meters. Validated as a pair: CVD ΔE 13.8, normal 24.3. The gap between them is a status-red hatch. |
| **Spheres** (fixed order) | Capabilities `#9b6be0` · Safety `#22a394` · Security `#3a8ae0` · Product `#b08e1a` · Ops `#6b7c91` | Every panel, flow and stacked bar uses these, in this order. They pass adjacent-pair checks; non-adjacent violet/blue are never shown side by side without labels. Capabilities shares the capability hue and Safety shares the understanding hue on purpose: *the safety department produces understanding*. |
| **Actors** | you `#3a8ae0` · US rivals `#d4732a` · China `#c43c8c` | Passes all pairs (CVD ≥ 11.9, normal ≥ 16.2). Rivals are told apart by monogram and label, never by a new hue. China moves off the status red; today `#e2584f` is nearly `--neg`. Government, public, evaluators and academia stay neutral `#9fb0c3` and are told apart by icon. |
| **Sequential** | `#16303a → #1d6f68 → #22a394 → #7fe0cf` | Magnitude: automation share, coverage. |
| **Diverging** | bad `#ef6b6b` ← `#33435a` → understanding teal | Detection against the 50% line; cause bars (gain/loss). |
| **Texture** | 45° hatch in bad red | "Unverified": the band between U and L, uncertain estimates. |
| **Ghost** | dashed outline in watch amber | Projected, previewed, lagged or probabilistic (exposure lines, §2.7 of the spec). |

**Validator results (for the record).**
- The current v1/v2 palette fails three checks:
  - blue↔violet: CVD ΔE 1.0;
  - orange↔gold: normal ΔE 10.2;
  - lightness band.
- The new actor and race sets pass every check.

**Surfaces and ink.**
- Surfaces: `--bg #0b0f15`, `--bg-2 #10161e`, `--panel #151c26`, `--panel-2 #1b2430`, `--line #243041`.
- Ink: `#e3e9f1` / `#9fb0c3` / `#6b7c91`.
- The current palette is kept, one step darker for depth.

## 3. Typography

| Token | Size / weight | Use |
|---|---|---|
| display | 32 / 700 mono | Hero numbers inside gauges (runway 3.5q) |
| title | 18 / 650 | Panel title |
| value | 15 / 600 mono | Stat chip values, card KPIs |
| body / head | 13 / 400 · 600 | Card titles, rows |
| label | 12 | Chips, buttons, row labels |
| caption | 11 / 600 caps +0.08em | Section captions, axes |

**Number rules.**
- All numbers use tabular mono, with units in grey.
- Signs are always shown (`+`, `−`, `▲`, `▼`).
- Round at the display layer: 2–3 significant figures.
- One formatter per currency.
- **Never render a raw float.** `fmt.ts` gets a lint test over all panels.

Fonts: Segoe UI Variable / Inter for text, Cascadia Mono / JetBrains Mono for numbers. Both ship with Windows 11; no web fonts are needed.

## 4. Component kit

All of these are shown in `mockups/00-design-system.png` and live in the mockups.

| Component | Anatomy | Behaviour |
|---|---|---|
| **StatChip** | icon tile · caption · value · trend (▲▼ + Δ over 30 d) · optional status suffix (`3.5q`, `2.7M idle`) | Hover opens the WhyCard. Click goes to the owning panel. The trend colour is semantic (an up-trend in a bad thing is red). |
| **RaceMeter** | two bars on one 5–15 scale · milestone ticks · hatched gap · numbers at both ends · "2.0 BLIND / 1.7 AHEAD" tag | The single hero of the top strip. Hover shows detection per trait vs 50%, why it moved and levers; it lights the linked UI. |
| **Gauge** | arc with status zones · needle · hero number · zone labels | Runway (3/6q), catastrophe risk (with a band arc), board confidence. |
| **CauseChain** | `root ▸ link ▸ symptom` chips; root in amber (actionable), symptoms in red; each chip is an icon + 2–4 words | Used in Watch items, decision "why now", tooltips and evidence. Each chip is clickable to its panel. |
| **CauseBars** (Democracy strip) | per source: icon · label · diverging bar · signed value · detail | Replaces the "Why · 30 d" text rows in every meter tooltip. |
| **FlowBand** | Sankey link; width = value; colour = destination sphere | Company flow; flow tab of the overview. |
| **ActionCard** | icon · verb · pill row (cost red, gain green, exposure dashed amber) · before→after mini-bars on the touched meters · key hint | Decision choices, relation actions, run launch. Hover ghosts the after-state onto the real top-strip meters. |
| **OptionTile** | icon · name · effect glyphs (`SYC ▲▲`, `$0`, `35 d`, `needs P23`) | Run designer choices, deal templates, eval gate levels. Locked tiles show the unlock reason. |
| **Timeline** | lanes · now-line · solid bars (committed) · ghost bars (lagged effects with probability) | Run ETA, ledger, site build-outs, decision deadlines. |
| **BandBar** | estimate tick · ±uncertainty band · severity colour | Trait beliefs, rival misalignment, agenda efficacy. |
| **Heat cell grid** | sequential or diverging cells · a "you are here" outline · threshold contour | Detection by level, automation by sector. |
| **Watch item** | CauseChain + one-line consequence + Go button | Right rail, generated by rules (§5.3). |
| **Badge** | count on a nav icon; colour = sphere or status | Shows where action waits. |

## 5. Interaction patterns

1. **Hover = why.** Every number has a WhyCard with three parts:
   - the value plus its 30-day sparkline;
   - **CauseBars** from the ledger, or a formula breakdown;
   - **Levers**: up to 3 Go buttons, each to the exact control.

   Blue terms nest (the CK3 Tooltip already supports this), and `Alt` locks.
2. **Click = go.** Any chip, node, cause or lever opens the owning panel, scrolls to the control and pulses it once (600 ms outline).
3. **Preview before commit.**
   - Hovering an OptionTile or ActionCard computes `actionView`/`runCard` and ghosts the after-state:
     - dashed segments on the affected top-strip meters;
     - trait arrows in the run designer.
   - Nothing changes until click.
4. **Causal highlight.** Hovering a meter sets `store.highlight = { keys }`. Every element registered with a matching `data-cause` key (nav badge, rail card, map node, table row) gets the teal outline. Example: hovering Understanding lights Safety in the nav, the "Power seeking 37%" Watch item and the U line on the frontier track [mockups/01b-main-hover-why.png].
5. **One alert channel.** Decisions, alerts and coach goals use the bottom bar only:
   - decisions get a ring timer;
   - same-kind alerts collapse;
   - failed player actions show as a transient flash and never enter the ticker.

   Nav badges mirror the queue by sphere.
6. **Keyboard.**
   - `Space` pause; `1–4` speed; `F` fast-forward to the next event.
   - `1/2/3` choose in a decision modal; `Esc` later.
   - `?` help and coach replay.
