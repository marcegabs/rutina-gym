'use client';

import { Component } from 'react';
import * as U from '@/lib/util.js';
import * as G from '@/lib/engine.js';
import * as D from '@/lib/data.js';
import { buildVM } from '@/lib/viewModel.js';
import { Screens } from './Screens.jsx';

// The signed-in app. Keeps the whole db in memory, applies each change
// locally first (fast at the gym) and then saves it to Supabase.
// The workout in progress lives in localStorage until you finish it.
export default class TrainingApp extends Component {
  constructor(props) {
    super(props);
    const now = Date.now();
    const db = { ...props.initialDb, active: this.readActive() };
    this._db = db;
    const resume = db.active && now - db.active.startTime < 4 * 3600000;
    this.state = {
      db, now, tab: 'today', view: resume ? 'workout' : 'main', progTab: 'lifts', openLift: null, openHist: null, todayPick: null,
      sheet: null, editor: null, picker: null, openExercise: null, confirm: null, toast: null, summary: null, showHow: false, act: null, saving: 0,
    };
    this._lastSec = 0;
    this._timers = {};
  }

  get sb() { return this.props.supabase; }
  get user() { return this.props.user; }
  get activeKey() { return 'rutinas-gym/active/' + this.user.id; }
  readActive() { try { const raw = window.localStorage.getItem('rutinas-gym/active/' + this.props.user.id); return raw ? JSON.parse(raw) : null; } catch { return null; } }
  writeActive(a) { try { if (a) window.localStorage.setItem(this.activeKey, JSON.stringify(a)); else window.localStorage.removeItem(this.activeKey); } catch { /* storage blocked */ } }

