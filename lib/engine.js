// Pure workout logic: queries over the in-memory db and the rules for a live workout.
// `db` is the shape produced by lib/data.js → loadAll().
import { dayStart, addDays, doneSets, topSet, volume, incFor, clone, uid, actType } from './util.js';

export function exMap(db) { const m = {}; db.exercises.forEach((e) => { m[e.id] = e; }); return m; }

export function sessionsFor(db, exId) {
  const out = [];
  db.workouts.forEach((w) => {
    w.exercises.forEach((e) => {
      if (e.exerciseId !== exId) return;
      const sets = doneSets(e.sets);
      if (!sets.length) return;
      out.push({ date: w.startTime, workoutId: w.id, name: e.name, sets, top: topSet(sets), volume: volume(sets) });
    });
  });
  return out;
}
export function lastFor(db, exId) { const s = sessionsFor(db, exId); return s.length ? s[s.length - 1] : null; }
export function bestFor(db, exId) { return topSet(sessionsFor(db, exId).map((s) => s.top)); }

// every day with gym or another activity → { dayMs: [{name,color,gym}] }
export function activeDays(db) {
  const m = {};
  const add = (t, v) => { const k = dayStart(t); (m[k] = m[k] || []).push(v); };
  db.workouts.forEach((w) => add(w.startTime, { name: 'Gym · ' + w.routineName, color: w.color || '#D4F36B', gym: true }));
  db.activities.forEach((a) => { const ty = actType(a.type); add(a.startTime, { name: ty.name, color: ty.color, gym: false }); });
  return m;
}
export function dayStreak(days, now) {
  let t = dayStart(now), n = 0;
  if (!days[t]) t = addDays(t, -1);
  while (days[t]) { n++; t = addDays(t, -1); }
  return n;
}
// 0 = not started, 1…weeks, > weeks = finished
export function programWeek(program, now) {
  if (!program) return 0;
  const d = Math.floor((dayStart(now) - dayStart(program.start)) / 86400000);
  return d < 0 ? 0 : Math.floor(d / 7) + 1;
}
export function weekRule(program, week) {
  return (program && program.rules && program.rules[week - 1]) || { extraSets: 0, repTarget: null, inc: null };
}

export function suggest(re, last, ex, week, rule) {
  if (!last) {
    if (re.targetWeight) return { weight: re.targetWeight, up: false, reason: 'Peso inicial de tu rutina.' };
    return { weight: 0, up: false, reason: week <= 1 ? 'Semana 1: elige un peso cómodo y aprende el movimiento.' : 'Primera vez: elige un peso con el que llegues a ' + re.targetRepMax + ' reps con buena técnica.' };
  }
  const top = last.top.weight;
  const topSets = last.sets.filter((s) => s.weight >= top);
  const hit = topSets.filter((s) => s.reps >= re.targetRepMax).length;
  if (ex && ex.compound && rule.repTarget) return { weight: top + incFor(ex), up: true, reason: 'Semana ' + week + ': más peso, ' + rule.repTarget + ' reps en compuestos.' };
  if (hit >= Math.ceil(topSets.length / 2)) return { weight: top + incFor(ex), up: true, reason: 'Llegaste a ' + re.targetRepMax + ' reps la vez pasada — sube el peso.' };
  const hint = rule.inc ? ' Semana ' + week + ': sube 1–2 kg si puedes.' : '';
  return { weight: top, up: false, reason: 'Mismo peso — busca llegar a ' + re.targetRepMax + ' reps.' + hint };
}

export function makeActiveEx(db, re0, order, week) {
  const ex = exMap(db)[re0.exerciseId] || { id: re0.exerciseId, name: 'Ejercicio', equipment: '' };
  const re = clone(re0);
  const rule = weekRule(db.program, week);
  let adj = '';
  if (ex.compound && rule.extraSets) { re.targetSets += rule.extraSets; adj = 'Semana ' + week + ': +' + rule.extraSets + ' serie'; }
  if (ex.compound && rule.repTarget) { re.targetRepMin = Math.min(re.targetRepMin, rule.repTarget); re.targetRepMax = rule.repTarget; adj = 'Semana ' + week + ': ' + rule.repTarget + ' reps'; }
  const last = lastFor(db, re.exerciseId);
  const sg = suggest(re, last, ex, week, rule);
  const sets = [];
  for (let i = 0; i < re.targetSets; i++) {
    const lr = last && last.sets[i] ? last.sets[i].reps : re.targetRepMax;
    sets.push({ setNumber: i + 1, weight: sg.weight, reps: sg.up ? re.targetRepMin : Math.min(re.targetRepMax, lr + 1), completed: false, timestamp: null });
  }
  return { exerciseId: re.exerciseId, name: ex.name, order, notes: re.notes || '', skipped: false,
    targetSets: re.targetSets, targetRepMin: re.targetRepMin, targetRepMax: re.targetRepMax, adj,
    restSeconds: re.restSeconds || db.profile.defaultRest, targetWeight: sg.weight, up: sg.up, reason: sg.reason, focus: null, sets };
}

export function newActive(db, r, now) {
  const list = r.exercises.slice().sort((a, b) => a.order - b.order);
  const week = programWeek(db.program, now);
  return { id: uid(), routineId: r.id, routineName: r.name, color: r.color, programId: db.program ? db.program.id : null,
    startTime: now, notes: '', current: 0, rest: null, week,
    exercises: list.map((re, i) => makeActiveEx(db, re, i, week)) };
}

export function activeSetIndex(e) {
  if (e.focus != null && e.sets[e.focus] && !e.sets[e.focus].completed) return e.focus;
  for (let i = 0; i < e.sets.length; i++) if (!e.sets[i].completed) return i;
  return -1;
}

// finished live workout → workout record (same shape as loaded history)
export function toRecord(a, now) {
  return {
    id: a.id, routineId: a.routineId, routineName: a.routineName, color: a.color, programId: a.programId || null, programWeek: a.week || null,
    startTime: a.startTime, endTime: now, duration: Math.max(1, Math.round((now - a.startTime) / 60000)), notes: a.notes || '',
    exercises: a.exercises.filter((e) => e.sets.some((s) => s.completed)).map((e, i) => ({
      exerciseId: e.exerciseId, name: e.name, order: i, notes: e.notes || '', skipped: false,
      targetSets: e.targetSets, targetRepMin: e.targetRepMin, targetRepMax: e.targetRepMax, targetWeight: e.targetWeight, restSeconds: e.restSeconds,
      sets: e.sets.map((s, j) => ({ setNumber: j + 1, weight: s.weight, reps: s.reps, completed: !!s.completed, timestamp: s.timestamp || null })),
    })),
  };
}
