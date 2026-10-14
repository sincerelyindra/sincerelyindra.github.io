/*
 * Original explanatory Swin-UNETR walkthrough.
 * Geometry: standard MONAI layout with the report's feature_size=24.
 * Numerical demo: synthetic 8^3 tokens, 4^3 windows, 3 heads, illustrative
 * frozen matrices and rank-8 updates. No trained checkpoint or patient data.
 */
(() => {
  'use strict';
  const N = 8;
  const WINDOW = 4;
  const FEATURES = 24;
  const HEADS = 3;
  const HEAD_DIM = FEATURES / HEADS;
  const RANK = 8;
  const SCALE = 32 / RANK;

  function coordinates(index) {
    return [index % N, Math.floor(index / N) % N, Math.floor(index / (N * N))];
  }
  function indexOf(x, y, z) { return z * N * N + y * N + x; }
  function matrix(rows, cols, seed, amplitude) {
    return Array.from({ length: rows }, (_, row) => Float64Array.from({ length: cols }, (_, col) => {
      const raw = Math.sin((row + 1) * 12.9898 + (col + 1) * 78.233 + seed) * 43758.5453;
      return (2 * (raw - Math.floor(raw)) - 1) * amplitude;
    }));
  }
  function multiply(weights, vector) {
    return Float64Array.from(weights, row => row.reduce((sum, value, i) => sum + value * vector[i], 0));
  }
  function normalized(vector) {
    const mean = vector.reduce((sum, value) => sum + value, 0) / vector.length;
    const variance = vector.reduce((sum, value) => sum + (value - mean) ** 2, 0) / vector.length;
    return Float64Array.from(vector, value => (value - mean) / Math.sqrt(variance + 1e-5));
  }
  function adaptedLinear(weights, a, b, vector, enabled) {
    const base = multiply(weights, vector);
    if (!enabled) return base;
    const update = multiply(b, multiply(a, vector));
    return Float64Array.from(base, (value, i) => value + SCALE * update[i]);
  }
  function softmax(scores) {
    const maximum = Math.max(...scores);
    const exponentials = scores.map(score => Math.exp(score - maximum));
    const total = exponentials.reduce((sum, value) => sum + value, 0);
    return exponentials.map(value => value / total);
  }

  // Full QKV projection has 72 outputs, split into Q/K/V and three 8-D heads.
  const qkvBase = matrix(FEATURES * 3, FEATURES, 1, .22);
  const qkvA = matrix(RANK, FEATURES, 2, .06);
  const qkvB = matrix(FEATURES * 3, RANK, 3, .10);
  const projectionBase = matrix(FEATURES, FEATURES, 4, .18);
  const projectionA = matrix(RANK, FEATURES, 5, .06);
  const projectionB = matrix(FEATURES, RANK, 6, .10);
  const tokens = Array.from({ length: N ** 3 }, (_, index) => {
    const [x, y, z] = coordinates(index);
    return normalized(Float64Array.from({ length: FEATURES }, (_, channel) =>
      Math.sin((x + 1) * (channel % 4 + 1) * .35)
      + Math.cos((y + 1) * (channel % 5 + 1) * .28)
      + Math.sin((z + 1) * (channel % 3 + 1) * .41 + channel * .17)
    ));
  });
  const qkvCache = {
    base: tokens.map(token => adaptedLinear(qkvBase, qkvA, qkvB, token, false)),
    lora: tokens.map(token => adaptedLinear(qkvBase, qkvA, qkvB, token, true))
  };

  function windowGroup(coordinate, shifted) {
    // This nonwrapped grouping is equivalent to cyclic shifting followed by
    // the boundary mask. It never joins the original opposite volume edges.
    return Math.floor((coordinate - (shifted ? WINDOW / 2 : 0)) / WINDOW);
  }
  function neighborsOf(queryIndex, shifted) {
    const queryGroup = coordinates(queryIndex).map(value => windowGroup(value, shifted));
    const neighbors = [];
    for (let index = 0; index < N ** 3; index++) {
      if (coordinates(index).every((value, axis) => windowGroup(value, shifted) === queryGroup[axis])) neighbors.push(index);
    }
    return neighbors;
  }
  function computeAttention(queryIndex, shifted, useLoRA) {
    const neighbors = neighborsOf(queryIndex, shifted);
    const qkv = useLoRA ? qkvCache.lora : qkvCache.base;
    const weights = [];
    const combined = new Float64Array(FEATURES);
    for (let head = 0; head < HEADS; head++) {
      const offset = head * HEAD_DIM;
      const scores = neighbors.map(index => {
        let dot = 0;
        for (let dim = 0; dim < HEAD_DIM; dim++) dot += qkv[queryIndex][offset + dim] * qkv[index][FEATURES + offset + dim];
        return dot / Math.sqrt(HEAD_DIM);
      });
      const probabilities = softmax(scores);
      const allWeights = new Float64Array(N ** 3);
      neighbors.forEach((index, neighborIndex) => {
        const weight = probabilities[neighborIndex];
        allWeights[index] = weight;
        for (let dim = 0; dim < HEAD_DIM; dim++) combined[offset + dim] += weight * qkv[index][2 * FEATURES + offset + dim];
      });
      weights.push(allWeights);
    }
    return {
      neighbors, weights,
      output: adaptedLinear(projectionBase, projectionA, projectionB, combined, useLoRA)
    };
  }
  function outputDistance(a, b) {
    return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
  }

  // Pure numerical functions remain usable by the local verification script.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { coordinates, indexOf, neighborsOf, softmax, computeAttention, outputDistance, adaptedLinear };
  }
  if (typeof document === 'undefined') return;
  const lab = document.getElementById('swin-architecture');
  if (!lab) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tensor = (channels, size) => `[1, ${channels}, ${size}, ${size}, ${size}]`;
  const stages = [
    { title: 'Four modalities, one 3D tensor.', input: tensor(4, 64), output: tensor(4, 64), operation: 'Choose crop or resize',
      text: 'Either the tumor-centered crop or the whole-volume resize produces a 64³ input with four channels. These are separate experimental pipelines, not two simultaneous network branches.', source: 'Project report: §§3.2 and 4.1.2.' },
    { title: 'Embed small 3D neighborhoods.', input: tensor(4, 64), output: tensor(24, 32), operation: '2³ patch embedding · stride 2',
      text: 'The standard patch embedding maps each 2 × 2 × 2 input neighborhood into 24 features. Spatial resolution becomes 32³. A convolutional branch from the original 64³ input supplies the full-resolution decoder skip.', source: 'Standard MONAI layout with the report’s feature size 24; internal patch settings are not reported.' },
    { title: 'Swin stage 1: attend, then merge.', input: tensor(24, 32), output: tensor(48, 16), operation: '2 blocks · 3 heads · merge',
      text: 'In the standard configuration, attention operates on the 32³ token grid through regular and shifted windows. LoRA adapts QKV and attention projection. Merging halves each spatial axis and doubles channels to 48. The pre-stage 32³ embedding is retained for its decoder skip.', source: 'Project report: LoRA targets and settings. Standard MONAI: two-block stage, head count, and feature sizes.' },
    { title: 'Swin stage 2: build a coarser representation.', input: tensor(48, 16), output: tensor(96, 8), operation: '2 blocks · 6 heads · merge',
      text: 'Attention now operates at 16³ with 48 channels. The regular/shifted partition pair exchanges information across nearby window boundaries; merging produces an 8³ grid with 96 channels. A residual convolutional block processes the incoming 16³ skip features.', source: 'Standard MONAI stage and skip layout; project report supplies the LoRA configuration.' },
    { title: 'Swin stage 3: context at a smaller grid.', input: tensor(96, 8), output: tensor(192, 4), operation: '2 blocks · 12 heads · merge',
      text: 'The standard stage attends on the 8³ representation, then merges to 4³ with 192 channels. These 4³ features are retained as the first decoder skip. Grid sizes describe feature tensors, not tumor dimensions or segmentation measurements.', source: 'Standard MONAI feature hierarchy derived from feature_size=24.' },
    { title: 'Swin stage 4 and the bottleneck.', input: tensor(192, 4), output: tensor(384, 2), operation: '24 heads · merge · residual conv',
      text: 'Stage 4 operates on 4³ features. MONAI reduces the nominal 7³ attention window to this smaller grid and disables its shift. The final merge produces 2³ × 384; a residual convolutional block refines this bottleneck before decoding.', source: 'Standard MONAI window-size adjustment and bottleneck. These internal settings are not independently verified project settings.' },
    { title: 'Decode to 4³ and recover an encoder skip.', input: tensor(384, 2), output: tensor(192, 4), operation: 'Upsample ×2 · concatenate · conv',
      text: 'A transposed convolution upsamples the bottleneck to 4³. The matching 4³ encoder feature is concatenated along the channel dimension, and residual convolutions refine the fused representation. This skip is direct in the standard layout.', source: 'Standard MONAI decoder5 and its 4³ skip.' },
    { title: 'Decode to 8³ with convolutional skip features.', input: tensor(192, 4), output: tensor(96, 8), operation: 'Upsample ×2 · concatenate · conv',
      text: 'The decoder doubles each spatial dimension to 8³ and fuses the 96-channel encoder skip after its residual convolutional block. Skip fusion combines the evolving decoder context with features preserved at the matching resolution.', source: 'Standard MONAI decoder4 and encoder4.' },
    { title: 'Decode to 16³.', input: tensor(96, 8), output: tensor(48, 16), operation: 'Upsample ×2 · concatenate · conv',
      text: 'Upsampling restores a 16³ grid. The convolutionally processed 16³ encoder skip joins the decoder through channel concatenation. Residual convolutions produce 48 output features per spatial location.', source: 'Standard MONAI decoder3 and encoder3.' },
    { title: 'Decode to 32³.', input: tensor(48, 16), output: tensor(24, 32), operation: 'Upsample ×2 · concatenate · conv',
      text: 'The decoder returns to 32³ with 24 channels. Its matching skip comes from the patch embedding output, passed through a residual convolutional block. It is not the output of the first stage’s patch merge.', source: 'Standard MONAI decoder2 and encoder2; the skip uses hidden_states_out[0].' },
    { title: 'Return to the 64³ input resolution.', input: tensor(24, 32), output: tensor(24, 64), operation: 'Upsample ×2 · input conv skip',
      text: 'The last upsampling block fuses a full-resolution residual convolutional branch of the original four-channel MRI input. This restores a 64³ grid with 24 features per voxel, ready for the segmentation head.', source: 'Standard MONAI decoder1 and encoder1.' },
    { title: 'Three voxel-wise logits, three binary targets.', input: tensor(24, 64), output: tensor(3, 64), operation: '1³ convolution · independent sigmoids',
      text: 'The head maps each voxel’s 24 features to WT, TC, and ET logits. Independent sigmoid probabilities suit these overlapping targets; a class softmax would impose mutual exclusivity. The report supervises them with 0.5 Dice loss + 0.5 BCE loss.', source: 'Project report: targets and loss. Standard MONAI: final 1 × 1 × 1 head.' }
  ];
  let currentStage = 0;
  let playing = !reducedMotion.matches;
  let automaticShifts = !reducedMotion.matches;
  let flowInView = false;
  let attentionInView = false;
  let frameId = 0;
  let lastFlowTime = 0;
  let lastShiftTime = 0;
  const nodes = [...lab.querySelectorAll('[data-swin-stage]')];
  const playButton = document.getElementById('swin-play');
  const stageSelect = document.getElementById('swin-stage');
  const shiftPlayButton = document.getElementById('swin-window-play');

  function renderStage(announce = false) {
    const stage = stages[currentStage];
    nodes.forEach((node, index) => {
      node.classList.toggle('is-selected', index === currentStage);
      node.setAttribute('aria-pressed', String(index === currentStage));
    });
    lab.querySelectorAll('[data-flow]').forEach(path => path.classList.toggle('is-active', Number(path.dataset.flow) === currentStage));
    lab.querySelectorAll('[data-skip]').forEach(path => path.classList.toggle('is-active', Number(path.dataset.skip) === currentStage));
    document.getElementById('swin-inspector-title').textContent = stage.title;
    document.getElementById('swin-inspector-text').textContent = stage.text;
    document.getElementById('swin-tensor-in').textContent = stage.input;
    document.getElementById('swin-tensor-out').textContent = stage.output;
    document.getElementById('swin-operation').textContent = stage.operation;
    document.getElementById('swin-stage-source').textContent = stage.source;
    document.getElementById('swin-step-count').textContent = `${String(currentStage + 1).padStart(2, '0')} / 12`;
    document.getElementById('swin-progress').style.width = `${(currentStage + 1) / stages.length * 100}%`;
    stageSelect.value = String(currentStage);
    if (announce) document.getElementById('swin-announcement').textContent = `${currentStage + 1} of 12. ${stage.title} Output ${stage.output}.`;
  }
  function setPlaying(value) {
    playing = value;
    lastFlowTime = 0;
    playButton.textContent = playing ? 'Pause flow' : 'Play flow';
    playButton.setAttribute('aria-pressed', String(playing));
    lab.classList.toggle('is-playing', playing);
    document.getElementById('swin-live-status').textContent = playing ? 'Live walkthrough' : 'Walkthrough paused';
    syncAnimation();
  }
  function selectStage(index) {
    currentStage = (index + stages.length) % stages.length;
    setPlaying(false);
    renderStage(true);
  }
  nodes.forEach((node, index) => {
    node.disabled = false;
    node.addEventListener('click', () => selectStage(index));
  });
  playButton.addEventListener('click', () => setPlaying(!playing));
  document.getElementById('swin-prev').addEventListener('click', () => selectStage(currentStage - 1));
  document.getElementById('swin-next').addEventListener('click', () => selectStage(currentStage + 1));
  document.getElementById('swin-reset').addEventListener('click', () => selectStage(0));
  stageSelect.addEventListener('change', () => selectStage(Number(stageSelect.value)));
  document.getElementById('swin-controls').hidden = false;
  renderStage();

  const grid = document.getElementById('swin-token-grid');
  const map = document.getElementById('swin-attention-map');
  const depthSlider = document.getElementById('swin-depth');
  const headSelect = document.getElementById('swin-head');
  const loraCheckbox = document.getElementById('swin-lora-enabled');
  const modeButtons = [...lab.querySelectorAll('[data-window-mode]')];
  const svgNamespace = 'http://www.w3.org/2000/svg';
  let queryIndex = indexOf(3, 3, 3);
  let plane = 3;
  let headIndex = 0;
  let shifted = false;
  let useLoRA = true;

  function svgElement(tag, attributes, content) {
    const element = document.createElementNS(svgNamespace, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (content !== undefined) element.textContent = content;
    return element;
  }
  function weightColor(weight, maximum) {
    const ratio = maximum > 0 ? Math.sqrt(weight / maximum) : 0;
    const pale = [237, 243, 230];
    const dark = [23, 77, 71];
    return `rgb(${pale.map((value, i) => Math.round(value + (dark[i] - value) * ratio)).join(',')})`;
  }
  function setAutomaticShifts(value) {
    automaticShifts = value;
    lastShiftTime = 0;
    shiftPlayButton.textContent = value ? 'Pause shifts' : 'Animate shifts';
    shiftPlayButton.setAttribute('aria-pressed', String(value));
    syncAnimation();
  }
  function selectQuery(x, y) {
    setAutomaticShifts(false);
    queryIndex = indexOf(x, y, plane);
    renderAttention();
  }
  const tokenButtons = Array.from({ length: N * N }, (_, index) => {
    const x = index % N;
    const y = Math.floor(index / N);
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => selectQuery(x, y));
    button.addEventListener('keydown', event => {
      let nextX = x;
      let nextY = y;
      if (event.key === 'ArrowLeft') nextX = Math.max(0, x - 1);
      else if (event.key === 'ArrowRight') nextX = Math.min(N - 1, x + 1);
      else if (event.key === 'ArrowUp') nextY = Math.max(0, y - 1);
      else if (event.key === 'ArrowDown') nextY = Math.min(N - 1, y + 1);
      else if (event.key === 'Home') nextX = 0;
      else if (event.key === 'End') nextX = N - 1;
      else return;
      event.preventDefault();
      selectQuery(nextX, nextY);
      tokenButtons[nextY * N + nextX].focus();
    });
    grid.append(button);
    return button;
  });

  function renderAttention() {
    const [queryX, queryY, queryZ] = coordinates(queryIndex);
    const adapted = computeAttention(queryIndex, shifted, true);
    const base = computeAttention(queryIndex, shifted, false);
    const shown = useLoRA ? adapted : base;
    const weights = shown.weights[headIndex];
    const maximum = Math.max(...weights);
    const neighborSet = new Set(shown.neighbors);
    let planeMass = 0;
    const accessibleWeights = [];
    const fragment = document.createDocumentFragment();
    fragment.append(svgElement('title', { id: 'swin-map-title' }, `Head ${headIndex + 1} attention from query (${queryX}, ${queryY}, ${queryZ}) on plane z=${plane}`));
    fragment.append(svgElement('desc', { id: 'swin-map-desc' }, 'Darker cells carry higher weights. Only unmasked window neighbors can receive nonzero weight. The orange outline marks the query when it is on this plane.'));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const index = indexOf(x, y, plane);
        const button = tokenButtons[y * N + x];
        const isQuery = index === queryIndex;
        const isNeighbor = neighborSet.has(index);
        const groupX = windowGroup(x, shifted);
        const groupY = windowGroup(y, shifted);
        button.classList.toggle('is-query', isQuery);
        button.classList.toggle('is-neighbor', isNeighbor);
        button.classList.toggle('window-left', x === 0 || windowGroup(x - 1, shifted) !== groupX);
        button.classList.toggle('window-right', x === N - 1 || windowGroup(x + 1, shifted) !== groupX);
        button.classList.toggle('window-top', y === 0 || windowGroup(y - 1, shifted) !== groupY);
        button.classList.toggle('window-bottom', y === N - 1 || windowGroup(y + 1, shifted) !== groupY);
        button.tabIndex = x === queryX && y === queryY ? 0 : -1;
        button.setAttribute('aria-pressed', String(isQuery));
        button.setAttribute('aria-label', `Token x ${x}, y ${y}, z ${plane}${isQuery ? ', selected query' : ''}${isNeighbor ? ', same attention window' : ''}`);
        const intensity = (Math.sin(x * .7 + plane * .3) + Math.cos(y * .6 - plane * .2) + 2) / 4;
        button.style.setProperty('--token-fill', `rgb(${Math.round(214 - intensity * 50)},${Math.round(230 - intensity * 36)},${Math.round(202 - intensity * 47)})`);
        const weight = weights[index];
        planeMass += weight;
        if (weight > 0) accessibleWeights.push(`(${x},${y},${plane}): ${weight.toFixed(5)}`);
        const rectangle = svgElement('rect', { x: x * 40 + 2, y: y * 40 + 2, width: 36, height: 36, rx: 2, fill: weightColor(weight, maximum), stroke: isQuery ? '#b37b32' : '#d9e3d4', 'stroke-width': isQuery ? 2.5 : 1 });
        rectangle.append(svgElement('title', {}, `Token (${x}, ${y}, ${plane}): attention ${weight.toFixed(6)}${isQuery ? ' · query' : ''}`));
        fragment.append(rectangle);
      }
    }
    map.replaceChildren(fragment);
    map.setAttribute('aria-label', `Attention weights, head ${headIndex + 1}, plane z ${plane}. Nonzero weights: ${accessibleWeights.join('; ') || 'none on this plane'}.`);
    const ranges = [0, 1, 2].map(axis => {
      const values = shown.neighbors.map(index => coordinates(index)[axis]);
      return `${['x', 'y', 'z'][axis]} ${Math.min(...values)}–${Math.max(...values)}`;
    });
    document.getElementById('swin-query-summary').textContent = `Query (${queryX}, ${queryY}, ${queryZ}) · ${shifted ? 'shifted' : 'regular'} windows · neighbors: ${ranges.join(', ')}. Viewing z=${plane}, head ${headIndex + 1}; LoRA ${useLoRA ? 'enabled' : 'disabled'}.`;
    document.getElementById('swin-neighbor-count').textContent = String(shown.neighbors.length);
    document.getElementById('swin-weight-sum').textContent = weights.reduce((sum, value) => sum + value, 0).toFixed(6);
    document.getElementById('swin-plane-mass').textContent = planeMass.toFixed(4);
    document.getElementById('swin-lora-delta').textContent = useLoRA ? outputDistance(adapted.output, base.output).toFixed(4) : '0.0000';
    document.getElementById('swin-weight-max').textContent = maximum.toFixed(4);
    document.getElementById('swin-depth-value').textContent = String(plane);
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String((button.dataset.windowMode === 'shifted') === shifted)));
  }
  modeButtons.forEach(button => button.addEventListener('click', () => {
    setAutomaticShifts(false);
    shifted = button.dataset.windowMode === 'shifted';
    renderAttention();
  }));
  loraCheckbox.addEventListener('change', () => {
    setAutomaticShifts(false);
    useLoRA = loraCheckbox.checked;
    renderAttention();
  });
  depthSlider.addEventListener('input', () => {
    setAutomaticShifts(false);
    plane = Number(depthSlider.value);
    renderAttention();
  });
  headSelect.addEventListener('change', () => {
    setAutomaticShifts(false);
    headIndex = Number(headSelect.value);
    renderAttention();
  });
  shiftPlayButton.addEventListener('click', () => setAutomaticShifts(!automaticShifts));
  document.getElementById('swin-attention-ui').hidden = false;
  renderAttention();

  function wantsAnimation() {
    return !document.hidden && ((playing && flowInView) || (automaticShifts && attentionInView));
  }
  function animationTick(now) {
    frameId = 0;
    if (playing && flowInView) {
      if (!lastFlowTime) lastFlowTime = now;
      if (now - lastFlowTime >= 1800) {
        currentStage = (currentStage + 1) % stages.length;
        renderStage();
        lastFlowTime = now;
      }
    }
    if (automaticShifts && attentionInView) {
      if (!lastShiftTime) lastShiftTime = now;
      if (now - lastShiftTime >= 2600) {
        shifted = !shifted;
        renderAttention();
        lastShiftTime = now;
      }
    }
    if (wantsAnimation()) frameId = window.requestAnimationFrame(animationTick);
  }
  function syncAnimation() {
    if (wantsAnimation() && !frameId) frameId = window.requestAnimationFrame(animationTick);
    else if (!wantsAnimation() && frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }
  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target.id === 'swin-board') {
          flowInView = entry.isIntersecting;
          lab.classList.toggle('is-in-view', flowInView);
          lastFlowTime = 0;
        } else {
          attentionInView = entry.isIntersecting;
          lastShiftTime = 0;
        }
      });
      syncAnimation();
    }, { threshold: .08 });
    visibility.observe(document.getElementById('swin-board'));
    visibility.observe(document.getElementById('swin-attention-ui'));
  } else {
    flowInView = true;
    attentionInView = true;
    lab.classList.add('is-in-view');
  }
  document.addEventListener('visibilitychange', () => {
    lastFlowTime = 0;
    lastShiftTime = 0;
    syncAnimation();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      setPlaying(false);
      setAutomaticShifts(false);
    }
  });
  setPlaying(playing);
  setAutomaticShifts(automaticShifts);
})();
