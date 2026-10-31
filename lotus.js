// White Lotus — a more botanical ASCII bloom
// Draws layered, individually shaded petals and a veined lotus leaf on a
// low-resolution canvas, then converts the artwork into coloured ASCII glyphs.
(() => {
  'use strict';

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const buffer = document.createElement('canvas');
  const bctx = buffer.getContext('2d', { willReadFrequently: true });
  const RAMP = ' .,:;irsXA253hMHGS#9B&@';
  const W = 1000, H = 1000, FPS = 30;
  let cols = 0, rows = 0, cellW = 0, cellH = 0, dpr = 1;
  let start = performance.now(), last = 0, time = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const out = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const smooth = (a, b, t) => ease((t - a) / (b - a));

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    const fs = clamp(Math.floor(Math.min(w / 115, h / 95)), 6, 12);
    ctx.font = `bold ${fs}px Menlo, Consolas, monospace`;
    cellW = ctx.measureText('M').width || fs * 0.6;
    cellH = fs;
    cols = Math.ceil(w / cellW);
    rows = Math.ceil(h / cellH);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    buffer.width = cols;
    buffer.height = rows;
  }

  // A single pointed, gently cupped petal. Local +y points away from the flower centre.
  function drawPetal(g, length, width, open, layer, index, variation) {
    const lift = layer === 2 ? 1 : layer === 1 ? 0.72 : 0.42;
    const L = length * mix(0.42, 1, open) * variation.length;
    const w = width * mix(0.72, 1, open) * variation.width;
    const curl = mix(0.02, layer === 2 ? 0.15 : 0.09, open);

    g.save();
    // The base narrows into the receptacle; the shoulder broadens before tapering to a point.
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-w * 0.52, L * 0.13, -w * 0.78, L * 0.57, -w * 0.25, L * 0.91);
    g.quadraticCurveTo(0, L * (1.08 + curl), w * 0.25, L * 0.91);
    g.bezierCurveTo(w * 0.78, L * 0.57, w * 0.52, L * 0.13, 0, 0);

    const shade = layer === 0 ? '#bfc5b8' : layer === 1 ? '#d5d8ce' : '#e5e5dc';
    const grad = g.createLinearGradient(-w * 0.6, L * 0.35, w * 0.55, L * 0.9);
    grad.addColorStop(0, shade);
    grad.addColorStop(0.22, '#f1f0e9');
    grad.addColorStop(0.58, index % 3 === 0 ? '#fffefa' : '#faf9f3');
    grad.addColorStop(1, '#e5e5dc');
    g.fillStyle = grad;
    g.shadowColor = 'rgba(8,24,20,0.42)';
    g.shadowBlur = 7;
    g.shadowOffsetY = 3;
    g.fill();
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
    g.strokeStyle = 'rgba(139,148,132,0.48)';
    g.lineWidth = 2;
    g.stroke();

    // Central vein and two faint branching veins follow the petal's curvature.
    g.lineCap = 'round';
    g.strokeStyle = `rgba(157,163,143,${0.23 + open * 0.22})`;
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(0, L * 0.08);
    g.quadraticCurveTo(w * 0.08, L * 0.53, 0, L * 0.94);
    g.stroke();
    g.lineWidth = 1.1;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(0, L * 0.55);
      g.quadraticCurveTo(side * w * 0.3, L * 0.65, side * w * 0.36, L * 0.79);
      g.stroke();
    }
    // A faint highlight along one edge gives each petal a curved, waxy surface.
    g.strokeStyle = 'rgba(255,255,250,0.62)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-w * 0.28, L * 0.2);
    g.quadraticCurveTo(-w * 0.58, L * 0.58, -w * 0.13, L * 0.88);
    g.stroke();
    g.restore();
  }

  function drawLeaf(g, cx, cy, scale, sway) {
    g.save();
    g.translate(cx + sway, cy);
    g.scale(scale, scale * 0.62);
    // Lotus leaves are nearly circular, with a characteristic narrow split to the centre.
    g.beginPath();
    g.moveTo(0, 0);
    g.ellipse(0, 0, 285, 170, -0.08, 0.18, Math.PI * 2 - 0.18);
    g.closePath();
    const leaf = g.createRadialGradient(-45, -55, 12, 0, 0, 300);
    leaf.addColorStop(0, '#6c9a72');
    leaf.addColorStop(0.48, '#477d60');
    leaf.addColorStop(0.82, '#285c49');
    leaf.addColorStop(1, '#173d35');
    g.fillStyle = leaf;
    g.fill();
    g.strokeStyle = 'rgba(148,190,145,0.52)';
    g.lineWidth = 3;
    g.stroke();

    // Radiating veins fan out from the leaf's central attachment point.
    for (let i = -13; i <= 13; i++) {
      const a = -Math.PI / 2 + i * 0.115;
      const ex = Math.cos(a) * 270;
      const ey = Math.sin(a) * 155;
      g.strokeStyle = i % 3 === 0 ? 'rgba(174,204,151,0.48)' : 'rgba(157,190,143,0.27)';
      g.lineWidth = i % 3 === 0 ? 2.2 : 1.2;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(ex * 0.48 - 10, ey * 0.58, ex, ey);
      g.stroke();
    }
    // Small central dimple where the leaf stalk joins the blade.
    g.fillStyle = '#244f3d';
    g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawLotus(g) {
    const bloom = out((time - 0.8) / 6.5);
    const leafIn = ease((time - 0.1) / 2.4);
    const sway = Math.sin(time * 0.65) * 4;
    const cx = W / 2, cy = 475 + Math.sin(time * 0.8) * 2;

    // Deep, quiet water with subtle concentric ripples.
    g.save();
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = `rgba(91,145,137,${0.12 - i * 0.018})`;
      g.lineWidth = 2;
      const pulse = Math.sin(time * 0.8 - i * 0.7) * 5;
      g.beginPath();
      g.ellipse(cx, 790, 150 + i * 55 + pulse, 10 + i * 3, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    drawLeaf(g, cx + 10, 770, leafIn, sway);

    // Stem rises from the water and disappears beneath the bloom.
    g.save();
    g.strokeStyle = '#47785a';
    g.lineWidth = 13;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx + 8, 800);
    g.bezierCurveTo(cx - 18, 690, cx + 15, 625, cx, cy + 60);
    g.stroke();
    g.restore();

    // Slightly flattened perspective creates the open, bowl-like lotus profile.
    g.save();
    g.translate(cx, cy);
    g.scale(1, 0.78);
    const layers = [
      // outer: broad, low petals that turn outward
      { count: 11, length: 235, width: 66, radius: 5, start: 0.12, delay: 0.4, duration: 5.4, tilt: -0.12 },
      // middle: overlapping petals rising behind the centre
      { count: 9, length: 190, width: 57, radius: 2, start: 0.43, delay: 1.15, duration: 5.0, tilt: 0.02 },
      // inner: narrower, more upright petals around the seed head
      { count: 7, length: 142, width: 46, radius: 0, start: 0.18, delay: 2.0, duration: 4.6, tilt: 0.19 },
    ];

    layers.forEach((L, layer) => {
      const opened = ease((time - L.delay) / L.duration);
      const scale = mix(0.34, 1, out((time - L.delay * 0.55) / 2.6));
      for (let i = 0; i < L.count; i++) {
        const angle = (i / L.count) * Math.PI * 2 + L.start;
        const irregular = 1 + Math.sin(i * 12.7 + layer) * 0.055;
        g.save();
        g.rotate(angle);
        g.translate(0, -L.radius);
        // Outer petals lean farther out; inner petals stay upright.
        g.rotate(L.tilt * (1 - opened));
        g.scale(scale * irregular, scale);
        drawPetal(g, L.length, L.width, opened, layer, i, {
          length: 0.94 + 0.09 * Math.sin(i * 4.1 + layer),
          width: 0.91 + 0.13 * Math.cos(i * 3.3 + layer),
        });
        g.restore();
      }
    });

    // Golden receptacle (seed head), textured with tiny seed pits.
    const centre = ease((time - 4.3) / 2.1);
    g.globalAlpha = centre;
    g.save();
    g.translate(0, 4);
    const disk = g.createRadialGradient(-8, -15, 4, 0, 0, 48);
    disk.addColorStop(0, '#f0d98d');
    disk.addColorStop(0.55, '#c6a84e');
    disk.addColorStop(1, '#8e7536');
    g.fillStyle = disk;
    g.beginPath(); g.ellipse(0, 0, 43, 34, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(91,69,28,0.55)';
    g.lineWidth = 2;
    g.stroke();
    for (let row = -3; row <= 3; row++) {
      for (let col = -4; col <= 4; col++) {
        const x = col * 9 + (row % 2) * 4;
        const y = row * 8;
        if ((x * x) / (37 * 37) + (y * y) / (28 * 28) < 0.88) {
          g.fillStyle = (row + col) % 2 ? '#8d7132' : '#f4dfa0';
          g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
        }
      }
    }
    g.restore();

    // Fine curved stamens form a delicate golden fringe around the receptacle.
    g.strokeStyle = '#d6bd70';
    g.lineWidth = 2;
    for (let i = 0; i < 42; i++) {
      const a = (i / 42) * Math.PI * 2;
      const inner = 37 + (i % 3) * 2;
      const outer = 66 + Math.sin(i * 2.4) * 5;
      const x1 = Math.cos(a) * inner, y1 = Math.sin(a) * inner * 0.72;
      const x2 = Math.cos(a) * outer, y2 = Math.sin(a) * outer * 0.72;
      g.beginPath();
      g.moveTo(x1, y1);
      g.quadraticCurveTo((x1 + x2) * 0.52, (y1 + y2) * 0.52 - 3, x2, y2);
      g.stroke();
      g.fillStyle = '#e8d28b';
      g.beginPath(); g.arc(x2, y2, 2.7, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    g.restore();
  }

  function render() {
    const aspect = cellH / cellW;
    const scale = Math.min(cols / W, (rows * aspect) / H) * 0.94;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = '#030809';
    bctx.fillRect(0, 0, cols, rows);
    bctx.setTransform(scale, 0, 0, scale / aspect,
      (cols - W * scale) / 2, (rows - H * scale / aspect) / 2);
    drawLotus(bctx);

    const pixels = bctx.getImageData(0, 0, cols, rows).data;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#030809';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.textBaseline = 'top';
    const n = RAMP.length - 1;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = pixels[i], gg = pixels[i + 1], b = pixels[i + 2];
        const m = Math.max(r, gg, b);
        if (m < 18) continue;
        const brightness = m / 255;
        const idx = clamp(Math.round(Math.pow(brightness, 0.72) * n), 1, n);
        const lift = Math.min(1.2, (38 + 215 * brightness) / m);
        ctx.fillStyle = `rgb(${Math.min(255, r * lift) | 0},${Math.min(255, gg * lift) | 0},${Math.min(255, b * lift) | 0})`;
        ctx.fillText(RAMP[idx], x * cellW, y * cellH);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    last = now;
    time = (now - start) / 1000;
    render();
  }

  function replay() { start = performance.now(); time = 0; }
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'r' || e.key === ' ') replay();
  });
  canvas.addEventListener('click', replay);
  resize();
  requestAnimationFrame(frame);
})();