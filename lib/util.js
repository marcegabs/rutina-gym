// Formatting, dates (es), units and small helpers shared by the whole app.

export const DAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY1 = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const MON = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MON3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const PALETTE = ['#D4F36B', '#C9BCFF', '#FFB27A', '#F6A6C6', '#9DD3CC', '#FFD15C'];
export const MUSCLES = ['Glúteo', 'Cuádriceps', 'Femoral', 'Aductores', 'Pantorrilla', 'Espalda', 'Pecho', 'Hombro', 'Bíceps', 'Tríceps', 'Trapecio', 'Core', 'Otro'];
export const EQUIPMENT = ['Barra', 'Mancuerna', 'Máquina', 'Polea', 'Peso corporal', 'Otro'];
// ids match public.activity_types
export const ACTIVITIES = [
  { id: 'swimming', name: 'Natación', color: '#9DD3CC' },
  { id: 'walking', name: 'Caminata', color: '#FFD15C' },
  { id: 'pilates', name: 'Pilates', color: '#F6A6C6' },
  { id: 'spinning', name: 'Spinning', color: '#FFB27A' },
  { id: 'functional', name: 'Entrenamiento funcional', color: '#C9BCFF' },
];
export function actType(id) {
  return ACTIVITIES.find((a) => a.id === id) || { id, name: 'Actividad', color: '#D4F36B' };
}

const KG_LB = 2.20462;

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
export const clone = (o) => JSON.parse(JSON.stringify(o));
export function dayStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function daysAgo(t, now) { return Math.round((dayStart(now) - dayStart(t)) / 86400000); }
export function weekStart(t) { const d = new Date(dayStart(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
export function addDays(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); }
export const pad2 = (n) => (n < 10 ? '0' : '') + n;
// 'YYYY-MM-DD' ↔ local midnight ms
export function parseDate(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d).getTime(); }
export function isoDate(t) { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

export function clock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ':' + pad2(m) : pad2(m)) + ':' + pad2(s);
}
export const restLabel = (sec) => (sec >= 60 ? Math.floor(sec / 60) + ':' + pad2(sec % 60) : sec + ' s');
export function dateLong(t) { const d = new Date(t); return DAY[d.getDay()] + ' ' + d.getDate() + ' de ' + MON[d.getMonth()]; }
export function dateShort(t) { const d = new Date(t); return d.getDate() + ' ' + MON3[d.getMonth()]; }
export function dateDay(t) { const d = new Date(t); return DAY3[d.getDay()] + ' ' + d.getDate() + ' ' + MON3[d.getMonth()]; }
export function timeOfDay(t) { const d = new Date(t); return d.getHours() + ':' + pad2(d.getMinutes()); }
export function rel(t, now) {
  const n = daysAgo(t, now);
  if (n <= 0) return 'hoy';
  if (n === 1) return 'ayer';
  if (n < 7) return 'hace ' + n + ' días';
  if (n < 14) return 'la semana pasada';
  return 'el ' + dateShort(t);
}
export const num = (v) => String(parseFloat((Math.round(v * 100) / 100).toFixed(2)));
export const thousands = (v) => Math.round(v).toLocaleString('es-MX');
export const toU = (kg, u) => (u === 'lb' ? Math.round(kg * KG_LB * 2) / 2 : Math.round(kg * 100) / 100);
export const fromU = (v, u) => (u === 'lb' ? v / KG_LB : v);
export const wt = (kg, u) => num(toU(kg, u));
export const e1rm = (w, r) => w * (1 + r / 30);
export function incFor(ex) {
  if (!ex) return 2.5;
  if (ex.slug === 'leg-press' || ex.slug === 'hack') return 5;
  return ex.equipment === 'Mancuerna' ? 1 : 2.5;
}
export function stepFor(ex, u) { const d = ex && ex.equipment === 'Mancuerna'; return u === 'lb' ? (d ? 2.5 : 5) : d ? 1 : 2.5; }
export const repRange = (a, b) => (a === b ? String(a) : a + '–' + b);
export const doneSets = (sets) => sets.filter((s) => s.completed);
export const volume = (sets) => doneSets(sets).reduce((t, s) => t + s.weight * s.reps, 0);
export function topSet(sets) {
  let best = null;
  sets.forEach((s) => { if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) best = s; });
  return best;
}
export function estimate(r) {
  let s = 0;
  r.exercises.forEach((e) => { s += e.targetSets * (45 + e.restSeconds) + 60; });
  return Math.max(10, Math.round((s / 60 + 5) / 5) * 5);
}
export function videoUrl(ex) {
  if (ex && ex.videoUrl && /^https?:\/\//.test(ex.videoUrl)) return ex.videoUrl;
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(((ex && ex.name) || 'ejercicio') + ' técnica correcta');
}
