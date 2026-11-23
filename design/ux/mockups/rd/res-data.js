// RESEARCH › Portfolio data, day-400 fixture (data400.json C.*). Provenance: DATA.md.
(function () {
  const u = (t) => `<u>${t}</u>`;
  const eff = (v, area, lo, hi) => `<b class="n">+${v}%</b> ${u(area)} <span class="rg">(${lo}–${hi}%)</span>`;
  const ret = (x) => `${u('returns falling')} <b>×${x}</b>`;
  const out = (w) => `<span class="olk ${w}">${w}</span>`;
  window.D.res = {
    limited: [{ cls: 'on', word: 'Limits most' }, { cls: 'mid', word: 'Spare teams' }, { cls: '', word: 'Enough' }, { cls: '', word: 'Not limiting' }],
    teams: [10, 2],
    capSub: '10 teams · 6 programmes',
    safSub: '2 teams · 1 of 18 programmes staffed',
    cards: [
      { side: 'cap', name: 'Scaling recipes', icon: 'layers', field: 'Pretraining', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.03, eta: 10, eff: eff('1.3', 'pretraining recipe', '0.7', '1.9'), odds: ret('0.75'), teams: 2, wanted: 2 },
      { side: 'cap', name: 'Environments & rewards', icon: 'wand-sparkles', field: 'Post-training', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.18, eta: 8, eff: eff('0.9', 'post-training ceiling', '0.7', '1.2'), odds: ret('0.73'), teams: 3, wanted: 3 },
      { side: 'cap', name: 'Data filtering & mixing', icon: 'layers', field: 'Pretraining', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.29, eta: 7, eff: eff('1.3', 'pretraining recipe', '0.7', '1.9'), odds: ret('0.72'), teams: 1, wanted: 1 },
      { side: 'cap', name: 'Optimizer & architecture tweaks', icon: 'layers', field: 'Pretraining', kind: 'ongoing', out: 'capability', track: 'programme', stage: 1, prog: 0.54, eta: 14, eff: eff('3.7', 'pretraining recipe', '0.7', '6.7'), odds: ret('0.87'), teams: 1, wanted: 1, sel: true },
      { side: 'cap', name: 'RL algorithms', icon: 'wand-sparkles', field: 'Post-training', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.72, eta: 3, eff: eff('1.6', 'post-training method', '1.2', '2.1'), odds: ret('0.51'), teams: 2, wanted: 2 },
      { side: 'cap', name: 'Inference efficiency', icon: 'circuit-board', field: 'Systems', kind: 'ongoing', out: 'capability', track: 'programme', stage: 2, prog: 0.63, eta: 4, eff: eff('3.8', 'serving efficiency', '2.6', '5.2'), odds: ret('0.43'), teams: 1, wanted: 1 },
      { side: 'cap', name: 'Multi-agent orchestration', icon: 'circuit-board', field: 'Systems', kind: 'one-off', out: 'capability', track: 'project', failed: `Failed in test · retry at lower odds: ${u('chance it works')} <b class="n w">24%</b>`, teams: 0, wanted: 3 },
      { side: 'saf', name: 'Applied interp', icon: 'scan-search', field: 'Interpretability', kind: 'ongoing', out: 'see', track: 'safety', stage: 2, prog: 0.02, eta: 47, eff: `<b>new instrument</b>: Deception probe`, odds: `${u('outlook')} ${out('Mixed')}`, teams: 2, wanted: 2, lim: 'research engineers' },
      { side: 'saf', name: 'Model organisms & evals', icon: 'list-checks', field: 'Evals & control', kind: 'ongoing', out: 'see', track: 'safety', stage: -1, prog: 0, eta: 0, eff: `<b>new instrument</b>: Auditing agents`, odds: `${u('outlook')} ${out('Promising')}`, teams: 0, wanted: 1, dim: true },
      { side: 'saf', name: 'AI control', icon: 'list-checks', field: 'Evals & control', kind: 'ongoing', out: 'stop', track: 'safety', stage: -1, prog: 0, eta: 0, eff: `<b>new safeguard</b>: Comms lockdown`, odds: `${u('outlook')} ${out('Promising')}`, teams: 0, wanted: 1, dim: true },
      { side: 'saf', name: 'CoT monitorability', icon: 'list-checks', field: 'Evals & control', kind: 'ongoing', out: 'see', track: 'safety', stage: -1, prog: 0, eta: 0, eff: `<b>new instrument</b>: Monitorability suite`, odds: `${u('outlook')} ${out('Promising')}`, teams: 0, wanted: 1, dim: true },
    ],
    safMore: { n: 14, mixed: 8, struggling: 6 },
  };
})();
