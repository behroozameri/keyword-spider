(() => {
  window.Spider?.cleanup?.();
  document.getElementById('__spider')?.remove();
  const c = document.createElement('canvas');
  c.id = '__spider';
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;pointer-events:none';
  document.body.appendChild(c);
  const g = c.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  const fit = () => { c.width = innerWidth * DPR; c.height = innerHeight * DPR; };
  fit(); addEventListener('resize', fit);

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const L1 = 44, L2 = 64, STEP_T = 0.17, MAXV = 480;
  const S = { x: 300, y: 500, tx: 300, ty: 500, vx: 0, vy: 0, speed: 0, h: -Math.PI / 2, face: null };
  let time = 0, frameId = null, destroyed = false;
  let activeScrollRoot = document.scrollingElement || document.documentElement;
  let lastScrollTop = activeScrollRoot.scrollTop || scrollY;

  // Adapters can register category colors with Spider.colors.type = '#rrggbb'.
  const COLORS = {};

  // ---------- user interface ----------
  document.getElementById('__spider-ui')?.remove();
  document.getElementById('__spider-ui-style')?.remove();
  const uiStyle = document.createElement('style');
  uiStyle.id = '__spider-ui-style';
  uiStyle.textContent = `
    #__spider-ui { position:fixed; top:16px; right:16px; width:320px; max-height:calc(100vh - 32px);
      z-index:2147483646; display:flex; flex-direction:column; overflow:hidden; color:#f5f1ff;
      background:rgba(17,12,23,.94); border:1px solid rgba(190,150,255,.42); border-radius:14px;
      box-shadow:0 16px 45px rgba(0,0,0,.45); font:13px/1.35 system-ui,-apple-system,sans-serif;
      backdrop-filter:blur(10px); }
    #__spider-ui * { box-sizing:border-box; }
    #__spider-ui header { display:flex; align-items:center; justify-content:space-between; padding:12px 14px;
      border-bottom:1px solid rgba(190,150,255,.18); }
    #__spider-ui h2 { margin:0; font-size:14px; letter-spacing:.02em; }
    .__spider-header-actions { display:flex; align-items:center; gap:9px; }
    #__spider-count { color:#bfa4ff; font-variant-numeric:tabular-nums; }
    #__spider-controls { display:grid; grid-template-columns:auto 1fr auto; gap:8px; align-items:center; padding:10px 14px; }
    #__spider-controls[hidden] { display:none; }
    #__spider-ui button { border:1px solid rgba(190,150,255,.35); border-radius:8px; padding:6px 9px;
      color:#f5f1ff; background:#2a1d35; cursor:pointer; font:inherit; }
    #__spider-ui button:hover { background:#3a2850; }
    #__spider-ui button:disabled { opacity:.45; cursor:not-allowed; }
    #__spider-ui #__spider-close { display:grid; place-items:center; width:34px; height:34px; padding:0; border-radius:11px;
      color:#e9e1ef; background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(155,92,255,.08));
      border-color:rgba(205,175,255,.42); box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 4px 12px rgba(0,0,0,.18);
      line-height:1; transition:transform .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease,color .16s ease; }
    #__spider-ui #__spider-close span { display:block; font-size:22px; font-weight:400; line-height:1; transform:translateY(-1px); pointer-events:none; }
    #__spider-ui #__spider-close:hover { color:#fff; background:linear-gradient(145deg,#ff5b78,#d93661);
      border-color:#ff8197; box-shadow:0 6px 18px rgba(255,64,105,.3); transform:translateY(-1px); }
    #__spider-ui #__spider-close:active { transform:translateY(0) scale(.96); }
    #__spider-ui #__spider-close:focus-visible { outline:2px solid #d5b7ff; outline-offset:2px; }
    #__spider-speed { width:100%; accent-color:#9b5cff; }
    #__spider-speed-value { width:34px; text-align:right; color:#cdbdff; font-variant-numeric:tabular-nums; }
    #__spider-status { display:flex; align-items:center; gap:7px; min-height:25px; padding:0 14px 9px;
      color:#b9adbf; font-size:12px; }
    #__spider-status::before { content:''; flex:0 0 auto; width:7px; height:7px; border-radius:50%;
      background:#756b7b; box-shadow:0 0 0 rgba(155,92,255,0); }
    #__spider-status[data-state="walking"]::before,
    #__spider-status[data-state="scrolling"]::before,
    #__spider-status[data-state="inspecting"]::before { background:#b77cff;
      animation:__spider-pulse 1s ease-in-out infinite; }
    #__spider-status[data-state="scrolling"]::before { background:#4df0ff; }
    #__spider-status[data-state="inspecting"]::before { background:#4dffb8; }
    #__spider-status[data-state="paused"]::before { background:#ffd24d; }
    #__spider-status[data-state="complete"]::before { background:#4dffb8; }
    @keyframes __spider-pulse { 50% { transform:scale(1.45); box-shadow:0 0 10px currentColor; } }
    #__spider-legend { display:flex; flex-wrap:wrap; gap:6px 10px; padding:0 14px 10px; }
    .__spider-legend-item { display:flex; align-items:center; gap:5px; color:#d7cfdd; font-size:11px; }
    .__spider-dot { width:8px; height:8px; border-radius:50%; box-shadow:0 0 8px currentColor; }
    #__spider-results { margin:0; padding:0 8px 0 0; list-style:none; overflow:auto; min-height:72px; }
    .__spider-result { display:grid; grid-template-columns:4px 1fr auto; gap:8px; align-items:center;
      margin:0 6px 6px 14px; padding:7px 8px 7px 0; border-radius:8px; color:#d9d2df; opacity:.72; }
    .__spider-result[data-top="true"] { background:rgba(255,255,255,.035); opacity:1; }
    .__spider-result[data-touched="true"] { background:rgba(155,92,255,.16); }
    .__spider-bar { align-self:stretch; border-radius:4px; }
    .__spider-value { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .__spider-meta { color:#9f94a7; font-size:10px; text-transform:uppercase; }
    .__spider-score { color:#fff; font-weight:700; font-variant-numeric:tabular-nums; }
    #__spider-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:10px 14px 12px;
      border-top:1px solid rgba(190,150,255,.18); }
  `;
  document.head.appendChild(uiStyle);

  const panel = document.createElement('aside');
  panel.id = '__spider-ui';
  panel.setAttribute('aria-label', 'Spider keyword results');
  panel.innerHTML = `
    <header>
      <h2>Spider Keywords</h2>
      <div class="__spider-header-actions">
        <span id="__spider-count">0 results</span>
        <button id="__spider-close" type="button" title="Close Keyword Spider" aria-label="Close Keyword Spider">
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </header>
    <div id="__spider-controls">
      <button id="__spider-pause" type="button">Pause</button>
      <input id="__spider-speed" type="range" min="0.25" max="3" step="0.25" value="1" aria-label="Animation speed">
      <span id="__spider-speed-value">1×</span>
    </div>
    <div id="__spider-status" data-state="idle">Waiting for extraction…</div>
    <div id="__spider-legend"></div>
    <ol id="__spider-results"></ol>
    <div id="__spider-actions">
      <button id="__spider-export-json" type="button" disabled>Export JSON</button>
      <button id="__spider-export-csv" type="button" disabled>Export CSV</button>
    </div>`;
  document.body.appendChild(panel);

  const UI = {
    paused: false,
    speed: 1,
    pauseStarted: null,
    totalPaused: 0,
    rows: new WeakMap(),
    resumeStatus: null,
    celebration: '',
    webProgress: 0,
    homeBottom: innerHeight,
    spiderScale: 1,
  };
  const controlsElement = panel.querySelector('#__spider-controls');
  const pauseButton = panel.querySelector('#__spider-pause');
  const speedInput = panel.querySelector('#__spider-speed');
  const speedValue = panel.querySelector('#__spider-speed-value');
  const statusElement = panel.querySelector('#__spider-status');
  const legendElement = panel.querySelector('#__spider-legend');
  const resultsElement = panel.querySelector('#__spider-results');
  const countElement = panel.querySelector('#__spider-count');
  const closeButton = panel.querySelector('#__spider-close');
  const jsonButton = panel.querySelector('#__spider-export-json');
  const csvButton = panel.querySelector('#__spider-export-csv');

  function setStatus(message, state = 'idle') {
    statusElement.textContent = message;
    statusElement.dataset.state = state;
  }

  function setPaused(paused) {
    if (UI.paused === paused) return;
    UI.paused = paused;
    if (paused) {
      UI.pauseStarted = performance.now();
      UI.resumeStatus = {
        message: statusElement.textContent,
        state: statusElement.dataset.state || 'walking',
      };
    } else if (UI.pauseStarted !== null) {
      UI.totalPaused += performance.now() - UI.pauseStarted;
      UI.pauseStarted = null;
    }
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    pauseButton.setAttribute('aria-pressed', String(paused));
    if (paused) setStatus('Spider paused', 'paused');
    else {
      setStatus(UI.resumeStatus?.message || 'Spider walking', UI.resumeStatus?.state || 'walking');
      UI.resumeStatus = null;
    }
  }

  function activeNow() {
    const currentPause = UI.paused && UI.pauseStarted !== null
      ? performance.now() - UI.pauseStarted
      : 0;
    return performance.now() - UI.totalPaused - currentPause;
  }

  pauseButton.addEventListener('click', () => setPaused(!UI.paused));
  closeButton.addEventListener('click', () => cleanup());
  speedInput.addEventListener('input', () => {
    UI.speed = Number(speedInput.value);
    speedValue.textContent = `${UI.speed}×`;
  });

  // ---------- legs ----------
  const BASE = [32, 68, 108, 148].map(d => d * Math.PI / 180);
  const HIPF = [12, 6, 0, -6];
  const RR = [90, 94, 94, 90];
  const legs = [];
  for (let s = 0; s < 2; s++) for (let k = 0; k < 4; k++) {
    const side = s ? 1 : -1;
    legs.push({ a: side * BASE[k], hf: HIPF[k], R: RR[k], side, group: (k + s) % 2,
                fx: 0, fy: 0, step: null, reach: null, lift: 0 });
  }
  const loc = (x, y) => ({
    x: S.x + Math.cos(S.h) * x - Math.sin(S.h) * y,
    y: S.y + Math.sin(S.h) * x + Math.cos(S.h) * y });
  const restPos = l => {
    const a = S.h + l.a;
    return { x: S.x + Math.cos(a) * l.R + clamp(S.vx * 0.12, -60, 60),
             y: S.y + Math.sin(a) * l.R + clamp(S.vy * 0.12, -60, 60) };
  };
  legs.forEach(l => { const r = restPos(l); l.fx = r.x; l.fy = r.y; });

  // ---------- update ----------
  const stepping = grp => legs.some(l => l.group === grp && l.step);

  function updateReach(l, dt) {
    const R = l.reach;
    if (R.delay > 0) { R.delay -= dt; return; }
    if (R.t === 0) { R.sx = l.fx; R.sy = l.fy; }
    R.t += dt;
    const r = R.el.getBoundingClientRect();
    const tx = clamp(S.x, r.left + 4, Math.max(r.left + 4, r.right - 4));
    const ty = clamp(S.y, r.top + 3, Math.max(r.top + 3, r.bottom - 3));
    if (R.t < 0.3) {
      const e = easeOut(R.t / 0.3);
      l.fx = lerp(R.sx, tx, e); l.fy = lerp(R.sy, ty, e);
      l.lift = Math.sin(Math.PI * R.t / 0.3) * 1.2;
    } else {
      l.fx = tx; l.fy = ty;
      l.lift = Math.max(0, 0.5 - (R.t - 0.3) * 5);
      if (!R.touched) { R.touched = true; R.onTouch(); }
    }
    if (R.t > 0.85) { l.reach = null; R.done(); }
  }

  function updateLeg(l, dt) {
    if (UI.celebration === 'wave' && l === legs[0]) {
      l.step = null;
      l.reach = null;
      const wave = Math.sin(time * 10);
      l.fx = S.x + 54 + wave * 14;
      l.fy = S.y - 52 - Math.abs(wave) * 10;
      l.lift = 1;
      return;
    }
    if (l.reach) return updateReach(l, dt);
    if (l.step) {
      const s = l.step; s.t += dt / STEP_T;
      if (s.t >= 1) { l.fx = s.tx; l.fy = s.ty; l.step = null; l.lift = 0; }
      else { const e = easeIO(s.t); l.fx = lerp(s.fx, s.tx, e); l.fy = lerp(s.fy, s.ty, e); l.lift = Math.sin(Math.PI * s.t); }
      return;
    }
    const r = restPos(l);
    const d = Math.hypot(l.fx - r.x, l.fy - r.y);
    const other = stepping(1 - l.group);
    if ((d > (S.speed > 50 ? 28 : 40) && !other) || d > 75)
      l.step = { t: 0, fx: l.fx, fy: l.fy, tx: r.x, ty: r.y };
  }

  function update(dt, rawDt) {
    const ox = S.x, oy = S.y;
    const dx = S.tx - S.x, dy = S.ty - S.y, d = Math.hypot(dx, dy);
    if (d > 0.5) {
      const k = Math.min(d * (1 - Math.exp(-4 * dt)), MAXV * dt);
      S.x += dx / d * k; S.y += dy / d * k;
    }
    const scrollVelocity = (scrollTopFor(activeScrollRoot) - lastScrollTop) / rawDt;
    lastScrollTop = scrollTopFor(activeScrollRoot);
    S.vx = (S.x - ox) / rawDt;
    S.vy = (S.y - oy) / rawDt + scrollVelocity;
    S.speed = Math.hypot(S.vx, S.vy);
    let want = null;
    if (S.speed > 50) want = Math.atan2(S.vy, S.vx);
    else if (S.face) { const f = S.face(); if (f) want = Math.atan2(f.y - S.y, f.x - S.x); }
    if (want !== null) S.h += angDiff(want, S.h) * (1 - Math.exp(-dt * 7));
    legs.forEach(l => updateLeg(l, dt));
  }

  // ---------- inverse kinematics ----------
  function solve(l) {
    const hp = loc(l.hf, l.side * 5);
    const dx = l.fx - hp.x, dy = l.fy - hp.y, d = Math.hypot(dx, dy) || 1;
    const dd = clamp(d, 24, L1 + L2 - 1);
    const ux = dx / d, uy = dy / d;
    const foot = { x: hp.x + ux * dd, y: hp.y + uy * dd };
    const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const mx = hp.x + ux * a, my = hp.y + uy * a;
    const c1 = { x: mx - uy * h, y: my + ux * h }, c2 = { x: mx + uy * h, y: my - ux * h };
    let k = dist(c1, S) > dist(c2, S) ? c1 : c2;
    k = { x: k.x + (k.x - mx) * 0.35 * l.lift, y: k.y + (k.y - my) * 0.35 * l.lift };
    return { hip: hp, knee: k, foot };
  }

  // ---------- drawing ----------
  function seg(ax, ay, bx, by, w0, w1) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    g.beginPath();
    g.moveTo(ax + nx * w0 / 2, ay + ny * w0 / 2); g.lineTo(bx + nx * w1 / 2, by + ny * w1 / 2);
    g.lineTo(bx - nx * w1 / 2, by - ny * w1 / 2); g.lineTo(ax - nx * w0 / 2, ay - ny * w0 / 2);
    g.closePath(); g.fill(); g.stroke();
  }
  function drawLeg(l) {
    const { hip, knee, foot } = solve(l);
    const s = 1 + 0.25 * l.lift;
    g.fillStyle = '#17101c'; g.strokeStyle = 'rgba(190,150,255,.55)'; g.lineWidth = 1;
    seg(hip.x, hip.y, knee.x, knee.y, 6 * s, 4.2 * s);
    seg(knee.x, knee.y, foot.x, foot.y, 4.2 * s, 1.4);
    g.beginPath(); g.arc(knee.x, knee.y, 3.4 * s, 0, 7); g.fill(); g.stroke();
  }
  function ell(x, y, rx, ry, c0, c1) {
    const gr = g.createRadialGradient(x - rx * .3, y - ry * .3, 2, x, y, Math.max(rx, ry));
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.strokeStyle = 'rgba(190,150,255,.5)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); g.stroke();
  }
  function drawBody() {
    g.save(); g.translate(S.x, S.y); g.rotate(S.h);
    const br = 1 + 0.03 * Math.sin(time * 3);
    ell(-26, 0, 23 * br, 17 * br, '#3d2a4a', '#0e0810');
    g.fillStyle = 'rgba(255,60,90,.85)';
    g.beginPath(); g.ellipse(-27, 0, 7, 3.2, 0, 0, 7); g.fill();
    ell(5, 0, 16, 11.5, '#4a3459', '#120a16');
    g.strokeStyle = '#17101c'; g.lineWidth = 3; g.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const w = Math.sin(time * 6 + sd) * 2;
      g.beginPath(); g.moveTo(15, sd * 4); g.lineTo(24 + w, sd * 7); g.stroke();
    }
    g.fillStyle = '#ff3355'; g.shadowColor = '#ff3355'; g.shadowBlur = 6;
    for (const [x, y, r] of [[16, 3.4, 2.2], [16, -3.4, 2.2], [13.5, 7, 1.5], [13.5, -7, 1.5]]) {
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    g.restore();
  }

  const marks = [];
  function drawHomeWeb() {
    if (UI.webProgress <= 0) return;
    const cx = 12;
    const cy = UI.homeBottom - 12;
    const radius = 115 * UI.webProgress;
    g.save();
    g.strokeStyle = 'rgba(210,190,255,.58)';
    g.lineWidth = 1;
    g.shadowColor = 'rgba(170,120,255,.4)';
    g.shadowBlur = 4;
    for (let index = 0; index <= 6; index++) {
      const angle = -Math.PI / 2 + index * (Math.PI / 12);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      g.stroke();
    }
    for (let ring = 0.25; ring <= 1; ring += 0.2) {
      g.beginPath();
      g.arc(cx, cy, radius * ring, -Math.PI / 2, 0);
      g.stroke();
    }
    g.restore();
  }
  function drawMarks(dt) {
    for (const m of marks) {
      const r = m.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      m.t = Math.min(1, m.t + dt * 4); m.ring = Math.min(1, m.ring + dt * 2.2);
      const p = 8 * (1 - m.t);
      g.strokeStyle = m.color; g.lineWidth = 2;
      g.strokeRect(r.left - p, r.top - p, r.width + 2 * p, r.height + 2 * p);
      g.fillStyle = m.color + '55'; g.fillRect(r.left, r.top, r.width, r.height);
      if (m.ring < 1) {
        g.globalAlpha = 1 - m.ring; g.beginPath();
        g.arc(r.left + r.width / 2, r.top + r.height / 2, 6 + m.ring * 40, 0, 7); g.stroke();
        g.globalAlpha = 1;
      }
      g.font = 'bold 12px monospace';
      const w = g.measureText(m.label).width + 8;
      g.fillStyle = m.color; g.fillRect(r.left, r.top - 17, w, 15);
      g.fillStyle = '#000'; g.fillText(m.label, r.left + 4, r.top - 5);
    }
  }

  let last = performance.now();
  function frame(now) {
    if (destroyed) return;
    const rawDt = Math.max(0.001, Math.min(0.05, (now - last) / 1000));
    last = now;
    const dt = UI.paused ? 0 : rawDt * UI.speed;
    if (dt > 0) {
      time += dt;
      update(dt, rawDt);
    } else lastScrollTop = scrollTopFor(activeScrollRoot);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    drawHomeWeb();
    drawMarks(dt);
    g.save();
    g.translate(S.x, S.y);
    g.scale(UI.spiderScale, UI.spiderScale);
    g.translate(-S.x, -S.y);
    g.shadowColor = 'rgba(170,120,255,.45)'; g.shadowBlur = 8;
    legs.forEach(drawLeg);
    drawBody();
    g.shadowBlur = 0;
    g.restore();
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);

  // ---------- helpers ----------
  const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const hasBox = el => {
    if (!el?.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isDocumentScrollRoot = root => root === document.scrollingElement ||
    root === document.documentElement || root === document.body;
  const scrollTopFor = root => isDocumentScrollRoot(root) ? scrollY : root.scrollTop;
  const maxScrollTop = root => isDocumentScrollRoot(root)
    ? Math.max(0, Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0) - innerHeight)
    : Math.max(0, root.scrollHeight - root.clientHeight);
  const scrollViewport = root => {
    if (isDocumentScrollRoot(root)) return { top: 0, bottom: innerHeight, height: innerHeight };
    const rect = root.getBoundingClientRect();
    const top = clamp(rect.top, 0, innerHeight);
    const bottom = clamp(rect.bottom, top, innerHeight);
    return { top, bottom, height: Math.max(1, bottom - top) };
  };
  function nearestScrollRoot(element) {
    for (let parent = element?.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|overlay)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 4) {
        return parent;
      }
    }
    return document.scrollingElement || document.documentElement;
  }
  function selectScrollRoot(items) {
    const counts = new Map();
    for (const target of items) {
      const root = nearestScrollRoot(target.el);
      counts.set(root, (counts.get(root) || 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || maxScrollTop(b[0]) - maxScrollTop(a[0]))[0]?.[0]
      || document.scrollingElement || document.documentElement;
  }
  function setScrollTop(root, top) {
    if (isDocumentScrollRoot(root)) {
      window.scrollTo({ left: scrollX, top, behavior: 'instant' });
    } else {
      root.scrollTo({ left: root.scrollLeft, top, behavior: 'instant' });
    }
  }
  async function animationSleep(ms) {
    let remaining = Math.max(0, ms);
    let previous = performance.now();
    while (!destroyed && remaining > 0) {
      await sleep(Math.min(40, remaining));
      const now = performance.now();
      if (!UI.paused) remaining -= (now - previous) * UI.speed;
      previous = now;
    }
  }
  async function waitFor(fn, ms) {
    const deadline = activeNow() + Math.max(0, ms);
    while (!destroyed && !fn() && activeNow() < deadline) await sleep(50);
    return !destroyed && fn();
  }
  async function scrollPageTo(requestedTop, deadline, allowUpward = false) {
    const start = scrollTopFor(activeScrollRoot);
    const lowerBound = allowUpward ? 0 : start;
    const end = clamp(requestedTop, lowerBound, maxScrollTop(activeScrollRoot));
    const distance = Math.abs(end - start);
    if (distance < 2) return;
    const duration = clamp(distance * 1.7, 600, 2600);
    const started = activeNow();
    while (!destroyed && activeNow() < deadline) {
      const progress = clamp((activeNow() - started) * UI.speed / duration, 0, 1);
      setScrollTop(activeScrollRoot, lerp(start, end, easeIO(progress)));
      if (progress >= 1) break;
      await sleep(16);
    }
    if (!destroyed && activeNow() < deadline) {
      setScrollTop(activeScrollRoot, end);
    }
  }
  async function withTimeout(promise, ms, message) {
    let settled = false, value, failure;
    promise.then(
      result => { settled = true; value = result; },
      error => { settled = true; failure = error; },
    );
    const deadline = activeNow() + Math.max(1, ms);
    while (!destroyed && !settled && activeNow() < deadline) await sleep(32);
    if (!settled) throw new Error(message);
    if (failure) throw failure;
    return value;
  }

  // ---------- English keyphrase extraction ----------
  const TECH_DICTIONARY = {
    skill: ['python','go','golang','java','typescript','javascript','kotlin','sql','postgres',
            'postgresql','dynamodb','nosql','aws','azure','gcp','docker','kubernetes','terraform',
            'react','fastapi','pytorch','tensorflow','langchain','pgvector','weaviate','bedrock',
            'spark','airflow','snowflake','kafka','ci/cd','rag','llm','nlp','mlops'],
    ml:    ['machine learning','ml infrastructure','ai/ml','ai platform','model training',
            'model serving','feature','data workflows','orchestration','deployment','evaluation',
            'ai coding tools','ai models','applied scientists','recommendations','fraud detection'],
    eng:   ['backend','data structures','algorithms','software design','scalable','high-performance',
            'infrastructure','production','distributed systems','microservices','apis'],
    soft:  ['communication','leadership','collaboration','mentoring','stakeholder',
            'bias to action','fast-paced','ambiguity','ownership'],
    req:   ['years of professional','years of experience','bachelor','master','degree','certification'],
  };
  COLORS.skill = '#4da3ff'; COLORS.ml = '#4dffb8'; COLORS.eng = '#c0ff4d';
  COLORS.soft = '#ffd24d'; COLORS.req = '#ff4da6';
  COLORS.keyword = '#4da3ff'; COLORS.keyphrase = '#4dffb8';

  const ENGLISH_STOPWORDS = new Set((
    'a about above after again against all am an and any are as at be because been before being below ' +
    'between both but by can could did do does doing down during each few for from further had has have ' +
    'having he her here hers herself him himself his how i if in into is it its itself just me more most ' +
    'my myself no nor not now of off on once only or other our ours ourselves out over own same she should ' +
    'so some such than that the their theirs them themselves then there these they this those through to ' +
    'too under until up very was we were what when where which while who whom why will with would you your ' +
    'yours yourself yourselves may might must shall also using use used via per within without including ' +
    "include includes including etc able across among around however therefore yet don't doesn't didn't " +
    "won't wouldn't can't cannot couldn't isn't aren't wasn't weren't hasn't haven't hadn't shouldn't"
  ).split(/\s+/));

  const WORD_SEGMENTER = new Intl.Segmenter('en', { granularity: 'word' });
  const LATIN_TOKEN = /^(?=.*[A-Za-z])[\p{Script=Latin}\p{M}\p{N}'’-]+$/u;
  const JOINER = /^[\s/&+#-]*$/u;

  function normalizeWord(value) {
    return value
      .normalize('NFKC')
      .replace(/[‘’]/g, "'")
      .replace(/'s$/i, '')
      .toLocaleLowerCase('en-US');
  }

  function segmentWords(text) {
    return [...WORD_SEGMENTER.segment(text)]
      .filter(part => part.isWordLike)
      .map(part => ({
        raw: part.segment,
        word: normalizeWord(part.segment),
        start: part.index,
        end: part.index + part.segment.length,
      }))
      .filter(token => LATIN_TOKEN.test(token.word));
  }

  function canJoin(text, left, right) {
    const gap = text.slice(left.end, right.start);
    // A bare dot can join names such as Node.js, but ". " ends a sentence.
    return gap === '.' || JOINER.test(gap);
  }

  function normalizedPhrase(text) {
    return segmentWords(text).map(token => token.word).join(' ');
  }

  function phraseInText(phrase, text) {
    if (!phrase || !text) return false;
    return (` ${text} `).includes(` ${phrase} `);
  }

  function dictionaryEntries(dict) {
    const entries = new Map();
    if (!dict || typeof dict !== 'object') return entries;
    for (const [type, phrases] of Object.entries(dict)) {
      if (!Array.isArray(phrases)) continue;
      for (const phrase of phrases) {
        const key = normalizedPhrase(String(phrase));
        if (key) entries.set(key, { type, phrase: String(phrase) });
      }
      if (!COLORS[type]) COLORS[type] = '#4da3ff';
    }
    return entries;
  }

  function visibleTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.visually-hidden, .sr-only, [class*="visually-hidden"], ' +
          '[class*="screen-reader"], [class*="sr-only"]')) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, noscript, template, svg, canvas, textarea, input, select, option, button, ' +
          'nav, aside, footer, [role="button"], [role="navigation"], [role="complementary"], ' +
          '[role="banner"], [role="contentinfo"], [role="search"], [role="menu"], [role="menubar"], ' +
          '[role="toolbar"], [role="tablist"], [aria-modal="true"], [contenteditable="true"], ' +
          '[hidden], [aria-hidden="true"], ' +
          '[data-spider-ignore], #__spider, #__spider-ui')) {
          return NodeFilter.FILTER_REJECT;
        }
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return NodeFilter.FILTER_REJECT;
        }
        if (typeof parent.checkVisibility === 'function' && !parent.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        })) return NodeFilter.FILTER_REJECT;
        const range = document.createRange();
        range.selectNodeContents(node);
        const hasLayout = [...range.getClientRects()].some(rect => rect.width > 0.5 && rect.height > 0.5);
        return hasLayout ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    for (let node; (node = walker.nextNode()); ) nodes.push(node);
    return nodes;
  }

  const TEXT_BLOCK_SELECTOR = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'pre',
    'figcaption', 'caption', 'td', 'th', 'dt', 'dd', '[itemprop="articleBody"]',
  ].join(', ');

  function contextFor(node, blockCache) {
    const parent = node.parentElement;
    const style = getComputedStyle(parent);
    const numericWeight = Number.parseInt(style.fontWeight, 10);
    const block = parent.closest(TEXT_BLOCK_SELECTOR) || parent;
    let blockContext = blockCache.get(block);
    if (!blockContext) {
      const blockText = (block.textContent || '').replace(/\s+/g, ' ').trim();
      const links = block.matches('a[href]') ? [block] : [...block.querySelectorAll('a[href]')];
      const linkCharacters = links.reduce(
        (sum, link) => sum + (link.textContent || '').replace(/\s+/g, ' ').trim().length,
        0,
      );
      const linkDensity = Math.min(1, linkCharacters / Math.max(1, blockText.length));
      let blockQuality = 0.58;
      if (block.matches('h1, h2, h3, h4, h5, h6')) blockQuality = 1;
      else if (block.matches('p, blockquote, pre, [itemprop="articleBody"]')) blockQuality = 0.88;
      else if (block.matches('li, figcaption, caption, td, th, dt, dd')) blockQuality = 0.72;
      if (blockText.length < 20) blockQuality -= 0.12;
      blockQuality = clamp(blockQuality - linkDensity * 0.45, 0, 1);
      blockContext = { block, blockQuality, linkDensity };
      blockCache.set(block, blockContext);
    }
    return {
      heading: Boolean(parent.closest('h1, h2, h3, h4, h5, h6')),
      emphasis: Boolean(parent.closest('strong, b, em')) || style.fontWeight === 'bold' || numericWeight >= 600,
      ...blockContext,
    };
  }

  function addRakeStatistics(nodeData, stats, stopwords) {
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const degree = Math.max(0, run.length - 1);
      for (const token of run) {
        const current = stats.get(token.word) || { frequency: 0, degree: 0 };
        current.frequency += 1;
        current.degree += degree;
        stats.set(token.word, current);
      }
      run = [];
    };

    for (let i = 0; i < nodeData.tokens.length; i++) {
      const token = nodeData.tokens[i];
      const previous = nodeData.tokens[i - 1];
      if ((previous && !canJoin(nodeData.text, previous, token)) || stopwords.has(token.word)) {
        flush();
        if (stopwords.has(token.word)) continue;
      }
      run.push(token);
    }
    flush();
  }

  function wrapCandidates(candidates, limit) {
    const occupied = new WeakMap();
    const placements = [];

    for (const candidate of candidates) {
      if (placements.length >= limit) break;
      const occurrences = [...candidate.occurrences].sort((a, b) => {
        const signalA = Number(a.heading) * 3 + Number(a.emphasis) * 2 + a.blockQuality + a.position;
        const signalB = Number(b.heading) * 3 + Number(b.emphasis) * 2 + b.blockQuality + b.position;
        return signalB - signalA;
      });
      const occurrence = occurrences.find(item => {
        const ranges = occupied.get(item.node) || [];
        return !ranges.some(range => item.start < range.end && item.end > range.start);
      });
      if (!occurrence) continue;
      const ranges = occupied.get(occurrence.node) || [];
      ranges.push({ start: occurrence.start, end: occurrence.end });
      occupied.set(occurrence.node, ranges);
      placements.push({ candidate, occurrence });
    }

    const byNode = new Map();
    for (const placement of placements) {
      const list = byNode.get(placement.occurrence.node) || [];
      list.push(placement);
      byNode.set(placement.occurrence.node, list);
    }

    for (const [node, list] of byNode) {
      list.sort((a, b) => b.occurrence.start - a.occurrence.start);
      for (const placement of list) {
        const { occurrence, candidate } = placement;
        const range = document.createRange();
        range.setStart(node, occurrence.start);
        range.setEnd(node, occurrence.end);
        const span = document.createElement('span');
        span.setAttribute('data-spider-keyword', '');
        span.style.setProperty('display', 'inline', 'important');
        span.style.setProperty('position', 'static', 'important');
        span.style.setProperty('inset', 'auto', 'important');
        span.style.setProperty('width', 'auto', 'important');
        span.style.setProperty('height', 'auto', 'important');
        span.style.setProperty('min-width', '0', 'important');
        span.style.setProperty('min-height', '0', 'important');
        span.style.setProperty('transform', 'none', 'important');
        range.surroundContents(span);
        candidate.el = span;
        candidate.text = occurrence.text;
      }
    }
    return placements.map(placement => placement.candidate).filter(candidate => {
      const span = candidate.el;
      const rect = span.getBoundingClientRect();
      const style = getComputedStyle(span);
      const fontSize = Number.parseFloat(style.fontSize) || 16;
      const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.3;
      const sane = rect.width > 0.5 && rect.height > 0.5 &&
        rect.width < innerWidth * 0.95 && rect.height <= Math.max(96, lineHeight * 4.5);
      if (sane) return true;
      const parent = span.parentNode;
      span.replaceWith(...span.childNodes);
      parent?.normalize();
      candidate.el = null;
      return false;
    });
  }

  function keywordItems(rootSel, dict = null, options = {}) {
    const matchedRoots = [...document.querySelectorAll(rootSel)];
    const roots = (matchedRoots.length ? matchedRoots : [document.body])
      .filter(root => !matchedRoots.some(other => other !== root && other.contains(root)));
    const maxCandidates = Math.max(1, Math.floor(options.limit || 80));
    const minScore = Number.isFinite(options.minScore) ? options.minScore : 0.12;
    const dictionary = dictionaryEntries(dict);
    const stopwords = new Set(ENGLISH_STOPWORDS);
    for (const word of options.stopwords || []) {
      const normalized = normalizeWord(String(word));
      if (normalized) stopwords.add(normalized);
    }
    const titleText = normalizedPhrase(document.title || '');
    const metaText = normalizedPhrase(
      document.querySelector('meta[name="description" i]')?.content || ''
    );
    const nodes = roots.flatMap(visibleTextNodes);
    const totalCharacters = Math.max(1, nodes.reduce((sum, node) => sum + node.nodeValue.length, 0));
    const blockCache = new WeakMap();
    let characterOffset = 0;
    const nodeData = nodes.map(node => {
      const data = {
        node,
        text: node.nodeValue,
        tokens: segmentWords(node.nodeValue),
        offset: characterOffset,
        ...contextFor(node, blockCache),
      };
      characterOffset += node.nodeValue.length;
      return data;
    }).filter(data => data.tokens.length);

    const rakeStats = new Map();
    nodeData.forEach(data => addRakeStatistics(data, rakeStats, stopwords));
    const rakeWordScore = word => {
      const stat = rakeStats.get(word);
      return stat ? (stat.degree + stat.frequency) / stat.frequency : 0;
    };

    const candidates = new Map();
    for (const data of nodeData) {
      const { node, text, tokens, heading, emphasis, block, blockQuality, linkDensity } = data;
      for (let startIndex = 0; startIndex < tokens.length; startIndex++) {
        for (let size = 1; size <= 3 && startIndex + size <= tokens.length; size++) {
          const phraseTokens = tokens.slice(startIndex, startIndex + size);
          if (phraseTokens.some(token => stopwords.has(token.word))) break;
          if (phraseTokens.some((token, index) => index > 0 && !canJoin(text, phraseTokens[index - 1], token))) break;
          const key = phraseTokens.map(token => token.word).join(' ');
          const dictionaryMatch = dictionary.get(key);
          const noisyToken = phraseTokens.some(token => token.word.length < 2 ||
            (/\p{L}/u.test(token.word) && /\p{N}/u.test(token.word)));
          if (noisyToken && !dictionaryMatch) continue;
          if (size === 1 && key.length < 3 && !dictionaryMatch) continue;
          if (size === 1 && key.length <= 2 && dictionaryMatch && key !== 'go' &&
            phraseTokens[0].raw !== phraseTokens[0].raw.toLocaleUpperCase('en-US')) continue;
          if (size === 1 && dictionaryMatch?.phrase.toLowerCase() === 'go' && phraseTokens[0].raw !== 'Go') continue;

          const first = phraseTokens[0], lastToken = phraseTokens.at(-1);
          const occurrence = {
            node,
            start: first.start,
            end: lastToken.end,
            text: text.slice(first.start, lastToken.end),
            heading,
            emphasis,
            block,
            blockQuality,
            linkDensity,
            position: 1 - Math.min(1, (data.offset + first.start) / totalCharacters),
          };
          let candidate = candidates.get(key);
          if (!candidate) {
            candidate = {
              key,
              words: phraseTokens.map(token => token.word),
              occurrences: [],
              dictionaryMatch,
            };
            candidates.set(key, candidate);
          }
          candidate.occurrences.push(occurrence);
        }
      }
    }

    let maxRake = 1;
    for (const candidate of candidates.values()) {
      candidate.rakeRaw = candidate.words.reduce((sum, word) => sum + rakeWordScore(word), 0);
      maxRake = Math.max(maxRake, candidate.rakeRaw);
    }

    const ranked = [];
    for (const candidate of candidates.values()) {
      const occurrences = candidate.occurrences;
      const count = occurrences.length;
      const inTitle = phraseInText(candidate.key, titleText);
      const inMeta = phraseInText(candidate.key, metaText);
      const inHeading = occurrences.some(item => item.heading);
      const emphasized = occurrences.some(item => item.emphasis);
      const dictionaryBoost = candidate.dictionaryMatch ? 1 : 0;
      const position = Math.max(...occurrences.map(item => item.position));
      const frequency = Math.min(1, Math.log1p(count) / Math.log(6));
      const rake = candidate.rakeRaw / maxRake;
      const blockCount = new Set(occurrences.map(item => item.block)).size;
      const crossBlock = Math.min(1, Math.max(0, blockCount - 1) / 3);
      const contentQuality = Math.max(...occurrences.map(item => item.blockQuality));
      const linkDensity = Math.min(...occurrences.map(item => item.linkDensity));
      const phraseBonus = candidate.words.length === 3 ? 0.08 : candidate.words.length === 2 ? 0.05 : 0;
      const score = Math.min(1,
        0.23 * rake +
        0.18 * Number(inTitle) +
        0.15 * Number(inHeading) +
        0.08 * Number(emphasized) +
        0.12 * frequency +
        0.08 * Number(inMeta) +
        0.08 * position +
        0.18 * dictionaryBoost +
        0.06 * crossBlock +
        0.06 * (contentQuality - 0.5) -
        0.10 * linkDensity +
        phraseBonus
      );
      const hasStrongSignal = inTitle || inMeta || inHeading || emphasized || dictionaryBoost;
      if (score < minScore || (candidate.words.length === 1 && count === 1 && !hasStrongSignal)) continue;

      const signals = ['rake'];
      if (inTitle) signals.push('title');
      if (inHeading) signals.push('heading');
      if (emphasized) signals.push('emphasis');
      if (count > 1) signals.push('frequency');
      if (crossBlock > 0) signals.push('cross-block');
      if (contentQuality >= 0.8) signals.push('content-block');
      if (inMeta) signals.push('meta-description');
      if (dictionaryBoost) signals.push('dictionary');
      ranked.push({
        ...candidate,
        type: candidate.dictionaryMatch?.type || (candidate.words.length > 1 ? 'keyphrase' : 'keyword'),
        score: Number(score.toFixed(4)),
        occurrenceCount: count,
        inHeading,
        emphasized,
        contentQuality,
        signals,
      });
    }

    const occurrenceOverlap = (left, right) => left.occurrences.some(current =>
      right.occurrences.some(previous => current.node === previous.node &&
        current.start < previous.end && current.end > previous.start)
    );
    const containsWords = (container, contained) => container.words.some((_, index) =>
      container.words.slice(index, index + contained.words.length).join(' ') === contained.key
    );
    const similarity = (left, right) => {
      const shared = left.words.filter(word => right.words.includes(word)).length;
      let value = shared / Math.max(1, Math.min(left.words.length, right.words.length));
      if (containsWords(left, right) || containsWords(right, left)) value = Math.max(value, 0.9);
      if (occurrenceOverlap(left, right)) value = Math.max(value, 0.95);
      return value;
    };
    const priority = candidate => candidate.score + candidate.words.length * 0.055 +
      Number(candidate.inHeading && candidate.words.length > 1) * 0.05 +
      Number(candidate.emphasized && candidate.words.length > 1) * 0.025;
    ranked.sort((a, b) => priority(b) - priority(a) || b.score - a.score ||
      b.words.length - a.words.length || a.key.localeCompare(b.key));
    const diverse = [];
    for (const candidate of ranked) {
      const redundant = diverse.some(selected => {
        if (similarity(candidate, selected) < 0.88) return false;
        if (candidate.dictionaryMatch && selected.dictionaryMatch &&
          candidate.dictionaryMatch.type !== selected.dictionaryMatch.type &&
          !occurrenceOverlap(candidate, selected)) return false;
        return true;
      });
      if (!redundant) diverse.push(candidate);
      if (diverse.length >= Math.max(maxCandidates * 2, maxCandidates + 10)) break;
    }
    return wrapCandidates(diverse, maxCandidates).map(candidate => ({
      el: candidate.el,
      type: candidate.type,
      text: candidate.text,
      score: candidate.score,
      occurrences: candidate.occurrenceCount,
      signals: candidate.signals,
    }));
  }

  // ---------- extraction ----------
  let activeAdapter = null;
  let targets = [];
  let results = [];

  function downloadResults(content, extension, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const adapterName = (activeAdapter?.name || 'page').replace(/[^a-z0-9_-]+/gi, '-');
    anchor.href = url;
    anchor.download = `spider-${adapterName}.${extension}`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvCell(value) {
    const text = value === null || value === undefined
      ? ''
      : Array.isArray(value) ? value.join('|') : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportJson() {
    downloadResults(JSON.stringify(results, null, 2), 'json', 'application/json');
  }

  function exportCsv() {
    const fields = ['type', 'value', 'score', 'occurrences', 'href', 'signals'];
    const lines = [fields.map(csvCell).join(',')];
    for (const result of results) {
      lines.push(fields.map(field => csvCell(result[field])).join(','));
    }
    downloadResults(lines.join('\n'), 'csv', 'text/csv;charset=utf-8');
  }

  function renderPanel() {
    countElement.textContent = `${results.length} result${results.length === 1 ? '' : 's'}`;
    resultsElement.replaceChildren();
    legendElement.replaceChildren();
    UI.rows = new WeakMap();

    const categoryCounts = new Map();
    targets.forEach((target, index) => {
      const result = results[index];
      const color = COLORS[result.type] || '#ffffff';
      categoryCounts.set(result.type, (categoryCounts.get(result.type) || 0) + 1);

      const row = document.createElement('li');
      row.className = '__spider-result';
      row.dataset.top = 'false';
      row.dataset.touched = 'false';

      const bar = document.createElement('span');
      bar.className = '__spider-bar';
      bar.style.background = color;

      const description = document.createElement('div');
      const value = document.createElement('div');
      value.className = '__spider-value';
      value.textContent = result.value;
      value.title = result.value;
      const meta = document.createElement('div');
      meta.className = '__spider-meta';
      meta.textContent = result.type;
      description.append(value, meta);

      const score = document.createElement('span');
      score.className = '__spider-score';
      score.textContent = Number.isFinite(result.score) ? `${Math.round(result.score * 100)}%` : '—';
      row.append(bar, description, score);
      resultsElement.appendChild(row);
      UI.rows.set(target, row);
    });

    for (const [type, count] of [...categoryCounts].sort((a, b) => a[0].localeCompare(b[0]))) {
      const item = document.createElement('span');
      item.className = '__spider-legend-item';
      const dot = document.createElement('span');
      dot.className = '__spider-dot';
      dot.style.color = COLORS[type] || '#ffffff';
      dot.style.background = COLORS[type] || '#ffffff';
      const label = document.createElement('span');
      label.textContent = `${type} (${count})`;
      item.append(dot, label);
      legendElement.appendChild(item);
    }

    jsonButton.disabled = results.length === 0;
    csvButton.disabled = results.length === 0;
    setStatus(results.length ? 'Results ranked and ready' : 'No targets found', results.length ? 'complete' : 'idle');
  }

  function showTopTargets(topN) {
    targets.forEach((target, index) => {
      const row = UI.rows.get(target);
      if (row) row.dataset.top = String(index < topN);
    });
    setStatus(`Preparing a top-to-bottom route for ${topN} target${topN === 1 ? '' : 's'}`, 'walking');
  }

  function showTouchedTarget(target, completed, total) {
    const row = UI.rows.get(target);
    if (row) {
      row.dataset.touched = 'true';
      const listRect = resultsElement.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      if (rowRect.top < listRect.top) resultsElement.scrollTop -= listRect.top - rowRect.top + 6;
      else if (rowRect.bottom > listRect.bottom) resultsElement.scrollTop += rowRect.bottom - listRect.bottom + 6;
    }
    const score = Number.isFinite(target.score) ? ` at ${Math.round(target.score * 100)}%` : '';
    setStatus(`Inspecting “${target.text}”${score} • ${completed}/${total}`, 'inspecting');
  }

  jsonButton.addEventListener('click', exportJson);
  csvButton.addEventListener('click', exportCsv);

  function serializeTarget(target) {
    const el = target.el;
    const link = el.matches?.('a[href]') ? el : el.closest?.('a[href]');
    const result = {
      type: target.type || 'keyword',
      value: target.text || el.textContent?.trim() || '',
      href: target.href || link?.href || null,
    };
    if (Number.isFinite(target.score)) result.score = target.score;
    if (Number.isFinite(target.occurrences)) result.occurrences = target.occurrences;
    if (Array.isArray(target.signals)) result.signals = [...target.signals];
    return result;
  }

  async function extract(adapter, max = 40) {
    if (!adapter || typeof adapter.collect !== 'function') {
      throw new Error('The selected adapter does not provide a collect() function.');
    }
    const limit = Math.max(0, Number.isFinite(max) ? Math.floor(max) : 40);
    activeAdapter = adapter;
    if (adapter.prepare) await adapter.prepare();
    const collected = await adapter.collect(limit);
    targets = (Array.isArray(collected) ? collected : [])
      .filter(target => target?.el instanceof Element)
      .slice(0, limit);
    results = targets.map(serializeTarget);
    renderPanel();
    console.log('[' + (adapter.name || '?') + '] extracted targets:', results.length);
    return results.map(result => ({ ...result }));
  }

  // ---------- animation ----------
  function cancelReaches() {
    for (const leg of legs) {
      if (!leg.reach) continue;
      const done = leg.reach.done;
      leg.reach = null;
      leg.lift = 0;
      done?.();
    }
  }

  async function playOutro(deadline) {
    if (destroyed) return;
    const viewport = scrollViewport(activeScrollRoot);
    UI.homeBottom = viewport.bottom;
    const homeX = 76;
    const homeY = clamp(viewport.bottom - 72, viewport.top + 60, viewport.bottom - 50);
    setStatus('Scan complete — spider is heading home', 'walking');
    S.tx = homeX;
    S.ty = homeY;
    S.face = () => ({ x: 8, y: viewport.bottom - 8 });
    await waitFor(
      () => Math.hypot(S.tx - S.x, S.ty - S.y) < 8,
      Math.max(0, Math.min(3000, deadline - activeNow())),
    );
    if (destroyed) return;

    UI.celebration = 'wave';
    setStatus('Bye bye! Thanks for exploring with me', 'inspecting');
    await animationSleep(1100);
    if (destroyed) return;

    UI.celebration = 'web';
    setStatus('Building a tiny web in the corner', 'walking');
    const webStarted = activeNow();
    const webDuration = 900;
    while (!destroyed && UI.webProgress < 1) {
      UI.webProgress = clamp((activeNow() - webStarted) * UI.speed / webDuration, 0, 1);
      await sleep(16);
    }
    if (destroyed) return;

    UI.webProgress = 1;
    UI.celebration = 'rest';
    S.tx = homeX - 8;
    S.ty = homeY + 8;
    S.face = () => ({ x: 8, y: viewport.bottom - 8 });
    const restStarted = activeNow();
    const restDuration = 450;
    while (!destroyed && UI.spiderScale > 0.75) {
      const progress = clamp((activeNow() - restStarted) * UI.speed / restDuration, 0, 1);
      UI.spiderScale = lerp(1, 0.75, easeOut(progress));
      await sleep(16);
    }
    if (destroyed) return;
    UI.spiderScale = 0.75;
    controlsElement.hidden = true;
    setStatus('Done — resting in a tiny web', 'complete');
  }

  async function animate(timeoutMs = 60000, topN = targets.length) {
    const timeout = Math.max(1000, Number(timeoutMs) || 60000);
    const limit = Math.max(0, Math.min(targets.length, Number.isFinite(topN) ? Math.floor(topN) : targets.length));
    const animationTargets = targets.slice(0, limit);
    const deadline = activeNow() + timeout;
    const visited = new Set();
    const skipped = new Set();
    let section = 1;
    showTopTargets(limit);
    activeScrollRoot = selectScrollRoot(animationTargets);
    lastScrollTop = scrollTopFor(activeScrollRoot);

    if (animationTargets.length) {
      const viewport = scrollViewport(activeScrollRoot);
      setStatus('Returning to the top of the page', 'scrolling');
      S.tx = clamp(innerWidth * 0.28, 80, innerWidth - 80);
      S.ty = clamp(viewport.top + viewport.height * 0.2, viewport.top + 60, viewport.bottom - 60);
      await scrollPageTo(0, deadline, true);
      await animationSleep(250);
      setStatus('Scanning section 1 from the top', 'inspecting');
      await animationSleep(250);
    }

    while (!destroyed && animationTargets.length) {
      if (activeNow() >= deadline) throw new Error(`Animation timed out after ${timeout} ms.`);
      animationTargets.forEach((target, index) => {
        if (!visited.has(index) && !target.el.isConnected) skipped.add(index);
      });

      const pageEnd = maxScrollTop(activeScrollRoot);
      const currentTop = scrollTopFor(activeScrollRoot);
      const viewport = scrollViewport(activeScrollRoot);
      const atTop = currentTop <= 2;
      const atBottom = currentTop >= pageEnd - 2;
      const safeTop = viewport.top + (atTop ? 8 : Math.min(48, viewport.height * 0.08));
      const safeBottom = viewport.bottom - (atBottom ? 8 : Math.min(110, viewport.height * 0.16));
      const visibleHere = animationTargets
        .map((target, index) => ({ target, index }))
        .filter(({ target, index }) => {
          if (visited.has(index) || skipped.has(index) || !hasBox(target.el)) return false;
          const rect = target.el.getBoundingClientRect();
          return rect.top >= safeTop && rect.bottom <= safeBottom && rect.right > 0 && rect.left < innerWidth;
        })
        .map(({ target, index }) => ({ target, index, c: center(target.el) }))
        .sort((a, b) => a.c.y - b.c.y || a.c.x - b.c.x);

      if (!visibleHere.length) {
        if (atBottom) break;
        section += 1;
        const step = Math.max(240, viewport.height * 0.72);
        const nextTop = Math.min(pageEnd, currentTop + step);
        const estimatedSections = Math.max(section, Math.ceil(pageEnd / step) + 1);
        setStatus(`Spider moving to section ${section} of about ${estimatedSections}`, 'walking');
        S.tx = clamp(innerWidth * 0.42, 80, innerWidth - 80);
        S.ty = clamp(viewport.top + viewport.height * 0.64, viewport.top + 60, viewport.bottom - 60);
        S.face = () => ({ x: S.tx, y: viewport.bottom + 100 });
        await waitFor(
          () => Math.hypot(S.tx - S.x, S.ty - S.y) < 8,
          Math.max(0, Math.min(2600, deadline - activeNow())),
        );
        setStatus(`Walking through page section ${section}`, 'scrolling');
        await scrollPageTo(nextTop, deadline);
        S.face = null;
        await animationSleep(180);
        setStatus(`Scanning visible section ${section}`, 'inspecting');
        await animationSleep(220);
        continue;
      }

      const anchor = visibleHere[0];
      const group = visibleHere
        .filter(item => dist(item.c, anchor.c) <= 90)
        .slice(0, 4);
      group.forEach(item => visited.add(item.index));

      setStatus(`Walking to visible target • ${visited.size + skipped.size}/${animationTargets.length}`, 'walking');

      const cx = group.reduce((s, o) => s + o.c.x, 0) / group.length;
      const cy = group.reduce((s, o) => s + o.c.y, 0) / group.length;
      S.tx = clamp(cx, 80, innerWidth - 80);
      S.ty = clamp(cy + 60, 80, innerHeight - 60);
      S.face = () => group[0].target.el.isConnected ? center(group[0].target.el) : null;
      await waitFor(
        () => Math.hypot(S.tx - S.x, S.ty - S.y) < 6 && S.speed < 40,
        Math.max(0, Math.min(5000, deadline - activeNow())),
      );
      await animationSleep(150);

      const free = new Set(legs);
      const reach = Promise.all(group.map((o, i) => {
        const ang = Math.atan2(o.c.y - S.y, o.c.x - S.x);
        let best = null, bd = 9;
        for (const l of free) {
          const da = Math.abs(angDiff(ang, S.h + l.a));
          if (da < bd) { bd = da; best = l; }
        }
        free.delete(best); best.step = null;
        return new Promise(res => {
          best.reach = { el: o.target.el, t: 0, delay: i * 0.18, touched: false, done: res,
            onTouch: () => {
              const score = Number.isFinite(o.target.score) ? ` ${Math.round(o.target.score * 100)}%` : '';
              marks.push({
                el: o.target.el,
                color: COLORS[o.target.type] || '#ffffff',
                label: `${o.target.type}${score}`,
                t: 0,
                ring: 0,
              });
              showTouchedTarget(o.target, visited.size + skipped.size, animationTargets.length);
            } };
        });
      }));
      try {
        await withTimeout(reach, Math.max(1, deadline - activeNow()), 'A spider leg animation timed out.');
      } catch (error) {
        cancelReaches();
        throw error;
      }
      S.face = null;
      await animationSleep(200);
    }

    animationTargets.forEach((_, index) => {
      if (!visited.has(index)) skipped.add(index);
    });
    const summary = { animated: visited.size, skipped: skipped.size, total: animationTargets.length };
    setStatus(`Page scan complete: ${summary.animated} inspected, ${summary.skipped} skipped`, 'complete');
    if (animationTargets.length) {
      await playOutro(Math.max(deadline, activeNow() + 4000));
    } else {
      controlsElement.hidden = true;
    }
    return summary;
  }

  // Backward-compatible convenience API. Extraction remains independent of animation.
  async function run(adapter, max = 40, timeoutMs = 60000, topN = max) {
    const extracted = await extract(adapter, max);
    try {
      await animate(timeoutMs, topN);
    } catch (error) {
      console.warn('[spider] animation failed:', error.message);
    }
    return extracted;
  }

  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    removeEventListener('resize', fit);
    cancelReaches();
    S.face = null;
    marks.length = 0;
    c.remove();
    panel.remove();
    uiStyle.remove();
    document.querySelectorAll('[data-spider-keyword]').forEach(span => {
      const parent = span.parentNode;
      span.replaceWith(...span.childNodes);
      parent?.normalize();
    });
    activeAdapter?.cleanup?.();
    targets = [];
    results = [];
  }

  window.Spider = {
    colors: COLORS,
    dictionaries: { tech: TECH_DICTIONARY },
    keywords: keywordItems,
    extract,
    animate,
    run,
    cleanup,
    sleep,
  };
})();
