// RESEARCH › Discoveries (UI-IA §1): one tree for capability and safety, one lane per field, columns by how far away a
// discovery is (Known · Can start now · One step away · Later). Each node: name, state, one effect (plus a risk mark when
// it has a known downside). Chance it works and size live in the tooltip / drawer. #drawer: L2, Neuralese recurrence.
// Day-400 values: data400a.json tree[] (nodeStatus, nodeOdds, needs) and the probe's projectEta (see DATA-a.md).
(function () {
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const SEL = location.hash === '#drawer' ? 'P17' : null;
  const FIELDS = [
    ['pre', 'Pretraining', 'cap', ['Mixture of experts', 'Dense', 'Quality filter', 'Code & math data', 'Fault-tolerant training']],
    ['post', 'Post-training', 'cap', ['Visible reasoning', 'Agentic environments', 'Hardened graders', 'Engagement tuning', 'Persuasion tuning']],
    ['sys', 'Systems', 'cap', ['Test-time compute', 'Distillation', 'Quantization', 'Speculative decoding', 'Long context + memory']],
    ['ali', 'Alignment', 'saf', ['Constitution / spec', 'Environment hardening', 'Honesty training']],
    ['int', 'Interpretability', 'saf', ['Noise-injection elicitation', 'Linear probes']],
    ['eva', 'Evals & control', 'saf', ['Model organisms', 'Trusted monitoring', 'Misuse classifiers', 'Propensity evals', 'Reasoning monitor']],
  ];
  // [id, field, name, state, tag, effect, risk, needs (names of unmet needs), opens]
  // state: open · res (researching, progress %) · fail · locked
  const N = [
    ['scienceData', 'pre', 'Science data', 'open', 'capability', '+ Bio, Math, AI research', 'more bio misuse uplift'],
    ['multimodal', 'pre', 'Native multimodal', 'open', 'capability', '+ Media, Physical', null, null, 2],
    ['P17', 'pre', 'Neuralese recurrence', 'open', 'capability', '×3.2 effective compute', 'reasoning monitors go blind', null, 1],
    ['P23', 'pre', 'Faithful reasoning', 'open', 'see', 'reasoning stays readable', 'costs ×0.5 effective compute'],
    ['P10', 'pre', 'Synthetic data flywheel', 'open', 'capability', 'better generated data', 'reward models get gamed'],
    ['P12', 'pre', 'Long-work demos', 'open', 'capability', 'long-task environments'],
    ['elastic', 'pre', 'Elastic training', 'open', 'capability', 'training efficiency ×1.05'],
    ['P24', 'pre', 'AI-designed successor', 'locked', 'capability', 'pretraining recipe ×9', 'new lineage, traits unknown', 'Focus: AI research'],
    ['L.latent', 'pre', 'Recurrent architectures', 'locked', 'capability', 'a new ongoing programme', null, 'Neuralese recurrence'],

    ['rl.mlResearch', 'post', 'Focus: AI research', 'open', 'capability', '+ AI research', 'reward hacking, eval awareness', null, 5],
    ['rl.swe', 'post', 'Focus: Code', 'open', 'capability', '+ Code, AI research, Cyber', 'reward-hacking pressure'],
    ['rl.longHorizon', 'post', 'Focus: Long tasks', 'open', 'capability', '+ Long tasks', 'power-seeking pressure'],
    ['rl.math', 'post', 'Focus: Math', 'open', 'capability', '+ Math & reasoning', null, null, 1],
    ['rl.cyber', 'post', 'Focus: Cyber', 'open', 'capability', '+ Cyber', 'cyber-offence warning'],
    ['rl.bio', 'post', 'Focus: Bio', 'open', 'capability', '+ Bio', 'bio-uplift warning'],
    ['P08', 'post', 'Continual learning', 'open', 'capability', 'AI staff model stays current', 'evals go stale', null, 1],
    ['P09', 'post', 'Test-time training', 'open', 'capability', '+ Math & reasoning', 'audits see less'],
    ['P14', 'post', 'Probe-guided training', 'open', 'fix', 'probes steer what training builds'],
    ['P06', 'post', 'Computer use', 'locked', 'capability', '+ Long tasks', 'overreach', 'Native multimodal'],
    ['P11', 'post', 'Self-play curricula', 'locked', 'capability', '+ Math & reasoning, Code', 'verifier hacking', 'Focus: Math'],
    ['P21', 'post', 'Brain-like learning', 'locked', 'capability', 'each token worth ×2', 'evals lag', 'Continual learning, Focus: AI research'],
    ['P18', 'post', 'Distil-and-amplify loop', 'locked', 'capability', 'more post-training per cycle', 'traits grow each cycle', 'Coordinating copies'],

    ['P05', 'sys', 'Coordinating copies', 'fail', 'capability', 'Deep thinking effort', null, null, 1],
    ['P16', 'sys', 'AI-designed kernels', 'locked', 'capability', 'training ×1.15 · serving ×1.33', null, 'Focus: AI research'],
    ['P15', 'sys', 'AI-assisted oversight', 'locked', 'see', 'cheaper red-teaming', null, 'Focus: AI research'],
    ['P22', 'sys', 'Robotics foundation', 'locked', 'capability', '+ Physical', 'physical reach', 'Native multimodal'],
    ['P25', 'sys', 'Formal verification', 'locked', 'stop', 'stronger weight security', null, 'Self-play curricula'],

    ['T-ANTISCHEME', 'ali', 'Anti-scheming training', 'open', 'fix', 'scheming −95% in training'],
    ['T-INOC', 'ali', 'Inoculation prompting', 'open', 'fix', 'less learned cheating'],
    ['T-W2S', 'ali', 'Weak-to-strong training', 'open', 'fix', 'fixes people-pleasing, proxy goals', null, null, 1],
    ['T-FILTER', 'ali', 'Hazard data filtering', 'open', 'fix', 'less bio & cyber hazard', 'weaker Bio, Cyber', null, 1],
    ['safetyPretrain', 'ali', 'Safety pretraining', 'open', 'fix', 'less situational awareness', 'slightly weaker models'],
    ['T-PERSONA', 'ali', 'Persona vectors', 'locked', 'fix', 'fixes people-pleasing, persona', null, 'Activation steering'],
    ['T-UNDO', 'ali', 'Unlearning', 'locked', 'fix', 'removes hazardous skill', null, 'Hazard data filtering'],
    ['T-CAST', 'ali', 'Corrigibility target', 'locked', 'fix', 'models accept correction', null, 'Weak-to-strong training'],

    ['T-DECEPT', 'int', 'Deception probe', 'res', 'see', 'reads faking, scheming, hiding', null, null, 1, 50],
    ['T-STEER', 'int', 'Activation steering', 'open', 'see', 'reads people-pleasing, eval awareness', null, null, 2],
    ['T-SAE', 'int', 'Sparse feature search', 'open', 'see', 'reads persona, scheming', null, null, 2],
    ['T-NLA', 'int', 'Activation verbalizer', 'locked', 'see', 'reads eval awareness, gaming', null, 'Deception probe'],
    ['T-CIRCUIT', 'int', 'Circuit tracing', 'locked', 'see', 'reads scheming, faking, hiding', null, 'Sparse feature search'],
    ['T-PHASE', 'int', 'Training-phase detector', 'locked', 'see', 'spots gaming during training', null, 'Sparse feature search'],
    ['T-EASUP', 'int', 'Eval-awareness damping', 'locked', 'see', 'reads eval awareness', null, 'Activation steering'],
    ['T-ENUM', 'int', 'Enumerative audit', 'locked', 'see', 'reads nearly every critical trait', null, 'Circuit tracing'],

    ['T-AUDIT', 'eva', 'AI auditors', 'open', 'see', 'reads proxy goals, persona, hacking'],
    ['T-HONEY', 'eva', 'Realistic honeypots', 'open', 'see', 'reads power-seeking, faking'],
    ['T-RESAMPLE', 'eva', 'Resample protocols', 'open', 'stop', 'stops power-seeking, scheming', null, null, 1],
    ['T-LOCK', 'eva', 'Comms lockdown', 'open', 'stop', 'stops collusion', null, null, 1],
    ['T-MONSUITE', 'eva', 'Reasoning-readability evals', 'open', 'see', 'spots hidden reasoning'],
    ['T-DEBATE', 'eva', 'Debate', 'open', 'see', 'reads people-pleasing, hacking'],
    ['aar', 'eva', 'AI alignment researchers', 'locked', 'meta', 'AI staff do safety research', null, 'Focus: AI research'],
    ['T-CEVAL', 'eva', 'Control evaluation', 'locked', 'see', 'measures your stop rates', null, 'Resample protocols'],
    ['T-COLLEVAL', 'eva', 'Collusion evals', 'locked', 'see', 'reads collusion', null, 'Comms lockdown'],
    ['T-MAD', 'eva', 'Anomaly detection', 'locked', 'see', 'flags strange internal states', null, 'Circuit tracing'],
    ['T-SCIAI', 'eva', 'Harm guardrail', 'locked', 'stop', 'blocks likely-harmful acts', null, 'Control evaluation'],
    ['T-GATE', 'eva', 'Verified gatekeeper', 'locked', 'stop', 'stops escapes', null, 'Formal verification'],
    ['P27', 'eva', 'AI alignment at scale', 'locked', 'meta', 'more AI safety staff', null, 'AI alignment researchers'],
  ];
  // zone: available = open/res/fail; next = locked with every unmet need available; later = the rest
  const avail = new Set(N.filter((n) => n[3] !== 'locked').map((n) => n[2]));
  const zoneOf = (n) => (n[3] !== 'locked' ? 'a' : n[7].split(', ').every((x) => avail.has(x)) ? 'n' : 'l');
  const icoState = (n) => n[3] === 'res' ? `<span class="ring" style="--p:${n[9]}"></span>` : n[3] === 'fail' ? ic('circle-x', 's12 bad') : n[3] === 'locked' ? ic('lock', 's12 t3') : ic('circle-dashed', 's12 t2');
  const node = (n) => {
    const z = zoneOf(n);
    const cls = `${n[4] === 'capability' ? 'ncap' : 'nsaf'} ${n[3] === 'locked' ? 'locked' : ''} ${n[3] === 'res' ? 'res' : ''} ${n[3] === 'fail' ? 'fail' : ''} ${SEL === n[0] ? 'sel' : ''}`;
    const l2 = n[3] === 'locked'
      ? `${n[4] === 'capability' ? '' : `<span class="tagx ${n[4]}">${n[4]}</span>`}<span class="ef">needs <b>${n[7]}</b></span>`
      : n[3] === 'res' ? `<span class="tagx ${n[4]}">${n[4]}</span><span class="ef" style="color:#cfe3ff">Researching · ~47 d</span>`
      : n[3] === 'fail' ? `<span class="ef bad">Failed · retry at 24%</span>`
      : `${n[4] === 'capability' ? '' : `<span class="tagx ${n[4]}">${n[4]}</span>`}<span class="ef">${n[5]}</span>${n[6] ? `<span class="rk">${ic('triangle-alert', 's12')}</span>` : ''}`;
    return `<div class="nd ${cls}" data-z="${z}"><div class="l1"><span class="si">${icoState(n)}</span><span class="nm">${n[2]}</span>${n[8] && n[3] !== 'locked' ? `<span class="op">${ic('git-branch', 's12')}${n[8]}</span>` : ''}</div><div class="l2">${l2}</div></div>`;
  };
  const lanes = FIELDS.map(([id, name, sph, known]) => {
    const ns = N.filter((n) => n[1] === id);
    const z = (k) => ns.filter((n) => zoneOf(n) === k).map(node).join('');
    return `<div class="lane">
      <div class="fieldn"><span class="sw" style="background:var(--${sph})"></span>${name}</div>
      <div class="known">${known.map((k) => `<span>${ic('check', 's12')}${k}</span>`).join('')}</div>
      <div class="zone z3">${z('a')}</div>
      <div class="zone z2">${z('n')}</div>
      <div class="zone z2">${z('l')}</div>
    </div>`;
  }).join('');
  const cnt = (k) => N.filter((n) => zoneOf(n) === k).length;

  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('flask-conical', 's22')} Research</h1>
    <div class="tabs"><span class="t">Portfolio</span><span class="t on">Discoveries</span><span class="t">Know-how</span></div>
    <div class="sp"></div>
    <span class="legend2">
      <span>${ic('circle-dashed', 's12')}can start</span><span><span class="ring" style="--p:50"></span>researching</span><span>${ic('circle-x', 's12 bad')}failed</span><span>${ic('lock', 's12')}locked</span>
      <span style="margin-left:6px"><span class="tagx capability">capability</span></span><span><span class="tagx see">see</span><span class="tagx stop">stop</span><span class="tagx fix">fix</span> safety</span>
      <span>${ic('triangle-alert', 's12 warn')}has a downside</span>
    </span>
    <span class="seg3"><span class="on">All</span><span>Capability</span><span>Safety</span></span>
  </div>
  <div class="card tree">
    <div class="zh">
      <div>Field</div>
      <div>${ic('circle-check', 's12 good')} Known <b>25</b></div>
      <div>${ic('circle-dashed', 's12')} Can start now <b>${cnt('a')}</b><span style="text-transform:none;letter-spacing:0;font-weight:500;margin-left:6px">· starting one adds it to your <u>Priority list</u></span></div>
      <div>${ic('lock', 's12')} One step away <b>${cnt('n')}</b></div>
      <div>${ic('lock', 's12')} Later <b>${cnt('l')}</b></div>
    </div>
    ${lanes}
  </div>
  ${SEL ? window.DISC_DRAWER || '' : ''}`;
})();
