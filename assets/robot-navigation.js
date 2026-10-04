/* Teaching example: the project figures and this synthetic grid are labelled separately. */
(function () {
  'use strict';
  const SQRT2 = Math.SQRT2;
  const cardinal = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const diagonal = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function createExampleGrid() {
    return Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 24 }, (_, x) => {
        const inBounds = x >= 2 && x <= 21 && y >= 2 && y <= 13;
        const ring = (x >= 2 && x <= 4) || (x >= 19 && x <= 21) ||
          (y >= 2 && y <= 4) || (y >= 11 && y <= 13);
        const diagonalRoad = Math.abs(y - (12 - 9 * (x - 3) / 17)) <= 1.25;
        return Number(inBounds && (ring || diagonalRoad));
      })
    );
  }

  function astar(grid, start, goal, connectivity = 8) {
    const rows = grid.length;
    const cols = rows ? grid[0].length : 0;
    const valid = ([x, y]) => Number.isInteger(x) && Number.isInteger(y) &&
      y >= 0 && y < rows && x >= 0 && x < cols && grid[y][x] === 1;
    if (!valid(start) || !valid(goal)) return null;
    const key = ([x, y]) => y * cols + x;
    const heuristic = ([x, y]) => Math.hypot(goal[0] - x, goal[1] - y);
    const moves = connectivity === 8 ? cardinal.concat(diagonal) : cardinal;
    const costs = new Map([[key(start), 0]]);
    const parents = new Map();
    const closed = new Set();
    let sequence = 0;
    const open = [{ point: start, g: 0, f: heuristic(start), order: sequence++ }];
    while (open.length) {
      open.sort((a, b) => a.f - b.f || a.order - b.order);
      const current = open.shift();
      const currentKey = key(current.point);
      if (closed.has(currentKey) || current.g > costs.get(currentKey) + 1e-10) continue;
      closed.add(currentKey);
      if (currentKey === key(goal)) {
        const path = [current.point];
        let cursor = currentKey;
        while (parents.has(cursor)) {
          cursor = parents.get(cursor);
          path.push([cursor % cols, Math.floor(cursor / cols)]);
        }
        path.reverse();
        let diagonals = 0;
        for (let i = 1; i < path.length; i++) {
          if (path[i][0] !== path[i - 1][0] && path[i][1] !== path[i - 1][1]) diagonals++;
        }
        return { path, cost: current.g, expanded: closed.size, diagonals,
          cardinals: path.length - 1 - diagonals };
      }
      for (const [dx, dy] of moves) {
        const next = [current.point[0] + dx, current.point[1] + dy];
        // Matches the source node: check the destination, without extra corner clearance.
        if (!valid(next)) continue;
        const nextKey = key(next);
        const tentative = current.g + (dx && dy ? SQRT2 : 1);
        if (tentative + 1e-10 < (costs.get(nextKey) ?? Infinity)) {
          costs.set(nextKey, tentative);
          parents.set(nextKey, currentKey);
          open.push({ point: next, g: tentative, f: tentative + heuristic(next),
            order: sequence++ });
        }
      }
    }
    return null;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createExampleGrid, astar };
    return;
  }
  if (typeof document === 'undefined') return;
  document.documentElement.classList.add('robot-enhanced');

  const image = document.getElementById('segmentation-image');
  const exampleDescription = document.getElementById('segmentation-description');
  const imageSizes = [[529, 185], [553, 202], [524, 200], [516, 196]];
  const exampleButtons = Array.from(document.querySelectorAll('[data-example]'));
  exampleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const number = Number(button.dataset.example);
      exampleButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      image.src = '../assets/robot-navigation/segmentation-example-' + number + '.webp';
      image.alt = 'Original example ' + number + ': aerial image, predicted road mask, ' +
        'and the reference mask labelled Actual Routes in the project presentation.';
      [image.width, image.height] = imageSizes[number - 1];
      exampleDescription.textContent = 'Example 0' + number +
        ' · Compare the aerial image, predicted routes, and reference routes in the original figure.';
    });
  });

  const map = document.getElementById('astar-map');
  const results = document.getElementById('astar-results');
  const connectivityButtons = Array.from(document.querySelectorAll('[data-connectivity]'));
  const grid = createExampleGrid();
  const start = [3, 12];
  const goal = [20, 3];
  const cell = 28;
  const centre = point => [(point[0] + 0.5) * cell, (point[1] + 0.5) * cell];

  function render(connectivity) {
    const result = astar(grid, start, goal, connectivity);
    if (!result || !map || !results) return;
    const description = connectivity + '-neighbour A star on a synthetic road mask. ' +
      result.cardinals + ' cardinal and ' + result.diagonals + ' diagonal moves. ' +
      'Total path cost ' + result.cost.toFixed(3) + ' grid units.';
    let cells = '';
    grid.forEach((row, y) => row.forEach((value, x) => {
      cells += '<rect x="' + (x * cell) + '" y="' + (y * cell) +
        '" width="' + cell + '" height="' + cell +
        '" fill="' + (value ? '#edf3e7' : '#c2cfb9') +
        '" stroke="' + (value ? '#d8e3cd' : '#b9c9af') + '" stroke-width="0.7"/>';
    }));
    const points = result.path.map(point => centre(point).join(',')).join(' ');
    const markers = [[start, 'S', '#174d47'], [goal, 'G', '#8a571c']].map(([point, label, colour]) => {
      const [x, y] = centre(point);
      return '<circle cx="' + x + '" cy="' + y + '" r="11.5" fill="' + colour +
        '" stroke="#fff" stroke-width="2"/><text x="' + x + '" y="' + (y + 4.5) +
        '" font-family="sans-serif" font-weight="600" font-size="13" fill="#fff" text-anchor="middle">' +
        label + '</text>';
    }).join('');
    map.innerHTML = '<title id="astar-title">' + connectivity +
      '-neighbour A star search</title><desc id="astar-description">' + description +
      '</desc>' + cells + '<polyline points="' + points +
      '" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>' +
      '<polyline points="' + points +
      '" fill="none" stroke="#174d47" stroke-width="4" stroke-linejoin="round"/>' + markers;
    results.innerHTML = '<p class="eyebrow">Synthetic example</p><p class="example-mode">' +
      connectivity + ' neighbours</p><dl><div><dt>Total path cost</dt><dd>' +
      result.cost.toFixed(3) + '<small>grid units</small></dd></div><div><dt>Moves on the path</dt><dd>' +
      (result.path.length - 1) + '</dd></div><div><dt>Unique nodes expanded</dt><dd>' +
      result.expanded + '</dd></div></dl><p class="example-note">' +
      result.cardinals + ' cardinal × 1<br>' + result.diagonals + ' diagonal × √2</p>';
    connectivityButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.connectivity) === connectivity));
    });
  }
  connectivityButtons.forEach(button => button.addEventListener('click', () => render(Number(button.dataset.connectivity))));
  render(8);

  if ('IntersectionObserver' in window) {
    const tocLinks = Array.from(document.querySelectorAll('.robot-toc a'));
    const sections = Array.from(document.querySelectorAll('.robot-section'));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting);
      if (!visible.length) return;
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const active = '#' + visible[0].target.id;
      tocLinks.forEach(link => {
        if (link.getAttribute('href') === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-12% 0px -55% 0px', threshold: 0 });
    sections.forEach(section => observer.observe(section));
  }
})();

