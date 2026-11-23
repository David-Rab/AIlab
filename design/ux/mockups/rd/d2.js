// Day-400 fixture data for TRAINING, Know-how, SAFETY › Risks, MODELS (data400b.json from _data2.ts). Provenance: DATA.md.
(function () {
  const DOM = [
    ['CODE', 'Code', 'code-xml'], ['RSCH', 'AI research', 'flask-conical'], ['REASON', 'Math & reasoning', 'lightbulb'], ['AGENCY', 'Long tasks', 'bot'],
    ['SOCIAL', 'Social', 'users-round'], ['MEDIA', 'Media', 'image'], ['CYBER', 'Cyber', 'binary'], ['BIO', 'Bio', 'dna'], ['PHYS', 'Physical', 'atom'],
  ];
  // Atlas-2.8 measured (models.cards Atlas-2.8 .domains, fitted) and the default plan's prediction (training.plans.base.prediction.domains)
  const now = { CODE: [6.72, 6.56, 6.88], RSCH: [3.57, 3.41, 3.73], REASON: [3.91, 3.75, 4.07], AGENCY: [6.93, 6.77, 7.09], SOCIAL: [0.15, 0, 0.31], MEDIA: [0.14, 0, 0.30], CYBER: [1.51, 1.35, 1.67], BIO: [0.57, 0.41, 0.73], PHYS: [0.92, 0.76, 1.08] };
  const next = { CODE: [9.36, 9.30, 9.43], RSCH: [6.46, 6.39, 6.52], REASON: [6.58, 6.51, 6.65], AGENCY: [9.81, 9.75, 9.88], SOCIAL: [0.39, 0.32, 0.45], MEDIA: [1.35, 1.29, 1.42], CYBER: [2.76, 2.70, 2.83], BIO: [2.02, 1.95, 2.08], PHYS: [2.20, 2.14, 2.27] };
  window.D2 = {
    DOM,
    ruler: { lo: 0, hi: 13, med: 6.4, best: 10, sup: null },
    rungs: [['Agent', 5, 'Jul 1, 2025'], ['Reliable agent', 6.5, 'Nov 29, 2025'], ['Research agent', 8.5], ['Superhuman coder', 10], ['Superhuman AI researcher', 12], ['Superintelligent AI researcher', 13.5], ['Superintelligence', 15]],
    train: {
      from: 'Atlas-2.8', newBase: 'Atlas-3.0', now, next,
      milestone: 'Research agent', ready: 'Feb 3, 2027', overall: [9.16, 9.05, 9.27],
      sightAtNext: '~3%', sightAtNow: '~40%',
      waiting: '×1.5',
      alt: { name: 'Post-train Atlas-3 only', ready: 'Oct 23, 2026', days: 65, milestone: 'Research agent' },
    },
  };
})();
