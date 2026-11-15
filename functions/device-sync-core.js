// Shared deterministic data model. No Bible text, credentials or group data.
const MAX_STATE_BYTES = 650000;
const PREFIX = '@gf_bible/plan_progress/';
const KEYS = {
  notes: '@chronological_bible/verse_notes', bookmarks: '@gf_bible/verse_bookmarks',
  highlights: '@gf_bible/verse_highlights', positions: '@chronological_bible/reader_positions',
  selection: '@chronological_bible/bible_selection', plan: '@gf_bible/reading_plan',
};
const parse = (raw, fallback = {}) => { try { return JSON.parse(raw) || fallback; } catch { return fallback; } };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isTrackedKey = key => Object.values(KEYS).includes(key) || key.startsWith(PREFIX);
function stampFrom(value) {
  const dates = [value?.savedAt, value?.canceledAt, ...(value?.dates || [])].filter(Boolean);
  let best = 0;
  for (const date of dates) {
    const m = String(date).match(/^(\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})[.\s]+(\d{1,2}):(\d{2})/);
    const ms = m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5]) : Date.parse(date);
    if (Number.isFinite(ms)) best = Math.max(best, ms);
  }
  return best;
}
function cleanValue(kind, value) {
  if (kind === 'bookmarks' || kind === 'highlights') {
    const out = { label: String(value?.label || ''), savedAt: String(value?.savedAt || '') };
    if (kind === 'highlights') { out.colorKey = String(value?.colorKey || 'yellow'); out.color = String(value?.color || '#FFF3A8'); }
    return out;
  }
  if (kind === 'notes') return String(value || '');
  if (kind === 'completion') {
    if (typeof value === 'string') return { active: true, dates: [value], canceledAt: null };
    return { active: value?.active !== false, dates: Array.isArray(value?.dates) ? value.dates.map(String) : [], canceledAt: value?.canceledAt || null };
  }
  return value;
}
function flatten(rows) {
  const out = {};
  for (const [kind, key] of Object.entries(KEYS)) {
    if (!own(rows, key) || rows[key] == null) continue;
    const value = kind === 'plan' ? rows[key] : parse(rows[key], null);
    if (value == null) continue;
    if (['selection', 'plan'].includes(kind)) out[`${kind}|current`] = value;
    else for (const [id, v] of Object.entries(value)) out[`${kind}|${id}`] = cleanValue(kind, v);
  }
  for (const [key, raw] of Object.entries(rows)) {
    if (!key.startsWith(PREFIX)) continue;
    const id = key.slice(PREFIX.length);
    const p = parse(raw);
    out[`day|${id}`] = Number(p.currentDay || 1);
    for (const [day, value] of Object.entries(p.completions || {})) out[`completion|${id}|${day}`] = cleanValue('completion', value);
  }
  return out;
}
function materialize(records, previousRows = {}) {
  const maps = { notes: {}, bookmarks: {}, highlights: {}, positions: {} };
  const plans = {};
  const rows = {};
  for (const [key, record] of Object.entries(records || {})) {
    if (record.deleted) continue;
    const [kind, ...parts] = key.split('|');
    const id = parts.join('|');
    const value = record.value;
    if (own(maps, kind)) {
      const old = parse(previousRows[KEYS[kind]])[id];
      maps[kind][id] = (kind === 'bookmarks' || kind === 'highlights') ? { ...value, text: old?.text || '' } : value;
    } else if (kind === 'plan') rows[KEYS.plan] = value;
    else if (kind === 'selection') rows[KEYS.selection] = JSON.stringify(value);
    else if (kind === 'day') { (plans[id] ||= { currentDay: 1, completions: {} }).currentDay = value; }
    else if (kind === 'completion') {
      const [plan, day] = parts;
      (plans[plan] ||= { currentDay: 1, completions: {} }).completions[day] = value;
    }
  }
  for (const [kind, key] of Object.entries(KEYS)) if (own(maps, kind)) rows[key] = JSON.stringify(maps[kind]);
  // Empty plans must be written too, otherwise a replaced plan resurfaces later.
  for (const key of Object.keys(previousRows)) if (key.startsWith(PREFIX) && !plans[key.slice(PREFIX.length)]) plans[key.slice(PREFIX.length)] = { currentDay: 1, completions: {} };
  for (const [id, plan] of Object.entries(plans)) rows[`${PREFIX}${id}`] = JSON.stringify(plan);
  return rows;
}
function compare(a, b) {
  if (!b) return 1;
  return (a.at - b.at) || (a.seq - b.seq) || String(a.device).localeCompare(String(b.device));
}
function mergeInitial(a, b) {
  const result = { ...a };
  for (const [key, incoming] of Object.entries(b)) {
    const old = result[key];
    const winner = compare(incoming, old) > 0 ? incoming : old;
    if (key.startsWith('completion|') && old && !old.deleted && !incoming.deleted && old.value.active && incoming.value.active) {
      result[key] = { ...winner, value: { ...winner.value, dates: [...new Set([...old.value.dates, ...incoming.value.dates])].sort() } };
    } else result[key] = winner;
  }
  return result;
}
function chooseInitial(source, receiver, mode) {
  if (mode === 'source') return { ...source };
  if (mode === 'receiver') return { ...receiver };
  if (mode === 'merge') return mergeInitial(source, receiver);
  throw new Error('Invalid connection mode');
}
function validRecord(key, r, now) {
  if (typeof key !== 'string' || key.length > 350 || /__proto__|constructor|prototype/.test(key)) return false;
  const kind = key.split('|')[0];
  if (!['notes', 'bookmarks', 'highlights', 'positions', 'selection', 'plan', 'day', 'completion'].includes(kind)) return false;
  if (!r || !Number.isSafeInteger(r.at) || r.at < 0 || r.at > now + 300000 || !Number.isSafeInteger(r.seq) || r.seq < 0 || typeof r.device !== 'string' || r.device.length > 128 || typeof r.deleted !== 'boolean') return false;
  if (r.deleted) return r.value === null;
  const v = r.value;
  if (kind === 'notes') return typeof v === 'string' && v.length <= 20000;
  if (kind === 'positions') return Number.isFinite(v) && v >= 0 && v <= 1e8;
  if (kind === 'day') return Number.isSafeInteger(v) && v >= 1 && v <= 5000;
  if (kind === 'plan') return typeof v === 'string' && v.length <= 100;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  if (kind === 'selection') return Object.keys(v).every(k => ['testament', 'book', 'chapter', 'verse'].includes(k)) && typeof v.book === 'string' && v.book.length <= 100 && Number.isSafeInteger(v.chapter) && v.chapter > 0 && Number.isSafeInteger(v.verse) && v.verse > 0;
  if (kind === 'completion') return Object.keys(v).every(k => ['active', 'dates', 'canceledAt'].includes(k)) && typeof v.active === 'boolean' && Array.isArray(v.dates) && v.dates.length <= 2000 && v.dates.every(d => typeof d === 'string' && d.length <= 100) && (v.canceledAt === null || typeof v.canceledAt === 'string');
  return Object.keys(v).every(k => ['label', 'savedAt', ...(kind === 'highlights' ? ['colorKey', 'color'] : [])].includes(k)) && typeof v.label === 'string' && v.label.length <= 200 && typeof v.savedAt === 'string' && v.savedAt.length <= 100 && (kind !== 'highlights' || (typeof v.colorKey === 'string' && v.colorKey.length <= 30 && /^#[0-9a-f]{6}$/i.test(v.color)));
}
module.exports = { KEYS, PREFIX, MAX_STATE_BYTES, parse, same, own, isTrackedKey, stampFrom, flatten, materialize, compare, chooseInitial, validRecord };
