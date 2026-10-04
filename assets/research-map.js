(() => {
  const root = document.getElementById('research-map');
  const canvas = document.getElementById('constellationCanvas');
  if (!document.body.classList.contains('home') || !root || !canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const themeTitle = document.getElementById('constellationTheme');
  const themeDescription = document.getElementById('constellationDescription');
  const themeProjects = document.getElementById('constellationProjects');
  const themeButtons = Array.from(root.querySelectorAll('[data-theme]'));
  const rotationButton = root.querySelector('[data-rotation-control]');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  const themes = [
    {
      name: 'Machine Learning',
      description: 'Applied modelling across structured data, vision, behavioural data, and decision systems.',
      projects: [
        ['GPT-2 From Scratch – LLM Systems', 'projects/gpt2-from-scratch.html'],
        ['Building-material classification', 'projects/building-classification.html'],
        ['Australian suburb analysis', 'projects/suburb-profile-analysis.html'],
        ['Brain-tumor segmentation', 'projects/medical-image-segmentation.html']
      ],
      x: -1.18, y: -0.40, z: 0.34
    },
    {
      name: 'Computer Vision',
      description: 'Visual representation learning for medical imaging, structural classification, and robot perception.',
      projects: [
        ['LoRA + ViT medical segmentation', 'projects/medical-image-segmentation.html'],
        ['Safe-building classification', 'projects/building-classification.html'],
        ['U-Net robot perception', 'projects/robot-path-planning.html']
      ],
      x: -0.80, y: 0.86, z: -0.56
    },
    {
      name: 'Reinforcement Learning',
      description: 'Learning policies for constrained sequential decisions, from EV routing to strategic bidding.',
      projects: [
        ['Electric-vehicle routing + V2G', 'projects/electric-vehicle-routing.html'],
        ['Strategic bidding agents', 'projects/strategic-auction-bidding.html']
      ],
      x: 0.02, y: -0.98, z: 0.72
    },
    {
      name: 'Optimization',
      description: 'Mathematical and robust optimization for routing, pricing, and multi-objective decisions.',
      projects: [
        ['EV routing MILP', 'projects/electric-vehicle-routing.html'],
        ['Robust quantile pricing', 'projects/robust-pricing.html'],
        ['Robot path planning', 'projects/robot-path-planning.html']
      ],
      x: 1.08, y: -0.40, z: -0.30
    },
    {
      name: 'Robotics',
      description: 'Perception, planning, and control integrated into an end-to-end navigation pipeline.',
      projects: [
        ['Wheeled-robot path optimization', 'projects/robot-path-planning.html']
      ],
      x: 0.92, y: 0.76, z: 0.48
    },
    {
      name: 'Game Theory',
      description: 'Strategic behaviour, choice modelling, auctions, and robust decisions under limited information.',
      projects: [
        ['Strategic auction bidding', 'projects/strategic-auction-bidding.html'],
        ['Robust pricing', 'projects/robust-pricing.html']
      ],
      x: 0.08, y: 0.96, z: 0.78
    },
    {
      name: 'RAG & LLMs',
      description: 'GPT-2 decoder implementation and checkpoint verification, alongside retrieval, evaluation, and QLoRA work at OLA R&D.',
      projects: [
        ['GPT-2 From Scratch – LLM Systems', 'projects/gpt2-from-scratch.html'],
        ['Professional experience', 'resume.html#experience']
      ],
      x: -0.18, y: 0.20, z: -1.18
    }
  ];


  const themeMap = new Map(themes.map((theme) => [theme.name, theme]));
  const edges = [[0, 1], [0, 2], [0, 3], [1, 4], [2, 3], [2, 5],
    [3, 4], [3, 5], [0, 6], [2, 6], [5, 6]];

  let selected = 'Reinforcement Learning';
  let rotationX = -0.18;
  let rotationY = 0.42;
  let playing = !motionPreference.matches;
  let inView = false;
  let hovering = false;
  let dragging = false;
  let pageHidden = false;
  let lastX = 0;
  let lastY = 0;
  let dragDistance = 0;
  let cssWidth = 720;
  let cssHeight = 440;
  let projected = [];
  let animationFrame = 0;
  let lastTime = 0;

  const shouldAnimate = () => playing && inView && !document.hidden &&
    !hovering && !dragging && !pageHidden;

  const projectPoint = (point) => {
    const cy = Math.cos(rotationY);
    const sy = Math.sin(rotationY);
    const cx = Math.cos(rotationX);
    const sx = Math.sin(rotationX);
    const x = point.x * cy - point.z * sy;
    const z1 = point.x * sy + point.z * cy;
    const y = point.y * cx - z1 * sx;
    const z = point.y * sx + z1 * cx;
    const scale = 2.75 / (3.2 + z);
    const base = Math.min(cssWidth, cssHeight - 70) * 0.29;
    return {
      x: cssWidth / 2 + x * base * scale,
      y: cssHeight / 2 + y * base * scale,
      z, scale, theme: point
    };
  };

  const overlaps = (a, b) => a.x < b.x + b.width + 5 &&
    a.x + a.width + 5 > b.x && a.y < b.y + b.height + 4 &&
    a.y + a.height + 4 > b.y;

  const drawLabels = (points, center) => {
    const occupied = [{x: center.x - 31, y: center.y - 10, width: 62, height: 42}];
    const priority = points.slice().sort((a, b) =>
      Number(b.theme.name === selected) - Number(a.theme.name === selected) || a.z - b.z);
    priority.forEach((point) => {
      const active = point.theme.name === selected;
      const fontSize = (cssWidth < 420 ? 11.5 : 12.5) + (active ? .5 : 0);
      ctx.font = (active ? '600 ' : '500 ') + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const words = point.theme.name.split(' ');
      const lines = [''];
      words.forEach((word) => {
        const candidate = (lines[lines.length - 1] + ' ' + word).trim();
        if (ctx.measureText(candidate).width > (cssWidth < 420 ? 90 : 126) && lines[lines.length - 1]) lines.push(word);
        else lines[lines.length - 1] = candidate;
      });
      const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 12;
      const height = lines.length * 16 + 8;
      const offsets = [[-width / 2, 15], [-width / 2, -height - 15],
        [15, -height / 2], [-width - 15, -height / 2],
        [-width / 2, 38], [-width / 2, -height - 38],
        [23, 18], [-width - 23, 18], [23, -height - 18], [-width - 23, -height - 18]];
      const candidates = offsets.map(([dx, dy]) => ({
        x: Math.max(8, Math.min(cssWidth - width - 8, point.x + dx)),
        y: Math.max(59, Math.min(cssHeight - height - 35, point.y + dy)),
        width, height
      }));
      let box = candidates.find((candidate) => !occupied.some((other) => overlaps(candidate, other)));
      if (!box) {
        let closest = Infinity;
        for (let y = 59; y <= cssHeight - height - 35; y += 8) {
          for (let x = 8; x <= cssWidth - width - 8; x += 8) {
            const candidate = {x, y, width, height};
            if (occupied.some((other) => overlaps(candidate, other))) continue;
            const distance = Math.hypot(x + width / 2 - point.x, y + height / 2 - point.y);
            if (distance < closest) {
              box = candidate;
              closest = distance;
            }
          }
        }
      }
      if (!box) return;
      occupied.push(box);
      ctx.strokeStyle = active ? 'rgba(191,216,193,.4)' : 'rgba(174,194,181,.2)';
      ctx.lineWidth = .7;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(Math.max(box.x, Math.min(box.x + width, point.x)),
        Math.max(box.y, Math.min(box.y + height, point.y)));
      ctx.stroke();
      ctx.fillStyle = 'rgba(20,40,35,.82)';
      ctx.fillRect(box.x, box.y, width, height);
      ctx.fillStyle = active ? '#e9f3df' : '#c7d8cd';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      lines.forEach((line, i) => ctx.fillText(line, box.x + width / 2, box.y + 4 + i * 16));
    });
  };

  const render = () => {
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    const center = {x: cssWidth / 2, y: cssHeight / 2};
    projected = themes.map(projectPoint);

    ctx.lineWidth = 1;
    edges.forEach(([a, b]) => {
      ctx.strokeStyle = 'rgba(164,193,176,.23)';
      ctx.beginPath();
      ctx.moveTo(projected[a].x, projected[a].y);
      ctx.lineTo(projected[b].x, projected[b].y);
      ctx.stroke();
    });
    projected.forEach((point) => {
      ctx.strokeStyle = 'rgba(164,193,176,.16)';
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    });

    projected.slice().sort((a, b) => b.z - a.z).forEach((point) => {
      const active = point.theme.name === selected;
      const radius = Math.max(5.5, 7 * point.scale) + (active ? 2 : 0);
      if (active) {
        ctx.fillStyle = 'rgba(193,217,176,.13)';
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = active ? '#c1d9b0' : 'rgba(186,208,195,' +
        Math.max(.5, Math.min(.9, .75 - point.z * .13)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#f0f5e9';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('INDRA', center.x, center.y + 13);
    drawLabels(projected, center);
  };

  const frame = (now) => {
    animationFrame = 0;
    if (!shouldAnimate()) return;
    rotationY += Math.min((now - lastTime) / 1000, .05) * .085;
    lastTime = now;
    render();
    animationFrame = requestAnimationFrame(frame);
  };

  const syncAnimation = () => {
    rotationButton.textContent = playing ? 'Pause rotation' : 'Resume rotation';
    if (shouldAnimate() && !animationFrame) {
      lastTime = performance.now();
      animationFrame = requestAnimationFrame(frame);
    } else if (!shouldAnimate() && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  };

  const setTheme = (name) => {
    const theme = themeMap.get(name);
    if (!theme) return;
    selected = name;
    themeTitle.textContent = theme.name;
    themeDescription.textContent = theme.description;
    themeProjects.replaceChildren();
    theme.projects.forEach(([label, href]) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      themeProjects.appendChild(link);
    });
    themeButtons.forEach((button) => button.setAttribute('aria-pressed',
      String(button.dataset.theme === name)));
    render();
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    cssWidth = Math.max(1, rect.width);
    cssHeight = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  };

  rotationButton.addEventListener('click', () => {
    playing = !playing;
    syncAnimation();
  });
  themeButtons.forEach((button) => button.addEventListener('click', () => setTheme(button.dataset.theme)));

  canvas.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') {
      hovering = true;
      syncAnimation();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    hovering = false;
    syncAnimation();
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    dragDistance = 0;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture?.(event.pointerId);
    syncAnimation();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    dragDistance += Math.abs(dx) + Math.abs(dy);
    rotationY += dx * .008;
    rotationX = Math.max(-1.1, Math.min(1.1, rotationX + dy * .006));
    lastX = event.clientX;
    lastY = event.clientY;
    render();
  });
  const endDrag = () => {
    dragging = false;
    canvas.classList.remove('is-dragging');
    syncAnimation();
  };
  canvas.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    if (dragDistance < 10) {
      const rect = canvas.getBoundingClientRect();
      const nearest = projected.slice().sort((a, b) =>
        Math.hypot(event.clientX - rect.left - a.x, event.clientY - rect.top - a.y) -
        Math.hypot(event.clientX - rect.left - b.x, event.clientY - rect.top - b.y))[0];
      if (nearest && Math.hypot(event.clientX - rect.left - nearest.x,
        event.clientY - rect.top - nearest.y) < 32) setTheme(nearest.theme.name);
    }
    endDrag();
  });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);

  document.addEventListener('visibilitychange', syncAnimation);
  motionPreference.addEventListener?.('change', (event) => {
    if (event.matches) playing = false;
    syncAnimation();
  });
  window.addEventListener('pagehide', () => {
    pageHidden = true;
    syncAnimation();
  });
  window.addEventListener('pageshow', () => {
    pageHidden = false;
    resize();
    syncAnimation();
  });

  root.hidden = false;
  setTheme(selected);
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      syncAnimation();
    }, {threshold: .1}).observe(canvas);
  } else {
    inView = true;
    syncAnimation();
  }
})();

