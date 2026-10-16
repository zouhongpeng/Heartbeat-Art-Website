/* ============================================================
   心跳艺术 Heartbeat Art — app.js
   CSV 心率数据 → 波形驱动粒子的动态视觉作品
   三种材质：霓虹 neon / 水彩 watercolor / 极简 mono
   ============================================================ */
'use strict';

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d', { alpha: false });
const uploadBtn = $('uploadBtn');
const demoBtn = $('demoBtn');
const fileInput = $('fileInput');
const fileStatus = $('fileStatus');
const errorLine = $('errorLine');
const saveBtn = $('saveBtn');
const countRange = $('countRange');
const speedRange = $('speedRange');
const countVal = $('countVal');
const speedVal = $('speedVal');
const paletteRow = $('paletteRow');
const motionToggle = $('motionToggle');
const panelTr = document.querySelector('.panel-tr');
const panelToggle = $('panelToggle');
const dropzone = $('dropzone');
const hint = $('hint');
const fpsVal = $('fpsVal');
const hudCount = $('hudCount');
const hudBpm = $('hudBpm');
const hudBl = document.querySelector('.hud-bl');

/* ---------------- 风格 / 主题配置 ---------------- */
const STYLE_CONFIG = {
  neon: {
    label: '霓虹',
    bg: '#05030d',
    fade: 0.18,
    composite: 'lighter',
    particle: { minA: 0.5, sizeMul: 1.0, kind: 'neon' },
    wave: { glowBlur: 22, underWidth: 7, underA: 0.16, segWidth: 2.1, segA: 0.85 },
    palettes: [
      { name: '脉冲', low: '#22e6ff', high: '#ff2d78', glow: '#22e6ff' },
      { name: '电流', low: '#7a5cff', high: '#22e6ff', glow: '#5a8cff' },
      { name: '热浪', low: '#ffb454', high: '#ff2d78', glow: '#ff7a3d' },
    ],
  },
  watercolor: {
    label: '水彩',
    bg: '#f6f1e7',
    fade: 0.1,
    composite: 'source-over',
    particle: { minA: 0.28, sizeMul: 1.0, kind: 'watercolor' },
    wave: { glowBlur: 7, underWidth: 8, underA: 0.1, segWidth: 2.2, segA: 0.5 },
    palettes: [
      { name: '玫瑰', low: '#9db8de', high: '#e08aa6', glow: '#d9a3b8' },
      { name: '湖蓝', low: '#a8c8d8', high: '#5b8dd9', glow: '#8fb4d6' },
      { name: '苔绿', low: '#c2d5c6', high: '#7fbf9f', glow: '#a6ceb8' },
    ],
  },
  mono: {
    label: '极简',
    bg: '#f7f7f5',
    fade: 0.32,
    composite: 'source-over',
    particle: { minA: 0.2, sizeMul: 1.0, kind: 'mono' },
    wave: { glowBlur: 0, underWidth: 0, underA: 0, segWidth: 1, segA: 0.82 },
    palettes: [
      { name: '墨', low: '#161616', high: '#161616', glow: '#161616', accent: '#161616' },
      { name: '藏蓝', low: '#161616', high: '#161616', glow: '#2f4b7c', accent: '#2f4b7c' },
      { name: '朱红', low: '#161616', high: '#161616', glow: '#b3392b', accent: '#b3392b' },
    ],
  },
};

/* ---------------- 状态 ---------------- */
const state = {
  style: 'neon',
  paletteIndex: { neon: 0, watercolor: 0, mono: 0 },
  count: 900,
  speed: 1,
  reduced:
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  dataset: null, // { t: Float64Array, bpm: Float64Array, duration, lo, hi }
  beats: null, // 累计节拍表 Float64Array
  totalBeats: 0,
  playhead: 0, // 数据时间（秒，循环）
  loopCount: 0,
  smoothBpm: 70,
  particles: [],
  sprites: [],
  dpr: 1,
  w: 0,
  h: 0,
};

