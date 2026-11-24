# Model naming (designer decisions, 2026-11-22 … 11-24)

The player names their models with a chosen **rung theme** (a ladder of 7 words, one per capability milestone) and a
chosen **tier convention** (size words for distilled students). Names follow one grammar, so a name tells the player the
model's lineage, the capability class its base was trained for, its post-training step, its size and (for a streaming
model) its weekly refresh. It follows no real lab exactly; it is built to keep many models trackable and to make
reaching a new rung a progression beat.

Checked against master 15d346f (R&D redesign merged).

## 1. Grammar

```
<Rung>-<major><C…>.<minor>[.<patch>][-<tier>[-<n>]]
```

| Part | Example | Set by |
|---|---|---|
| Rung | `Cruiser` | the base run's launch forecast (§2) |
| major | `2` | next free number in that rung, reserved at launch (§3) |
| C… | `2C`, `2CC` | one `C` per continued-pretraining run on the lineage (§4) |
| minor | `.3` | the base's full post-trains, amplify included (§5) |
| patch | `.57` | the continual-learning stream's weekly refreshes (§6) |
| tier | `-micro` | a distilled student's size band (§7) |
| n | `-2` | the second student of one version in one band (§7) |

Examples: `Cruiser-2.0` · `Cruiser-2.3` · `Cruiser-2C.0` · `Cruiser-3.1.57` · `Cruiser-2.3-micro` ·
`Cruiser-2.3-micro-2` · `Dreadnought-3.12-nano`.

Full names everywhere (tables included); no short form. Rivals keep their fixed family names (data/v2/names.ts).

## 2. Rung

Seven rungs, one per milestone (`MILESTONE_NAMES`, `LEVEL_KNOTS`):

| Rung | Forecast level | Milestone |
|---|---|---|
| 1 | < 6.5 | Agent (the start models, level 5, and anything smaller) |
| 2 | 6.5 – 8.5 | Reliable agent |
| 3 | 8.5 – 10 | Research agent |
| 4 | 10 – 12 | Superhuman coder |
| 5 | 12 – 13.5 | Superhuman AI researcher |
| 6 | 13.5 – 15 | Superintelligent AI researcher |
| 7 | ≥ 15 | Superintelligence |

- **Source:** the base run's **launch forecast** midpoint (`TrainingRun.forecast.mid`: the lab's belief on the measured
  scale, through the post-training the base would get, frozen at launch). Never the true G and never `run.predicted`
  (truth-based): the name must not leak hidden capability.
- **No forecast** (nothing measured yet, e.g. the spinout start): the rung of the measured model the run starts from,
  else rung 1.
- **Fixed for the lineage:** post-trains, amplify, continued pretraining and the stream never change the rung, whatever
  they add.
- **Below rung 1 / above rung 7:** keep the bottom / top word.
- **Start base (B0):** rung from the start model's measured level at game start.
- **What the word claims:** a capability class named at launch, not that the model meets the milestone (milestones are
  "doing the job", work fit; a specialised model can meet one earlier or later than its general level suggests). The
  name's tooltip says so (good-ui: a tooltip for every term; levels never as raw numbers).

## 3. Major number

- A new base (pretraining from a design) takes the next free number **within its rung**: `Cruiser-1`, `Cruiser-2`;
  the next rung starts again at 1 (`Battleship-1`).
- Reserved when the run **launches** (the run card and queue can say "Training Cruiser-3"). A cancelled or failed run
  leaves a **gap**; gaps are kept.
- A base can land in a lower rung than earlier ones (a small, cheap base): `Frigate-1` after `Cruiser-3` is correct.

## 4. Continued pretraining

A continued base keeps its parent's size, design and lineage (hidden traits stepped, not redrawn) and adds pretraining
FLOP; it starts with no versions. Name: the parent's rung and major plus `C`, versions restart at `.0`:
`Cruiser-2` → `Cruiser-2C` (`Cruiser-2C.0`, `2C.1` …), again → `Cruiser-2CC`.

## 5. Minor number (post-training)

- Counts only **full** post-trains on that base, starting at `.0`, and the **amplify** run (RL with the teacher as
  grader, IDA) as a post-train. Students and imports do not use a minor number.
- Fixes today's skip: `versionName` counts every version on the base, students included, so the first post-train of
  the game is `Atlas-1.4` (B0 holds V0 and its three start students).
- **Amplify on a student is blocked** (the plan returns a reason). Today nothing stops it and the result would be a
  `full` version without the student's size.

