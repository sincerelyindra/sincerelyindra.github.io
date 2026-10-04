/* Progressive enhancement for the report's scores and confusion counts. */
(() => {
  'use strict';
  const source = document.getElementById('building-study-data');
  if (!source) return;
  const data = JSON.parse(source.textContent);
  const { classes, names, matrix, results } = data;
  const sum = values => values.reduce((total, value) => total + value, 0);
  const rowTotals = matrix.map(sum);
  const maxCount = Math.max(...matrix.flat());
  const matrixButtons = [...document.querySelectorAll('.matrix-cell')];
  let selectedRow = 2;
  let selectedColumn = 3;

  const pressed = (selector, value, attribute) => {
    document.querySelectorAll(selector).forEach(button => {
      button.setAttribute('aria-pressed', String(button.getAttribute(attribute) === value));
    });
  };

  function updateChart(mode) {
    const keys = mode === 'accuracy' ? ['train', 'validation'] : ['public', 'private'];
    const chart = document.getElementById('comparison-chart');
    const labels = mode === 'accuracy' ? ['Training', 'Validation'] : ['Public', 'Private'];
    const format = value => mode === 'accuracy' ? `${(value * 100).toFixed(1)}%` : value.toFixed(3);
    results.forEach((result, row) => {
      keys.forEach((key, series) => {
        const value = result[key];
        chart.querySelector(`[data-bar="${row}-${series}"]`).setAttribute('width', String(value * 490));
        const label = chart.querySelector(`[data-value="${row}-${series}"]`);
        label.setAttribute('x', String(230 + value * 490));
        label.textContent = format(value);
      });
    });
    const axisLabels = chart.querySelectorAll('.chart-axis text');
    [0, .25, .5, .75, 1].forEach((value, index) => {
      axisLabels[index].textContent = mode === 'accuracy' ? `${value * 100}%` : value.toFixed(2);
    });
    document.getElementById('chart-axis-label').textContent = mode === 'accuracy'
      ? 'Local accuracy · percent' : 'Kaggle score · metric unspecified';
    document.getElementById('legend-primary').textContent = labels[0];
    document.getElementById('legend-secondary').textContent = labels[1];
    document.getElementById('comparison-title').textContent = mode === 'accuracy'
      ? 'Training and validation accuracy' : 'Public and private Kaggle scores';
    document.getElementById('comparison-desc').textContent = results.map(result =>
      `${result.name}: ${labels[0]} ${format(result[keys[0]])}, ${labels[1]} ${format(result[keys[1]])}.`
    ).join(' ') + ' Bars start at zero. Exact scores are in Table 1.';
    document.getElementById('chart-insight').textContent = mode === 'accuracy'
      ? 'Similarity filtering has the highest reported validation accuracy (57.8%). Its 0.2 percentage-point training–validation gap does not, by itself, establish stronger generalization.'
      : 'The baseline has the highest public score (0.497); Canny has the highest private score (0.412). There is no single leader across both.';
    pressed('[data-chart-mode]', mode, 'data-chart-mode');
  }

  function luminance(rgb) {
    const linear = rgb.map(channel => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  }

  function updateMatrix(mode) {
    matrixButtons.forEach(button => {
      const row = Number(button.dataset.row);
      const column = Number(button.dataset.column);
      const count = matrix[row][column];
      const fraction = count / rowTotals[row];
      const strength = mode === 'percent' ? fraction : count / maxCount;
      const rgb = [243, 247, 245].map((start, index) =>
        Math.round(start + ([23, 77, 71][index] - start) * strength));
      const brightness = luminance(rgb);
      const darkBrightness = luminance([17, 17, 17]);
      const lightContrast = 1.05 / (brightness + .05);
      const darkContrast = (brightness + .05) / (darkBrightness + .05);
      button.style.setProperty('--cell-bg', `rgb(${rgb.join(',')})`);
      button.style.setProperty('--cell-ink', lightContrast > darkContrast ? '#fff' : '#111');
      button.querySelector('.cell-value').textContent = mode === 'percent'
        ? `${(fraction * 100).toFixed(1)}%` : String(count);
      button.setAttribute('aria-label',
        `True ${classes[row]}, ${names[row]}; predicted ${classes[column]}, ${names[column]}: ` +
        `${count} images, ${(fraction * 100).toFixed(1)}% of true ${classes[row]}`);
    });
    document.getElementById('matrix-table-caption').textContent = mode === 'percent'
      ? 'True class ↓ / Predicted class → · row percentages'
      : 'True class ↓ / Predicted class → · counts';
    document.getElementById('matrix-scale-unit').textContent = mode === 'percent'
      ? '0–100% per row' : `0–${maxCount} images`;
    pressed('[data-matrix-mode]', mode, 'data-matrix-mode');
  }

  function selectCell(row, column) {
    selectedRow = row;
    selectedColumn = column;
    const count = matrix[row][column];
    const total = rowTotals[row];
    const correct = matrix[row][row];
    const percentage = 100 * count / total;
    matrixButtons.forEach(button => {
      const selected = Number(button.dataset.row) === row && Number(button.dataset.column) === column;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.getElementById('cell-status').textContent = row === column
      ? 'On diagonal / Correct classification' : 'Off diagonal / Misclassification';
    document.getElementById('cell-direction').textContent = `True ${classes[row]} → Predicted ${classes[column]}`;
    const units = document.createElement('span');
    units.textContent = count === 1 ? 'image' : 'images';
    document.getElementById('cell-count').replaceChildren(document.createTextNode(`${count} `), units);
    document.getElementById('cell-description').textContent =
      `${count} of ${total} ${names[row].toLowerCase()} examples were predicted as ` +
      `${names[column].toLowerCase()} buildings (${percentage.toFixed(1)}%).`;
    const recall = document.createElement('span');
    recall.textContent = `· ${(100 * correct / total).toFixed(1)}% recall`;
    document.getElementById('cell-recall').replaceChildren(document.createTextNode(`${correct} / ${total} `), recall);
  }

  function showCurve(value) {
    document.querySelectorAll('[data-curve-panel]').forEach(panel => {
      panel.hidden = panel.getAttribute('data-curve-panel') !== value;
    });
    pressed('[data-curve]', value, 'data-curve');
  }

  document.querySelectorAll('[data-chart-mode]').forEach(button => {
    button.addEventListener('click', () => updateChart(button.dataset.chartMode));
  });
  document.querySelectorAll('[data-matrix-mode]').forEach(button => {
    button.addEventListener('click', () => updateMatrix(button.dataset.matrixMode));
  });
  document.querySelectorAll('[data-curve]').forEach(button => {
    button.addEventListener('click', () => showCurve(button.dataset.curve));
  });
  matrixButtons.forEach(button => {
    const inspect = () => selectCell(Number(button.dataset.row), Number(button.dataset.column));
    button.addEventListener('click', inspect);
    button.addEventListener('focus', inspect);
    button.disabled = false;
  });
  document.querySelector('.confusion-matrix').addEventListener('keydown', event => {
    if (!event.target.closest('.matrix-cell')) return;
    let row = selectedRow;
    let column = selectedColumn;
    switch (event.key) {
      case 'ArrowLeft': column = Math.max(0, column - 1); break;
      case 'ArrowRight': column = Math.min(classes.length - 1, column + 1); break;
      case 'ArrowUp': row = Math.max(0, row - 1); break;
      case 'ArrowDown': row = Math.min(classes.length - 1, row + 1); break;
      case 'Home': column = 0; if (event.ctrlKey) row = 0; break;
      case 'End': column = classes.length - 1; if (event.ctrlKey) row = classes.length - 1; break;
      default: return;
    }
    event.preventDefault();
    matrixButtons.find(button => Number(button.dataset.row) === row && Number(button.dataset.column) === column).focus();
  });

  updateChart('leaderboard');
  updateMatrix('counts');
  selectCell(2, 3);
  showCurve('canny');
  document.documentElement.classList.add('building-ready');

  const sectionLinks = [...document.querySelectorAll('.study-toc nav a')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        sectionLinks.forEach(link => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-100px 0px -55% 0px', threshold: 0 });
    document.querySelectorAll('.study-section').forEach(section => observer.observe(section));
  }
})();