/* ---------------- 颜色工具 ---------------- */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/* ---------------- 示例数据：静息 → 运动 → 恢复 的叙事曲线 ---------------- */
function generateDemoData() {
  const DURATION = 720; // 12 分钟，1Hz
  const t = new Float64Array(DURATION);
  const bpm = new Float64Array(DURATION);
  let noise = 0;
  for (let s = 0; s < DURATION; s++) {
    noise = noise * 0.92 + (Math.random() - 0.5) * 2.2;
    let v;
    if (s < 120) {
      v = 61 + 2.5 * Math.sin(s / 9) + noise * 0.35;
    } else if (s < 200) {
      const k = (s - 120) / 80;
      v = 61 + (128 - 61) * k + 3 * Math.sin(s / 7) + noise * 0.5;
    } else if (s < 440) {
      v = 140 + 16 * Math.sin(s / 21) + 7 * Math.sin(s / 5.5) + noise;
    } else if (s < 560) {
      const k = (s - 440) / 120;
      const e = k * k * (3 - 2 * k);
      v = 140 + (74 - 140) * e + 4 * Math.sin(s / 11) + noise * 0.6;
    } else {
      v = 72 + 3.5 * Math.sin(s / 13) + noise * 0.4;
    }
    t[s] = s;
    bpm[s] = Math.round(clamp(v, 48, 190) * 10) / 10;
  }
  return finalizeDataset(t, bpm);
}

/* ---------------- 数据归一化与节拍表 ---------------- */
function finalizeDataset(t, bpm) {
  // 按时间排序
  const idx = Array.from({ length: t.length }, (_, i) => i).sort(
    (a, b) => t[a] - t[b]
  );
  const ts = new Float64Array(t.length);
  const bs = new Float64Array(bpm.length);
  for (let i = 0; i < idx.length; i++) {
    ts[i] = t[idx[i]];
    bs[i] = bpm[idx[i]];
  }
  const duration = Math.max(ts[ts.length - 1] - ts[0], 1);
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of bs) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const pad = Math.max((hi - lo) * 0.12, 4);
  lo = clamp(lo - pad, 42, 120);
  hi = clamp(hi + pad, 80, 200);
  const beats = new Float64Array(ts.length);
  for (let i = 1; i < ts.length; i++) {
    beats[i] =
      beats[i - 1] +
      ((ts[i] - ts[i - 1]) * (bs[i] + bs[i - 1])) / 2 / 60;
  }
  return { t: ts, bpm: bs, duration, lo, hi, beats };
}

/* 在数据时间 t（秒，已循环到 [0,duration)）处线性取 BPM */
function bpmAt(ds, tSec) {
  const t = ds.t;
  let lo = 0;
  let hi = t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] < tSec) lo = mid + 1;
    else hi = mid;
  }
  const i = clamp(lo, 1, t.length - 1);
  const span = t[i] - t[i - 1] || 1;
  const k = clamp((tSec - t[i - 1]) / span, 0, 1);
  return ds.bpm[i - 1] + (ds.bpm[i] - ds.bpm[i - 1]) * k;
}

/* 累计节拍数 → 数据时间（二分反演），b 已循环 */
function timeAtBeat(ds, beats, bAbs) {
  const span = beats[beats.length - 1];
  let b = bAbs % span;
  if (b < 0) b += span;
  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] < b) lo = mid + 1;
    else hi = mid;
  }
  const i = clamp(lo, 1, beats.length - 1);
  const db = beats[i] - beats[i - 1] || 1;
  const k = (b - beats[i - 1]) / db;
  return ds.t[i - 1] + (ds.t[i] - ds.t[i - 1]) * k;
}

