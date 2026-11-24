// Day-369 save (designer's playtest). L0 shell from _shell.ts; product values from _data.ts → data369.json, then the
// market redesign's rules applied by hand. Provenance of every number: DATA.md.
window.SHELL = {
  date: 'Jul 5, 2026', day: 369, speed: '13.0',
  lead: '195 d', leadWord: 'ahead of', leadColor: 'var(--good)', rival: 'DeepCent', cash: '$97.6B', runway: '3 qtrs', loc: '< 0.1%', locModel: '',
  alertCount: 10, alertText: '5 research · 5 other',
  badges: { lab: null, research: null, training: null, safety: null },
};

// Model skill (believed work skill) on the lineup bars: 0% = Atlas-2.0-mini-mini, 100% = Atlas-4.0.
window.SKILL = {
  'Atlas-4.0': 100, 'Atlas-4.0-mini': 71, 'Atlas-4.0-mini-mini': 43, 'Atlas-3.0': 69, 'Atlas-3.0-mini': 41, 'Atlas-3.0-mini-mini': 12,
  'Atlas-2.0': 57, 'Atlas-2.0-mini': 29, 'Atlas-2.0-mini-mini': 0,
};

window.MKT = {
  total: { profit: 62.0, revenue: 83.3, cost: 21.2 },
  pool: { served: '1.17M', need: '1.76M', short: '0.59M', pct: 66.5, away: 10.5 },
  share: { now: 35, tgt: 31, rival: 'DeepCent', rv: 27, time: '~16 mo' },
  products: [
    { id: 'ent', name: 'Enterprise', icon: 'building-2', sells: 'large firms',
      profit: 34.4, revenue: 54.3, cost: 19.9, margin: 63,
      cust: ['17.1B', 'hours of work a year'], price: '$3.18', per: 'per hour',
      need: '1.65M', served: '1.10M', pct: 66.5, away: '$9.1B',
      stance: 'profit',
      lineup: [
        { name: 'Atlas-3.0', share: 76 },
        { name: 'Atlas-3.0-mini', share: 24 },
      ],
      tools: [['Research agent', 'telescope', 'Finance'], ['Clinical assistant', 'stethoscope', 'Healthcare'], ['Back-office agent', 'clipboard-list', 'Government'], ['Memory', 'brain-circuit']],
      more: 6, more2: 7 },
    { id: 'chat', name: 'Chat', icon: 'message-circle', sells: 'the public',
      profit: 25.0, revenue: 25.6, cost: 0.56, margin: 98,
      cust: ['1.64B', 'weekly users · 96.8M pay'], price: '$22', per: 'per month',
      need: '44.6k', served: '30.7k', pct: 69, freeLimited: true,
      stance: 'profit', atCap: true,
      lineup: [
        { name: 'Atlas-3.0-mini', serves: 'paying users' },
        { name: 'Atlas-3.0-mini-mini', serves: 'free users' },
      ],
      tools: [['Memory', 'brain-circuit'], ['Voice & vision', 'eye'], ['Companion', 'heart']],
      more: 1, more2: 7 },
    { id: 'api', name: 'API', icon: 'square-terminal', sells: 'small firms & developers',
      profit: 1.89, revenue: 2.46, cost: 0.57, margin: 77,
      cust: ['936M', 'hours of work a year'], price: '$2.63', per: 'per hour',
      need: '48.4k', served: '31.7k', pct: 65.5, away: '$1.3B',
      stance: 'profit',
      lineup: [
        { name: 'Atlas-2.0', share: 66 },
        { name: 'Atlas-2.0-mini', share: 34 },
      ],
      tools: [['Coding harness', 'code'], ['Computer use', 'mouse-pointer-2'], ['Voice & vision', 'eye']],
      more: 4, more2: 7 },
    { id: 'vet', name: 'Vetted', icon: 'shield-check', sells: 'government, military, critical infrastructure, regulated firms',
      profit: 0.72, revenue: 0.96, cost: 0.23, margin: 76,
      cust: ['358M', 'hours of work a year'], price: '$2.68', per: 'per hour',
      need: '19.4k', served: '13.0k', pct: 67, away: '$85M',
      stance: 'profit',
      lineup: [
        { name: 'Atlas-3.0', share: 73 },
        { name: 'Atlas-3.0-mini', share: 27 },
        { name: 'Atlas-2.0-mini', share: 0 },
      ],
      tools: [['Defence & intelligence suite', 'shield', 'Military']],
      more: 9, more2: 6, terms: true },
  ],
  // Enterprise › Atlas-3.0-mini: what each replacement would change, a year from now at today's buyers (lineup-swap state)
  swap: {
    product: 'ent', model: 'Atlas-3.0-mini',
    opts: [
      { name: 'Atlas-4.0-mini', tag: 'new', cost: '×1.25', profit: '+$7.7B', hours: '+3.8B h', compute: '−0.75M', note: 'all buyers served', good: true },
      { name: 'Atlas-4.0-mini-mini', tag: 'new', cost: '×0.16', profit: '+$4.1B', hours: '+2.0B h', compute: '−0.18M', good: true },
      { name: 'Atlas-2.0-mini', cost: '×0.70', profit: '−$1.1B', hours: '−0.6B h', compute: '+0.06M' },
      { name: 'Atlas-3.0-mini-mini', cost: '×0.13', profit: '−$2.5B', hours: '−1.3B h', compute: '+0.13M' },
    ],
    remove: { profit: '−$7.2B', hours: '−3.6B h', compute: '+0.23M' },
  },
};
