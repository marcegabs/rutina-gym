/* ─────────────────────────────────────────────────────────────
   Rutinas GYM · v0.3
   1 Utilidades · 2 Programa (body recomp 4 semanas) · 3 Persistencia
   4 Consultas · 5 Motor de entreno · 6 Componente (vista + acciones)
   La UI solo habla con TOS.* — TOS.Store se puede cambiar por una API
   más adelante sin tocar el markup.
   ───────────────────────────────────────────────────────────── */
var TOS = (function () {
  var SCHEMA_VERSION = 2;
  var STORE_KEY = 'training-os/v1';
  var DAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var DAY3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var DAY1 = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  var MON = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MON3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var PALETTE = ['#D4F36B', '#C9BCFF', '#FFB27A', '#F6A6C6', '#9DD3CC', '#FFD15C'];
  var KG_LB = 2.20462;
  var MUSCLES = ['Glúteo', 'Cuádriceps', 'Femoral', 'Aductores', 'Pantorrilla', 'Espalda', 'Pecho', 'Hombro', 'Bíceps', 'Tríceps', 'Trapecio', 'Core', 'Otro'];
  var EQUIPMENT = ['Barra', 'Mancuerna', 'Máquina', 'Polea', 'Peso corporal', 'Otro'];
  // Otras actividades que cuentan para la meta diaria junto con el gym
  var ACTIVITIES = [
    { id: 'swimming', name: 'Natación', color: '#9DD3CC' },
    { id: 'walking', name: 'Caminata', color: '#FFD15C' },
    { id: 'pilates', name: 'Pilates', color: '#F6A6C6' },
    { id: 'spinning', name: 'Spinning', color: '#FFB27A' },
    { id: 'functional', name: 'Entrenamiento funcional', color: '#C9BCFF' }
  ];
  function actType(id) { return ACTIVITIES.find(function (a) { return a.id === id; }) || { id: id, name: 'Actividad', color: '#D4F36B' }; }

  /* 1 ── utilidades */
  function uid(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dayStart(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function daysAgo(t, now) { return Math.round((dayStart(now) - dayStart(t)) / 86400000); }
  function weekStart(t) { var d = new Date(dayStart(t)); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); }
  function addDays(t, n) { var d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function clock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + pad2(m) : pad2(m)) + ':' + pad2(s);
  }
  function restLabel(sec) { return sec >= 60 ? (Math.floor(sec / 60) + ':' + pad2(sec % 60)) : sec + ' s'; }
  function dateLong(t) { var d = new Date(t); return DAY[d.getDay()] + ' ' + d.getDate() + ' de ' + MON[d.getMonth()]; }
  function dateShort(t) { var d = new Date(t); return d.getDate() + ' ' + MON3[d.getMonth()]; }
  function dateDay(t) { var d = new Date(t); return DAY3[d.getDay()] + ' ' + d.getDate() + ' ' + MON3[d.getMonth()]; }
  function timeOfDay(t) { var d = new Date(t); return d.getHours() + ':' + pad2(d.getMinutes()); }
  function rel(t, now) {
    var n = daysAgo(t, now);
    if (n <= 0) return 'hoy';
    if (n === 1) return 'ayer';
    if (n < 7) return 'hace ' + n + ' días';
    if (n < 14) return 'la semana pasada';
    return 'el ' + dateShort(t);
  }
  function num(v) { return String(parseFloat((Math.round(v * 100) / 100).toFixed(2))); }
  function thousands(v) { return Math.round(v).toLocaleString('es-MX'); }
  function toU(kg, u) { return u === 'lb' ? Math.round(kg * KG_LB * 2) / 2 : Math.round(kg * 100) / 100; }
  function fromU(v, u) { return u === 'lb' ? v / KG_LB : v; }
  function wt(kg, u) { return num(toU(kg, u)); }
  function e1rm(w, r) { return w * (1 + r / 30); }
  function incFor(ex) { if (!ex) return 2.5; if (ex.id === 'leg-press' || ex.id === 'hack') return 5; return ex.equipment === 'Mancuerna' ? 1 : 2.5; }
  function stepFor(ex, u) { var d = ex && ex.equipment === 'Mancuerna'; return u === 'lb' ? (d ? 2.5 : 5) : (d ? 1 : 2.5); }
  function repRange(a, b) { return a === b ? String(a) : a + '–' + b; }
  function doneSets(sets) { return sets.filter(function (s) { return s.completed; }); }
  function volume(sets) { return doneSets(sets).reduce(function (t, s) { return t + s.weight * s.reps; }, 0); }
  function topSet(sets) {
    var best = null;
    sets.forEach(function (s) { if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) best = s; });
    return best;
  }
  function estimate(r) {
    var s = 0;
    r.exercises.forEach(function (e) { s += e.targetSets * (45 + e.restSeconds) + 60; });
    return Math.max(10, Math.round((s / 60 + 5) / 5) * 5);
  }
  function videoUrl(ex) {
    if (ex && ex.videoUrl && /^https?:\/\//.test(ex.videoUrl)) return ex.videoUrl;
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(((ex && ex.name) || 'ejercicio') + ' técnica correcta');
  }

  /* 2 ── programa: body recomp · 4 semanas (Upper/Lower + natación diaria) */
  // [id, nombre, músculo, equipo, nombre en Hevy, compuesto, indicaciones]
  var EXERCISES = [
    ['goblet', 'Sentadilla goblet', 'Cuádriceps', 'Mancuerna', 'Goblet Squat', true, 'Mancuerna pegada al pecho, rodillas siguen la punta del pie, espalda recta.'],
    ['rdl', 'Peso muerto rumano', 'Femoral', 'Barra', 'Romanian Deadlift', true, 'Rodillas suaves, lleva la cadera atrás y mantén la barra pegada a las piernas.'],
    ['leg-press', 'Prensa de pierna', 'Cuádriceps', 'Máquina', 'Leg Press', true, 'Pies al ancho de hombros; no bloquees las rodillas arriba.'],
    ['kickback', 'Patada de glúteo en máquina', 'Glúteo', 'Máquina', 'Cable Glute Kickback', false, 'Aprieta el glúteo arriba, sin arquear la espalda baja.'],
    ['lying-curl', 'Curl femoral acostado', 'Femoral', 'Máquina', 'Leg Curl (Machine)', false, 'Baja en 2 segundos, cadera pegada al banco.'],
    ['calf', 'Elevación de talones', 'Pantorrilla', 'Máquina', 'Standing Calf Raise', false, 'Estira abajo por completo y sostén 1 segundo arriba.'],
    ['db-bench', 'Press banca con mancuernas', 'Pecho', 'Mancuerna', 'Dumbbell Bench Press', true, 'Omóplatos juntos, baja controlado hasta la línea del pecho.'],
    ['pec-deck', 'Peck deck', 'Pecho', 'Máquina', 'Pec Deck Fly', false, 'Codos ligeramente flexionados, junta al frente y aprieta.'],
    ['machine-press', 'Press militar en máquina', 'Hombro', 'Máquina', 'Shoulder Press (Machine)', true, 'Espalda pegada al respaldo, no bloquees los codos.'],
    ['lateral', 'Elevación lateral', 'Hombro', 'Mancuerna', 'Lateral Raise (Dumbbell)', false, 'Sube con los codos hasta la altura del hombro, sin impulso. Peso por mano.'],
    ['front', 'Elevación frontal', 'Hombro', 'Mancuerna', 'Front Raise (Dumbbell)', false, 'Brazos casi rectos, sube hasta la altura de los ojos. Peso por mano.'],
    ['dip-machine', 'Fondos en máquina (tríceps)', 'Tríceps', 'Máquina', 'Tricep Dip (Machine)', false, 'Codos pegados al cuerpo, extiende por completo.'],
    ['copa', 'Press copa tríceps', 'Tríceps', 'Mancuerna', 'Overhead Tricep Extension', false, 'Codos apuntando al techo, baja la mancuerna detrás de la cabeza.'],
    ['hack', 'Sentadilla hack', 'Cuádriceps', 'Máquina', 'Hack Squat', true, 'Baja profundo con la espalda pegada al respaldo.'],
    ['adduction', 'Aducción en máquina', 'Aductores', 'Máquina', 'Hip Adduction (Machine)', false, 'Cierra controlado y abre lento.'],
    ['leg-ext', 'Extensión de pierna', 'Cuádriceps', 'Máquina', 'Leg Extension (Machine)', false, 'Pausa arriba 1 segundo.'],
    ['incline-curl', 'Curl femoral inclinado', 'Femoral', 'Máquina', 'Lying Leg Curl', false, 'Cadera abajo, controla la bajada.'],
    ['lunge', 'Desplante caminando', 'Glúteo', 'Mancuerna', 'Walking Lunge', true, '12 por lado. Paso largo, torso erguido. Peso por mano.'],
    ['pulldown', 'Jalón al frente en polea', 'Espalda', 'Polea', 'Lat Pulldown', true, 'Pecho arriba, jala la barra a la clavícula.'],
    ['seated-row', 'Remo sentado en máquina', 'Espalda', 'Máquina', 'Seated Cable Row', true, 'Junta los omóplatos al final de cada rep.'],
    ['db-row', 'Remo con mancuerna', 'Espalda', 'Mancuerna', 'Single Arm Dumbbell Row', true, '12 por lado. Jala hacia la cadera, espalda plana.'],
    ['straight-pd', 'Pull down barra Z prono', 'Espalda', 'Polea', 'Straight Arm Pulldown', false, 'Brazos casi rectos, baja la barra hasta los muslos.'],
    ['hammer', 'Curl martillo', 'Bíceps', 'Mancuerna', 'Hammer Curl (Dumbbell)', false, 'Palmas mirándose, codos quietos. Peso por mano.'],
    ['ez-curl', 'Curl barra Z abierto', 'Bíceps', 'Barra', 'EZ Bar Curl', false, 'Agarre abierto, sin balancear el cuerpo.'],
    ['shrug', 'Encogimientos con mancuerna', 'Trapecio', 'Mancuerna', 'Dumbbell Shrug', false, 'Sube los hombros hacia las orejas y sostén 1 segundo.']
  ];
  // [ejercicio, series, reps, descanso seg]
  var ROUTINES = [
    { id: 'lower-a', name: 'Lower A', desc: 'Pierna fuerza, base · descanso 90 s', day: 1, items: [
      ['goblet', 4, 12, 90], ['rdl', 4, 12, 90], ['leg-press', 4, 12, 90], ['kickback', 4, 15, 90], ['lying-curl', 4, 12, 90], ['calf', 4, 20, 90]] },
    { id: 'upper-a', name: 'Upper A', desc: 'Empuje: pecho, hombro, tríceps · descanso 90 s', day: 2, items: [
      ['db-bench', 4, 12, 90], ['pec-deck', 4, 12, 90], ['machine-press', 4, 12, 90], ['lateral', 4, 12, 90], ['front', 3, 12, 90], ['dip-machine', 4, 15, 90], ['copa', 3, 15, 90]] },
    { id: 'lower-b', name: 'Lower B', desc: 'Hipertrofia: glúteo y muslo interno · descanso 60–75 s', day: 4, items: [
      ['hack', 4, 12, 75], ['adduction', 4, 20, 60], ['leg-ext', 4, 15, 60], ['incline-curl', 4, 12, 60], ['lunge', 3, 12, 75], ['calf', 4, 20, 60]] },
    { id: 'upper-b', name: 'Upper B', desc: 'Jale: espalda, bíceps, hombro posterior · descanso 90 s', day: 5, items: [
      ['pulldown', 4, 12, 90], ['seated-row', 4, 12, 90], ['db-row', 4, 12, 90], ['straight-pd', 3, 15, 90], ['hammer', 4, 12, 90], ['ez-curl', 3, 12, 90], ['shrug', 4, 20, 90]] }
  ];
  var TIPS = [
    'Aprende los movimientos, pesos conservadores.',
    'Sube 1–2 kg en al menos 2 ejercicios por día.',
    'Agrega 1 serie extra en los compuestos (5×12).',
    'Peso más alto, baja a 10 reps en los compuestos.'
  ];
  // plan de cada día: mañana (gym) y tarde
  var WEEK_PLAN = { 1: ['Lower A', 'Natación'], 2: ['Upper A', 'Natación'], 3: ['Descanso activo', 'Natación'], 4: ['Lower B', 'Natación'],
    5: ['Upper B', 'Natación'], 6: ['Descanso', 'Natación opcional'], 0: ['Descanso', ''] };

  function programStart(now) {
    // arranca este lunes si es lun–mié; si no, el próximo lunes
    var ws = weekStart(now), dow = (new Date(now).getDay() + 6) % 7;
    return dow <= 2 ? ws : addDays(ws, 7);
  }
  function seed(now) {
    var exercises = EXERCISES.map(function (e) { return { id: e[0], name: e[1], muscleGroup: e[2], equipment: e[3], hevyName: e[4], compound: e[5], instructions: e[6] || '', notes: '', videoUrl: '' }; });
    var routines = ROUTINES.map(function (r, i) {
      var rr = { id: r.id, name: r.name, description: r.desc, scheduledDay: r.day, color: PALETTE[i],
        exercises: r.items.map(function (it, j) {
          return { exerciseId: it[0], order: j, targetSets: it[1], targetRepMin: it[2], targetRepMax: it[2], targetWeight: 0, restSeconds: it[3], notes: '' };
        }) };
      rr.estimatedDuration = estimate(rr);
      return rr;
    });
    return { version: SCHEMA_VERSION, profile: { name: '', units: 'kg', defaultRest: 90, theme: 'auto', sound: true, dailyGoal: 1 },
      program: { name: 'Body recomp · 4 semanas', start: programStart(now), weeks: 4, tips: TIPS.slice(), weekPlan: clone(WEEK_PLAN) },
      exercises: exercises, routines: routines, workouts: [], activities: [], active: null, seededAt: now };
  }

  /* 3 ── persistencia: localStorage, con respaldo en memoria */
  var Store = {
    mode: 'memory', _mem: null,
    read: function () {
      try { var raw = window.localStorage.getItem(STORE_KEY); this.mode = 'device'; return raw ? JSON.parse(raw) : null; }
      catch (e) { this.mode = 'memory'; return this._mem ? clone(this._mem) : null; }
    },
    write: function (db) {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(db)); this.mode = 'device'; }
      catch (e) { this.mode = 'memory'; this._mem = clone(db); }
    }
  };
  // v1 (datos de ejemplo en inglés) → v2: programa nuevo, conserva lo que registraste tú
  function migrate(old, now) {
    var db = seed(now);
    if (old.profile) Object.keys(db.profile).forEach(function (k) { if (old.profile[k] != null) db.profile[k] = old.profile[k]; });
    db.workouts = (old.workouts || []).filter(function (w) { return String(w.id).indexOf('w_seed_') !== 0; });
    db.activities = (old.activities || []).filter(function (a) { return String(a.id).indexOf('a_seed_') !== 0; });
    return db;
  }
  function load(now) {
    var db = null;
    try { db = Store.read(); } catch (e) { db = null; }
    if (db && db.version === 1) { db = migrate(db, now); Store.write(db); }
    if (!db || db.version !== SCHEMA_VERSION || !db.routines) { db = seed(now); Store.write(db); }
    return db;
  }

  /* 4 ── consultas */
  function exMap(db) { var m = {}; db.exercises.forEach(function (e) { m[e.id] = e; }); return m; }
  function sessionsFor(db, exId) {
    var out = [];
    db.workouts.forEach(function (w) {
      w.exercises.forEach(function (e) {
        if (e.exerciseId !== exId) return;
        var sets = doneSets(e.sets);
        if (!sets.length) return;
        out.push({ date: w.startTime, workoutId: w.id, name: e.name, sets: sets, top: topSet(sets), volume: volume(sets) });
      });
    });
    return out;
  }
  function activeDays(db) {
    var m = {};
    var add = function (t, v) { var k = dayStart(t); (m[k] = m[k] || []).push(v); };
    db.workouts.forEach(function (w) { add(w.startTime, { name: 'Gym · ' + w.routineName, color: w.color || '#D4F36B', gym: true }); });
    (db.activities || []).forEach(function (a) { var ty = actType(a.type); add(a.startTime, { name: ty.name, color: ty.color, gym: false }); });
    return m;
  }
  function dayStreak(days, now) {
    var t = dayStart(now), n = 0;
    if (!days[t]) t = addDays(t, -1);
    while (days[t]) { n++; t = addDays(t, -1); }
    return n;
  }
  // semana del programa: 0 = aún no empieza, 1–4, >4 = terminado
  function programWeek(db, now) {
    var p = db.program; if (!p) return 0;
    var d = Math.floor((dayStart(now) - dayStart(p.start)) / 86400000);
    return d < 0 ? 0 : Math.floor(d / 7) + 1;
  }
  function lastFor(db, exId) { var s = sessionsFor(db, exId); return s.length ? s[s.length - 1] : null; }
  function bestFor(db, exId) { return topSet(sessionsFor(db, exId).map(function (s) { return s.top; })); }
  function suggest(re, last, ex, week) {
    if (!last) {
      if (re.targetWeight) return { weight: re.targetWeight, up: false, reason: 'Peso inicial de tu rutina.' };
      return { weight: 0, up: false, reason: week <= 1 ? 'Semana 1: elige un peso cómodo y aprende el movimiento.' : 'Primera vez: elige un peso con el que llegues a ' + re.targetRepMax + ' reps con buena técnica.' };
    }
    var top = last.top.weight;
    var topSets = last.sets.filter(function (s) { return s.weight >= top; });
    var hit = topSets.filter(function (s) { return s.reps >= re.targetRepMax; }).length;
    var w2 = week === 2 ? ' Semana 2: sube 1–2 kg si puedes.' : '';
    if (week === 4 && ex && ex.compound) return { weight: top + incFor(ex), up: true, reason: 'Semana 4: más peso, 10 reps en compuestos.' };
    if (hit >= Math.ceil(topSets.length / 2)) return { weight: top + incFor(ex), up: true, reason: 'Llegaste a ' + re.targetRepMax + ' reps la vez pasada — sube el peso.' };
    return { weight: top, up: false, reason: 'Mismo peso — busca llegar a ' + re.targetRepMax + ' reps.' + w2 };
  }

  /* 5 ── motor de entreno */
  function makeActiveEx(db, re, order, week) {
    var ex = exMap(db)[re.exerciseId] || { id: re.exerciseId, name: 'Ejercicio', equipment: '' };
    re = clone(re);
    var adj = '';
    if (ex.compound && week === 3) { re.targetSets += 1; adj = 'Semana 3: +1 serie'; }
    if (ex.compound && week === 4) { re.targetRepMin = Math.min(re.targetRepMin, 10); re.targetRepMax = 10; adj = 'Semana 4: 10 reps'; }
    var last = lastFor(db, re.exerciseId);
    var sg = suggest(re, last, ex, week);
    var sets = [];
    for (var i = 0; i < re.targetSets; i++) {
      var lr = last && last.sets[i] ? last.sets[i].reps : re.targetRepMax;
      sets.push({ setNumber: i + 1, weight: sg.weight, reps: sg.up ? re.targetRepMin : Math.min(re.targetRepMax, lr + 1), completed: false, timestamp: null });
    }
    return { exerciseId: re.exerciseId, name: ex.name, order: order, notes: re.notes || '', skipped: false,
      targetSets: re.targetSets, targetRepMin: re.targetRepMin, targetRepMax: re.targetRepMax, adj: adj,
      restSeconds: re.restSeconds || db.profile.defaultRest, targetWeight: sg.weight, up: sg.up, reason: sg.reason, focus: null, sets: sets };
  }
  function newActive(db, r, now) {
    var list = r.exercises.slice().sort(function (a, b) { return a.order - b.order; });
    var week = programWeek(db, now);
    return { id: uid('w'), routineId: r.id, routineName: r.name, color: r.color, date: dayStart(now), startTime: now, notes: '', current: 0, rest: null, week: week,
      exercises: list.map(function (re, i) { return makeActiveEx(db, re, i, week); }) };
  }
  function activeSetIndex(e) {
    if (e.focus != null && e.sets[e.focus] && !e.sets[e.focus].completed) return e.focus;
    for (var i = 0; i < e.sets.length; i++) if (!e.sets[i].completed) return i;
    return -1;
  }
  function toRecord(a, now) {
    return { id: a.id, routineId: a.routineId, routineName: a.routineName, color: a.color, date: a.date, startTime: a.startTime, endTime: now,
      duration: Math.max(1, Math.round((now - a.startTime) / 60000)), completed: true, notes: a.notes || '', programWeek: a.week || 0,
      exercises: a.exercises.filter(function (e) { return e.sets.some(function (s) { return s.completed; }); }).map(function (e, i) {
        return { exerciseId: e.exerciseId, name: e.name, order: i, notes: e.notes || '',
          sets: e.sets.map(function (s, j) { return { setNumber: j + 1, weight: s.weight, reps: s.reps, completed: !!s.completed, timestamp: s.timestamp || null }; }) };
      }) };
  }

  return { SCHEMA_VERSION: SCHEMA_VERSION, DAY: DAY, DAY3: DAY3, DAY1: DAY1, MON: MON, MON3: MON3, PALETTE: PALETTE, MUSCLES: MUSCLES, EQUIPMENT: EQUIPMENT, WEEK_PLAN: WEEK_PLAN,
    uid: uid, clone: clone, dayStart: dayStart, daysAgo: daysAgo, weekStart: weekStart, addDays: addDays, pad2: pad2, clock: clock, restLabel: restLabel,
    dateLong: dateLong, dateShort: dateShort, dateDay: dateDay, timeOfDay: timeOfDay, rel: rel, num: num, thousands: thousands,
    toU: toU, fromU: fromU, wt: wt, e1rm: e1rm, incFor: incFor, stepFor: stepFor, repRange: repRange, doneSets: doneSets, volume: volume, topSet: topSet, estimate: estimate, videoUrl: videoUrl,
    ACTIVITIES: ACTIVITIES, actType: actType, activeDays: activeDays, dayStreak: dayStreak, programWeek: programWeek, programStart: programStart,
    seed: seed, Store: Store, load: load, exMap: exMap, sessionsFor: sessionsFor, lastFor: lastFor, bestFor: bestFor, suggest: suggest,
    makeActiveEx: makeActiveEx, newActive: newActive, activeSetIndex: activeSetIndex, toRecord: toRecord };
})();

