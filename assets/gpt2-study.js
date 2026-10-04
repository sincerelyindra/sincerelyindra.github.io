(() => {
  'use strict';
  if (!document.body.classList.contains('gpt-study')) return;

  const stages = {
    embeddings: {
      kicker: 'Embedding the input',
      title: 'A token identity and a position.',
      description: 'Look up each token in E (50,257 × 768) and its position in P (1,024 × 768). Add them to form the initial residual stream. Positions are learned embeddings, not sinusoidal encodings.',
      equation: 'H₀[b, t, :] = E[token_id] + P[t]',
      diagram: false
    },
    decoder: {
      kicker: 'One decoder block',
      title: 'Two sublayers. Two residual paths.',
      description: 'Normalize before each sublayer. Attention mixes information across permitted positions; the GELU MLP transforms each position independently. Each sublayer adds its result to its input.',
      equation: 'U = H + Attention(LN(H))\nH_out = U + MLP(LN(U))',
      diagram: true
    },
    output: {
      kicker: 'From representations to logits',
      title: 'One vocabulary score per token.',
      description: 'Apply the final LayerNorm, then multiply by the transpose of the token embedding matrix E. There is no separate output-weight matrix or output bias. For generation, use the final position’s vocabulary scores.',
      equation: 'logits = LN_final(H₁₂) × Eᵀ\n(B, T, 768) → (B, T, 50,257)',
      diagram: false
    }
  };

  const stageButtons = [...document.querySelectorAll('[data-stage]')];
  const stageKicker = document.getElementById('stage-kicker');
  const stageTitle = document.getElementById('stage-title');
  const stageExplanation = document.getElementById('stage-explanation');
  const stageEquation = document.getElementById('stage-equation');
  const decoderDiagram = document.getElementById('decoder-diagram');
  const setStage = (key) => {
    const stage = stages[key];
    if (!stage) return;
    stageButtons.forEach((button) => {
      const selected = button.dataset.stage === key;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
    });
    stageKicker.textContent = stage.kicker;
    stageTitle.textContent = stage.title;
    stageExplanation.textContent = stage.description;
    stageEquation.replaceChildren();
    const code = document.createElement('code');
    stage.equation.split('\n').forEach((line, index) => {
      if (index) code.append(document.createElement('br'));
      code.append(document.createTextNode(line));
    });
    stageEquation.append(code);
    decoderDiagram.hidden = !stage.diagram;
  };
  stageButtons.forEach((button) => button.addEventListener('click', () => setStage(button.dataset.stage)));

  const subscripts = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇'];
  const tokenSymbol = (n) => `x${subscripts[n]}`;
  const querySlider = document.getElementById('query-position');
  const queryValue = document.getElementById('query-value');
  const queryRows = [...document.querySelectorAll('[data-query]')];
  const queryTitle = document.getElementById('mask-query-title');
  const readable = document.getElementById('mask-readable');
  const prediction = document.getElementById('mask-prediction');
  const updateMask = () => {
    const query = Number(querySlider.value);
    queryValue.value = String(query);
    querySlider.setAttribute('aria-valuetext', `Position ${query}; can attend to keys 1 through ${query}`);
    queryRows.forEach((row) => row.classList.toggle('is-query', Number(row.dataset.query) === query));
    queryTitle.textContent = query === 1 ? 'Position 1 can read only itself.' : `Position ${query} can read 1–${query}.`;
    const masked = Array.from({ length: 6 - query }, (_, i) => query + i + 1);
    if (masked.length === 0) readable.textContent = 'All six keys are visible. There are no future positions in this example.';
    else if (masked.length === 1) readable.textContent = `Key ${masked[0]} is masked. Its attention probability is zero.`;
    else readable.textContent = `Keys ${masked.join(', ').replace(/, ([^,]+)$/, ' and $1')} are masked. Their attention probability is zero.`;
    const prefix = query === 1 ? tokenSymbol(1) : `${tokenSymbol(1)}…${tokenSymbol(query)}`;
    prediction.textContent = `This position predicts token ${tokenSymbol(query + 1)} from the prefix ${prefix}.`;
  };
  querySlider.addEventListener('input', updateMask);
  updateMask();

  const prefix = document.getElementById('generation-prefix');
  const status = document.getElementById('generation-status');
  const stepButton = document.getElementById('generation-step');
  const resetButton = document.getElementById('generation-reset');
  let generated = 0;
  const updateGeneration = () => {
    prefix.replaceChildren();
    for (let n = 1; n <= 3 + generated; n++) {
      const token = document.createElement('span');
      token.className = n > 3 ? 'token generated-token' : 'token';
      token.textContent = tokenSymbol(n);
      prefix.append(token);
    }
    prefix.setAttribute('aria-label', `Current decoding prefix: tokens 1 through ${3 + generated}`);
    if (generated === 3) {
      status.textContent = 'Three tokens appended. In a real decoder, continue until a stopping condition or the context limit is reached.';
      stepButton.textContent = 'Example complete';
    } else {
      status.textContent = `Use the final position’s logits to predict ${tokenSymbol(4 + generated)}, then append it to the prefix.`;
      stepButton.textContent = 'Append one token →';
    }
    stepButton.disabled = generated === 3;
    resetButton.disabled = generated === 0;
  };
  stepButton.addEventListener('click', () => {
    if (generated >= 3) return;
    generated++;
    updateGeneration();
    if (generated === 3) resetButton.focus({ preventScroll: true });
  });
  resetButton.addEventListener('click', () => {
    generated = 0;
    updateGeneration();
    stepButton.focus({ preventScroll: true });
  });

  // Keep reading navigation quiet: only the current section label changes.
  const tocLinks = [...document.querySelectorAll('.study-toc a')];
  const sections = [...document.querySelectorAll('.study-section')];
  if ('IntersectionObserver' in window) {
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      const first = sections.find((section) => visible.has(section.id));
      if (!first) return;
      tocLinks.forEach((link) => {
        if (link.hash === `#${first.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-100px 0px -45% 0px', threshold: 0 });
    sections.forEach((section) => observer.observe(section));
  }
  document.body.classList.add('study-ready');
})();