  componentDidMount() {
    this._iv = setInterval(() => this.tick(), 200);
    try {
      this._mq = window.matchMedia('(prefers-color-scheme: dark)');
      this._onMq = () => this.applyTheme();
      this._mq.addEventListener('change', this._onMq);
    } catch { /* old browser */ }
    this.applyTheme();
    // keep the profile's timezone in sync so "today" and streaks use the local day
    const tz = D.guessTimezone();
    if (tz && this._db.profile.timezone !== tz) this.setProfile('timezone', tz);
  }
  componentWillUnmount() {
    clearInterval(this._iv);
    try { this._mq.removeEventListener('change', this._onMq); } catch { /* noop */ }
    Object.values(this._timers).forEach(clearTimeout);
    clearTimeout(this._toastT);
  }
  applyTheme() {
    const t = this._db.profile.theme;
    let dark = t === 'dark';
    if (t === 'auto') { try { dark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { dark = false; } }
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }

  /* ── state plumbing ── */
  commit(fn, extra, persist) {
    const db = U.clone(this._db);
    fn(db);
    const activeChanged = JSON.stringify(db.active) !== JSON.stringify(this._db.active);
    this._db = db;
    if (activeChanged) this.writeActive(db.active);
    this.setState({ db, now: Date.now(), ...(extra || {}) });
    if (persist) this.persist(persist);
  }
  async persist(fn) {
    this.setState((s) => ({ saving: s.saving + 1 }));
    try { await fn(this.sb, this.user); }
    catch (e) { this.toast('No se pudo guardar: ' + (e.message || 'sin conexión')); this.props.onReload && this.props.onReload(); }
    finally { this.setState((s) => ({ saving: s.saving - 1 })); }
  }
  debounce(key, fn, ms = 700) {
    clearTimeout(this._timers[key]);
    this._timers[key] = setTimeout(() => this.persist(fn), ms);
  }
  toast(msg) {
    clearTimeout(this._toastT);
    this.setState({ toast: msg });
    this._toastT = setTimeout(() => this.setState({ toast: null }), 2200);
  }
  ask(title, body, yes, action, danger = true) { this.setState({ confirm: { title, body, yes, action, danger } }); }
  scrollTop() { setTimeout(() => { try { window.scrollTo({ top: 0 }); document.querySelectorAll('[data-scroll]').forEach((el) => { el.scrollTop = 0; }); } catch { /* noop */ } }, 0); }
  set(patch) { this.setState(patch); }

  /* ── timer & feedback ── */
  tick() {
    const a = this._db.active;
    if (!a || this.state.view !== 'workout') return;
    const now = Date.now();
    if (a.rest && !a.rest.done && now >= a.rest.endAt) {
      this.commit((db) => { db.active.rest.done = true; db.active.rest.doneAt = now; });
      this.restAlert();
      return;
    }
    if (a.rest && a.rest.done && now - (a.rest.doneAt || now) > 15000) { this.commit((db) => { db.active.rest = null; }); return; }
    const sec = Math.floor(now / 1000);
    if (sec !== this._lastSec) { this._lastSec = sec; this.setState({ now }); }
  }
  unlockAudio() {
    try {
      if (!this._ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this._ac = new AC(); }
      if (this._ac && this._ac.state === 'suspended') this._ac.resume();
    } catch { /* no audio */ }
  }
  buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* noop */ } }
  restAlert() {
    if (!this._db.profile.sound) return;
    this.buzz([220, 90, 220]);
    try {
      const ac = this._ac; if (!ac) return;
      [0, 0.22].forEach((off) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + off;
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.2);
      });
    } catch { /* no audio */ }
  }

  setTab = (t) => { this.setState({ tab: t, view: 'main', sheet: null }); this.scrollTop(); };

  /* ── workout lifecycle ── */
  startWorkout = (rid) => {
    const r = this._db.routines.find((x) => x.id === rid);
    if (!r) return;
    const go = () => {
      this.unlockAudio();
      this.commit((db) => { db.active = G.newActive(db, r, Date.now()); }, { view: 'workout', sheet: null, showHow: false, confirm: null });
      this.scrollTop();
    };
    const a = this._db.active;
    if (a && a.routineId === rid) { this.setState({ view: 'workout' }); return; }
    if (a) { this.ask('¿Reemplazar el entreno en curso?', a.routineName + ' sigue abierto. Si empiezas ' + r.name + ' se descarta.', 'Descartar y empezar', go); return; }
    go();
  };
  resume = () => { this.unlockAudio(); this.setState({ view: 'workout', sheet: null }); this.scrollTop(); };
  leave = () => this.setState({ view: 'main', tab: 'today', sheet: null });
  finish = () => {
    const a = this._db.active;
    if (!a) return;
    let sets = 0;
    a.exercises.forEach((e) => { sets += U.doneSets(e.sets).length; });
    if (!sets) { this.ask('Aún no hay nada registrado', 'No completaste ninguna serie, así que no hay nada que guardar. ¿Descartar este entreno?', 'Descartar', this.discardNow); return; }
    const now = Date.now(), db0 = this._db, u = db0.profile.units;
    const prs = []; let vol = 0, exCount = 0;
    a.exercises.forEach((e) => {
      const done = U.doneSets(e.sets);
      if (!done.length) return;
      exCount++; vol += U.volume(e.sets);
      const prev = G.bestFor(db0, e.exerciseId), top = U.topSet(done);
      if (prev && (top.weight > prev.weight || (top.weight === prev.weight && top.reps > prev.reps))) prs.push({ name: e.name, txt: U.wt(top.weight, u) + ' ' + u + ' × ' + top.reps });
    });
    const rec = G.toRecord(a, now);
    this.commit((db) => { db.workouts.push(rec); db.active = null; }, {
      view: 'complete', sheet: null,
      summary: { id: rec.id, name: rec.routineName, date: U.dateLong(now), duration: rec.duration, exercises: exCount, sets, volume: U.thousands(U.toU(vol, u)) + ' ' + u, prs, notes: rec.notes },
    }, (sb, user) => D.insertWorkout(sb, user, rec));
    this.buzz(60);
  };
  discardNow = () => { this.commit((db) => { db.active = null; }, { view: 'main', tab: 'today', sheet: null, confirm: null }); this.toast('Entreno descartado'); };
  discard = () => this.ask('¿Descartar este entreno?', 'Se perderá todo lo registrado en esta sesión.', 'Descartar', this.discardNow);
  doneSummary = () => { this.setState({ view: 'main', tab: 'today', summary: null }); this.scrollTop(); };
  summaryNote = (v) => {
    const id = this.state.summary && this.state.summary.id;
    this.commit((db) => { const w = db.workouts.find((x) => x.id === id); if (w) w.notes = v; }, { summary: { ...this.state.summary, notes: v } });
    this.debounce('sumnote', (sb) => D.updateWorkoutNotes(sb, id, v));
  };

  /* ── sets ── */
  mutEx(ei, fn, extra) { this.commit((db) => { const a = db.active; if (a && a.exercises[ei]) fn(a.exercises[ei], a, db); }, extra); }
  completeSet = (ei, si) => {
    this.unlockAudio();
    const now = Date.now();
    this.mutEx(ei, (e, a, db) => {
      const s = e.sets[si]; if (!s) return;
      s.completed = true; s.timestamp = now; delete s.wText; delete s.rText;
      e.focus = null; e.skipped = false;
      e.sets.forEach((x, j) => { if (j > si && !x.completed && !x.touched) x.weight = s.weight; });
      const more = a.exercises.some((x) => !x.skipped && x.sets.some((y) => !y.completed));
      if (more) { const sec = e.restSeconds || db.profile.defaultRest; a.rest = { endAt: now + sec * 1000, total: sec, ei, done: false }; }
      else a.rest = null;
    });
    this.buzz(30);
  };
  undoSet = (ei, si) => this.mutEx(ei, (e, a) => {
    const s = e.sets[si]; if (!s) return;
    s.completed = false; s.timestamp = null; e.focus = si;
    if (a.rest && a.rest.ei === ei) a.rest = null;
  });
  focusSet = (ei, si) => this.mutEx(ei, (e) => { e.focus = si; });
  step = (ei, si, field, dir) => {
    const u = this._db.profile.units, ex = G.exMap(this._db)[this._db.active.exercises[ei].exerciseId];
    this.mutEx(ei, (e) => {
      const s = e.sets[si]; if (!s) return;
      if (field === 'w') { s.weight = U.fromU(Math.max(0, U.toU(s.weight, u) + dir * U.stepFor(ex, u)), u); delete s.wText; }
      else { s.reps = Math.max(0, s.reps + dir); delete s.rText; }
      s.touched = true;
    });
  };
  typeW = (ei, si, v) => {
    const u = this._db.profile.units;
    this.mutEx(ei, (e) => { const s = e.sets[si]; if (!s) return; s.wText = v; s.touched = true; const n = parseFloat(String(v).replace(',', '.')); if (!isNaN(n) && n >= 0) s.weight = U.fromU(n, u); });
  };
  typeR = (ei, si, v) => this.mutEx(ei, (e) => { const s = e.sets[si]; if (!s) return; s.rText = v; s.touched = true; const n = parseInt(v, 10); if (!isNaN(n) && n >= 0) s.reps = n; });
  addSet = (ei) => this.mutEx(ei, (e) => {
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ setNumber: e.sets.length + 1, weight: last ? last.weight : e.targetWeight, reps: last ? last.reps : e.targetRepMax, completed: false, timestamp: null });
    e.skipped = false;
  });
  removeSet = (ei) => {
    const e0 = this._db.active.exercises[ei];
    if (!e0 || e0.sets.length <= 1) { this.toast('Deja al menos una serie'); return; }
    this.mutEx(ei, (e) => {
      let idx = -1;
      for (let i = e.sets.length - 1; i >= 0; i--) if (!e.sets[i].completed) { idx = i; break; }
      if (idx < 0) idx = e.sets.length - 1;
      e.sets.splice(idx, 1);
      e.sets.forEach((s, j) => { s.setNumber = j + 1; });
      if (e.focus != null && e.focus >= e.sets.length) e.focus = null;
    });
  };
  gotoEx = (i) => { this.commit((db) => { if (db.active && db.active.exercises[i]) db.active.current = i; }, { showHow: false }); this.scrollTop(); };
  nextEx = () => {
    const a = this._db.active; if (!a) return;
    let n = a.current + 1;
    for (let i = a.current + 1; i < a.exercises.length; i++) { if (a.exercises[i].sets.some((s) => !s.completed)) { n = i; break; } }
    this.gotoEx(Math.min(n, a.exercises.length - 1));
  };
  skipEx = () => {
    const a = this._db.active; if (!a) return;
    const ei = a.current;
    this.commit((db) => {
      const A = db.active; A.exercises[ei].skipped = true;
      if (A.rest && A.rest.ei === ei) A.rest = null;
      for (let i = ei + 1; i < A.exercises.length; i++) { if (!A.exercises[i].skipped && A.exercises[i].sets.some((s) => !s.completed)) { A.current = i; return; } }
    }, { sheet: null, showHow: false });
    this.toast('Ejercicio saltado');
    this.scrollTop();
  };
  unskip = () => this.mutEx(this._db.active.current, (e) => { e.skipped = false; });
  restPlus = () => this.commit((db) => {
    const r = db.active && db.active.rest; if (!r) return;
    if (r.done) { r.done = false; r.endAt = Date.now() + 30000; r.total = 30; } else { r.endAt += 30000; r.total += 30; }
  });
  restSkip = () => this.commit((db) => { if (db.active) db.active.rest = null; });
  exNote = (v) => this.mutEx(this._db.active.current, (e) => { e.notes = v; });
  workoutNote = (v) => this.commit((db) => { if (db.active) db.active.notes = v; });
  ctaAction = () => {
    const a = this._db.active; if (!a) return;
    const vm = buildVM(this);
    const c = vm.w.cta;
    if (c.kind === 'complete') this.completeSet(vm.w.ci, c.si);
    else if (c.kind === 'next') this.nextEx();
    else this.finish();
  };

  /* ── exercise picker ── */
  openPicker = (purpose) => this.setState({ picker: { purpose, query: '' }, sheet: 'picker' });
  pickerQuery = (q) => this.setState({ picker: { ...this.state.picker, query: q } });
  pickExercise = (exId) => {
    const p = this.state.picker; if (!p) return;
    const db0 = this._db;
    if (p.purpose === 'editor') {
      const last = G.lastFor(db0, exId);
      this.editorUpdate((ed) => {
        ed.exercises.push({ key: U.uid(), exerciseId: exId, order: ed.exercises.length, targetSets: 4, targetRepMin: 12, targetRepMax: 12,
          targetWeight: last ? last.top.weight : 0, restSeconds: db0.profile.defaultRest, notes: '', perSide: false });
        ed.open = ed.exercises.length - 1;
      });
      this.setState({ picker: null, sheet: null });
      return;
    }
    const a = db0.active; if (!a) return;
    const cur = a.current, week = a.week || 0;
    this.commit((db) => {
      const A = db.active;
      if (p.purpose === 'swap') {
        const old = A.exercises[cur];
        A.exercises[cur] = G.makeActiveEx(db, { exerciseId: exId, targetSets: old.sets.length, targetRepMin: old.targetRepMin, targetRepMax: old.targetRepMax, targetWeight: 0, restSeconds: old.restSeconds, notes: '' }, old.order, 0);
        if (A.rest && A.rest.ei === cur) A.rest = null;
      } else {
        A.exercises.push(G.makeActiveEx(db, { exerciseId: exId, targetSets: 3, targetRepMin: 12, targetRepMax: 12, targetWeight: 0, restSeconds: db.profile.defaultRest, notes: '' }, A.exercises.length, week));
        A.current = A.exercises.length - 1;
      }
    }, { picker: null, sheet: null, showHow: false });
    this.toast(p.purpose === 'swap' ? 'Ejercicio reemplazado' : 'Ejercicio agregado');
    this.scrollTop();
  };
  createExercise = (name) => {
    const ex = { id: U.uid(), slug: '', name, muscleGroup: 'Otro', equipment: 'Otro', hevyName: '', compound: false, instructions: '', notes: '', videoUrl: '' };
    this.commit((db) => { db.exercises.push(ex); }, null, (sb, user) => D.insertExercise(sb, user, ex));
    this.pickExercise(ex.id);
  };

  /* ── routine editor ── */
  openEditor = (rid) => {
    const r = rid ? this._db.routines.find((x) => x.id === rid) : null;
    const ed = r ? U.clone(r) : { id: U.uid(), name: '', description: '', scheduledDay: null, color: U.PALETTE[this._db.routines.length % U.PALETTE.length], exercises: [], position: this._db.routines.length, programId: null };
    ed.exercises.forEach((e) => { e.key = e.key || e.id || U.uid(); });
    ed.isNew = !r; ed.open = null;
    this.setState({ editor: ed, sheet: null });
  };
  editorUpdate = (fn) => { const ed = U.clone(this.state.editor); fn(ed); this.setState({ editor: ed }); };
  editorBump = (i, k, d, mn, mx) => this.editorUpdate((x) => {
    const it = x.exercises[i]; it[k] = Math.max(mn, Math.min(mx, it[k] + d));
    if (k === 'targetRepMin' && it.targetRepMax < it.targetRepMin) it.targetRepMax = it.targetRepMin;
    if (k === 'targetRepMax' && it.targetRepMin > it.targetRepMax) it.targetRepMin = it.targetRepMax;
  });
  editorWeight = (i, dir, step) => {
    const u = this._db.profile.units;
    this.editorUpdate((x) => { const y = x.exercises[i]; y.targetWeight = U.fromU(Math.max(0, U.toU(y.targetWeight, u) + dir * step), u); });
  };
  editorMove = (i, d) => this.editorUpdate((x) => {
    const j = i + d; if (j < 0 || j >= x.exercises.length) return;
    const t = x.exercises[j]; x.exercises[j] = x.exercises[i]; x.exercises[i] = t;
    if (x.open === i) x.open = j;
  });
  saveEditor = () => {
    const ed = U.clone(this.state.editor);
    if (!ed.name.trim()) { this.toast('Ponle nombre a la rutina'); return; }
    ed.name = ed.name.trim();
    ed.exercises.forEach((e, i) => { e.order = i; });
    const isNew = ed.isNew; delete ed.isNew; delete ed.open;
    this.commit((db) => {
      const i = db.routines.findIndex((x) => x.id === ed.id);
      if (i >= 0) db.routines[i] = ed; else db.routines.push(ed);
    }, { editor: null }, (sb, user) => D.upsertRoutine(sb, user, ed));
    this.toast(isNew ? 'Rutina creada' : 'Rutina guardada');
  };
  duplicateRoutine = (rid) => {
    const i = this._db.routines.findIndex((x) => x.id === rid); if (i < 0) return;
    const c = U.clone(this._db.routines[i]);
    c.id = U.uid(); c.name = c.name + ' (copia)'; c.scheduledDay = null; c.color = U.PALETTE[(i + 1) % U.PALETTE.length]; c.position = this._db.routines.length;
    this.commit((db) => { db.routines.splice(i + 1, 0, c); }, null, (sb, user) => D.upsertRoutine(sb, user, c));
    this.toast('Rutina duplicada');
  };
  deleteRoutine = (rid) => {
    const r = this._db.routines.find((x) => x.id === rid); if (!r) return;
    this.ask('¿Borrar ' + r.name + '?', 'Se elimina la rutina. Tu historial se conserva.', 'Borrar', () => {
      this.commit((db) => { db.routines = db.routines.filter((x) => x.id !== rid); },
        { confirm: null, todayPick: this.state.todayPick === rid ? null : this.state.todayPick }, (sb) => D.deleteRoutine(sb, rid));
      this.toast('Rutina borrada');
    });
  };

  /* ── exercise library ── */
  newLibraryExercise = () => {
    const ex = { id: U.uid(), slug: '', name: 'Nuevo ejercicio', muscleGroup: 'Otro', equipment: 'Otro', hevyName: '', compound: false, instructions: '', notes: '', videoUrl: '' };
    this.commit((db) => { db.exercises.unshift(ex); }, { openExercise: ex.id }, (sb, user) => D.insertExercise(sb, user, ex));
  };
  updExercise = (id, field, v) => {
    this.commit((db) => { const e = db.exercises.find((x) => x.id === id); if (e) e[field] = v; });
    this.debounce('ex:' + id + ':' + field, (sb) => D.updateExercise(sb, id, field, v));
  };
  deleteExercise = (id) => {
    const e = this._db.exercises.find((x) => x.id === id); if (!e) return;
    const used = this._db.routines.filter((r) => r.exercises.some((x) => x.exerciseId === id)).length;
    this.ask('¿Borrar ' + e.name + '?', used ? 'Se quita de ' + used + (used > 1 ? ' rutinas' : ' rutina') + '. El historial se conserva.' : 'El historial se conserva.', 'Borrar', () => {
      this.commit((db) => {
        db.exercises = db.exercises.filter((x) => x.id !== id);
        db.routines.forEach((r) => { r.exercises = r.exercises.filter((x) => x.exerciseId !== id); r.exercises.forEach((x, i) => { x.order = i; }); });
      }, { confirm: null, openExercise: null }, (sb) => D.deleteExercise(sb, id));
    });
  };

  /* ── settings ── */
  setProfile = (k, v) => {
    this.commit((db) => { db.profile[k] = v; });
    if (k === 'theme') setTimeout(() => this.applyTheme(), 0);
    this.debounce('profile:' + k, (sb, user) => D.saveProfile(sb, user, k, v), k === 'name' ? 700 : 0);
  };
  shiftProgram = (weeks) => {
    if (!this._db.program) return;
    this.commit((db) => { db.program.start = U.addDays(db.program.start, 7 * weeks); });
    const p = this._db.program;
    this.debounce('program', (sb) => D.saveProgramStart(sb, p), 400);
  };
  resetProgram = () => {
    this.ask('¿Restablecer el programa?', 'Rutinas y ejercicios vuelven al body recomp de 4 semanas. Tu historial se conserva.', 'Restablecer', async () => {
      this.setState({ confirm: null });
      try { await D.reseedProgram(this.sb); this.props.onReload && this.props.onReload(); this.toast('Programa restablecido'); }
      catch (e) { this.toast('No se pudo restablecer: ' + e.message); }
    });
  };
  clearHistory = () => {
    this.ask('¿Borrar el historial?', 'Se borran todos los entrenos y actividades. Rutinas y ejercicios se quedan.', 'Borrar historial', () => {
      this.commit((db) => { db.workouts = []; db.activities = []; db.active = null; }, { confirm: null, view: 'main' }, (sb, user) => D.clearHistory(sb, user));
      this.toast('Historial borrado');
    });
  };
  deleteHistoryItem = (item) => {
    const isW = item.kind === 'workout';
    this.ask(isW ? '¿Borrar este entreno?' : '¿Borrar esta actividad?', isW ? 'Se quita del historial y del progreso.' : 'Se quita del historial y de tu meta diaria.', 'Borrar', () => {
      this.commit((db) => {
        if (isW) db.workouts = db.workouts.filter((w) => w.id !== item.id);
        else db.activities = db.activities.filter((a) => a.id !== item.id);
      }, { confirm: null, openHist: null }, (sb) => (isW ? D.deleteWorkout(sb, item.id) : D.deleteActivity(sb, item.id)));
    });
  };

  /* ── other activities ── */
  openActivity = (type) => this.setState({ sheet: 'activity', act: { type: type || null, duration: 45, day: 0, notes: '' } });
  actUpdate = (patch) => this.setState({ act: { ...this.state.act, ...patch } });
  saveActivity = () => {
    const A = this.state.act; if (!A) return;
    if (!A.type) { this.toast('Elige una actividad'); return; }
    const now = Date.now();
    const t = A.day ? U.addDays(U.dayStart(now), -A.day) + 12 * 3600000 : now - A.duration * 60000;
    const rec = { id: U.uid(), type: A.type, date: U.dayStart(t), startTime: t, duration: A.duration, notes: A.notes || '' };
    this.commit((db) => { db.activities.push(rec); db.activities.sort((x, y) => x.startTime - y.startTime); }, { sheet: null, act: null }, (sb, user) => D.insertActivity(sb, user, rec));
    this.buzz(40);
    this.toast(U.actType(A.type).name + ' registrada');
  };
  loadProgram = async () => {
    try { await D.reseedProgram(this.sb); this.props.onReload && this.props.onReload(); this.toast('Programa cargado'); }
    catch (e) { this.toast('No se pudo cargar: ' + e.message); }
  };

  render() {
    return <Screens app={this} vm={buildVM(this)} />;
  }
}
