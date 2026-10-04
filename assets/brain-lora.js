/* Progressive enhancement for report-based model and result comparisons. */
(() => {
  'use strict';
  const study = document.querySelector('.brain-study');
  if (!study) return;

  const variants = {
    '1': {
      front: '3-layer CNN', projection: '4 → 32 → 3 channels', lora: 'QKV · r = 16, α = 32',
      decoder: '3 upsampling stages', alignment: 'Transposed convolutions',
      description: 'Approach 1: GPU, batch size 4, class-weighted Dice + BCE, ReduceLROnPlateau, and approximately 819K trainable parameters.'
    },
    '2': {
      front: '1×1 convolution', projection: '4 → 3 channels', lora: 'QKV · r = 16, α = 32',
      decoder: '2 upsampling stages', alignment: 'Lightweight decoder',
      description: 'Approach 2: CPU, batch size 2, unweighted Dice + BCE, cosine annealing over 50 epochs, and approximately 672K reported trainable parameters.'
    },
    '3': {
      front: '1×1 convolution', projection: '4 → 3 channels', lora: 'QKV · r = 8, α = 16',
      decoder: '2 upsampling stages', alignment: 'Alignment correction',
      description: 'Approach 3: GPU, batch size 4, unweighted Dice + BCE, cosine annealing with early stopping, pinned memory, four data-loading workers, and approximately 672K reported trainable parameters.'
    }
  };

  document.querySelectorAll('[data-variant]').forEach(button => {
    button.addEventListener('click', () => {
      const variant = variants[button.dataset.variant];
      if (!variant) return;
      document.querySelectorAll('[data-variant]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      for (const key of ['front', 'projection', 'lora', 'decoder', 'alignment', 'description']) {
        const target = document.getElementById(`variant-${key}`);
        if (target) target.textContent = variant[key];
      }
    });
  });

  const families = {
    '3d': {
      heading: '3D strategies · regional Dice',
      series: [
        { name: 'Whole-volume resize', color: '#3d586e', values: [0.9013, 0.8481, 0.7959] },
        { name: 'Center patch', color: '#174d47', values: [0.8965, 0.8365, 0.8385] }
      ],
      insight: 'Center patches improve ET Dice by 0.0426, while WT and TC decrease by 0.0048 and 0.0116. The reported mean increases from 0.8484 to 0.8572.',
      table: 'Table 1'
    },
    '2d': {
      heading: '2D models · regional Dice',
      series: [
        { name: 'Approach 1', color: '#174d47', values: [0.7784, 0.6718, 0.6309] },
        { name: 'Approach 2', color: '#8c643f', values: [0.7812, 0.5526, 0.4199] },
        { name: 'Approach 3', color: '#3d586e', values: [0.8229, 0.6070, 0.5088] }
      ],
      insight: 'Approach 1 leads on TC and ET; Approach 3 leads on WT. Architecture, loss, LoRA rank, and training settings vary together, so this comparison does not isolate any one change.',
      table: 'Table 2'
    }
  };
  const regions = ['WT', 'TC', 'ET'];
  const svg = document.getElementById('score-chart');
  const ns = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attrs = {}, content) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function drawChart(key) {
    const family = families[key];
    if (!family || !svg) return;
    const fragment = document.createDocumentFragment();
    fragment.append(svgNode('title', { id: 'score-chart-title' }, `${family.heading} on a zero-to-one scale`));
    const scoreDescription = family.series.map(series => `${series.name}: ${regions.map((region, index) => `${region} ${series.values[index].toFixed(4)}`).join(', ')}.`).join(' ');
    fragment.append(svgNode('desc', { id: 'score-chart-desc' }, `${scoreDescription} Exact values also appear in ${family.table}.`));
    const grid = svgNode('g', { class: 'chart-grid' });
    const axis = svgNode('g', { class: 'chart-axis' });
    for (const tick of [0, .25, .5, .75, 1]) {
      const x = 130 + tick * 590;
      grid.append(svgNode('path', { d: `M${x} 40V328` }));
      axis.append(svgNode('text', { x, y: 350 }, tick.toFixed(2)));
    }
    axis.append(svgNode('path', { d: 'M130 328H720' }));
    axis.append(svgNode('text', { x: 425, y: 374 }, 'Dice coefficient'));
    fragment.append(grid, axis);
    const regionLabels = svgNode('g', { class: 'chart-region' });
    const values = svgNode('g', { class: 'chart-value' });
    regions.forEach((region, regionIndex) => {
      const startY = 64 + regionIndex * 88;
      const midpoint = startY + ((family.series.length - 1) * 22 + 14) / 2;
      regionLabels.append(svgNode('text', { x: 109, y: midpoint + 5 }, region));
      family.series.forEach((series, seriesIndex) => {
        const y = startY + seriesIndex * 22;
        const score = series.values[regionIndex];
        const rect = svgNode('rect', { x: 130, y, width: score * 590, height: 14, rx: 2, fill: series.color });
        rect.append(svgNode('title', {}, `${series.name}, ${region}: ${score.toFixed(4)}`));
        fragment.append(rect);
        values.append(svgNode('text', { x: 140 + score * 590, y: y + 12 }, score.toFixed(4)));
      });
    });
    fragment.append(regionLabels, values);
    svg.replaceChildren(fragment);
    document.getElementById('score-chart-heading').textContent = family.heading;
    document.getElementById('score-chart-insight').textContent = family.insight;
    const legend = document.getElementById('score-chart-legend');
    legend.replaceChildren(...family.series.map(series => {
      const item = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.setProperty('--series-color', series.color);
      item.append(swatch, document.createTextNode(series.name));
      return item;
    }));
  }
  document.querySelectorAll('[data-result-family]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-result-family]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      drawChart(button.dataset.resultFamily);
    });
  });

  const tocLinks = [...document.querySelectorAll('.study-toc a')];
  const sections = tocLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  function updateLocation() {
    const marker = 145;
    let current = sections[0];
    for (const section of sections) if (section.getBoundingClientRect().top <= marker) current = section;
    for (const link of tocLinks) {
      if (current && link.getAttribute('href') === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  let scrollQueued = false;
  window.addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(() => { updateLocation(); scrollQueued = false; });
  }, { passive: true });
  updateLocation();
  study.classList.add('study-enhanced');
})();
