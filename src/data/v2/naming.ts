// Model naming (design/MODEL-NAMING.md): rung themes, tier conventions and the edges that pick them.

/** A rung theme: seven words, rung 1 → 7 (one per milestone). `words` absent = Agent-n (the rung as a number). */
export interface RungTheme { id: string; label: string; words?: readonly string[] }

/** The default theme: no words, the rung as a number (`Agent-3-1.2`). */
export const DEFAULT_THEME = 'agent';
/** Family word of the no-theme names. */
export const AGENT_FAMILY = 'Agent';
/** Family word of an imported model's lineage (spinout start): it keeps its own family and never takes a rung. */
export const IMPORT_FAMILY = 'Import';

/** MODEL-NAMING §9 (the designer's shortlist, its numbering kept in the comments). */
export const RUNG_THEMES: readonly RungTheme[] = [
  { id: 'agent', label: 'No theme (Agent-n)' }, // 58
  { id: 'poetic', label: 'Poetic forms', words: ['Couplet', 'Tercet', 'Quatrain', 'Villanelle', 'Ballad', 'Ode', 'Epic'] }, // 1
  { id: 'books', label: 'Books', words: ['Leaf', 'Pamphlet', 'Chapbook', 'Volume', 'Tome', 'Codex', 'Library'] }, // 2
  { id: 'fiction', label: 'Fiction lengths', words: ['Flash', 'Short Story', 'Novelette', 'Novella', 'Novel', 'Saga', 'Cycle'] }, // 4
  { id: 'paradiso', label: "Dante's Paradiso", words: ['Moon', 'Mercury', 'Venus', 'Sun', 'Mars', 'Jupiter', 'Saturn'] }, // 5
  { id: 'inferno', label: "Dante's Inferno", words: ['Lust', 'Gluttony', 'Greed', 'Wrath', 'Violence', 'Fraud', 'Treachery'] }, // 6
  { id: 'ensembles', label: 'Music ensembles', words: ['Solo', 'Duet', 'Trio', 'Quartet', 'Octet', 'Orchestra', 'Philharmonic'] }, // 7
  { id: 'forms', label: 'Musical forms', words: ['Motif', 'Étude', 'Prelude', 'Sonata', 'Concerto', 'Symphony', 'Opera'] }, // 8
  { id: 'light', label: 'Light', words: ['Spark', 'Candle', 'Lantern', 'Torch', 'Beacon', 'Sun', 'Nova'] }, // 11
  { id: 'clouds', label: 'Clouds', words: ['Wisp', 'Haze', 'Cirrus', 'Cumulus', 'Nimbus', 'Thunderhead', 'Supercell'] }, // 12
  { id: 'weather', label: 'Weather', words: ['Zephyr', 'Breeze', 'Squall', 'Gale', 'Storm', 'Tempest', 'Hurricane'] }, // 13
  { id: 'water', label: 'Water', words: ['Dew', 'Rill', 'Brook', 'River', 'Lake', 'Sea', 'Ocean'] }, // 14
  { id: 'peaks', label: 'Mountains (real peaks)', words: ['Fuji', 'Rainier', 'Kilimanjaro', 'Denali', 'Aconcagua', 'K2', 'Everest'] }, // 15
  { id: 'mountains', label: 'Mountains', words: ['Knoll', 'Hill', 'Crag', 'Ridge', 'Peak', 'Summit', 'Massif'] }, // 16
  { id: 'trees', label: 'Trees', words: ['Bonsai', 'Sapling', 'Birch', 'Oak', 'Cedar', 'Redwood', 'Sequoia'] }, // 18
  { id: 'chili', label: 'Chili heat', words: ['Bell', 'Jalapeño', 'Serrano', 'Cayenne', 'Habanero', 'Ghost', 'Reaper'] }, // 20
  { id: 'depths', label: 'Ocean depths', words: ['Littoral', 'Epipelagic', 'Mesopelagic', 'Bathypelagic', 'Abyssal', 'Hadal', 'Challenger'] }, // 21
  { id: 'rivers', label: 'Rivers by length', words: ['Thames', 'Rhine', 'Danube', 'Mississippi', 'Yangtze', 'Amazon', 'Nile'] }, // 22
  { id: 'islands', label: 'Islands by area', words: ['Ireland', 'Iceland', 'Great Britain', 'Madagascar', 'Borneo', 'New Guinea', 'Greenland'] }, // 23
  { id: 'atmosphere', label: 'Atmosphere layers', words: ['Troposphere', 'Stratosphere', 'Mesosphere', 'Thermosphere', 'Exosphere', 'Magnetosphere', 'Heliosphere'] }, // 24
  { id: 'stars', label: 'Stars', words: ['Red Dwarf', 'Yellow Dwarf', 'Subgiant', 'Giant', 'Bright Giant', 'Supergiant', 'Hypergiant'] }, // 27
  { id: 'si', label: 'SI prefixes', words: ['Mega', 'Giga', 'Tera', 'Peta', 'Exa', 'Zetta', 'Yotta'] }, // 28
  { id: 'gases', label: 'Noble gases', words: ['Helium', 'Neon', 'Argon', 'Krypton', 'Xenon', 'Radon', 'Oganesson'] }, // 29
  { id: 'spectrum', label: 'Electromagnetic spectrum', words: ['Radio', 'Microwave', 'Infrared', 'Visible', 'Ultraviolet', 'X-ray', 'Gamma'] }, // 30
  { id: 'mohs', label: 'Mohs scale', words: ['Calcite', 'Fluorite', 'Apatite', 'Quartz', 'Topaz', 'Corundum', 'Diamond'] }, // 31
  { id: 'alchemy', label: 'Alchemical metals', words: ['Lead', 'Tin', 'Iron', 'Copper', 'Quicksilver', 'Silver', 'Gold'] }, // 34
  { id: 'numbers', label: 'Number systems', words: ['Natural', 'Integer', 'Rational', 'Real', 'Complex', 'Quaternion', 'Octonion'] }, // 37
  { id: 'hypercubes', label: 'Hypercubes', words: ['Point', 'Line', 'Square', 'Cube', 'Tesseract', 'Penteract', 'Hexeract'] }, // 38
  { id: 'hyperops', label: 'Hyperoperations', words: ['Successor', 'Addition', 'Multiplication', 'Exponentiation', 'Tetration', 'Pentation', 'Hexation'] }, // 39
  { id: 'angels', label: 'Angelic choirs', words: ['Angel', 'Archangel', 'Power', 'Dominion', 'Throne', 'Cherub', 'Seraph'] }, // 41
  { id: 'sefirot', label: 'Kabbalah sefirot', words: ['Malkuth', 'Yesod', 'Netzach', 'Tiferet', 'Chesed', 'Binah', 'Keter'] }, // 42
  { id: 'chakras', label: 'Chakras', words: ['Muladhara', 'Svadhisthana', 'Manipura', 'Anahata', 'Vishuddha', 'Ajna', 'Sahasrara'] }, // 43
  { id: 'chakrasEn', label: 'Chakras (English)', words: ['Root', 'Sacral', 'Solar', 'Heart', 'Throat', 'Third Eye', 'Crown'] }, // 43
  { id: 'greek', label: 'Greek beings', words: ['Nymph', 'Satyr', 'Hero', 'Demigod', 'Olympian', 'Titan', 'Primordial'] }, // 44
  { id: 'champagne', label: 'Champagne bottles', words: ['Magnum', 'Jeroboam', 'Methuselah', 'Salmanazar', 'Balthazar', 'Nebuchadnezzar', 'Melchizedek'] }, // 46
  { id: 'church', label: 'Church hierarchy', words: ['Deacon', 'Priest', 'Monsignor', 'Bishop', 'Archbishop', 'Cardinal', 'Pope'] }, // 47
  { id: 'warships', label: 'Warships', words: ['Cutter', 'Corvette', 'Frigate', 'Destroyer', 'Cruiser', 'Battleship', 'Dreadnought'] }, // 48
  { id: 'military', label: 'Military units', words: ['Squad', 'Platoon', 'Company', 'Battalion', 'Brigade', 'Division', 'Army'] }, // 49
  { id: 'cursus', label: 'Cursus honorum', words: ['Quaestor', 'Aedile', 'Praetor', 'Consul', 'Censor', 'Dictator', 'Imperator'] }, // 50
  { id: 'peerage', label: 'Peerage', words: ['Baron', 'Viscount', 'Earl', 'Marquess', 'Duke', 'King', 'Emperor'] }, // 51
  { id: 'sumo', label: 'Sumo ranks', words: ['Makushita', 'Jūryō', 'Maegashira', 'Komusubi', 'Sekiwake', 'Ōzeki', 'Yokozuna'] }, // 52
  { id: 'belts', label: 'Martial arts belts', words: ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Brown', 'Black'] }, // 53
  { id: 'chess', label: 'Chess', words: ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King', 'Checkmate'] }, // 54
  { id: 'periods', label: 'Geologic periods', words: ['Cambrian', 'Devonian', 'Carboniferous', 'Permian', 'Triassic', 'Jurassic', 'Cretaceous'] }, // 67
  { id: 'creation', label: 'Days of creation', words: ['Light', 'Firmament', 'Land', 'Stars', 'Creatures', 'Man', 'Sabbath'] }, // 69
];
export const RUNG_THEME_BY_ID: Record<string, RungTheme> = Object.fromEntries(RUNG_THEMES.map((t) => [t.id, t]));

/** Rung edges on the measured level (MODEL-NAMING §2, the milestones' LEVEL_KNOTS from Reliable agent up): a forecast
 *  below 6.5 is rung 1 (Agent, the start models), ≥ 15 rung 7 (Superintelligence). */
export const RUNG_EDGES = [6.5, 8.5, 10, 12, 13.5, 15] as const;
export const RUNG_COUNT = RUNG_EDGES.length + 1;

/** Tier conventions: size words of distilled students, largest band first (MODEL-NAMING §7). */
export interface TierSet { id: string; label: string; words: readonly [string, string, string, string] }
export const DEFAULT_TIERS = 'generic';
export const TIER_SETS: readonly TierSet[] = [
  { id: 'generic', label: 'Lite · Mini · Micro · Nano', words: ['lite', 'mini', 'micro', 'nano'] },
  { id: 'speed', label: 'Swift · Flash · Spark · Blink', words: ['swift', 'flash', 'spark', 'blink'] },
  { id: 'size', label: 'Large · Medium · Small · Tiny', words: ['large', 'medium', 'small', 'tiny'] },
];
export const TIER_SET_BY_ID: Record<string, TierSet> = Object.fromEntries(TIER_SETS.map((t) => [t.id, t]));
/** Lower edges of the size bands (student ÷ its base's active parameters): ≥ 1/2, ≥ 1/4, ≥ 1/16, below. */
export const TIER_EDGES = [1 / 2, 1 / 4, 1 / 16] as const;
