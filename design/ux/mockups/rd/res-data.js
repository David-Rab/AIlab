// RESEARCH › Portfolio data, day-400 fixture (data400.json C.*). Provenance: DATA.md.
// Capability effects are shown where they land: the next model's effective compute in that know-how area (× = 10^OOM).
(function () {
  const u = (t) => `<u>${t}</u>`;
  const lands = (where, x, what) => `<span class="t3">${where}</span> <b class="n">×${x}</b> ${u(what)}`;
  const ret = (w) => `<span class="t3">results now</span> <b>~${w}</b> <span class="t3">of the first</span>`;
  const out = (w) => `<span class="olk ${w}">${w}</span>`;
  window.D.res = {
    limited: [{ cls: 'on', word: 'Limits most' }, { cls: 'mid', word: 'Spare teams' }, { cls: '', word: 'Enough' }, { cls: '', word: 'Not limiting' }],
    teams: [10, 2],
    capSub: '10 teams · 6 programmes',
    safSub: '2 teams · 1 of 18 programmes staffed',
    cards: [
      { side: 'cap', name: 'Scaling recipes', icon: 'layers', field: 'Pretraining', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.03, eta: 10, eff: lands('next base model', '1.013', 'pretraining compute'), odds: '', ret: ret('¾'), teams: 2, wanted: 2 },
      { side: 'cap', name: 'Environments & rewards', icon: 'wand-sparkles', field: 'Post-training', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.18, eta: 8, eff: lands('next post-training', '1.009', 'post-training ceiling'), odds: '', ret: ret('¾'), teams: 3, wanted: 3 },
      { side: 'cap', name: 'Data filtering & mixing', icon: 'layers', field: 'Pretraining', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.29, eta: 7, eff: lands('next base model', '1.013', 'pretraining compute'), odds: '', ret: ret('¾'), teams: 1, wanted: 1 },
      { side: 'cap', name: 'Optimizer & architecture tweaks', icon: 'layers', field: 'Pretraining', kind: 'ongoing', out: 'capability', track: 'programme', stage: 1, prog: 0.54, eta: 14, eff: lands('next base model', '1.037', 'pretraining compute'), odds: '', ret: ret('⅞'), teams: 1, wanted: 1, sel: true },
      { side: 'cap', name: 'Post-training algorithms', icon: 'wand-sparkles', field: 'Post-training', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.72, eta: 3, eff: lands('next post-training', '1.016', 'post-training compute'), odds: '', ret: ret('½'), teams: 2, wanted: 2 },
      { side: 'cap', name: 'Faster serving', icon: 'circuit-board', field: 'Systems', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.63, eta: 4, eff: lands('serving', '1.038', 'work per chip'), odds: '', ret: ret('⅖'), teams: 1, wanted: 1 },
      { side: 'cap', name: 'Coordinating many copies', icon: 'circuit-board', field: 'Systems', kind: 'one-off', out: 'capability', track: 'project', failed: `Failed in test · retry at lower odds: ${u('chance it works')} <b class="n w">24%</b>`, teams: 0, wanted: 3 },
      { side: 'saf', name: 'Applied interpretability', icon: 'scan-search', field: 'Interpretability', kind: 'ongoing', out: 'see', track: 'safety', stage: 2, prog: 0.02, eta: 47, eff: `<span class="t3">new</span> ${u('instrument')}: <b>Deception probe</b>`, odds: `${u('outlook')} ${out('Mixed')}`, teams: 2, wanted: 2, lim: 'research engineers' },
      { side: 'saf', name: 'Model organisms & evals', icon: 'list-checks', field: 'Evals & control', kind: 'ongoing', out: 'see', track: 'safety', stage: -1, prog: 0, eta: 0, eff: `<span class="t3">new</span> ${u('instrument')}: <b>AI auditors</b>`, odds: `${u('outlook')} ${out('Promising')}`, teams: 0, wanted: 1, dim: true },
      { side: 'saf', name: 'Control protocols', icon: 'list-checks', field: 'Evals & control', kind: 'ongoing', out: 'stop', track: 'safety', stage: -1, prog: 0, eta: 0, eff: `<span class="t3">new</span> ${u('safeguard')}: <b>Comms lockdown</b>`, odds: `${u('outlook')} ${out('Promising')}`, teams: 0, wanted: 1, dim: true },
      { side: 'saf', name: 'Readable reasoning', icon: 'list-checks', field: 'Evals & control', kind: 'ongoing', out: 'see', track: 'safety', stage: -1, prog: 0, eta: 0, eff: `<span class="t3">new</span> ${u('instrument')}: <b>Reasoning-readability evals</b>`, odds: `${u('outlook')} ${out('Promising')}`, teams: 0, wanted: 1, dim: true },
    ],
    safMore: { n: 14, mixed: 8, struggling: 6 },
  };
})();
