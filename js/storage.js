// localStorage persistence: autosave of the current run + records.
import { serialize, deserialize } from './game/state.js';

const SAVE_KEY = 'starfall.save.v1';
const REC_KEY = 'starfall.records.v1';

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function saveGame(g) {
  safe(() => localStorage.setItem(SAVE_KEY, serialize(g)));
}

export function loadGame() {
  const s = safe(() => localStorage.getItem(SAVE_KEY), null);
  if (!s) return null;
  const g = deserialize(s);
  if (!g || g.phase !== 'play') {
    clearSave();
    return null;
  }
  return g;
}

export function hasSave() {
  return !!safe(() => localStorage.getItem(SAVE_KEY), null);
}

export function clearSave() {
  safe(() => localStorage.removeItem(SAVE_KEY));
}

export function loadRecords() {
  const r = safe(() => JSON.parse(localStorage.getItem(REC_KEY)), null);
  return r && typeof r === 'object' ? { best: r.best || null, plays: r.plays || 0, history: r.history || [] } : { best: null, plays: 0, history: [] };
}

/** Store a finished run. Returns { rec, isNewDepth, isNewScore }. */
export function recordRun(g) {
  const rec = loadRecords();
  const run = {
    depth: g.player.deepest,
    score: g.score,
    lv: g.player.lv,
    turns: g.turn,
    kills: g.player.kills,
    gold: g.player.gold,
    cause: g.cause,
    date: new Date().toISOString(),
  };
  const isNewDepth = !rec.best || run.depth > rec.best.depth;
  const isNewScore = !rec.best || run.score > rec.best.score;
  if (!rec.best) rec.best = { depth: run.depth, score: run.score, date: run.date };
  else {
    if (isNewDepth) rec.best.depth = run.depth;
    if (isNewScore) rec.best.score = run.score;
    rec.best.date = run.date;
  }
  rec.plays++;
  rec.history.unshift(run);
  rec.history = rec.history.slice(0, 10);
  safe(() => localStorage.setItem(REC_KEY, JSON.stringify(rec)));
  return { rec, isNewDepth, isNewScore };
}
