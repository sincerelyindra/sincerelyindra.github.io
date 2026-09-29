document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-nav');

if (menuButton && navigation) {
  const closeMenu = () => {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  };

  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    navigation.classList.toggle('is-open', !isOpen);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  });

  navigation.addEventListener('click', closeMenu);
}

document.querySelector('[data-print-resume]')?.addEventListener('click', () => window.print());

(() => {
  const canvas = document.getElementById('constellationCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const themeTitle = document.getElementById('constellationTheme');
  const themeDescription = document.getElementById('constellationDescription');
  const themeProjects = document.getElementById('constellationProjects');
  const themeButtons = Array.from(document.querySelectorAll('[data-theme]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const themes = [
    {
      name: 'Machine Learning',
      description: 'Applied modelling across structured data, vision, behavioural data, and decision systems.',
      projects: [
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
      description: 'Retrieval-augmented generation, hybrid search, semantic reranking, evaluation, and QLoRA at OLA R&D.',
      projects: [
        ['Professional experience', 'resume.html#experience']
      ],
      x: -0.18, y: 0.20, z: -1.18
    }
  ];

  const themeMap = new Map(themes.map((theme) => [theme.name, theme]));
  const edges = [
    [0, 1], [0, 2], [0, 3], [1, 4], [2, 3], [2, 5],
    [3, 4], [3, 5], [0, 6], [2, 6], [5, 6]
  ];

  let selected = 'Reinforcement Learning';
  let rotationX = -0.18;
  let rotationY = 0.42;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let lastX = 0;
  let lastY = 0;
  let dragDistance = 0;
  let cssWidth = 720;
  let cssHeight = 500;
  let projected = [];
  let animationFrame = 0;
  let lastTime = performance.now();

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

    themeButtons.forEach((button) => {
      const active = button.dataset.theme === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    cssWidth = Math.max(300, rect.width);
    cssHeight = Math.max(320, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const rotatePoint = (point) => {
    const cy = Math.cos(rotationY);
    const sy = Math.sin(rotationY);
    const cx = Math.cos(rotationX);
    const sx = Math.sin(rotationX);

    const x1 = point.x * cy - point.z * sy;
    const z1 = point.x * sy + point.z * cy;
    const y1 = point.y * cx - z1 * sx;
    const z2 = point.y * sx + z1 * cx;

    return { x: x1, y: y1, z: z2 };
  };

  const projectPoint = (point) => {
    const rotated = rotatePoint(point);
    const base = Math.min(cssWidth, cssHeight) * 0.30;
    const depth = 3.2 + rotated.z;
    const scale = 2.75 / depth;
    return {
      x: cssWidth / 2 + rotated.x * base * scale,
      y: cssHeight / 2 + rotated.y * base * scale,
      z: rotated.z,
      scale
    };
  };

  const draw = (now) => {
    const elapsed = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (!dragging && !reducedMotion) rotationY += elapsed * 0.10;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const center = { x: cssWidth / 2, y: cssHeight / 2 };
    const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.min(cssWidth, cssHeight) * 0.48);
    glow.addColorStop(0, 'rgba(20,184,166,0.13)');
    glow.addColorStop(0.52, 'rgba(56,189,248,0.035)');
    glow.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    projected = themes.map((theme) => {
      const p = projectPoint(theme);
      return { ...p, theme };
    });

    ctx.lineWidth = 1;
    edges.forEach(([a, b]) => {
      const p1 = projected[a];
      const p2 = projected[b];
      const alpha = 0.15 + Math.max(-0.04, ((p1.z + p2.z) / 2 + 1.2) * 0.06);
      ctx.strokeStyle = 'rgba(148, 210, 214, ' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(148, 210, 214, 0.18)';
    projected.forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });

    const order = projected.slice().sort((a, b) => a.z - b.z);
    order.forEach((p) => {
      const active = p.theme.name === selected;
      const radius = Math.max(5.5, 8.2 * p.scale) + (active ? 3 : 0);
      const alpha = Math.min(1, Math.max(0.48, 0.66 + p.z * 0.16));

      if (active) {
        ctx.fillStyle = 'rgba(45,212,191,0.16)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = active ? '#5eead4' : 'rgba(226,232,240,' + alpha.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = active ? 'rgba(153,246,228,.95)' : 'rgba(148,163,184,.45)';
      ctx.lineWidth = active ? 1.5 : 1;
      ctx.stroke();

      const fontSize = Math.max(10.5, Math.min(14, 11.2 * p.scale));
      ctx.font = (active ? '650 ' : '500 ') + fontSize.toFixed(1) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = active ? '#ecfeff' : 'rgba(226,232,240,' + Math.min(1, alpha + 0.12).toFixed(2) + ')';
      ctx.fillText(p.theme.name, p.x, p.y + radius + 7);
    });

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(94,234,212,.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('INDRA', center.x, center.y + 17);

    if (!reducedMotion) animationFrame = requestAnimationFrame(draw);
  };

  const nearestTheme = (x, y) => {
    let best = null;
    let bestDistance = 34;
    projected.forEach((p) => {
      const distance = Math.hypot(x - p.x, y - p.y);
      if (distance < bestDistance) {
        best = p.theme;
        bestDistance = distance;
      }
    });
    return best;
  };

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragStartX = lastX = event.clientX;
    dragStartY = lastY = event.clientY;
    dragDistance = 0;
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    dragDistance += Math.abs(dx) + Math.abs(dy);
    rotationY += dx * 0.008;
    rotationX = Math.max(-1.1, Math.min(1.1, rotationX + dy * 0.006));
    lastX = event.clientX;
    lastY = event.clientY;
    if (reducedMotion) draw(performance.now());
  });

  canvas.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    dragging = false;

    if (dragDistance < 10) {
      const rect = canvas.getBoundingClientRect();
      const theme = nearestTheme(event.clientX - rect.left, event.clientY - rect.top);
      if (theme) {
        setTheme(theme.name);
        if (reducedMotion) draw(performance.now());
      }
    }
  });

  canvas.addEventListener('pointercancel', () => {
    dragging = false;
  });

  themeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.theme === selected));
    button.addEventListener('click', () => {
      setTheme(button.dataset.theme);
      if (reducedMotion) draw(performance.now());
    });
  });

  const observer = new ResizeObserver(() => {
    resize();
    if (reducedMotion) draw(performance.now());
  });
  observer.observe(canvas);

  setTheme(selected);
  resize();
  if (reducedMotion) {
    draw(performance.now());
  } else {
    animationFrame = requestAnimationFrame(draw);
  }

  window.addEventListener('pagehide', () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    observer.disconnect();
  }, { once: true });
})();