/* 6 ── componente */
class Component extends DCLogic {
  constructor(props) {
    super(props);
    var now = Date.now();
    var db = TOS.load(now);
    this._db = db;
    var resume = db.active && (now - db.active.startTime) < 4 * 3600000;
    this.state = { db: db, now: now, tab: 'today', view: resume ? 'workout' : 'main', progTab: 'lifts', openLift: null, openHist: null,
      todayPick: null, sheet: null, editor: null, picker: null, openExercise: null, confirm: null, toast: null, summary: null, showHow: false, act: null };
    this._lastSec = 0;
  }

  componentDidMount() {
    var self = this;
    this._iv = setInterval(function () { self.tick(); }, 200);
    this._onStorage = function (e) {
      if (e.key !== 'training-os/v1' || !e.newValue) return;
      try { var db = JSON.parse(e.newValue); if (db.version !== TOS.SCHEMA_VERSION) return; self._db = db; self.setState({ db: db }); } catch (err) {}
    };
    try { window.addEventListener('storage', this._onStorage); } catch (e) {}
    try {
      this._mq = window.matchMedia('(prefers-color-scheme: dark)');
      this._onMq = function () { self.forceUpdate(); };
      if (this._mq.addEventListener) this._mq.addEventListener('change', this._onMq);
    } catch (e) {}
  }
  componentWillUnmount() {
    clearInterval(this._iv);
    try { window.removeEventListener('storage', this._onStorage); } catch (e) {}
    try { if (this._mq && this._mq.removeEventListener) this._mq.removeEventListener('change', this._onMq); } catch (e) {}
    clearTimeout(this._toastT);
  }

