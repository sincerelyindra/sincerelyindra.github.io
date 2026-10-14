/* Real inference with the exported RouteGenerator2 checkpoint. No synthetic activations. */
(function () {
  'use strict';
  const root = document.getElementById('unet-explorer');
  if (!root) return;
  const base = new URL('../assets/robot-unet/', document.baseURI);
  const runtimeURL = new URL('../vendor/tfjs-4.22.0.min.js', base);
  const $ = id => document.getElementById(id);
  const stages = [
    {name:'c1 · Encoder 1', layer:'activation_1', size:128, channels:16, description:'The first block learns local image patterns at full resolution. Its 16 channels also feed the last decoder block through a skip connection.', operation:'128 × 128 × 3 → [3 × 3 Conv → BN → ReLU] × 2 → 128 × 128 × 16'},
    {name:'c2 · Encoder 2', layer:'activation_3', size:64, channels:32, description:'A 2 × 2 max pool halves the image dimensions. Two convolutions then learn 32 feature channels; the skip connection preserves this 64 × 64 representation.', operation:'2 × 2 max pool → dropout → [3 × 3 Conv → BN → ReLU] × 2 → 64 × 64 × 32'},
    {name:'c3 · Encoder 3', layer:'activation_5', size:32, channels:64, description:'The third encoder block combines local features at a lower spatial resolution. It produces 64 channels and sends a copy to the corresponding decoder level.', operation:'2 × 2 max pool → dropout → [3 × 3 Conv → BN → ReLU] × 2 → 32 × 32 × 64'},
    {name:'c4 · Encoder 4', layer:'activation_7', size:16, channels:128, description:'The last encoder level produces 128 feature channels on a 16 × 16 grid. These features connect directly to the first decoder level.', operation:'2 × 2 max pool → dropout → [3 × 3 Conv → BN → ReLU] × 2 → 16 × 16 × 128'},
    {name:'c5 · Bottleneck', layer:'activation_9', size:8, channels:256, description:'Four pooling operations reduce the original 128 × 128 image to 8 × 8. The bottleneck has 256 channels and begins the expansion back to a dense road prediction.', operation:'2 × 2 max pool → dropout → [3 × 3 Conv → BN → ReLU] × 2 → 8 × 8 × 256'},
    {name:'c6 · Decoder 1', layer:'activation_11', size:16, channels:128, description:'A learned transposed convolution upsamples the bottleneck to 16 × 16 with 128 channels. Concatenating c4 adds another 128 channels; two convolutions reduce the combined 256 channels to 128.', operation:'3 × 3 transpose Conv, stride 2 → concatenate c4 (256 channels) → dropout → Conv block → 16 × 16 × 128'},
    {name:'c7 · Decoder 2', layer:'activation_13', size:32, channels:64, description:'Upsampling produces 64 channels at 32 × 32. The c3 skip adds 64 more channels, and the convolution block fuses the combined 128 channels into 64.', operation:'3 × 3 transpose Conv, stride 2 → concatenate c3 (128 channels) → dropout → Conv block → 32 × 32 × 64'},
    {name:'c8 · Decoder 3', layer:'activation_15', size:64, channels:32, description:'The decoder returns to 64 × 64. Concatenating 32 upsampled channels with the 32-channel c2 skip gives 64 channels before the two-convolution block.', operation:'3 × 3 transpose Conv, stride 2 → concatenate c2 (64 channels) → dropout → Conv block → 64 × 64 × 32'},
    {name:'c9 · Decoder 4', layer:'activation_17', size:128, channels:16, description:'The final decoder level restores the original resolution. The c1 skip supplies full-resolution encoder features; two convolutions reduce the concatenated 32 channels to 16.', operation:'3 × 3 transpose Conv, stride 2 → concatenate c1 (32 channels) → dropout → Conv block → 128 × 128 × 16'},
    {name:'Output · Road probability', layer:'conv2d_18', size:128, channels:1, description:'A 1 × 1 convolution combines the final 16 feature channels into one logit per pixel. Sigmoid maps each logit to a road probability. The ROS integration thresholds these probabilities at 0.5 before morphology.', operation:'128 × 128 × 16 → 1 × 1 Conv → sigmoid → 128 × 128 × 1'}
  ];
  const runButton = $('unet-run');
  const playButton = $('unet-play');
  const inputImage = $('unet-input-image');
  const inputCanvas = $('unet-input-canvas');
  const probabilityCanvas = $('unet-probability');
  const maskCanvas = $('unet-mask');
  const status = $('unet-status');
  const threshold = $('unet-threshold');
  const channel = $('unet-channel');
  const stageSelect = $('unet-stage');
  const figures = [...root.querySelectorAll('[data-unet-feature]')];
  const sampleButtons = [...root.querySelectorAll('[data-unet-sample]')];
  const nodes = [...root.querySelectorAll('[data-unet-stage]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let runtimePromise, model, probe, featureData = null;
  let selectedStage = 0, sample = 'map27', busy = false, hasRun = false;
  let timer = null, wantsPlay = false, visible = false, localImageURL = null, userInteracted = false;
  let inputVersion = 0;

  function say(message) { status.textContent = message; }
  function setBusy(value) {
    busy = value;
    root.setAttribute('aria-busy', String(value));
    runButton.disabled = value;
    sampleButtons.forEach(button => { button.disabled = value; });
    $('unet-upload').disabled = value;
    $('unet-file-label').setAttribute('aria-disabled', String(value));
  }
  function stopTimer() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    root.classList.remove('is-playing');
  }
  function updatePlayback() {
    stopTimer();
    playButton.textContent = wantsPlay ? 'Pause data flow' : 'Replay data flow';
    playButton.setAttribute('aria-pressed', String(wantsPlay));
    if (wantsPlay && visible && !document.hidden && !reducedMotion.matches && !busy) {
      root.classList.add('is-playing');
      timer = window.setInterval(() => selectStage((selectedStage + 1) % stages.length), 1200);
    }
  }
  function pauseForInspection() {
    userInteracted = true;
    wantsPlay = false;
    updatePlayback();
  }
  function formatValue(value) {
    return Math.abs(value) >= 100 ? value.toFixed(1) : Math.abs(value) >= 0.01 ? value.toFixed(3) : value.toExponential(2);
  }
  function drawFeature(canvas, values, width, channels, index, probability) {
    canvas.width = canvas.height = width;
    const context = canvas.getContext('2d');
    const image = context.createImageData(width, width);
    let min = Infinity, max = -Infinity;
    for (let p = 0; p < width * width; p++) {
      const v = values[p * channels + index];
      min = Math.min(min, v); max = Math.max(max, v);
    }
    const scale = max > min ? 1 / (max - min) : 0;
    for (let p = 0; p < width * width; p++) {
      const value = values[p * channels + index];
      const normalized = probability ? value : (value - min) * scale;
      const n = Math.max(0, Math.min(1, normalized));
      const offset = p * 4;
      image.data[offset] = probability ? Math.round(n * 255) : Math.round(244 - n * 217);
      image.data[offset + 1] = probability ? Math.round(n * 255) : Math.round(248 - n * 166);
      image.data[offset + 2] = probability ? Math.round(n * 255) : Math.round(237 - n * 173);
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return [min, max];
  }
  function renderFeatures() {
    const stage = stages[selectedStage];
    const first = Number(channel.value);
    $('unet-channel-number').textContent = `${first + 1} / ${stage.channels}`;
    figures.forEach((figure, i) => {
      figure.hidden = i >= stage.channels;
      const canvas = figure.querySelector('canvas');
      const index = (first + i) % stage.channels;
      figure.querySelector('[data-feature-label]').textContent = stage.channels === 1 ? 'Road probability' : `Channel ${index + 1}`;
      const range = figure.querySelector('[data-feature-range]');
      if (!featureData) {
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        range.textContent = 'Available after a forward pass';
        return;
      }
      const [min, max] = drawFeature(canvas, featureData[selectedStage], stage.size, stage.channels, index, selectedStage === 9);
      range.textContent = `${formatValue(min)} – ${formatValue(max)}`;
      canvas.setAttribute('aria-label', `${stage.name}, channel ${index + 1}. Computed feature map; raw range ${formatValue(min)} to ${formatValue(max)}.`);
    });
    $('unet-heatmap-note').textContent = selectedStage === 9 ? 'The output uses its actual 0–1 probability scale: black is 0, white is 1.' : 'Each channel is scaled separately for visibility. Pale is its minimum; green is its maximum. Values below each map show the original activation range.';
    root.querySelector('.unet-channel-note').textContent = stage.channels === 1 ? 'One road-probability channel' : 'Four channels from the selected layer';
    channel.disabled = !featureData || stage.channels === 1;
  }
  function selectStage(index) {
    selectedStage = index;
    const stage = stages[index];
    stageSelect.value = String(index);
    $('unet-shape').textContent = `${stage.size} × ${stage.size} × ${stage.channels}`;
    $('unet-stage-description').textContent = stage.description;
    $('unet-stage-operation').textContent = stage.operation;
    channel.max = String(stage.channels - 1);
    channel.value = String(Math.min(Number(channel.value), stage.channels - 1));
    nodes.forEach(node => {
      const current = Number(node.dataset.unetStage) === index;
      node.classList.toggle('is-current', current);
      node.setAttribute('aria-pressed', String(current));
    });
    root.querySelectorAll('[data-unet-edge]').forEach(edge => edge.classList.toggle('is-current', Number(edge.dataset.unetEdge) === index));
    root.querySelectorAll('[data-unet-skip]').forEach(skip => skip.classList.toggle('is-current', Number(skip.dataset.unetSkip) === index));
    renderFeatures();
  }
  function drawMask() {
    $('unet-threshold-value').textContent = Number(threshold.value).toFixed(2);
    if (!featureData) return;
    const values = featureData[9];
    const context = maskCanvas.getContext('2d');
    const image = context.createImageData(128, 128);
    let count = 0;
    for (let p = 0; p < values.length; p++) {
      const road = values[p] > Number(threshold.value);
      if (road) count++;
      const v = road ? 255 : 0;
      image.data[p * 4] = image.data[p * 4 + 1] = image.data[p * 4 + 2] = v;
      image.data[p * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    $('unet-road-fraction').textContent = `${(count / values.length * 100).toFixed(1)}% of pixels labelled road`;
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The selected image could not be decoded.'));
      image.src = url;
    });
  }
  async function prepareInput() {
    const image = await loadImage(localImageURL || new URL(`${sample}.png`, base).href);
    const context = inputCanvas.getContext('2d', {willReadFrequently:true});
    context.drawImage(image, 0, 0, 128, 128);
    inputCanvas.hidden = false;
    const pixels = context.getImageData(0, 0, 128, 128).data;
    const values = new Float32Array(128 * 128 * 3);
    for (let p = 0; p < 128 * 128; p++) {
      values[p * 3] = pixels[p * 4];
      values[p * 3 + 1] = pixels[p * 4 + 1];
      values[p * 3 + 2] = pixels[p * 4 + 2];
    }
    return values;
  }
  function loadRuntime() {
    if (window.tf) return Promise.resolve(window.tf);
    if (runtimePromise) return runtimePromise;
    runtimePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = runtimeURL.href;
      script.onload = () => window.tf ? resolve(window.tf) : reject(new Error('The inference runtime did not initialize.'));
      script.onerror = () => {script.remove(); runtimePromise = null; reject(new Error('The inference runtime could not be downloaded.'));};
      document.head.appendChild(script);
    });
    return runtimePromise;
  }
  async function ensureModel() {
    if (model) return;
    say('Loading the browser runtime and the trained checkpoint…');
    const tf = await loadRuntime();
    try {
      if (!await tf.setBackend('webgl')) await tf.setBackend('cpu');
    } catch (_) { await tf.setBackend('cpu'); }
    await tf.ready();
    model = await tf.loadLayersModel(new URL('model/model.json', base).href, {
      onProgress: fraction => say(`Loading the trained checkpoint · ${Math.round(fraction * 100)}%`)
    });
    probe = tf.model({inputs:model.inputs, outputs:stages.map(stage => model.getLayer(stage.layer).output)});
  }
  async function run() {
    if (busy) return;
    const version = inputVersion;
    setBusy(true); stopTimer();
    root.dataset.state = 'loading';
    let input, outputs;
    try {
      await ensureModel();
      const values = await prepareInput();
      say('Running the trained U-Net and reading its feature maps…');
      await new Promise(resolve => window.requestAnimationFrame(resolve));
      const tf = window.tf;
      input = tf.tensor4d(values, [1, 128, 128, 3]);
      const start = performance.now();
      outputs = tf.tidy(() => probe.predict(input));
      const computed = await Promise.all(outputs.map(tensor => tensor.data()));
      if (version !== inputVersion) return;
      featureData = computed;
      const elapsed = performance.now() - start;
      probabilityCanvas.hidden = maskCanvas.hidden = false;
      drawFeature(probabilityCanvas, featureData[9], 128, 1, 0, true);
      threshold.disabled = false;
      drawMask(); renderFeatures();
      root.dataset.state = 'ready';
      $('unet-live-tag').textContent = 'Computed in your browser';
      $('unet-pass-source').textContent = localImageURL ? 'Your image · locally computed prediction' : `${sample === 'map27' ? 'Map 27' : 'Map 34'} · repository image · locally computed prediction`;
      $('unet-output-note').textContent = 'Live checkpoint output · 0–1';
      $('unet-mask-note').textContent = 'Before the project’s morphology';
      say(`Forward pass complete · ${(elapsed / 1000).toFixed(2)} s on this device · ${tf.getBackend() === 'webgl' ? 'WebGL' : 'CPU'}. Select a block to inspect its features.`);
      runButton.textContent = 'Run U-Net again';
      if (!hasRun && !userInteracted) wantsPlay = !reducedMotion.matches;
      hasRun = true;
    } catch (error) {
      root.dataset.state = 'error';
      say('Live inference could not finish. The architecture and original project figures remain available. Use “Run U-Net” to retry.');
      runButton.textContent = 'Retry U-Net';
      console.error('U-Net inference:', error);
    } finally {
      if (outputs) window.tf.dispose(outputs);
      if (input) input.dispose();
      setBusy(false); updatePlayback();
    }
  }
  function clearPass() {
    featureData = null;
    probabilityCanvas.hidden = maskCanvas.hidden = true;
    threshold.disabled = channel.disabled = true;
    $('unet-road-fraction').textContent = '';
    root.dataset.state = 'idle';
    $('unet-live-tag').textContent = 'Trained project checkpoint';
    renderFeatures();
  }
  function useSavedImages() {
    $('unet-saved-probability').src = new URL(`${sample}-probability.png`, base).href;
    $('unet-saved-mask').src = new URL(`${sample}-mask.png`, base).href;
    $('unet-saved-probability').hidden = $('unet-saved-mask').hidden = false;
    $('unet-saved-probability').alt = `Saved road-probability prediction from the project checkpoint on ${sample === 'map27' ? 'Map 27' : 'Map 34'}. Bright pixels indicate higher road probability.`;
    $('unet-saved-mask').alt = `Saved binary mask from the project checkpoint on ${sample === 'map27' ? 'Map 27' : 'Map 34'}, thresholded at 0.5. White pixels are predicted roads.`;
    $('unet-output-note').textContent = 'Saved checkpoint output · run to refresh';
    $('unet-mask-note').textContent = 'Saved mask · threshold 0.50';
    $('unet-pass-source').textContent = `${sample === 'map27' ? 'Map 27' : 'Map 34'} · saved output from this checkpoint`;
  }
  runButton.addEventListener('click', run);
  playButton.addEventListener('click', () => {
    userInteracted = true;
    wantsPlay = !wantsPlay;
    if (wantsPlay && reducedMotion.matches) {
      selectStage((selectedStage + 1) % stages.length);
      wantsPlay = false;
    }
    updatePlayback();
  });
  stageSelect.addEventListener('change', () => {pauseForInspection(); selectStage(Number(stageSelect.value));});
  stageSelect.addEventListener('focus', pauseForInspection);
  channel.addEventListener('input', () => {pauseForInspection(); renderFeatures();});
  threshold.addEventListener('input', drawMask);
  nodes.forEach(node => {
    const select = () => {pauseForInspection(); selectStage(Number(node.dataset.unetStage));};
    node.addEventListener('click', select);
    node.addEventListener('focus', pauseForInspection);
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); select();}
      else if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault(); pauseForInspection();
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const index = (Number(node.dataset.unetStage) + step + stages.length) % stages.length;
        nodes.find(other => Number(other.dataset.unetStage) === index)?.focus();
        selectStage(index);
      }
    });
  });
  sampleButtons.forEach(button => button.addEventListener('click', () => {
    if (busy) return;
    pauseForInspection(); inputVersion++;
    if (localImageURL) URL.revokeObjectURL(localImageURL);
    localImageURL = null; sample = button.dataset.unetSample;
    inputImage.src = new URL(`${sample}.png`, base).href;
    inputImage.alt = `128 by 128 RGB input resized from repository image ${sample === 'map27' ? 'map27.jpeg' : 'Map34.jpg'}.`;
    inputCanvas.hidden = true;
    $('unet-input-note').textContent = '128 × 128 RGB · project repository';
    $('unet-upload').value = '';
    sampleButtons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    clearPass(); useSavedImages();
    if (model) run(); else say('A repository image is selected. Run U-Net to inspect its features.');
  }));
  $('unet-upload').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file || busy) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) {
      say('Choose a PNG, JPEG, or WebP image smaller than 15 MB.'); event.target.value = ''; return;
    }
    pauseForInspection(); inputVersion++;
    if (localImageURL) URL.revokeObjectURL(localImageURL);
    localImageURL = URL.createObjectURL(file);
    inputImage.src = localImageURL; inputImage.alt = 'Your selected image, resized locally to 128 by 128 for the model.';
    inputCanvas.hidden = true;
    sampleButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
    clearPass();
    $('unet-saved-probability').hidden = $('unet-saved-mask').hidden = true;
    $('unet-input-note').textContent = 'Your image · stays in this browser';
    $('unet-output-note').textContent = 'Preparing a new prediction…';
    $('unet-mask-note').textContent = 'Available after inference';
    $('unet-pass-source').textContent = 'Your image · no inference result yet';
    await run();
  });
  document.addEventListener('visibilitychange', updatePlayback);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', () => {if (reducedMotion.matches) wantsPlay = false; updatePlayback();});
  selectStage(0);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible && !hasRun && !busy && root.dataset.state !== 'error') run();
      updatePlayback();
    }, {threshold:0.05});
    observer.observe(root);
  } else { visible = true; }
})();
