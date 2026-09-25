// Turns app state into ready-to-render values for every screen.
// `app` is the TrainingApp component: it provides state, db and the action methods.
import * as U from './util.js';
import * as G from './engine.js';

const FALLBACK_PLAN = { 1: ['Lower A', 'Natación'], 2: ['Upper A', 'Natación'], 3: ['Descanso activo', 'Natación'], 4: ['Lower B', 'Natación'],
  5: ['Upper B', 'Natación'], 6: ['Descanso', 'Natación opcional'], 0: ['Descanso', ''] };

export function buildVM(app) {
  const st = app.state, db = st.db, P = db.profile, u = P.units, now = st.now;
  const X = G.exMap(db);
  const a = db.active;
  const vm = { unit: u, isToday: st.tab === 'today', isWorkouts: st.tab === 'workouts', isProgress: st.tab === 'progress', isSettings: st.tab === 'settings' };
  vm.miniResume = !!a && st.view !== 'workout';
  vm.miniResumeTxt = a ? a.routineName + ' · ' + U.clock((now - a.startTime) / 1000) : '';

  /* programa */
  const PG = db.program;
  const pw = G.programWeek(PG, now);
  const plan = (PG && PG.weekPlan && Object.keys(PG.weekPlan).length ? PG.weekPlan : FALLBACK_PLAN);
  vm.hasProgram = !!PG;
  vm.prog = { name: '', week: '', tip: '', segs: [], start: '', weekNum: '—' };
  if (PG) {
    const running = pw >= 1 && pw <= PG.weeks;
    vm.prog = {
      name: PG.name,
      week: running ? 'Semana ' + pw + ' de ' + PG.weeks : pw === 0 ? 'Empieza el ' + U.dateDay(PG.start).toLowerCase() : 'Programa completado',
      tip: running ? PG.tips[pw - 1] || '' : pw === 0 ? 'Mientras tanto puedes ir probando los ejercicios. Semana 1: ' + (PG.tips[0] || '').toLowerCase()
        : 'Terminaste las ' + PG.weeks + ' semanas. Reinicia el programa en Ajustes o ajusta tus rutinas.',
      segs: Array.from({ length: PG.weeks }, (_, i) => ({ cls: i + 1 < pw ? 'seg-bar done' : i + 1 === pw ? 'seg-bar now' : 'seg-bar' })),
      start: 'Inicio: ' + U.dateDay(PG.start).toLowerCase(),
      weekNum: pw === 0 ? '—' : pw > PG.weeks ? 'Fin' : String(pw),
    };
  }

  /* hoy */
  const dow = new Date(now).getDay();
  const scheduled = db.routines.find((r) => r.scheduledDay === dow) || null;
  const pick = (st.todayPick && db.routines.find((r) => r.id === st.todayPick)) || scheduled;
  const todayPlan = plan[dow] || ['', ''];
  vm.greeting = P.name ? 'Hola, ' + P.name : 'Hoy';
  vm.todayDate = U.dateLong(now);
  vm.hasActive = !!a;
  vm.activeName = a ? a.routineName : '';
  if (a) {
    const dn = a.exercises.reduce((t, e) => t + U.doneSets(e.sets).length, 0);
    vm.activeInfo = 'Ejercicio ' + (a.current + 1) + ' de ' + a.exercises.length + ' · ' + dn + ' series · ' + Math.max(1, Math.round((now - a.startTime) / 60000)) + ' min';
  }
  vm.showPlan = !a && !!pick;
  vm.showRestDay = !a && !pick;
  vm.restTitle = todayPlan[0] && !scheduled ? todayPlan[0] : 'Sin gym hoy';
  vm.restDayTxt = todayPlan[1] ? 'Hoy toca ' + todayPlan[1].toLowerCase() + '. Regístrala abajo cuando termines.' : 'Día de descanso total. Recupera — o elige una rutina abajo.';
  vm.plan = null;
  if (pick) {
    const isSched = scheduled && pick.id === scheduled.id;
    const rule = G.weekRule(PG, pw);
    vm.plan = {
      id: pick.id, name: pick.name, color: pick.color, desc: pick.description || '',
      tag: isSched ? U.DAY[dow] + ' · mañana' : 'Elegida para hoy',
      meta: pick.exercises.length + ' ejercicios · ~' + U.estimate(pick) + ' min',
      pm: isSched && todayPlan[1] ? 'Tarde: ' + todayPlan[1].toLowerCase() : '',
      items: pick.exercises.slice().sort((x, y) => x.order - y.order).map((re, i) => {
        const ex = X[re.exerciseId] || {};
        const sets = re.targetSets + (ex.compound ? rule.extraSets || 0 : 0);
        const reps = ex.compound && rule.repTarget ? rule.repTarget : re.targetRepMax;
        return { key: re.id || i, n: U.pad2(i + 1), name: ex.name || 'Ejercicio', spec: sets + ' × ' + U.repRange(Math.min(re.targetRepMin, reps), reps) + (re.perSide ? ' c/lado' : '') };
      }),
    };
  }
  vm.showSwitch = !a && db.routines.length > 0;
  vm.switchLabel = pick ? 'Cambiar el entreno de hoy' : 'Entrenar de todos modos';
  vm.todayChips = db.routines.map((r) => ({ id: r.id, name: r.name, color: r.color, on: !!pick && pick.id === r.id }));

  const ws = U.weekStart(now);
  const days = G.activeDays(db), today0 = U.dayStart(now);
  vm.week = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const t = U.addDays(ws, i), d = new Date(t), dd = d.getDay();
    const sr = db.routines.find((r) => r.scheduledDay === dd);
    const did = days[t], done = !!did, isT = t === today0;
    return { key: t, letter: U.DAY1[dd], num: d.getDate(), cls: 'wk ' + (done ? 'done ' : '') + (isT ? 'today ' : '') + (!done && sr && t > now ? 'planned' : ''),
      dot: did ? did[0].color : sr && t >= today0 ? sr.color : 'transparent',
      title: did ? did.map((x) => x.name).join(', ') : plan[dd] ? plan[dd].filter(Boolean).join(' + ') : '' };
  });
  let weekDays = 0;
  for (let i = 0; i < 7; i++) if (days[U.addDays(ws, i)]) weekDays++;
  vm.weekCount = weekDays;
  vm.weekRange = U.dateShort(ws) + ' – ' + U.dateShort(U.addDays(ws, 6));

  /* meta diaria */
  const todayDid = days[today0] || [];
  const streakDays = G.dayStreak(days, now);
  const didSwim = todayDid.some((x) => x.name === 'Natación');
  vm.goal = {
    done: todayDid.length > 0,
    title: todayDid.length ? 'Listo por hoy' : 'Muévete hoy',
    sub: todayDid.length ? todayDid.map((x) => x.name).join(' + ') + (todayPlan[1] === 'Natación' && !didSwim ? ' · falta: natación' : '')
      : 'Meta: 1 actividad física al día' + (todayPlan[1] ? ' · plan: ' + todayPlan[1].toLowerCase() : ''),
    streak: String(streakDays), streakLabel: streakDays === 1 ? 'día seguido' : 'días seguidos',
  };

  const lw = db.workouts[db.workouts.length - 1];
  const la = db.activities[db.activities.length - 1];
  vm.lastW = null;
  if (la && (!lw || la.startTime > lw.startTime)) {
    const lt = U.actType(la.type);
    vm.lastW = { id: la.id, title: lt.name + ' · ' + U.rel(la.startTime, now), color: lt.color, meta: la.duration + ' min' + (la.notes ? ' · ' + la.notes : '') };
  } else if (lw) {
    const lsets = lw.exercises.reduce((t, e) => t + U.doneSets(e.sets).length, 0);
    const lvol = lw.exercises.reduce((t, e) => t + U.volume(e.sets), 0);
    vm.lastW = { id: lw.id, title: lw.routineName + ' · ' + U.rel(lw.startTime, now), color: lw.color || '#D4F36B',
      meta: lw.duration + ' min · ' + lsets + ' series · ' + U.thousands(U.toU(lvol, u)) + ' ' + u };
  }

  /* rutinas */
  vm.routines = db.routines.map((r) => ({
    id: r.id, name: r.name, color: r.color, desc: r.description || '',
    meta: (r.scheduledDay == null ? 'Cualquier día' : U.DAY[r.scheduledDay]) + ' · ' + r.exercises.length + ' ejercicios · ~' + U.estimate(r) + ' min',
    items: r.exercises.slice().sort((x, y) => x.order - y.order).map((re, i) => ({
      key: re.id || i, name: (X[re.exerciseId] || {}).name || 'Ejercicio', spec: re.targetSets + ' × ' + U.repRange(re.targetRepMin, re.targetRepMax) + (re.perSide ? ' c/lado' : '') })),
  }));
  vm.weekPlan = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const p = plan[d] || ['', ''], r = db.routines.find((x) => x.scheduledDay === d);
    return { key: d, day: U.DAY3[d], am: r ? r.name : p[0], pm: p[1] || '—', color: r ? r.color : 'transparent', today: d === dow };
  });
  vm.progTips = PG ? PG.tips.map((t, i) => ({ key: i, n: 'Semana ' + (i + 1), tip: t, now: i + 1 === pw })) : [];

  /* progreso */
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const weekCounts = [];
  for (let k = 7; k >= 0; k--) {
    const s0 = U.addDays(ws, -7 * k); let c = 0;
    for (let i = 0; i < 7; i++) if (days[U.addDays(s0, i)]) c++;
    weekCounts.push({ start: s0, count: c });
  }
  let monthDays = 0; const monthSoFar = new Date(now).getDate();
  for (let i = 0; i < monthSoFar; i++) if (days[U.addDays(monthStart.getTime(), i)]) monthDays++;
  vm.stats = [
    { label: 'Racha', value: String(streakDays), sub: streakDays === 1 ? 'día con actividad' : 'días con actividad', accent: true },
    { label: 'Esta semana', value: weekDays + '/7', sub: 'días activos' },
    { label: 'Este mes', value: monthDays + '/' + monthSoFar, sub: 'días activos · ' + U.MON3[new Date(now).getMonth()] },
    { label: 'Sesiones gym', value: String(db.workouts.length), sub: db.activities.length + ' otras actividades' },
  ];
  vm.weeks8 = weekCounts.map((w, i) => ({ key: w.start, count: w.count ? String(w.count) : '', label: i === 7 ? 'Ahora' : U.dateShort(w.start),
    height: w.count ? 8 + w.count * 10 : 6, cls: w.count ? (w.count >= 7 ? 'wk-bar now' : 'wk-bar') : 'wk-bar empty' }));

  const fmtSet = (s) => U.wt(s.weight, u) + ' × ' + s.reps;
  const liftIds = [];
  for (let i = db.workouts.length - 1; i >= 0; i--) db.workouts[i].exercises.forEach((e) => { if (e.exerciseId && liftIds.indexOf(e.exerciseId) < 0 && U.doneSets(e.sets).length) liftIds.push(e.exerciseId); });
  vm.lifts = liftIds.map((id) => {
    const ss = G.sessionsFor(db, id), cur = ss[ss.length - 1], prev = ss[ss.length - 2];
    let trend = 'new', ttxt = 'Primer registro';
    if (prev) {
      const d = U.e1rm(cur.top.weight, cur.top.reps) / Math.max(0.0001, U.e1rm(prev.top.weight, prev.top.reps)) - 1;
      if (d > 0.01) { trend = 'up'; ttxt = '↑ Mejorando'; } else if (d < -0.01) { trend = 'down'; ttxt = '↓ Bajó'; } else { trend = 'flat'; ttxt = '→ Estable'; }
    }
    const pts = ss.slice(-8); let mn = Infinity, mx = -Infinity;
    pts.forEach((p) => { mn = Math.min(mn, p.top.weight); mx = Math.max(mx, p.top.weight); });
    const coords = pts.map((p, i) => [Math.round(pts.length > 1 ? 8 + (i / (pts.length - 1)) * 284 : 150), Math.round(mx > mn ? 58 - ((p.top.weight - mn) / (mx - mn)) * 48 : 34)]);
    const best = G.bestFor(db, id), ex = X[id];
    return { id, name: (ex && ex.name) || cur.name, muscle: ex ? ex.muscleGroup + ' · ' + ex.equipment : 'Ya no está en la biblioteca',
      prev: prev ? U.wt(prev.top.weight, u) + ' ' + u + ' × ' + prev.top.reps : '—', cur: U.wt(cur.top.weight, u) + ' ' + u + ' × ' + cur.top.reps,
      trendCls: 'trend ' + trend, trendTxt: ttxt, open: st.openLift === id,
      spark: coords.map((c) => c.join(',')).join(' '), lastX: coords[coords.length - 1][0], lastY: coords[coords.length - 1][1],
      best: best ? U.wt(best.weight, u) + ' ' + u + ' × ' + best.reps : '—', sessions: ss.length + (ss.length === 1 ? ' sesión' : ' sesiones'),
      recent: ss.slice(-5).reverse().map((s) => ({ key: s.workoutId, date: U.dateShort(s.date), sets: s.sets.map(fmtSet).join(' · ') })) };
  });
  const hist = db.workouts.map((w) => {
    const sets = w.exercises.reduce((t, e) => t + U.doneSets(e.sets).length, 0);
    const vol = w.exercises.reduce((t, e) => t + U.volume(e.sets), 0);
    return { id: w.id, kind: 'workout', t: w.startTime, name: w.routineName, color: w.color || '#D4F36B', date: U.dateDay(w.startTime),
      meta: w.duration + ' min · ' + sets + ' series · ' + U.thousands(U.toU(vol, u)) + ' ' + u, open: st.openHist === w.id,
      exercises: w.exercises.map((e, i) => ({ key: i, name: e.name, sets: U.doneSets(e.sets).map(fmtSet).join(' · ') || 'Sin series' })),
      notes: w.notes || '', delLabel: 'Borrar entreno' };
  });
  db.activities.forEach((ac) => {
    const ty = U.actType(ac.type);
    hist.push({ id: ac.id, kind: 'activity', t: ac.startTime, name: ty.name, color: ty.color, date: U.dateDay(ac.startTime), meta: ac.duration + ' min',
      open: st.openHist === ac.id, exercises: [], notes: ac.notes || '', delLabel: 'Borrar actividad' });
  });
  vm.history = hist.sort((x, y) => y.t - x.t);

  /* ajustes */
  vm.counts = db.routines.length + ' rutinas · ' + db.exercises.length + ' ejercicios · ' + db.workouts.length + ' entrenos · ' + db.activities.length + ' actividades';

  /* entreno */
  vm.w = null;
  if (a) {
    const ci = Math.min(a.current, a.exercises.length - 1), E = a.exercises[ci], EX = X[E.exerciseId] || {};
    let total = 0, done = 0;
    a.exercises.forEach((e) => { if (e.skipped) return; total += e.sets.length; done += U.doneSets(e.sets).length; });
    const asi = G.activeSetIndex(E);
    const best = G.bestFor(db, E.exerciseId);
    const last = G.lastFor(db, E.exerciseId);
    let nextTxt;
    if (asi >= 0) nextTxt = 'Sigue · Serie ' + (asi + 1) + ' · ' + U.wt(E.sets[asi].weight, u) + ' ' + u + ' × ' + E.sets[asi].reps;
    else {
      const nx = a.exercises.slice(ci + 1).find((e) => !e.skipped && e.sets.some((s) => !s.completed));
      nextTxt = nx ? 'Sigue · ' + nx.name : 'Última serie lista — termina cuando quieras';
    }
    let cta;
    if (asi >= 0) cta = { kind: 'complete', label: 'Completar serie ' + (asi + 1), sub: U.wt(E.sets[asi].weight, u) + ' ' + u + ' × ' + E.sets[asi].reps, cls: 'cta cta-ink', si: asi };
    else {
      const hasNext = a.exercises.slice(ci + 1).some((e) => e.sets.some((s) => !s.completed));
      cta = hasNext ? { kind: 'next', label: 'Siguiente ejercicio', sub: a.exercises[ci + 1] ? a.exercises[ci + 1].name : '', cls: 'cta cta-accent' }
        : { kind: 'finish', label: 'Terminar entreno', sub: done + ' series registradas', cls: 'cta cta-accent' };
    }
    vm.w = {
      ci, name: a.routineName + (a.week >= 1 && PG && a.week <= PG.weeks ? ' · S' + a.week : ''), pos: 'Ejercicio ' + (ci + 1) + ' de ' + a.exercises.length,
      elapsed: U.clock((now - a.startTime) / 1000), progressPct: total ? Math.round((done / total) * 100) : 0, progressTxt: done + '/' + total + ' series',
      strip: a.exercises.map((e, i) => {
        const complete = e.sets.every((s) => s.completed);
        return { key: i, i, n: i + 1, name: e.name, cls: 'ex-chip' + (i === ci ? ' cur' : '') + (complete ? ' done' : '') + (e.skipped ? ' skipped' : ''),
          aria: e.name + (complete ? ', completo' : e.skipped ? ', saltado' : '') };
      }),
      ex: { name: E.name, muscle: (EX.muscleGroup || 'Otro') + ' · ' + (EX.equipment || 'Otro'), spec: E.sets.length + ' × ' + U.repRange(E.targetRepMin, E.targetRepMax),
        rest: U.restLabel(E.restSeconds) + ' descanso', how: EX.instructions || '', note: E.notes || '', hevy: EX.hevyName ? 'Hevy: ' + EX.hevyName : '', adj: E.adj || '' },
      video: U.videoUrl(EX.id ? EX : { name: E.name }), videoLabel: EX.videoUrl ? 'Ver video' : 'Ver video en YouTube',
      showHow: st.showHow, isSkipped: !!E.skipped,
      prevLabel: last ? 'La vez pasada · ' + U.rel(last.date, now) : 'La vez pasada',
      prevSets: last ? last.sets.map((s, i) => ({ key: i, txt: U.wt(s.weight, u) + ' ' + u + ' × ' + s.reps })) : null,
      targetW: E.targetWeight ? U.wt(E.targetWeight, u) + ' ' + u : 'Tú eliges', targetR: U.repRange(E.targetRepMin, E.targetRepMax) + ' reps', reason: E.reason || '',
      stepLabel: '±' + U.num(U.stepFor(EX, u)) + ' ' + u,
      sets: E.sets.map((s, i) => ({
        key: i, i, label: 'Serie ' + (i + 1), of: 'de ' + E.sets.length,
        state: s.completed ? 'done' : i === asi ? 'active' : 'pending',
        txt: U.wt(s.weight, u) + ' ' + u + ' × ' + s.reps, time: s.timestamp ? U.timeOfDay(s.timestamp) : '',
        pr: !!(s.completed && best && (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps))),
        wVal: s.wText != null ? s.wText : U.wt(s.weight, u), rVal: s.rText != null ? s.rText : String(s.reps),
      })),
      resting: !!a.rest && !a.rest.done, restDone: !!a.rest && !!a.rest.done,
      restClock: a.rest ? U.clock((a.rest.endAt - now) / 1000) : '00:00',
      restPct: a.rest ? Math.max(0, Math.min(100, ((a.rest.endAt - now) / (a.rest.total * 1000)) * 100)) : 0,
      restNext: nextTxt, cta, notes: a.notes || '',
    };
  }

  /* resumen */
  const S = st.summary;
  vm.sum = S ? { ...S, duration: S.duration + ' min', exercises: String(S.exercises), sets: String(S.sets) } : null;

  /* selector */
  const pk = st.picker || { purpose: 'add', query: '' };
  const q = pk.query.trim().toLowerCase();
  vm.picker = {
    title: pk.purpose === 'swap' ? 'Reemplazar ejercicio' : 'Agregar ejercicio', query: pk.query,
    results: db.exercises.filter((e) => !q || e.name.toLowerCase().includes(q) || (e.muscleGroup || '').toLowerCase().includes(q) || (e.hevyName || '').toLowerCase().includes(q))
      .slice().sort((x, y) => x.name.localeCompare(y.name, 'es')).map((e) => ({ id: e.id, name: e.name, meta: e.muscleGroup + ' · ' + e.equipment })),
    canCreate: !!q && !db.exercises.some((e) => e.name.toLowerCase() === q), createName: pk.query.trim(),
  };
  vm.library = db.exercises.map((e) => ({ ...e, meta: e.muscleGroup + ' · ' + e.equipment + (e.hevyName ? ' · Hevy: ' + e.hevyName : ''), open: st.openExercise === e.id, video: U.videoUrl(e) }));

  /* editor */
  const ed = st.editor;
  vm.ed = null;
  if (ed) {
    vm.ed = {
      title: ed.isNew ? 'Nueva rutina' : 'Editar rutina', name: ed.name, desc: ed.description || '', color: ed.color, scheduledDay: ed.scheduledDay,
      duration: '~' + U.estimate(ed) + ' min · ' + ed.exercises.length + ' ejercicios',
      items: ed.exercises.map((it, i) => {
        const ex = X[it.exerciseId] || { name: 'Ejercicio', equipment: '' };
        return { key: it.key || it.id || i, i, n: U.pad2(i + 1), name: ex.name, open: ed.open === i, step: U.stepFor(ex, u),
          spec: it.targetSets + ' × ' + U.repRange(it.targetRepMin, it.targetRepMax) + ' · ' + U.restLabel(it.restSeconds) + ' descanso' + (it.targetWeight ? ' · ' + U.wt(it.targetWeight, u) + ' ' + u : ''),
          fields: [
            { k: 'targetSets', label: 'Series', val: String(it.targetSets), d: 1, min: 1, max: 12 },
            { k: 'targetRepMin', label: 'Reps mín.', val: String(it.targetRepMin), d: 1, min: 1, max: 50 },
            { k: 'targetRepMax', label: 'Reps máx.', val: String(it.targetRepMax), d: 1, min: 1, max: 50 },
            { k: 'restSeconds', label: 'Descanso', val: U.restLabel(it.restSeconds), d: 15, min: 15, max: 600 },
            { k: 'targetWeight', label: 'Peso inicial · ' + u, val: U.wt(it.targetWeight, u) },
          ] };
      }),
    };
  }
  return vm;
}