## 6. Patch number (continual-learning stream)

- The stream updates its version in place every `STREAM_PERIOD_DAYS` (7): each refresh adds 1 to the patch:
  `Cruiser-3.1` → `Cruiser-3.1.1` … `Cruiser-3.1.57`.
- When the stream stops the version keeps its last patch; the next post-train is `Cruiser-3.2`.
- A student distilled from a streaming version freezes the patch it was made at: `Cruiser-3.1.12-micro`.
- An eval on a streaming version names the patch it measured ("measured at 3.1.12").

## 7. Tier word (distilled students)

- Only distilled students (`variant: 'mini'`) take a tier word. Other lineup entries (older full models, post-trains)
  keep their own names.
- **By size**, not by capability lost: the student's active parameters ÷ its **base's** active parameters (the
  lineage's full-size model; a student has no base of its own). Size is exact, known before the run and what a tier
  sells on; the distillation gap follows from it.
- The version part is the **full-size ancestor's** (walk `parentVersionId` to the first full version), so a student of
  a student is `Cruiser-2.3-nano`, not `-mini-nano`.
- Two students of one version in one band: `-2`, `-3` (`Cruiser-2.3-micro-2`).

| Band (student ÷ base) | Generic | Speed | Plain size |
|---|---|---|---|
| ≥ 1/2 | Lite | Swift | Large |
| 1/4 – 1/2 | Mini | Flash | Medium |
| 1/16 – 1/4 | Micro | Spark | Small |
| < 1/16 | Nano | Blink | Tiny |

Today's sizes land as: start lineup 1/2.8 → Mini, 1/5.7 → Micro, 1/80 → Nano (already named `-mini/-micro/-nano`);
the auto cheap tier's 1/6 → Micro.

## 8. Not named

- **Channels** (Gov, Trusted, …): who a product is offered to, not a kind of model. No suffix.
- **Open weights:** a release act on the same version (`openDay`). No suffix, no badge.
- **Rivals and China:** fixed family names (`Orion-3.2`, students `<model> mini/micro/nano`); rivals wait for their own
  session.

## 9. Rung themes (7 words, rung 1 → 7)

Numbers are the shortlist's original numbers.

| # | Theme | Rungs 1 → 7 |
|---|---|---|
| 1 | Poetic forms | Couplet, Tercet, Quatrain, Villanelle, Ballad, Ode, Epic |
| 2 | Books | Leaf, Pamphlet, Chapbook, Volume, Tome, Codex, Library |
| 4 | Fiction lengths | Flash, Short Story, Novelette, Novella, Novel, Saga, Cycle |
| 5 | Dante's Paradiso | Moon, Mercury, Venus, Sun, Mars, Jupiter, Saturn |
| 6 | Dante's Inferno | Lust, Gluttony, Greed, Wrath, Violence, Fraud, Treachery |
| 7 | Music ensembles | Solo, Duet, Trio, Quartet, Octet, Orchestra, Philharmonic |
| 8 | Musical forms | Motif, Étude, Prelude, Sonata, Concerto, Symphony, Opera |
| 11 | Light | Spark, Candle, Lantern, Torch, Beacon, Sun, Nova |
| 12 | Clouds | Wisp, Haze, Cirrus, Cumulus, Nimbus, Thunderhead, Supercell |
| 13 | Weather | Zephyr, Breeze, Squall, Gale, Storm, Tempest, Hurricane |
| 14 | Water | Dew, Rill, Brook, River, Lake, Sea, Ocean |
| 15 | Mountains (real peaks) | Fuji, Rainier, Kilimanjaro, Denali, Aconcagua, K2, Everest |
| 16 | Mountains (generic) | Knoll, Hill, Crag, Ridge, Peak, Summit, Massif |
| 18 | Trees | Bonsai, Sapling, Birch, Oak, Cedar, Redwood, Sequoia |
| 20 | Chili heat | Bell, Jalapeño, Serrano, Cayenne, Habanero, Ghost, Reaper |
| 21 | Ocean depths | Littoral, Epipelagic, Mesopelagic, Bathypelagic, Abyssal, Hadal, Challenger |
| 22 | Rivers by length | Thames, Rhine, Danube, Mississippi, Yangtze, Amazon, Nile |
| 23 | Islands by area | Ireland, Iceland, Great Britain, Madagascar, Borneo, New Guinea, Greenland |
| 24 | Atmosphere layers | Troposphere, Stratosphere, Mesosphere, Thermosphere, Exosphere, Magnetosphere, Heliosphere |
| 27 | Stars | Red Dwarf, Yellow Dwarf, Subgiant, Giant, Bright Giant, Supergiant, Hypergiant |
| 28 | SI prefixes | Mega, Giga, Tera, Peta, Exa, Zetta, Yotta |
| 29 | Noble gases | Helium, Neon, Argon, Krypton, Xenon, Radon, Oganesson |
| 30 | Electromagnetic spectrum | Radio, Microwave, Infrared, Visible, Ultraviolet, X-ray, Gamma |
| 31 | Mohs scale | Calcite, Fluorite, Apatite, Quartz, Topaz, Corundum, Diamond |
| 34 | Alchemical metals | Lead, Tin, Iron, Copper, Quicksilver, Silver, Gold |
| 37 | Number systems | Natural, Integer, Rational, Real, Complex, Quaternion, Octonion |
| 38 | Hypercubes | Point, Line, Square, Cube, Tesseract, Penteract, Hexeract |
| 39 | Hyperoperations | Successor, Addition, Multiplication, Exponentiation, Tetration, Pentation, Hexation |
| 41 | Angelic choirs | Angel, Archangel, Power, Dominion, Throne, Cherub, Seraph |
| 42 | Kabbalah sefirot | Malkuth, Yesod, Netzach, Tiferet, Chesed, Binah, Keter |
| 43 | Chakras | Muladhara, Svadhisthana, Manipura, Anahata, Vishuddha, Ajna, Sahasrara (English: Root, Sacral, Solar, Heart, Throat, Third Eye, Crown) |
| 44 | Greek beings (by age) | Nymph, Satyr, Hero, Demigod, Olympian, Titan, Primordial |
| 46 | Champagne bottles | Magnum, Jeroboam, Methuselah, Salmanazar, Balthazar, Nebuchadnezzar, Melchizedek |
| 47 | Church hierarchy | Deacon, Priest, Monsignor, Bishop, Archbishop, Cardinal, Pope |
| 48 | Warships | Cutter, Corvette, Frigate, Destroyer, Cruiser, Battleship, Dreadnought |
| 49 | Military units | Squad, Platoon, Company, Battalion, Brigade, Division, Army |
| 50 | Cursus honorum | Quaestor, Aedile, Praetor, Consul, Censor, Dictator, Imperator |
| 51 | Peerage | Baron, Viscount, Earl, Marquess, Duke, King, Emperor |
| 52 | Sumo ranks | Makushita, Jūryō, Maegashira, Komusubi, Sekiwake, Ōzeki, Yokozuna |
| 53 | Martial arts belts | White, Yellow, Orange, Green, Blue, Brown, Black |
| 54 | Chess | Pawn, Knight, Bishop, Rook, Queen, King, Checkmate |
| 67 | Geologic periods | Cambrian, Devonian, Carboniferous, Permian, Triassic, Jurassic, Cretaceous |
| 69 | Days of creation | Light, Firmament, Land, Stars, Creatures, Man, Sabbath |
| 58 | No theme (Agent-n) | the rung as a number: `Agent-<rung>-<major>…`, e.g. `Agent-3-1.2`, `Agent-5-2.4-micro` |

Two-word rungs keep their space (`Short Story-2.1`, `Great Britain-1.0`).

## 10. Implementation notes

- **Store the parts, render the name.** Base: `rung`, `major`, `cont` (number of `C`s). Version: `minor` (full
  versions), `patch` (stream), `tier` + `tierN` (students), and the full-size ancestor's id for students. Game state:
  the chosen theme and tier convention. One function renders a name from the parts and the current choice; `name`
  stays as a cached string for logs, which keep the name of the day they were written.
- **Run names:** a base run reserves its rung and major at launch and shows the coming name.
- **Saves:** older saves derive the parts once on load (rung from the base's measured level, minors by counting full
  post-trains in day order).

## 11. Choosing the theme

- Not chosen at game start. A new game uses **Agent-n** (no theme) and the **generic** tier words (Lite / Mini /
  Micro / Nano).
- The player changes either one at any time in the **MODELS** tab; every model's name re-renders (logs keep the name
  of their day).

## 12. Imported models (spinout start)

The imported family keeps its own name and never enters the theme (no rung word). Its post-trains, stream patches and
students follow the same minor / patch / tier rules under that family name.