  /* ── estado ── */
  commit(fn, extra) {
    var db = TOS.clone(this._db);
    fn(db);
    this._db = db;
    TOS.Store.write(db);
    this.setState(Object.assign({ db: db, now: Date.now() }, extra || {}));
  }
  toast(msg) {
    var self = this;
    clearTimeout(this._toastT);
    this.setState({ toast: msg });
    this._toastT = setTimeout(function () { self.setState({ toast: null }); }, 1900);
  }
  ask(title, body, yes, action, danger) { this.setState({ confirm: { title: title, body: body, yes: yes, action: action, danger: danger !== false } }); }
  scrollTop() { var self = this; setTimeout(function () { try { if (self._scrollEl) self._scrollEl.scrollTop = 0; if (self._wScrollEl) self._wScrollEl.scrollTop = 0; } catch (e) {} }, 0); }
  prefersDark() { try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } }

  /* ── temporizador y avisos ── */
  tick() {
    var a = this._db.active;
    if (!a || this.state.view !== 'workout') return;
    var now = Date.now();
    if (a.rest && !a.rest.done && now >= a.rest.endAt) {
      this.commit(function (db) { db.active.rest.done = true; db.active.rest.doneAt = now; });
      this.restAlert();
      return;
    }
    if (a.rest && a.rest.done && now - (a.rest.doneAt || now) > 15000) {
      this.commit(function (db) { db.active.rest = null; });
      return;
    }
    var sec = Math.floor(now / 1000);
    if (sec !== this._lastSec) { this._lastSec = sec; this.setState({ now: now }); }
  }
  unlockAudio() {
    try { if (!this._ac) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) this._ac = new AC(); } if (this._ac && this._ac.state === 'suspended') this._ac.resume(); } catch (e) {}
  }
  buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  restAlert() {
    if (!this._db.profile.sound) return;
    this.buzz([220, 90, 220]);
    try {
      var ac = this._ac; if (!ac) return;
      [0, 0.22].forEach(function (off) {
        var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + off;
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.2);
      });
    } catch (e) {}
  }

  setTab(t) { this.setState({ tab: t, view: 'main', sheet: null }); this.scrollTop(); }

  /* ── ciclo del entreno ── */
  startWorkout(rid) {
    var self = this, r = this._db.routines.find(function (x) { return x.id === rid; });
    if (!r) return;
    var go = function () {
      self.unlockAudio();
      self.commit(function (db) { db.active = TOS.newActive(db, r, Date.now()); }, { view: 'workout', sheet: null, showHow: false, confirm: null });
      self.scrollTop();
    };
    var a = this._db.active;
    if (a && a.routineId === rid) { this.setState({ view: 'workout' }); return; }
    if (a) { this.ask('¿Reemplazar el entreno en curso?', a.routineName + ' sigue abierto. Si empiezas ' + r.name + ' se descarta.', 'Descartar y empezar', go); return; }
    go();
  }
  resume() { this.unlockAudio(); this.setState({ view: 'workout', sheet: null }); this.scrollTop(); }
  leave() { this.setState({ view: 'main', tab: 'today', sheet: null }); }
  finish() {
    var self = this, a = this._db.active;
    if (!a) return;
    var sets = 0;
    a.exercises.forEach(function (e) { sets += TOS.doneSets(e.sets).length; });
    if (!sets) { this.ask('Aún no hay nada registrado', 'No completaste ninguna serie, así que no hay nada que guardar. ¿Descartar este entreno?', 'Descartar', function () { self.discardNow(); }); return; }
    var now = Date.now(), db0 = this._db, u = db0.profile.units;
    var prs = [], vol = 0, exCount = 0;
    a.exercises.forEach(function (e) {
      var done = TOS.doneSets(e.sets);
      if (!done.length) return;
      exCount++; vol += TOS.volume(e.sets);
      var prev = TOS.bestFor(db0, e.exerciseId), top = TOS.topSet(done);
      if (prev && (top.weight > prev.weight || (top.weight === prev.weight && top.reps > prev.reps))) prs.push({ name: e.name, txt: TOS.wt(top.weight, u) + ' ' + u + ' × ' + top.reps });
    });
    var rec = TOS.toRecord(a, now);
    this.commit(function (db) { db.workouts.push(rec); db.active = null; }, {
      view: 'complete', sheet: null,
      summary: { id: rec.id, name: rec.routineName, date: TOS.dateLong(now), duration: rec.duration, exercises: exCount, sets: sets, volume: TOS.thousands(TOS.toU(vol, u)) + ' ' + u, prs: prs, notes: rec.notes }
    });
    this.buzz(60);
  }
  discardNow() { this.commit(function (db) { db.active = null; }, { view: 'main', tab: 'today', sheet: null, confirm: null }); this.toast('Entreno descartado'); }
  discard() { var self = this; this.ask('¿Descartar este entreno?', 'Se perderá todo lo registrado en esta sesión.', 'Descartar', function () { self.discardNow(); }); }
  doneSummary() { this.setState({ view: 'main', tab: 'today', summary: null }); this.scrollTop(); }
  summaryNote(v) {
    var id = this.state.summary && this.state.summary.id;
    var sum = Object.assign({}, this.state.summary, { notes: v });
    this.commit(function (db) { var w = db.workouts.find(function (x) { return x.id === id; }); if (w) w.notes = v; }, { summary: sum });
  }

  /* ── series ── */
  mutEx(ei, fn, extra) { this.commit(function (db) { var a = db.active; if (a && a.exercises[ei]) fn(a.exercises[ei], a, db); }, extra); }
  completeSet(ei, si) {
    this.unlockAudio();
    var now = Date.now();
    this.mutEx(ei, function (e, a, db) {
      var s = e.sets[si]; if (!s) return;
      s.completed = true; s.timestamp = now; delete s.wText; delete s.rText;
      e.focus = null; e.skipped = false;
      e.sets.forEach(function (x, j) { if (j > si && !x.completed && !x.touched) x.weight = s.weight; });
      var more = a.exercises.some(function (x) { return !x.skipped && x.sets.some(function (y) { return !y.completed; }); });
      if (more) { var sec = e.restSeconds || db.profile.defaultRest; a.rest = { endAt: now + sec * 1000, total: sec, ei: ei, done: false }; }
      else a.rest = null;
    });
    this.buzz(30);
  }
  undoSet(ei, si) {
    this.mutEx(ei, function (e, a) {
      var s = e.sets[si]; if (!s) return;
      s.completed = false; s.timestamp = null; e.focus = si;
      if (a.rest && a.rest.ei === ei) a.rest = null;
    });
  }
  focusSet(ei, si) { this.mutEx(ei, function (e) { e.focus = si; }); }
  step(ei, si, field, dir) {
    var u = this._db.profile.units, ex = TOS.exMap(this._db)[this._db.active.exercises[ei].exerciseId];
    this.mutEx(ei, function (e) {
      var s = e.sets[si]; if (!s) return;
      if (field === 'w') { var d = Math.max(0, TOS.toU(s.weight, u) + dir * TOS.stepFor(ex, u)); s.weight = TOS.fromU(d, u); delete s.wText; }
      else { s.reps = Math.max(0, s.reps + dir); delete s.rText; }
      s.touched = true;
    });
  }
  typeW(ei, si, v) {
    var u = this._db.profile.units;
    this.mutEx(ei, function (e) { var s = e.sets[si]; if (!s) return; s.wText = v; s.touched = true; var n = parseFloat(String(v).replace(',', '.')); if (!isNaN(n) && n >= 0) s.weight = TOS.fromU(n, u); });
  }
  typeR(ei, si, v) {
    this.mutEx(ei, function (e) { var s = e.sets[si]; if (!s) return; s.rText = v; s.touched = true; var n = parseInt(v, 10); if (!isNaN(n) && n >= 0) s.reps = n; });
  }
  addSet(ei) {
    this.mutEx(ei, function (e) {
      var last = e.sets[e.sets.length - 1];
      e.sets.push({ setNumber: e.sets.length + 1, weight: last ? last.weight : e.targetWeight, reps: last ? last.reps : e.targetRepMax, completed: false, timestamp: null });
      e.skipped = false;
    });
  }
  removeSet(ei) {
    var e0 = this._db.active.exercises[ei];
    if (!e0 || e0.sets.length <= 1) { this.toast('Deja al menos una serie'); return; }
    this.mutEx(ei, function (e) {
      var idx = -1;
      for (var i = e.sets.length - 1; i >= 0; i--) if (!e.sets[i].completed) { idx = i; break; }
      if (idx < 0) idx = e.sets.length - 1;
      e.sets.splice(idx, 1);
      e.sets.forEach(function (s, j) { s.setNumber = j + 1; });
      if (e.focus != null && e.focus >= e.sets.length) e.focus = null;
    });
  }
  gotoEx(i) { this.commit(function (db) { if (db.active && db.active.exercises[i]) db.active.current = i; }, { showHow: false }); this.scrollTop(); }
  nextEx() {
    var a = this._db.active; if (!a) return;
    var n = a.current + 1;
    for (var i = a.current + 1; i < a.exercises.length; i++) { if (a.exercises[i].sets.some(function (s) { return !s.completed; })) { n = i; break; } }
    if (n >= a.exercises.length) n = a.exercises.length - 1;
    this.gotoEx(n);
  }
  skipEx() {
    var a = this._db.active; if (!a) return;
    var ei = a.current;
    this.commit(function (db) {
      var A = db.active; A.exercises[ei].skipped = true;
      if (A.rest && A.rest.ei === ei) A.rest = null;
      for (var i = ei + 1; i < A.exercises.length; i++) { if (!A.exercises[i].skipped && A.exercises[i].sets.some(function (s) { return !s.completed; })) { A.current = i; return; } }
    }, { sheet: null, showHow: false });
    this.toast('Ejercicio saltado');
    this.scrollTop();
  }
  unskip() { var ei = this._db.active.current; this.mutEx(ei, function (e) { e.skipped = false; }); }
  restPlus() {
    this.commit(function (db) {
      var r = db.active && db.active.rest; if (!r) return;
      if (r.done) { r.done = false; r.endAt = Date.now() + 30000; r.total = 30; } else { r.endAt += 30000; r.total += 30; }
    });
  }
  restSkip() { this.commit(function (db) { if (db.active) db.active.rest = null; }); }
  exNote(v) { var ei = this._db.active.current; this.mutEx(ei, function (e) { e.notes = v; }); }
  workoutNote(v) { this.commit(function (db) { if (db.active) db.active.notes = v; }); }

  /* ── selector de ejercicios ── */
  openPicker(purpose) { this.setState({ picker: { purpose: purpose, query: '' }, sheet: 'picker' }); }
  pickExercise(exId) {
    var p = this.state.picker; if (!p) return;
    var db0 = this._db;
    if (p.purpose === 'editor') {
      var last = TOS.lastFor(db0, exId);
      this.editorUpdate(function (ed) {
        ed.exercises.push({ exerciseId: exId, order: ed.exercises.length, targetSets: 4, targetRepMin: 12, targetRepMax: 12,
          targetWeight: last ? last.top.weight : 0, restSeconds: db0.profile.defaultRest, notes: '' });
        ed.open = ed.exercises.length - 1;
      });
      this.setState({ picker: null, sheet: null });
      return;
    }
    var a = db0.active; if (!a) return;
    var cur = a.current, week = a.week || 0;
    this.commit(function (db) {
      var A = db.active;
      if (p.purpose === 'swap') {
        var old = A.exercises[cur];
        var re = { exerciseId: exId, targetSets: old.sets.length, targetRepMin: old.targetRepMin, targetRepMax: old.targetRepMax, targetWeight: 0, restSeconds: old.restSeconds, notes: '' };
        A.exercises[cur] = TOS.makeActiveEx(db, re, old.order, 0);
        if (A.rest && A.rest.ei === cur) A.rest = null;
      } else {
        var re2 = { exerciseId: exId, targetSets: 3, targetRepMin: 12, targetRepMax: 12, targetWeight: 0, restSeconds: db.profile.defaultRest, notes: '' };
        A.exercises.push(TOS.makeActiveEx(db, re2, A.exercises.length, week));
        A.current = A.exercises.length - 1;
      }
    }, { picker: null, sheet: null, showHow: false });
    this.toast(p.purpose === 'swap' ? 'Ejercicio reemplazado' : 'Ejercicio agregado');
    this.scrollTop();
  }
  createExercise(name) {
    var id = TOS.uid('x');
    this.commit(function (db) { db.exercises.push({ id: id, name: name, muscleGroup: 'Otro', equipment: 'Otro', hevyName: '', compound: false, instructions: '', notes: '', videoUrl: '' }); });
    this.pickExercise(id);
  }

  /* ── editor de rutinas ── */
  openEditor(rid) {
    var r = rid ? this._db.routines.find(function (x) { return x.id === rid; }) : null;
    var ed = r ? TOS.clone(r) : { id: TOS.uid('r'), name: '', description: '', scheduledDay: null, color: TOS.PALETTE[this._db.routines.length % TOS.PALETTE.length], exercises: [], estimatedDuration: 0 };
    ed.isNew = !r; ed.open = null;
    this.setState({ editor: ed, sheet: null });
  }
  editorUpdate(fn) { var ed = TOS.clone(this.state.editor); fn(ed); this.setState({ editor: ed }); }
  saveEditor() {
    var ed = TOS.clone(this.state.editor);
    if (!ed.name.trim()) { this.toast('Ponle nombre a la rutina'); return; }
    ed.name = ed.name.trim();
    ed.exercises.forEach(function (e, i) { e.order = i; });
    ed.estimatedDuration = TOS.estimate(ed);
    var isNew = ed.isNew; delete ed.isNew; delete ed.open;
    this.commit(function (db) {
      var i = db.routines.findIndex(function (x) { return x.id === ed.id; });
      if (i >= 0) db.routines[i] = ed; else db.routines.push(ed);
    }, { editor: null });
    this.toast(isNew ? 'Rutina creada' : 'Rutina guardada');
  }
  duplicateRoutine(rid) {
    this.commit(function (db) {
      var i = db.routines.findIndex(function (x) { return x.id === rid; }); if (i < 0) return;
      var c = TOS.clone(db.routines[i]); c.id = TOS.uid('r'); c.name = c.name + ' (copia)'; c.scheduledDay = null;
      c.color = TOS.PALETTE[(i + 1) % TOS.PALETTE.length];
      db.routines.splice(i + 1, 0, c);
    });
    this.toast('Rutina duplicada');
  }
  deleteRoutine(rid) {
    var self = this, r = this._db.routines.find(function (x) { return x.id === rid; }); if (!r) return;
    this.ask('¿Borrar ' + r.name + '?', 'Se elimina la rutina. Tu historial se conserva.', 'Borrar', function () {
      self.commit(function (db) { db.routines = db.routines.filter(function (x) { return x.id !== rid; }); }, { confirm: null, todayPick: self.state.todayPick === rid ? null : self.state.todayPick });
      self.toast('Rutina borrada');
    });
  }

  /* ── biblioteca de ejercicios ── */
  newLibraryExercise() {
    var id = TOS.uid('x');
    this.commit(function (db) { db.exercises.unshift({ id: id, name: 'Nuevo ejercicio', muscleGroup: 'Otro', equipment: 'Otro', hevyName: '', compound: false, instructions: '', notes: '', videoUrl: '' }); }, { openExercise: id });
  }
  updExercise(id, field, v) { this.commit(function (db) { var e = db.exercises.find(function (x) { return x.id === id; }); if (e) e[field] = v; }); }
  deleteExercise(id) {
    var self = this, e = this._db.exercises.find(function (x) { return x.id === id; }); if (!e) return;
    var used = this._db.routines.filter(function (r) { return r.exercises.some(function (x) { return x.exerciseId === id; }); }).length;
    this.ask('¿Borrar ' + e.name + '?', used ? 'Se quita de ' + used + (used > 1 ? ' rutinas' : ' rutina') + '. El historial se conserva.' : 'El historial se conserva.', 'Borrar', function () {
      self.commit(function (db) {
        db.exercises = db.exercises.filter(function (x) { return x.id !== id; });
        db.routines.forEach(function (r) { r.exercises = r.exercises.filter(function (x) { return x.exerciseId !== id; }); r.exercises.forEach(function (x, i) { x.order = i; }); r.estimatedDuration = TOS.estimate(r); });
      }, { confirm: null, openExercise: null });
    });
  }

  /* ── ajustes ── */
  setProfile(k, v) { this.commit(function (db) { db.profile[k] = v; }); }
  shiftProgram(weeks) {
    this.commit(function (db) { if (db.program) db.program.start = TOS.addDays(db.program.start, 7 * weeks); });
  }
  resetProgram() {
    var self = this;
    this.ask('¿Restablecer el programa?', 'Rutinas y ejercicios vuelven al body recomp de 4 semanas. Tu historial se conserva.', 'Restablecer', function () {
      var old = self._db, db = TOS.seed(Date.now());
      db.profile = old.profile; db.workouts = old.workouts; db.activities = old.activities || [];
      self._db = db; TOS.Store.write(db);
      self.setState({ db: db, confirm: null, view: 'main', tab: 'today', todayPick: null, summary: null, editor: null, sheet: null });
      self.toast('Programa restablecido');
    });
  }
  clearHistory() {
    var self = this;
    this.ask('¿Borrar el historial?', 'Se borran todos los entrenos y actividades. Rutinas y ejercicios se quedan.', 'Borrar historial', function () {
      self.commit(function (db) { db.workouts = []; db.activities = []; db.active = null; }, { confirm: null, view: 'main' });
      self.toast('Historial borrado');
    });
  }
  deleteWorkout(id) {
    var self = this;
    this.ask('¿Borrar este entreno?', 'Se quita del historial y del progreso.', 'Borrar', function () {
      self.commit(function (db) { db.workouts = db.workouts.filter(function (w) { return w.id !== id; }); }, { confirm: null, openHist: null });
    });
  }

  /* ── otras actividades ── */
  openActivity(type) { this.setState({ sheet: 'activity', act: { type: type || null, duration: 45, day: 0, notes: '' } }); }
  actUpdate(patch) { this.setState({ act: Object.assign({}, this.state.act, patch) }); }
  saveActivity() {
    var A = this.state.act; if (!A) return;
    if (!A.type) { this.toast('Elige una actividad'); return; }
    var now = Date.now(), t = A.day ? TOS.addDays(TOS.dayStart(now), -A.day) + 12 * 3600000 : now - A.duration * 60000;
    var rec = { id: TOS.uid('a'), type: A.type, date: TOS.dayStart(t), startTime: t, duration: A.duration, notes: A.notes || '' };
    this.commit(function (db) { db.activities = db.activities || []; db.activities.push(rec); db.activities.sort(function (x, y) { return x.startTime - y.startTime; }); }, { sheet: null, act: null });
    this.buzz(40);
    this.toast(TOS.actType(A.type).name + ' registrada');
  }
  deleteActivity(id) {
    var self = this;
    this.ask('¿Borrar esta actividad?', 'Se quita del historial y de tu meta diaria.', 'Borrar', function () {
      self.commit(function (db) { db.activities = (db.activities || []).filter(function (a) { return a.id !== id; }); }, { confirm: null, openHist: null });
    });
  }

  /* ── vista ── */
  renderVals() {
    var self = this, st = this.state, db = st.db, P = db.profile, u = P.units, now = st.now;
    var X = TOS.exMap(db);
    var dark = P.theme === 'dark' || (P.theme === 'auto' && this.prefersDark());
    var a = db.active;
    var vm = {
      accent: this.props.accent ?? '#D4F36B', themeCls: dark ? 'dark' : 'light', unit: u,
      setScroll: function (el) { self._scrollEl = el; }, setWScroll: function (el) { self._wScrollEl = el; },
      showMain: st.view === 'main', inWorkout: st.view === 'workout' && !!a, inComplete: st.view === 'complete' && !!st.summary
    };
    var tabs = ['today', 'workouts', 'progress', 'settings'];
    vm.tabCls = {}; vm.go = {};
    tabs.forEach(function (t) { vm.tabCls[t] = st.tab === t ? 'on' : ''; vm.go[t] = function () { self.setTab(t); }; });
    vm.isToday = st.tab === 'today'; vm.isWorkouts = st.tab === 'workouts'; vm.isProgress = st.tab === 'progress'; vm.isSettings = st.tab === 'settings';
    vm.miniResume = !!a && st.view !== 'workout';
    vm.miniResumeTxt = a ? a.routineName + ' · ' + TOS.clock((now - a.startTime) / 1000) : '';

    /* programa */
    var PG = db.program || { weeks: 4, tips: [], start: now, name: '' };
    var pw = TOS.programWeek(db, now), plan = PG.weekPlan || TOS.WEEK_PLAN;
    vm.prog = { name: PG.name, notStarted: pw === 0, running: pw >= 1 && pw <= PG.weeks, finished: pw > PG.weeks,
      week: pw >= 1 && pw <= PG.weeks ? 'Semana ' + pw + ' de ' + PG.weeks : pw === 0 ? 'Empieza el ' + TOS.dateDay(PG.start).toLowerCase() : 'Programa completado',
      tip: pw >= 1 && pw <= PG.weeks ? PG.tips[pw - 1] : pw === 0 ? 'Mientras tanto puedes ir probando los ejercicios. Semana 1: ' + (PG.tips[0] || '').toLowerCase() : 'Terminaste las ' + PG.weeks + ' semanas. Reinicia el programa en Ajustes o ajusta tus rutinas.',
      segs: [], start: 'Inicio: ' + TOS.dateDay(PG.start).toLowerCase(),
      weekNum: pw === 0 ? '—' : (pw > PG.weeks ? 'Fin' : String(pw)) };
    for (var si0 = 1; si0 <= PG.weeks; si0++) vm.prog.segs.push({ cls: si0 < pw ? 'seg-bar done' : si0 === pw ? 'seg-bar now' : 'seg-bar', n: 'S' + si0 });

    /* hoy */
    var dow = new Date(now).getDay();
    var scheduled = db.routines.find(function (r) { return r.scheduledDay === dow; }) || null;
    var pick = (st.todayPick && db.routines.find(function (r) { return r.id === st.todayPick; })) || scheduled;
    var todayPlan = plan[dow] || ['', ''];
    vm.greeting = P.name ? 'Hola, ' + P.name : 'Hoy';
    vm.todayDate = TOS.dateLong(now);
    vm.hasActive = !!a;
    vm.activeName = a ? a.routineName : '';
    if (a) {
      var dn = a.exercises.reduce(function (t, e) { return t + TOS.doneSets(e.sets).length; }, 0);
      vm.activeInfo = 'Ejercicio ' + (a.current + 1) + ' de ' + a.exercises.length + ' · ' + dn + ' series · ' + Math.max(1, Math.round((now - a.startTime) / 60000)) + ' min';
    }
    vm.resume = function () { self.resume(); };
    vm.showPlan = !a && !!pick; vm.showRestDay = !a && !pick;
    vm.restTitle = todayPlan[0] && !scheduled ? todayPlan[0] : 'Sin gym hoy';
    vm.restDayTxt = todayPlan[1] ? 'Hoy toca ' + todayPlan[1].toLowerCase() + '. Regístrala abajo cuando termines.' : 'Día de descanso total. Recupera — o elige una rutina abajo.';
    vm.plan = { name: '', meta: '', color: '#D4F36B', tag: '', items: [], start: function () {}, pm: '', hasPm: false };
    if (pick) {
      var isSched = scheduled && pick.id === scheduled.id;
      vm.plan = { name: pick.name, color: pick.color, tag: isSched ? TOS.DAY[dow] + ' · mañana' : 'Elegida para hoy',
        meta: pick.exercises.length + ' ejercicios · ~' + (pick.estimatedDuration || TOS.estimate(pick)) + ' min',
        desc: pick.description || '',
        pm: todayPlan[1] ? 'Tarde: ' + todayPlan[1].toLowerCase() : '', hasPm: !!todayPlan[1],
        items: pick.exercises.slice().sort(function (x, y) { return x.order - y.order; }).map(function (re, i) {
          var ex = X[re.exerciseId] || {};
          var sets = re.targetSets + (ex.compound && pw === 3 ? 1 : 0), reps = ex.compound && pw === 4 ? 10 : re.targetRepMax;
          return { n: TOS.pad2(i + 1), name: ex.name || 'Ejercicio', spec: sets + ' × ' + TOS.repRange(Math.min(re.targetRepMin, reps), reps) };
        }),
        start: function () { self.startWorkout(pick.id); } };
    }
    vm.showSwitch = !a && db.routines.length > 0;
    vm.switchLabel = pick ? 'Cambiar el entreno de hoy' : 'Entrenar de todos modos';
    vm.todayChips = db.routines.map(function (r) {
      return { name: r.name, color: r.color, cls: pick && pick.id === r.id ? 'on' : '', pick: function () { self.setState({ todayPick: r.id }); } };
    });
    var ws = TOS.weekStart(now);
    var days = TOS.activeDays(db), today0 = TOS.dayStart(now);
    vm.week = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var t = TOS.addDays(ws, i), d = new Date(t), dd = d.getDay();
      var sr = db.routines.find(function (r) { return r.scheduledDay === dd; });
      var did = days[t], done = !!did, isT = t === today0;
      return { letter: TOS.DAY1[dd], num: d.getDate(), cls: (done ? 'done ' : '') + (isT ? 'today ' : '') + (!done && sr && t > now ? 'planned' : ''),
        dot: did ? did[0].color : (sr && t >= today0 ? sr.color : 'transparent'),
        title: did ? did.map(function (x) { return x.name; }).join(', ') : (plan[dd] ? plan[dd].filter(Boolean).join(' + ') : '') };
    });
    var weekDays = 0;
    for (var wd = 0; wd < 7; wd++) if (days[TOS.addDays(ws, wd)]) weekDays++;
    vm.weekCount = weekDays;
    vm.weekRange = TOS.dateShort(ws) + ' – ' + TOS.dateShort(TOS.addDays(ws, 6));

    /* meta diaria: 1 actividad física al día (el gym cuenta) */
    var todayDid = days[today0] || [];
    var streakDays = TOS.dayStreak(days, now);
    var didSwim = todayDid.some(function (x) { return x.name === 'Natación'; });
    vm.goal = {
      done: todayDid.length > 0, notDone: todayDid.length === 0,
      title: todayDid.length ? 'Listo por hoy' : 'Muévete hoy',
      sub: todayDid.length ? todayDid.map(function (x) { return x.name; }).join(' + ') + (todayPlan[1] === 'Natación' && !didSwim ? ' · falta: ' + todayPlan[1].toLowerCase() : '')
        : 'Meta: 1 actividad física al día' + (todayPlan[1] ? ' · plan: ' + todayPlan[1].toLowerCase() : ''),
      streak: String(streakDays), streakLabel: streakDays === 1 ? 'día seguido' : 'días seguidos',
      cls: todayDid.length ? 'goal done' : 'goal',
      types: TOS.ACTIVITIES.map(function (t) { return { name: t.name, color: t.color, pick: function () { self.openActivity(t.id); } }; }),
      open: function () { self.openActivity(null); }
    };

    var lw = db.workouts[db.workouts.length - 1];
    var la = (db.activities || [])[(db.activities || []).length - 1];
    vm.hasLast = !!(lw || la);
    vm.lastW = { title: '', meta: '', color: '#D4F36B', open: function () {} };
    if (la && (!lw || la.startTime > lw.startTime)) {
      var lt = TOS.actType(la.type);
      vm.lastW = { title: lt.name + ' · ' + TOS.rel(la.startTime, now), color: lt.color, meta: la.duration + ' min' + (la.notes ? ' · ' + la.notes : ''),
        open: function () { self.setState({ tab: 'progress', progTab: 'history', openHist: la.id }); self.scrollTop(); } };
    } else if (lw) {
      var lsets = lw.exercises.reduce(function (t, e) { return t + TOS.doneSets(e.sets).length; }, 0);
      var lvol = lw.exercises.reduce(function (t, e) { return t + TOS.volume(e.sets); }, 0);
      vm.lastW = { title: lw.routineName + ' · ' + TOS.rel(lw.startTime, now), color: lw.color || '#D4F36B',
        meta: lw.duration + ' min · ' + lsets + ' series · ' + TOS.thousands(TOS.toU(lvol, u)) + ' ' + u,
        open: function () { self.setState({ tab: 'progress', progTab: 'history', openHist: lw.id }); self.scrollTop(); } };
    }

    /* rutinas */
    vm.routines = db.routines.map(function (r) {
      return { name: r.name, color: r.color, desc: r.description || '', hasDesc: !!r.description,
        meta: (r.scheduledDay == null ? 'Cualquier día' : TOS.DAY[r.scheduledDay]) + ' · ' + r.exercises.length + ' ejercicios · ~' + (r.estimatedDuration || TOS.estimate(r)) + ' min',
        items: r.exercises.slice().sort(function (x, y) { return x.order - y.order; }).map(function (re) {
          return { name: (X[re.exerciseId] || {}).name || 'Ejercicio', spec: re.targetSets + ' × ' + TOS.repRange(re.targetRepMin, re.targetRepMax) };
        }),
        start: function () { self.startWorkout(r.id); }, edit: function () { self.openEditor(r.id); },
        dup: function () { self.duplicateRoutine(r.id); }, del: function () { self.deleteRoutine(r.id); } };
    });
    vm.noRoutines = db.routines.length === 0;
    vm.newRoutine = function () { self.openEditor(null); };
    vm.weekPlan = [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      var p = plan[d] || ['', ''], r = db.routines.find(function (x) { return x.scheduledDay === d; });
      return { day: TOS.DAY3[d], am: r ? r.name : p[0], pm: p[1] || '—', color: r ? r.color : 'transparent', cls: d === dow ? 'plan-row today' : 'plan-row' };
    });
    vm.progTips = (PG.tips || []).map(function (t, i) { return { n: 'Semana ' + (i + 1), tip: t, cls: i + 1 === pw ? 'tip-row now' : 'tip-row' }; });

    /* progreso */
    var monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    var weekCounts = [];
    for (var k = 7; k >= 0; k--) {
      var s0 = TOS.addDays(ws, -7 * k), c = 0;
      for (var dd2 = 0; dd2 < 7; dd2++) if (days[TOS.addDays(s0, dd2)]) c++;
      weekCounts.push({ start: s0, count: c });
    }
    var monthDays = 0, monthSoFar = new Date(now).getDate();
    for (var md = 0; md < monthSoFar; md++) if (days[TOS.addDays(monthStart.getTime(), md)]) monthDays++;
    vm.stats = [
      { label: 'Racha', value: String(streakDays), sub: streakDays === 1 ? 'día con actividad' : 'días con actividad', cls: 'stat-accent' },
      { label: 'Esta semana', value: weekDays + '/7', sub: 'días activos', cls: '' },
      { label: 'Este mes', value: monthDays + '/' + monthSoFar, sub: 'días activos · ' + TOS.MON3[new Date(now).getMonth()], cls: '' },
      { label: 'Sesiones gym', value: String(db.workouts.length), sub: (db.activities || []).length + ' otras actividades', cls: '' }
    ];
    vm.weeks8 = weekCounts.map(function (w, i) {
      return { count: w.count ? String(w.count) : '', label: i === 7 ? 'Ahora' : TOS.dateShort(w.start).replace(' ', ' '),
        bar: 'height:' + (w.count ? 8 + w.count * 10 : 6) + 'px', cls: w.count ? (w.count >= 7 ? 'wk-bar now' : 'wk-bar') : 'wk-bar empty' };
    });
    vm.progLifts = st.progTab === 'lifts'; vm.progHistory = st.progTab === 'history';
    vm.progLiftsCls = vm.progLifts ? 'on' : ''; vm.progHistCls = vm.progHistory ? 'on' : '';
    vm.showLifts = function () { self.setState({ progTab: 'lifts' }); };
    vm.showHistory = function () { self.setState({ progTab: 'history' }); };
    var fmtSet = function (s) { return TOS.wt(s.weight, u) + ' × ' + s.reps; };
    var liftIds = [];
    for (var wi = db.workouts.length - 1; wi >= 0; wi--) db.workouts[wi].exercises.forEach(function (e) { if (liftIds.indexOf(e.exerciseId) < 0 && TOS.doneSets(e.sets).length) liftIds.push(e.exerciseId); });
    vm.lifts = liftIds.map(function (id) {
      var ss = TOS.sessionsFor(db, id), cur = ss[ss.length - 1], prev = ss[ss.length - 2];
      var trend = 'new', ttxt = 'Primer registro';
      if (prev) {
        var d = TOS.e1rm(cur.top.weight, cur.top.reps) / TOS.e1rm(prev.top.weight, prev.top.reps) - 1;
        if (d > 0.01) { trend = 'up'; ttxt = '↑ Mejorando'; } else if (d < -0.01) { trend = 'down'; ttxt = '↓ Bajó'; } else { trend = 'flat'; ttxt = '→ Estable'; }
      }
      var pts = ss.slice(-8), mn = Infinity, mx = -Infinity;
      pts.forEach(function (p) { mn = Math.min(mn, p.top.weight); mx = Math.max(mx, p.top.weight); });
      var coords = pts.map(function (p, i) {
        var x = pts.length > 1 ? 8 + i / (pts.length - 1) * 284 : 150;
        var y = mx > mn ? 58 - (p.top.weight - mn) / (mx - mn) * 48 : 34;
        return [Math.round(x), Math.round(y)];
      });
      var best = TOS.bestFor(db, id), ex = X[id];
      return { id: id, name: (ex && ex.name) || cur.name, muscle: ex ? ex.muscleGroup + ' · ' + ex.equipment : 'Ya no está en la biblioteca',
        prev: prev ? TOS.wt(prev.top.weight, u) + ' ' + u + ' × ' + prev.top.reps : '—',
        cur: TOS.wt(cur.top.weight, u) + ' ' + u + ' × ' + cur.top.reps,
        trendCls: 'trend ' + trend, trendTxt: ttxt, open: st.openLift === id,
        toggle: function () { self.setState({ openLift: st.openLift === id ? null : id }); },
        spark: coords.map(function (c) { return c.join(','); }).join(' '),
        lastX: coords[coords.length - 1][0], lastY: coords[coords.length - 1][1],
        best: best ? TOS.wt(best.weight, u) + ' ' + u + ' × ' + best.reps : '—',
        sessions: ss.length + (ss.length === 1 ? ' sesión' : ' sesiones'),
        recent: ss.slice(-5).reverse().map(function (s) { return { date: TOS.dateShort(s.date), sets: s.sets.map(fmtSet).join(' · ') }; }) };
    });
    vm.noLifts = vm.lifts.length === 0;
    var hist = db.workouts.map(function (w) {
      var sets = w.exercises.reduce(function (t, e) { return t + TOS.doneSets(e.sets).length; }, 0);
      var vol = w.exercises.reduce(function (t, e) { return t + TOS.volume(e.sets); }, 0);
      return { t: w.startTime, name: w.routineName, color: w.color || '#D4F36B', date: TOS.dateDay(w.startTime), rel: TOS.rel(w.startTime, now),
        meta: w.duration + ' min · ' + sets + ' series · ' + TOS.thousands(TOS.toU(vol, u)) + ' ' + u,
        open: st.openHist === w.id, toggle: function () { self.setState({ openHist: st.openHist === w.id ? null : w.id }); },
        exercises: w.exercises.map(function (e) { return { name: e.name, sets: TOS.doneSets(e.sets).map(fmtSet).join(' · ') || 'Sin series' }; }),
        notes: w.notes || '', hasNotes: !!w.notes, delLabel: 'Borrar entreno', del: function () { self.deleteWorkout(w.id); } };
    });
    (db.activities || []).forEach(function (ac) {
      var ty = TOS.actType(ac.type);
      hist.push({ t: ac.startTime, name: ty.name, color: ty.color, date: TOS.dateDay(ac.startTime), rel: TOS.rel(ac.startTime, now),
        meta: ac.duration + ' min', open: st.openHist === ac.id, toggle: function () { self.setState({ openHist: st.openHist === ac.id ? null : ac.id }); },
        exercises: [], notes: ac.notes || '', hasNotes: !!ac.notes, delLabel: 'Borrar actividad', del: function () { self.deleteActivity(ac.id); } });
    });
    vm.history = hist.sort(function (x, y) { return y.t - x.t; });
    vm.noHistory = vm.history.length === 0;

    /* ajustes */
    vm.profileName = P.name || '';
    vm.onName = function (e) { self.setProfile('name', e.target.value); };
    vm.units = ['kg', 'lb'].map(function (x) { return { label: x, cls: u === x ? 'on' : '', pick: function () { self.setProfile('units', x); } }; });
    vm.rests = [60, 75, 90, 120].map(function (x) { return { label: TOS.restLabel(x), cls: P.defaultRest === x ? 'on' : '', pick: function () { self.setProfile('defaultRest', x); } }; });
    vm.themes = [['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']].map(function (x) { return { label: x[1], cls: P.theme === x[0] ? 'on' : '', pick: function () { self.setProfile('theme', x[0]); } }; });
    vm.soundCls = P.sound ? 'toggle on' : 'toggle';
    vm.soundOn = !!P.sound;
    vm.toggleSound = function () { self.setProfile('sound', !P.sound); };
    vm.storageTxt = TOS.Store.mode === 'device' ? 'Guardado en este dispositivo — se conserva al cerrar la app.' : 'El almacenamiento está bloqueado aquí: los datos duran hasta que cierres la página.';
    vm.storageCls = TOS.Store.mode === 'device' ? 'status ok' : 'status warn';
    vm.counts = db.routines.length + ' rutinas · ' + db.exercises.length + ' ejercicios · ' + db.workouts.length + ' entrenos · ' + (db.activities || []).length + ' actividades';
    vm.exCount = db.exercises.length + ' ejercicios';
    vm.routineCount = db.routines.length + ' rutinas';
    vm.openExercises = function () { self.setState({ sheet: 'library' }); };
    vm.goRoutines = function () { self.setTab('workouts'); };
    vm.resetDemo = function () { self.resetProgram(); };
    vm.clearHistory = function () { self.clearHistory(); };
    vm.progEarlier = function () { self.shiftProgram(-1); }; // empezó antes → semana más avanzada
    vm.progLater = function () { self.shiftProgram(1); };

    /* entreno */
    vm.w = { name: '', pos: '', elapsed: '', progressStyle: 'width:0%', strip: [], ex: {}, sets: [], prevSets: [], cta: { label: '', sub: '', cls: '', act: function () {} } };
    if (a) {
      var ci = Math.min(a.current, a.exercises.length - 1), E = a.exercises[ci], EX = X[E.exerciseId] || {};
      var total = 0, done = 0;
      a.exercises.forEach(function (e) { if (e.skipped) return; total += e.sets.length; done += TOS.doneSets(e.sets).length; });
      var asi = TOS.activeSetIndex(E);
      var best = TOS.bestFor(db, E.exerciseId);
      var last = TOS.lastFor(db, E.exerciseId);
      var restOn = !!a.rest && !a.rest.done, restDone = !!a.rest && !!a.rest.done;
      var nextTxt = '';
      if (asi >= 0) nextTxt = 'Sigue · Serie ' + (asi + 1) + ' · ' + TOS.wt(E.sets[asi].weight, u) + ' ' + u + ' × ' + E.sets[asi].reps;
      else {
        var nx = a.exercises.slice(ci + 1).find(function (e) { return !e.skipped && e.sets.some(function (s) { return !s.completed; }); });
        nextTxt = nx ? 'Sigue · ' + nx.name : 'Última serie lista — termina cuando quieras';
      }
      var cta;
      if (asi >= 0) cta = { label: 'Completar serie ' + (asi + 1), sub: TOS.wt(E.sets[asi].weight, u) + ' ' + u + ' × ' + E.sets[asi].reps, cls: 'cta-ink', act: function () { self.completeSet(ci, asi); } };
      else {
        var hasNext = a.exercises.slice(ci + 1).some(function (e) { return e.sets.some(function (s) { return !s.completed; }); });
        cta = hasNext ? { label: 'Siguiente ejercicio', sub: a.exercises[ci + 1] ? a.exercises[ci + 1].name : '', cls: 'cta-accent', act: function () { self.nextEx(); } }
          : { label: 'Terminar entreno', sub: done + ' series registradas', cls: 'cta-accent', act: function () { self.finish(); } };
      }
      cta.isCheck = asi >= 0; cta.isArrow = asi < 0;
      var step = TOS.stepFor(EX, u);
      vm.w = {
        name: a.routineName + (a.week >= 1 && a.week <= 4 ? ' · S' + a.week : ''), pos: 'Ejercicio ' + (ci + 1) + ' de ' + a.exercises.length, elapsed: TOS.clock((now - a.startTime) / 1000),
        progressStyle: 'width:' + (total ? Math.round(done / total * 100) : 0) + '%', progressTxt: done + '/' + total + ' series',
        strip: a.exercises.map(function (e, i) {
          var complete = e.sets.every(function (s) { return s.completed; });
          return { n: i + 1, name: e.name, cls: 'ex-chip' + (i === ci ? ' cur' : '') + (complete ? ' done' : '') + (e.skipped ? ' skipped' : ''),
            aria: e.name + (complete ? ', completo' : e.skipped ? ', saltado' : ''), go: function () { self.gotoEx(i); } };
        }),
        ex: { name: E.name, muscle: (EX.muscleGroup || 'Otro') + ' · ' + (EX.equipment || 'Otro'), spec: E.sets.length + ' × ' + TOS.repRange(E.targetRepMin, E.targetRepMax),
          rest: TOS.restLabel(E.restSeconds) + ' descanso', how: EX.instructions || '', note: E.notes || '', hevy: EX.hevyName ? 'Hevy: ' + EX.hevyName : '', adj: E.adj || '' },
        hasHevy: !!EX.hevyName, hasAdj: !!E.adj,
        video: TOS.videoUrl(EX.id ? EX : { name: E.name }), videoLabel: EX.videoUrl ? 'Ver video' : 'Ver video en YouTube',
        hasHow: !!EX.instructions, showHow: st.showHow, howCls: st.showHow ? 'how-btn on' : 'how-btn',
        toggleHow: function () { self.setState({ showHow: !st.showHow }); },
        hasNote: !!E.notes,
        hasPrev: !!last, firstTime: !last,
        prevLabel: last ? 'La vez pasada · ' + TOS.rel(last.date, now) : 'La vez pasada',
        prevSets: last ? last.sets.map(function (s) { return { txt: TOS.wt(s.weight, u) + ' ' + u + ' × ' + s.reps }; }) : [],
        targetW: E.targetWeight ? TOS.wt(E.targetWeight, u) + ' ' + u : 'Tú eliges', targetR: TOS.repRange(E.targetRepMin, E.targetRepMax) + ' reps', reason: E.reason || '',
        isSkipped: !!E.skipped, unskip: function () { self.unskip(); },
        sets: E.sets.map(function (s, i) {
          var isPR = s.completed && best && (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps));
          return { label: 'Serie ' + (i + 1), short: 'Serie ' + (i + 1), of: 'de ' + E.sets.length,
            isActive: i === asi, isDone: !!s.completed, isPending: !s.completed && i !== asi,
            txt: TOS.wt(s.weight, u) + ' ' + u + ' × ' + s.reps, time: s.timestamp ? TOS.timeOfDay(s.timestamp) : '', pr: !!isPR,
            wVal: s.wText != null ? s.wText : TOS.wt(s.weight, u), rVal: s.rText != null ? s.rText : String(s.reps),
            wMinus: function () { self.step(ci, i, 'w', -1); }, wPlus: function () { self.step(ci, i, 'w', 1); },
            rMinus: function () { self.step(ci, i, 'r', -1); }, rPlus: function () { self.step(ci, i, 'r', 1); },
            onW: function (e) { self.typeW(ci, i, e.target.value); }, onR: function (e) { self.typeR(ci, i, e.target.value); },
            focus: function () { self.focusSet(ci, i); }, undo: function () { self.undoSet(ci, i); } };
        }),
        stepLabel: '±' + TOS.num(step) + ' ' + u,
        addSet: function () { self.addSet(ci); }, removeSet: function () { self.removeSet(ci); },
        resting: restOn, restDone: restDone,
        restClock: a.rest ? TOS.clock((a.rest.endAt - now) / 1000) : '00:00',
        restStyle: a.rest ? 'width:' + Math.max(0, Math.min(100, (a.rest.endAt - now) / (a.rest.total * 1000) * 100)) + '%' : 'width:0%',
        restNext: nextTxt,
        restPlus: function () { self.restPlus(); }, restSkip: function () { self.restSkip(); },
        cta: cta,
        openMenu: function () { self.setState({ sheet: 'menu' }); },
        openNotes: function () { self.setState({ sheet: 'notes' }); },
        swap: function () { self.openPicker('swap'); }, add: function () { self.openPicker('add'); },
        skip: function () { self.skipEx(); },
        workoutNote: a.notes || '', onExNote: function (e) { self.exNote(e.target.value); }, onWorkoutNote: function (e) { self.workoutNote(e.target.value); }
      };
    }
    vm.finish = function () { self.finish(); };
    vm.leave = function () { self.leave(); };
    vm.discard = function () { self.discard(); };

    /* resumen */
    var S = st.summary;
    vm.sum = S ? { name: S.name, date: S.date, duration: S.duration + ' min', exercises: String(S.exercises), sets: String(S.sets), volume: S.volume,
      prs: S.prs, hasPrs: S.prs.length > 0, noPrs: S.prs.length === 0, notes: S.notes || '' } : { prs: [] };
    vm.onSumNote = function (e) { self.summaryNote(e.target.value); };
    vm.doneSummary = function () { self.doneSummary(); };

    /* hojas */
    vm.sheetMenu = st.sheet === 'menu' && !!a; vm.sheetNotes = st.sheet === 'notes' && !!a;
    vm.sheetPicker = st.sheet === 'picker' && !!st.picker; vm.sheetLibrary = st.sheet === 'library';
    vm.closeSheet = function () { self.setState({ sheet: null, picker: null, act: null }); };
    vm.sheetActivity = st.sheet === 'activity' && !!st.act;
    var AC = st.act || { type: null, duration: 45, day: 0, notes: '' };
    vm.act = {
      types: TOS.ACTIVITIES.map(function (t) { return { name: t.name, color: t.color, cls: AC.type === t.id ? 'act-btn on' : 'act-btn', pick: function () { self.actUpdate({ type: t.id }); } }; }),
      durations: [15, 30, 45, 60, 90].map(function (m) { return { label: m + '', cls: AC.duration === m ? 'chip on' : 'chip', pick: function () { self.actUpdate({ duration: m }); } }; }),
      duration: AC.duration + ' min',
      minus: function () { self.actUpdate({ duration: Math.max(5, AC.duration - 5) }); }, plus: function () { self.actUpdate({ duration: Math.min(600, AC.duration + 5) }); },
      days: [['Hoy', 0], ['Ayer', 1]].map(function (d) { return { label: d[0], cls: AC.day === d[1] ? 'chip on' : 'chip', pick: function () { self.actUpdate({ day: d[1] }); } }; }),
      notes: AC.notes || '', onNotes: function (e) { self.actUpdate({ notes: e.target.value }); },
      saveLabel: AC.type ? 'Registrar ' + TOS.actType(AC.type).name.toLowerCase() : 'Elige una actividad',
      save: function () { self.saveActivity(); }
    };
    vm.openActivity = function () { self.openActivity(null); };
    var pk = st.picker || { purpose: 'add', query: '' };
    var q = pk.query.trim().toLowerCase();
    vm.picker = { title: pk.purpose === 'swap' ? 'Reemplazar ejercicio' : 'Agregar ejercicio', query: pk.query,
      onQuery: function (e) { self.setState({ picker: Object.assign({}, st.picker, { query: e.target.value }) }); },
      results: db.exercises.filter(function (e) { return !q || e.name.toLowerCase().indexOf(q) >= 0 || (e.muscleGroup || '').toLowerCase().indexOf(q) >= 0 || (e.hevyName || '').toLowerCase().indexOf(q) >= 0; })
        .slice().sort(function (x, y) { return x.name.localeCompare(y.name, 'es'); })
        .map(function (e) { return { name: e.name, meta: e.muscleGroup + ' · ' + e.equipment, pick: function () { self.pickExercise(e.id); } }; }),
      canCreate: !!q && !db.exercises.some(function (e) { return e.name.toLowerCase() === q; }),
      createLabel: 'Crear “' + pk.query.trim() + '”', create: function () { self.createExercise(pk.query.trim()); } };
    vm.library = db.exercises.map(function (e) {
      var open = st.openExercise === e.id;
      return { name: e.name, meta: e.muscleGroup + ' · ' + e.equipment + (e.hevyName ? ' · Hevy: ' + e.hevyName : ''), open: open,
        toggle: function () { self.setState({ openExercise: open ? null : e.id }); },
        onName: function (ev) { self.updExercise(e.id, 'name', ev.target.value); },
        onHow: function (ev) { self.updExercise(e.id, 'instructions', ev.target.value); }, how: e.instructions || '',
        video: TOS.videoUrl(e), videoInput: e.videoUrl || '', onVideo: function (ev) { self.updExercise(e.id, 'videoUrl', ev.target.value.trim()); },
        muscles: TOS.MUSCLES.map(function (m) { return { label: m, cls: e.muscleGroup === m ? 'chip sm on' : 'chip sm', pick: function () { self.updExercise(e.id, 'muscleGroup', m); } }; }),
        equipment: TOS.EQUIPMENT.map(function (m) { return { label: m, cls: e.equipment === m ? 'chip sm on' : 'chip sm', pick: function () { self.updExercise(e.id, 'equipment', m); } }; }),
        del: function () { self.deleteExercise(e.id); } };
    });
    vm.newLibraryExercise = function () { self.newLibraryExercise(); };

    /* editor */
    var ed = st.editor;
    vm.inEditor = !!ed;
    vm.ed = { title: '', name: '', desc: '', days: [], items: [] };
    if (ed) {
      var upd = function (fn) { self.editorUpdate(fn); };
      var bump = function (i, k, d, mn, mx) { upd(function (x) { var it = x.exercises[i]; it[k] = Math.max(mn, Math.min(mx, it[k] + d)); if (k === 'targetRepMin' && it.targetRepMax < it.targetRepMin) it.targetRepMax = it.targetRepMin; if (k === 'targetRepMax' && it.targetRepMin > it.targetRepMax) it.targetRepMin = it.targetRepMax; }); };
      vm.ed = { title: ed.isNew ? 'Nueva rutina' : 'Editar rutina', name: ed.name, desc: ed.description || '',
        onName: function (e) { var v = e.target.value; upd(function (x) { x.name = v; }); },
        onDesc: function (e) { var v = e.target.value; upd(function (x) { x.description = v; }); },
        days: [null, 1, 2, 3, 4, 5, 6, 0].map(function (d) { return { label: d == null ? 'Cualquiera' : TOS.DAY3[d], cls: ed.scheduledDay === d ? 'chip sm on' : 'chip sm', pick: function () { upd(function (x) { x.scheduledDay = d; }); } }; }),
        colors: TOS.PALETTE.map(function (c) { return { c: c, style: 'background:' + c, cls: ed.color === c ? 'swatch-btn on' : 'swatch-btn', pick: function () { upd(function (x) { x.color = c; }); } }; }),
        empty: ed.exercises.length === 0,
        duration: '~' + TOS.estimate(ed) + ' min · ' + ed.exercises.length + ' ejercicios',
        items: ed.exercises.map(function (it, i) {
          var ex = X[it.exerciseId] || { name: 'Ejercicio', equipment: '' };
          var st2 = TOS.stepFor(ex, u);
          return { n: TOS.pad2(i + 1), name: ex.name, open: ed.open === i,
            spec: it.targetSets + ' × ' + TOS.repRange(it.targetRepMin, it.targetRepMax) + ' · ' + TOS.restLabel(it.restSeconds) + ' descanso' + (it.targetWeight ? ' · ' + TOS.wt(it.targetWeight, u) + ' ' + u : ''),
            toggle: function () { upd(function (x) { x.open = x.open === i ? null : i; }); },
            up: function () { upd(function (x) { if (i > 0) { var t = x.exercises[i - 1]; x.exercises[i - 1] = x.exercises[i]; x.exercises[i] = t; if (x.open === i) x.open = i - 1; } }); },
            down: function () { upd(function (x) { if (i < x.exercises.length - 1) { var t = x.exercises[i + 1]; x.exercises[i + 1] = x.exercises[i]; x.exercises[i] = t; if (x.open === i) x.open = i + 1; } }); },
            remove: function () { upd(function (x) { x.exercises.splice(i, 1); x.open = null; }); },
            fields: [
              { label: 'Series', val: String(it.targetSets), minus: function () { bump(i, 'targetSets', -1, 1, 12); }, plus: function () { bump(i, 'targetSets', 1, 1, 12); } },
              { label: 'Reps mín.', val: String(it.targetRepMin), minus: function () { bump(i, 'targetRepMin', -1, 1, 50); }, plus: function () { bump(i, 'targetRepMin', 1, 1, 50); } },
              { label: 'Reps máx.', val: String(it.targetRepMax), minus: function () { bump(i, 'targetRepMax', -1, 1, 50); }, plus: function () { bump(i, 'targetRepMax', 1, 1, 50); } },
              { label: 'Descanso', val: TOS.restLabel(it.restSeconds), minus: function () { bump(i, 'restSeconds', -15, 15, 600); }, plus: function () { bump(i, 'restSeconds', 15, 15, 600); } },
              { label: 'Peso inicial · ' + u, val: TOS.wt(it.targetWeight, u),
                minus: function () { upd(function (x) { var y = x.exercises[i]; y.targetWeight = TOS.fromU(Math.max(0, TOS.toU(y.targetWeight, u) - st2), u); }); },
                plus: function () { upd(function (x) { var y = x.exercises[i]; y.targetWeight = TOS.fromU(TOS.toU(y.targetWeight, u) + st2, u); }); } }
            ] };
        }),
        addExercise: function () { self.openPicker('editor'); },
        save: function () { self.saveEditor(); }, cancel: function () { self.setState({ editor: null }); } };
    }

    /* confirmación + aviso */
    var C = st.confirm;
    vm.hasConfirm = !!C;
    vm.cf = C ? { title: C.title, body: C.body, yes: C.yes, yesCls: C.danger ? 'btn btn-danger-fill' : 'btn btn-ink',
      onYes: function () { var fn = C.action; self.setState({ confirm: null }); fn(); }, onNo: function () { self.setState({ confirm: null }); } } : {};
    vm.hasToast = !!st.toast; vm.toastTxt = st.toast || '';
    return vm;
  }
}