/* ---------------- CSV 解析 ---------------- */
function parseCSV(text) {
  const clean = text.replace(/^﻿/, '').trim();
  if (!clean) throw new Error('文件为空，请上传包含 BPM 数据的 CSV');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 4) throw new Error('数据行数过少，至少需要 4 行数据');

  const delim = /;/.test(lines[0]) && !/,/.test(lines[0]) ? ';' : /\t/.test(lines[0]) ? '\t' : ',';
  const rows = lines.map((l) => l.split(delim).map((c) => c.trim()));

  const isNum = (s) => s !== '' && !Number.isNaN(Number(s));
  const hasHeader = rows[0].some((c) => c !== '' && !isNum(c));
  const header = hasHeader ? rows[0].map((h) => h.toLowerCase()) : null;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const colCount = rows[0].length;
  // 收集每列数值（dataRows 已剔除表头）
  const numericCols = [];
  for (let c = 0; c < colCount; c++) {
    const probe = dataRows.slice(0, 40);
    let count = 0;
    for (let r = 0; r < probe.length; r++) {
      if (isNum(probe[r][c])) count++;
    }
    // 长样本按比例判定，短样本至少 2 个数值（避免日期/文本列误判）
    const qualified =
      probe.length >= 10
        ? count >= probe.length * 0.6
        : count >= Math.min(2, probe.length);
    if (qualified) numericCols.push(c);
  }
  if (!numericCols.length) throw new Error('未找到任何数值列，请确认 CSV 含 BPM 数值');

  // 定位 BPM 列
  let bpmCol = -1;
  if (header) {
    const hit = header.findIndex((h) =>
      /(?:^|[_-\s])(?:bpm|hr|heart[_ -]?rate|heartrate)(?:$|[_-\s])|心率|脉搏/.test(h)
    );
    if (hit >= 0) bpmCol = hit;
  }
  if (bpmCol < 0) {
    if (numericCols.length === 1) {
      bpmCol = numericCols[0];
    } else {
      // 选择数值范围最贴近心率（30–240）的列
      let best = -1;
      let bestScore = Infinity;
      for (const c of numericCols) {
        const vals = dataRows
          .slice(0, 60)
          .map((r) => Number(r[c]))
          .filter((v) => !Number.isNaN(v));
        if (!vals.length) continue;
        const inRange =
          vals.filter((v) => v >= 30 && v <= 240).length / vals.length;
        const median = vals.slice().sort((a, b) => a - b)[vals.length >> 1];
        const dist = Math.abs(median - 75);
        const score = dist - inRange * 200;
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
      bpmCol = best;
    }
  }
  if (bpmCol < 0) {
    // 退而求其次：最后一个数值列
    bpmCol = numericCols[numericCols.length - 1];
  }

  // 定位时间列：优先数值列，其次可解析的日期文本列
  let timeCol = numericCols.length > 1
    ? numericCols.find((c) => c !== bpmCol)
    : -1;
  if (header) {
    const hit = header.findIndex((h) => /time|timestamp|date|时间/.test(h));
    if (hit >= 0 && hit !== bpmCol) timeCol = hit;
  }
  if (timeCol < 0 || timeCol === undefined) {
    for (let c = 0; c < colCount; c++) {
      if (c === bpmCol) continue;
      const probe = dataRows.slice(0, 6);
      const parseable =
        probe.filter((r) => isNum(r[c]) || !Number.isNaN(Date.parse((r[c] || '').replace(/\//g, '-'))))
          .length / probe.length;
      if (parseable > 0.8) {
        timeCol = c;
        break;
      }
    }
  }
  if (timeCol < 0) timeCol = undefined;

  const tOut = [];
  const bOut = [];
  for (const row of dataRows) {
    const bRaw = row[bpmCol];
    if (!isNum(bRaw)) continue;
    const b = Number(bRaw);
    if (b < 30 || b > 240) continue;    let tSec = null;
    if (timeCol !== undefined) {
      const raw = row[timeCol];
      if (isNum(raw)) {
        tSec = Number(raw);
      } else if (raw) {
        const ms = Date.parse(raw.replace(/\//g, '-'));
        if (!Number.isNaN(ms)) tSec = ms / 1000;
      }
    }
    tOut.push(tSec);
    bOut.push(b);
  }

  if (bOut.length < 3) throw new Error('有效 BPM 数据不足 3 条（合理范围 30–240）');

  // 统一时间戳
  if (tOut.some((v) => v === null)) {
    for (let i = 0; i < tOut.length; i++) tOut[i] = i;
  } else {
    const base = tOut[0];
    // 单位推断：中位差大于 1e8 视为毫秒/纳秒级绝对时间戳
    const diffs = [];
    for (let i = 1; i < Math.min(tOut.length, 80); i++)
      diffs.push(Math.abs(tOut[i] - tOut[i - 1]));
    diffs.sort((a, b) => a - b);
    const medianDelta = diffs[diffs.length >> 1] || 0;
    const divisor = medianDelta > 1e8 ? 1e9 : medianDelta > 500 ? 1000 : 1;
    for (let i = 0; i < tOut.length; i++) tOut[i] = (tOut[i] - base) / divisor;
  }

  return finalizeDataset(Float64Array.from(tOut), Float64Array.from(bOut));
}

/* ---------------- 画布尺寸 ---------------- */
function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = Math.round(state.w * state.dpr);
  canvas.height = Math.round(state.h * state.dpr);
  canvas.style.width = state.w + 'px';
  canvas.style.height = state.h + 'px';
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  // 不透明底色，保证导出 PNG 有实底
  ctx.fillStyle = STYLE_CONFIG[state.style].bg;
  ctx.fillRect(0, 0, state.w, state.h);
}

/* ---------------- 心跳波形几何（PQRST 高斯合成） ---------------- */
function gWrap(u, c, wgt, width) {
  let d = Math.abs(u - c);
  d = Math.min(d, 1 - d);
  return wgt * Math.exp(-(d * d) / (2 * width * width));
}
/* ph ∈ [0,1)：一个心动周期内的归一化位置，返回约 -0.25 .. 1 */
function ecgShape(ph) {
  return (
    gWrap(ph, 0.16, 0.13, 0.022) -
    gWrap(ph, 0.36, 0.12, 0.008) +
    gWrap(ph, 0.4, 1.0, 0.011) -
    gWrap(ph, 0.44, 0.28, 0.013) +
    gWrap(ph, 0.66, 0.3, 0.046)
  );
}

/* ---------------- 归一化查找表（沿节拍轴采样 BPM） ---------------- */
let normLut = null;
let beatSpan = 1;

function buildNormLut(ds, beats, size = 1024) {
  const lut = new Float32Array(size);
  const span = beats[beats.length - 1] || 1;
  for (let i = 0; i < size; i++) {
    const t = timeAtBeat(ds, beats, (span * i) / (size - 1));
    lut[i] = (bpmAt(ds, t) - ds.lo) / (ds.hi - ds.lo || 1);
  }
  return lut;
}
function normAtBeat(b) {
  if (!normLut) return 0.5;
  const span = beatSpan || 1;
  let f = ((b % span) / span) * (normLut.length - 1);
  if (f < 0) f += normLut.length - 1;
  const i = Math.floor(f);
  const k = f - i;
  const a = normLut[i % normLut.length];
  const c = normLut[(i + 1) % normLut.length];
  return clamp(a + (c - a) * k, 0, 1);
}

function currentPalette() {
  return STYLE_CONFIG[state.style].palettes[
    state.paletteIndex[state.style]
  ];
}

/* ---------------- 粒子精灵（按 BPM 渐变预渲染） ---------------- */
const SPRITE_N = 48;
function buildSprites() {
  const pal = currentPalette();
  const cfg = STYLE_CONFIG[state.style].particle;
  const S = 64;
  const low = hexToRgb(pal.low);
  const high = hexToRgb(pal.high);
  state.sprites = [];
  for (let i = 0; i < SPRITE_N; i++) {
    const t = i / (SPRITE_N - 1);
    const c = mixRgb(low, high, t);
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    if (cfg.kind === 'neon') {
      const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grad.addColorStop(0, rgba(c, 0.95));
      grad.addColorStop(0.25, rgba(c, 0.55));
      grad.addColorStop(0.55, rgba(c, 0.16));
      grad.addColorStop(1, rgba(c, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
    } else if (cfg.kind === 'watercolor') {
      // 多层柔软晕染，边缘不规则
      g.globalAlpha = 0.5;
      for (let k = 0; k < 5; k++) {
        const r = S * (0.2 + k * 0.085);
        const ox = (Math.random() - 0.5) * 5;
        const oy = (Math.random() - 0.5) * 5;
        const grad = g.createRadialGradient(
          S / 2 + ox,
          S / 2 + oy,
          0,
          S / 2 + ox,
          S / 2 + oy,
          r
        );
        grad.addColorStop(0, rgba(c, 0.16));
        grad.addColorStop(1, rgba(c, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.arc(S / 2 + ox, S / 2 + oy, r, 0, Math.PI * 2);
        g.fill();
      }
      const core = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.22);
      core.addColorStop(0, rgba(c, 0.3));
      core.addColorStop(1, rgba(c, 0));
      g.globalAlpha = 1;
      g.fillStyle = core;
      g.fillRect(0, 0, S, S);
    } else {
      // 极简：无渐变无光晕的墨点
      g.fillStyle = rgba(c, 1);
      g.beginPath();
      g.arc(S / 2, S / 2, S * 0.12, 0, Math.PI * 2);
      g.fill();
    }
    state.sprites.push(cv);
  }
}

/* ---------------- 粒子池 ---------------- */
function makeParticle(initial = false) {
  return {
    x: initial ? Math.random() * state.w : state.w + Math.random() * 80,
    depth: Math.pow(Math.random(), 1.3), // 0 远 → 1 近
    orbitR: 6 + Math.random() * 26,
    angle0: Math.random() * Math.PI * 2,
    omega: 0.25 + Math.random() * 0.7,
    phase: Math.random(),
    sizeBase: 5 + Math.random() * 11,
  };
}
function ensureParticles() {
  const pool = state.particles;
  while (pool.length < state.count) pool.push(makeParticle(true));
  if (pool.length > state.count) pool.length = state.count;
}

/* ---------------- 波形几何辅助 ---------------- */
function waveParams() {
  const ppb = clamp(state.w / 7.2, 110, 260); // 每节拍像素
  const midY = state.h * 0.54;
  const amp = Math.min(state.h * 0.27, state.w * 0.14);
  const anchorX = state.w * 0.68; // 最新心跳出现的位置
  return { ppb, midY, amp, anchorX };
}
function waveYAtBeat(b, P) {
  const norm = normAtBeat(b);
  const f = ((b % 1) + 1) % 1;
  const shape = ecgShape(f);
  return {
    y: P.midY - shape * P.amp * (0.55 + 0.7 * norm),
    norm,
    shape,
  };
}

/* ---------------- 背景脉动光晕 ---------------- */
function drawHalo(headBeats) {
  const P = waveParams();
  const pal = currentPalette();
  const norm = normAtBeat(headBeats);
  const frac = ((headBeats % 1) + 1) % 1;
  const peak = Math.max(0, ecgShape(frac));
  const pulsePower = state.reduced ? 0.35 : 1;
  const pulse = norm * 0.55 + peak * 0.45;
  const cx = state.w / 2;
  const cy = P.midY;
  const maxR = Math.max(state.w, state.h) * 0.62;
  const r = maxR * (0.62 + 0.3 * norm) * (1 + 0.08 * peak * pulsePower);

  ctx.save();
  if (state.style === 'neon') {
    ctx.globalCompositeOperation = 'lighter';
    let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const glow = hexToRgb(pal.glow);
    const high = hexToRgb(pal.high);
    grad.addColorStop(0, rgba(glow, 0.05 + 0.08 * pulse * pulsePower));
    grad.addColorStop(0.5, rgba(glow, 0.02 + 0.03 * pulse * pulsePower));
    grad.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.w, state.h);
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.5);
    grad.addColorStop(0, rgba(high, 0.03 + 0.06 * peak * pulsePower));
    grad.addColorStop(1, rgba(high, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.w, state.h);
  } else if (state.style === 'watercolor') {
    const glow = hexToRgb(pal.glow);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.9);
    grad.addColorStop(0, rgba(glow, 0.06 + 0.07 * pulse * pulsePower));
    grad.addColorStop(0.6, rgba(glow, 0.02 + 0.02 * pulse * pulsePower));
    grad.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.w, state.h);
  } else {
    // 极简：同心细线，无发光
    const ink = hexToRgb('#161616');
    const accent = hexToRgb(pal.accent || '#161616');
    ctx.lineWidth = 1;
    [0.55, 0.82, 1.05].forEach((scale, i) => {
      ctx.beginPath();
      ctx.strokeStyle = rgba(i === 1 ? accent : ink, 0.04 + 0.06 * pulse * pulsePower);
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  ctx.restore();
}

/* ---------------- 心跳发光波形 ---------------- */
function drawWave(headBeats) {
  const P = waveParams();
  const cfg = STYLE_CONFIG[state.style].wave;
  const pal = currentPalette();
  const low = hexToRgb(pal.low);
  const high = hexToRgb(pal.high);
  const glow = hexToRgb(pal.glow);
  const STEP = state.style === 'mono' ? 3 : 4;
  const points = [];
  for (let x = 0; x <= state.w; x += STEP) {
    const b = headBeats + (x - P.anchorX) / P.ppb;
    const info = waveYAtBeat(b, P);
    points.push({ x, y: info.y, norm: info.norm, shape: info.shape });
  }

  ctx.save();
  if (state.style === 'neon') ctx.globalCompositeOperation = 'lighter';

  // 底层光晕描边（全宽一次）
  if (cfg.underWidth > 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.lineWidth = cfg.underWidth;
    ctx.strokeStyle = rgba(glow, cfg.underA);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (cfg.glowBlur > 0) {
      ctx.shadowColor = rgba(glow, 0.9);
      ctx.shadowBlur = cfg.glowBlur;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 顶层：按 BPM 分段着色
  ctx.lineWidth = cfg.segWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const SEG = Math.max(2, Math.floor(10 / STEP));
  for (let i = 0; i < points.length - 1; i += SEG) {
    const end = Math.min(i + SEG, points.length - 1);
    const p0 = points[i];
    const p1 = points[end];
    let norm = 0;
    let peak = 0;
    for (let k = i; k <= end; k++) {
      norm += points[k].norm;
      if (points[k].shape > peak) peak = points[k].shape;
    }
    norm /= end - i + 1;
    const peakAmt = clamp((peak - 0.25) / 0.75, 0, 1);
    const c = mixRgb(low, high, norm);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    for (let k = i + 1; k <= end; k++) ctx.lineTo(points[k].x, points[k].y);
    if (state.style === 'mono') {
      const isAccent = peakAmt > 0.55 && pal.accent && pal.accent !== '#161616';
      ctx.strokeStyle = isAccent
        ? rgba(hexToRgb(pal.accent), cfg.segA)
        : rgba(c, cfg.segA);
    } else if (state.style === 'watercolor') {
      ctx.strokeStyle = rgba(c, cfg.segA * (0.75 + 0.4 * norm));
    } else {
      ctx.strokeStyle = rgba(
        c,
        Math.min(1, cfg.segA * (0.65 + 0.35 * norm) + 0.25 * peakAmt)
      );
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- 粒子绘制 ---------------- */
function drawParticles(headBeats, dt, scrollRate) {
  if (!state.sprites.length) return;
  const P = waveParams();
  const cfg = STYLE_CONFIG[state.style].particle;
  const reducedMul = state.reduced ? 0.25 : 1;
  ctx.save();
  ctx.globalCompositeOperation = STYLE_CONFIG[state.style].composite;
  const ink = hexToRgb(currentPalette().accent || currentPalette().high);

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    // 水平推进（景深视差）
    p.x -= scrollRate * dt * (0.35 + 0.65 * p.depth);
    p.phase = (p.phase + p.omega * dt * (state.smoothBpm / 60) * reducedMul) % 1;
    if (p.x < -40) Object.assign(p, makeParticle(false));

    const b = headBeats + (p.x - P.anchorX) / P.ppb;
    const info = waveYAtBeat(b, P);
    const persp = 0.25 + 0.75 * p.depth;
    const angle = p.angle0 + p.phase * Math.PI * 2;
    const orbit = p.orbitR * persp;
    const ox = Math.sin(angle) * orbit * 0.5;
    const oy = Math.cos(angle) * orbit;
    const size =
      p.sizeBase * persp * (0.55 + 0.85 * info.norm) * cfg.sizeMul;
    const px = p.x + ox;
    const py = info.y + oy;

    if (state.style === 'mono') {
      const s = Math.max(1, size * 0.14);
      ctx.fillStyle = rgba(ink, cfg.minA + 0.45 * p.depth);
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
      continue;
    }

    const spriteIndex = Math.min(
      SPRITE_N - 1,
      Math.max(0, Math.round(info.norm * (SPRITE_N - 1)))
    );
    ctx.globalAlpha =
      (cfg.minA + (state.style === 'neon' ? 0.5 : 0.32) * p.depth) *
      (0.45 + 0.75 * info.norm);
    ctx.drawImage(
      state.sprites[spriteIndex],
      px - size / 2,
      py - size / 2,
      size,
      size
    );
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---------------- 主循环 ---------------- */
let rafId = 0;
let lastT = performance.now();
let fpsAccum = 0;
let fpsFrames = 0;
let lastFps = 60;
let perfLevel = 0; // 0 高 DPR → 1 降 DPR → 2 再降
let perfCooldown = 0;

function frame(now) {
  rafId = requestAnimationFrame(frame);
  let dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (document.hidden) return;

  const ds = state.dataset;
  if (!ds) return;

  const cfg = STYLE_CONFIG[state.style];
  const P = waveParams();

  // 推进播放头（秒）
  const motionMul = state.reduced ? 0.12 : 1;
  state.playhead += dt * state.speed * motionMul;
  if (state.playhead >= ds.duration) {
    state.playhead -= ds.duration;
    state.loopCount++;
  }

  // 平滑当前 BPM
  const targetBpm = bpmAt(ds, state.playhead);
  state.smoothBpm += (targetBpm - state.smoothBpm) * Math.min(1, dt * 4);

  // 由数据时间反查累计节拍
  const span = state.beats[state.beats.length - 1];
  let headBeats = 0;
  if (state.playhead <= ds.t[0]) {
    headBeats = 0;
  } else {
    let lo = 0;
    let hi = ds.t.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ds.t[mid] < state.playhead) lo = mid + 1;
      else hi = mid;
    }
    const i = clamp(lo, 1, ds.t.length - 1);
    const dbt = ds.t[i] - ds.t[i - 1] || 1;
    const k = (state.playhead - ds.t[i - 1]) / dbt;
    headBeats =
      state.beats[i - 1] + (state.beats[i] - state.beats[i - 1]) * k;
  }
  headBeats += state.loopCount * span;

  // 拖尾：半透明底色覆盖
  const fade = state.reduced ? Math.min(cfg.fade + 0.4, 0.82) : cfg.fade;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle =
    state.style === 'neon'
      ? `rgba(5,3,13,${fade})`
      : state.style === 'watercolor'
        ? `rgba(246,241,231,${fade})`
        : `rgba(247,247,245,${fade})`;
  ctx.fillRect(0, 0, state.w, state.h);

  // 滚动速率（像素/秒）= 当前节拍率 × 每节拍像素
  const bps = state.smoothBpm / 60;
  const scrollRate = bps * P.ppb * state.speed * motionMul;

  drawHalo(headBeats);
  drawParticles(headBeats, dt, scrollRate);
  drawWave(headBeats);

  // FPS 统计与自适应 DPR
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 0.6) {
    lastFps = fpsFrames / fpsAccum;
    fpsAccum = 0;
    fpsFrames = 0;
    fpsVal.textContent = `${Math.round(lastFps)} fps`;
    hudBpm.textContent = `${Math.round(state.smoothBpm)} bpm`;
    hudBl.classList.toggle('is-lowfps', lastFps < 30);
    // 帧率不足且距离上次降级超过 3 秒：降低 DPR
    if (lastFps < 28 && perfLevel < 2 && perfCooldown <= 0) {
      perfLevel++;
      perfCooldown = 3;
      const maxDpr = perfLevel === 1 ? 1.25 : 1;
      state.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.round(state.w * state.dpr);
      canvas.height = Math.round(state.h * state.dpr);
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.fillStyle = cfg.bg;
      ctx.fillRect(0, 0, state.w, state.h);
    }
  }
  if (perfCooldown > 0) perfCooldown -= dt;
}

/* ---------------- 数据载入 ---------------- */
function loadDataset(ds, label) {
  state.dataset = ds;
  state.beats = ds.beats;
  beatSpan = state.beats[state.beats.length - 1] || 1;
  state.totalBeats = beatSpan;
  state.playhead = 0;
  state.loopCount = 0;
  state.smoothBpm = ds.bpm[0];
  normLut = buildNormLut(ds, state.beats);
  fileStatus.textContent = label;
  errorLine.textContent = '';
  hint.classList.add('is-hidden');
  // 清屏重绘，避免不同风格残影串色
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = STYLE_CONFIG[state.style].bg;
  ctx.fillRect(0, 0, state.w, state.h);
}

function handleFile(file) {
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type && !/csv/i.test(file.type)) {
    errorLine.textContent = '请上传 .csv 格式文件';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const ds = parseCSV(String(reader.result));
      loadDataset(ds, `${file.name} · ${ds.bpm.length} 条 · ${Math.round(ds.duration)}s`);
    } catch (err) {
      errorLine.textContent =
        err && err.message ? err.message : 'CSV 解析失败，请检查文件格式';
    }
  };
  reader.onerror = () => {
    errorLine.textContent = '文件读取失败，请重试';
  };
  reader.readAsText(file);
}

/* ---------------- 风格 / 主题 UI ---------------- */
function buildSwatches() {
  const palettes = STYLE_CONFIG[state.style].palettes;
  paletteRow.innerHTML = '';
  palettes.forEach((pal, i) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (i === state.paletteIndex[state.style] ? ' is-active' : '');
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', `颜色主题：${pal.name}`);
    btn.title = pal.name;
    if (pal.low === pal.high) {
      btn.style.background = pal.low;
    } else {
      btn.style.background = `linear-gradient(135deg, ${pal.low}, ${pal.high})`;
    }
    btn.addEventListener('click', () => {
      state.paletteIndex[state.style] = i;
      buildSwatches();
      buildSprites();
    });
    paletteRow.appendChild(btn);
  });
}

function setStyle(key) {
  state.style = key;
  document.body.dataset.style = key;
  document.querySelectorAll('.seg').forEach((btn) => {
    const active = btn.dataset.styleKey === key;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  buildSwatches();
  buildSprites();
  if (state.dataset) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = STYLE_CONFIG[key].bg;
    ctx.fillRect(0, 0, state.w, state.h);
  }
}

/* ---------------- 保存 PNG ---------------- */
function savePNG() {
  canvas.toBlob((blob) => {
    if (!blob) {
      errorLine.textContent = '图片生成失败，请重试';
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
    a.href = url;
    a.download = `heartbeat-art-${STYLE_CONFIG[state.style].label}-${stamp}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/* ---------------- 事件绑定 ---------------- */
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  fileInput.value = '';
});
demoBtn.addEventListener('click', () => {
  const ds = generateDemoData();
  loadDataset(ds, `示例心率 · ${ds.bpm.length} 条 · 静息→运动→恢复`);
});
saveBtn.addEventListener('click', savePNG);

document.querySelectorAll('.seg').forEach((btn) => {
  btn.addEventListener('click', () => setStyle(btn.dataset.styleKey));
});

countRange.addEventListener('input', () => {
  state.count = Number(countRange.value);
  countVal.textContent = state.count;
  countRange.setAttribute('aria-valuenow', String(state.count));
  hudCount.textContent = `${state.count} 粒子`;
  ensureParticles();
});
speedRange.addEventListener('input', () => {
  state.speed = Number(speedRange.value);
  speedVal.textContent = `${state.speed.toFixed(2)}×`;
  speedRange.setAttribute('aria-valuenow', String(state.speed));
});
motionToggle.addEventListener('change', () => {
  state.reduced = motionToggle.checked;
});

// 移动端参数面板折叠
panelToggle.addEventListener('click', () => {
  const collapsed = panelTr.classList.toggle('is-collapsed');
  panelToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
});
if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches) {
  panelTr.classList.add('is-collapsed');
  panelToggle.setAttribute('aria-expanded', 'false');
}

// 系统减弱动态
const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
motionToggle.checked = state.reduced;
if (reducedMQ.addEventListener) {
  reducedMQ.addEventListener('change', (e) => {
    state.reduced = e.matches;
    motionToggle.checked = e.matches;
  });
}

// 拖拽上传
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  dropzone.classList.add('is-dragover');
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropzone.classList.remove('is-dragover');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropzone.classList.remove('is-dragover');
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) handleFile(file);
});

window.addEventListener('resize', resize);

/* ---------------- 初始化 ---------------- */
resize();
buildSwatches();
buildSprites();
ensureParticles();
hudCount.textContent = `${state.count} 粒子`;
loadDataset(generateDemoData(), '示例心率 · 720 条 · 静息→运动→恢复');
// 示例播放时先展示引导，数秒后淡出；上传新数据时立即淡出
hint.classList.remove('is-hidden');
setTimeout(() => hint.classList.add('is-hidden'), 6000);
requestAnimationFrame((t) => {
  lastT = t;
  rafId = requestAnimationFrame(frame);
});

