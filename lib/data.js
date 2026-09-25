// Supabase ↔ app data. loadAll() builds the in-memory db the UI works with;
// the save* functions write single changes back. Everything is scoped by RLS,
// so queries never need to filter by user themselves (inserts still set user_id).
import { parseDate, isoDate, dayStart, actType } from './util.js';

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const mapExercise = (x) => ({
  id: x.id, slug: x.slug, name: x.name, muscleGroup: x.muscle_group, equipment: x.equipment, hevyName: x.hevy_name || '',
  compound: x.is_compound, instructions: x.instructions || '', notes: x.notes || '', videoUrl: x.video_url || '',
});
const mapRoutine = (r) => ({
  id: r.id, slug: r.slug, name: r.name, description: r.description || '', scheduledDay: r.scheduled_weekday, color: r.color,
  position: r.position, programId: r.program_id,
  exercises: (r.routine_exercises || []).slice().sort((a, b) => a.position - b.position).map((e) => ({
    id: e.id, exerciseId: e.exercise_id, order: e.position, targetSets: e.target_sets, targetRepMin: e.target_rep_min,
    targetRepMax: e.target_rep_max, targetWeight: Number(e.target_weight_kg) || 0, restSeconds: e.rest_seconds, notes: e.notes || '', perSide: e.per_side,
  })),
});
const mapWorkout = (w) => ({
  id: w.id, routineId: w.routine_id, routineName: w.routine_name, color: w.color || '#D4F36B', programId: w.program_id, programWeek: w.program_week,
  startTime: Date.parse(w.started_at), endTime: w.ended_at ? Date.parse(w.ended_at) : null, duration: w.duration_minutes || 0, notes: w.notes || '',
  exercises: (w.workout_exercises || []).slice().sort((a, b) => a.position - b.position).map((e) => ({
    id: e.id, exerciseId: e.exercise_id, name: e.exercise_name, order: e.position, notes: e.notes || '', skipped: e.skipped,
    sets: (e.sets || []).slice().sort((a, b) => a.set_number - b.set_number).map((s) => ({
      setNumber: s.set_number, weight: Number(s.weight_kg), reps: s.reps, completed: s.completed, timestamp: s.completed_at ? Date.parse(s.completed_at) : null,
    })),
  })),
});
const mapActivity = (a) => ({
  id: a.id, type: a.activity_type_id, date: parseDate(a.performed_on),
  startTime: a.started_at ? Date.parse(a.started_at) : parseDate(a.performed_on) + 12 * 3600000, duration: a.duration_minutes, notes: a.notes || '',
});

export async function loadAll(sb, user) {
  const [profileR, exR, progR, routR, workR, actR] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    sb.from('exercises').select('*').is('archived_at', null).order('name'),
    sb.from('programs').select('*, program_weeks(*), day_plans(*, routines(name))').eq('is_active', true).maybeSingle(),
    sb.from('routines').select('*, routine_exercises(*)').is('archived_at', null).order('position'),
    sb.from('workouts').select('*, workout_exercises(*, sets(*))').eq('status', 'completed').order('started_at'),
    sb.from('activities').select('*').order('performed_on'),
  ]);
  let p = must(profileR);
  if (!p) p = must(await sb.from('profiles').insert({ id: user.id, timezone: guessTimezone() }).select().single());
  const prog = must(progR);
  let program = null;
  if (prog) {
    const weeks = (prog.program_weeks || []).slice().sort((a, b) => a.week_number - b.week_number);
    const weekPlan = {};
    (prog.day_plans || []).forEach((d) => {
      const pm = d.afternoon_activity ? actType(d.afternoon_activity).name : '';
      weekPlan[d.weekday] = [d.routines ? d.routines.name : d.morning_label, pm ? pm + (d.afternoon_optional ? ' opcional' : '') : ''];
    });
    program = {
      id: prog.id, name: prog.name, start: parseDate(prog.start_date), weeks: prog.weeks, weekPlan,
      tips: weeks.map((w) => w.tip),
      rules: weeks.map((w) => ({ extraSets: w.compound_extra_sets || 0, repTarget: w.compound_rep_target, inc: w.weight_increase_kg != null ? Number(w.weight_increase_kg) : null })),
    };
  }
  const activities = must(actR).map(mapActivity);
  activities.sort((a, b) => a.startTime - b.startTime);
  return {
    profile: { name: p.display_name || '', units: p.units, defaultRest: p.default_rest_seconds, theme: p.theme, sound: p.rest_alert, timezone: p.timezone, dailyGoal: p.daily_goal },
    program,
    exercises: must(exR).map(mapExercise),
    routines: must(routR).map(mapRoutine),
    workouts: must(workR).map(mapWorkout),
    activities,
  };
}

function guessTimezone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } }
export { guessTimezone };

// ── profile ──
const PROFILE_COLS = { name: 'display_name', units: 'units', defaultRest: 'default_rest_seconds', theme: 'theme', sound: 'rest_alert', timezone: 'timezone' };
export async function saveProfile(sb, user, key, value) {
  must(await sb.from('profiles').update({ [PROFILE_COLS[key]]: value }).eq('id', user.id));
}

// ── program ──
export async function saveProgramStart(sb, program) {
  must(await sb.from('programs').update({ start_date: isoDate(program.start) }).eq('id', program.id));
}
export async function reseedProgram(sb) {
  must(await sb.rpc('seed_my_program'));
}

// ── exercises ──
export async function insertExercise(sb, user, ex) {
  must(await sb.from('exercises').insert({ id: ex.id, user_id: user.id, name: ex.name, muscle_group: ex.muscleGroup, equipment: ex.equipment }));
}
const EX_COLS = { name: 'name', muscleGroup: 'muscle_group', equipment: 'equipment', instructions: 'instructions', videoUrl: 'video_url' };
export async function updateExercise(sb, id, field, value) {
  let v = value;
  if (field === 'videoUrl') v = /^https?:\/\//i.test(value) ? value : null;
  if (field === 'name' && !String(value).trim()) return; // the column rejects empty names
  must(await sb.from('exercises').update({ [EX_COLS[field]]: v }).eq('id', id));
}
export async function deleteExercise(sb, id) {
  must(await sb.from('exercises').delete().eq('id', id));
}

// ── routines ──
export async function upsertRoutine(sb, user, r) {
  must(await sb.from('routines').upsert({
    id: r.id, user_id: user.id, program_id: r.programId || null, name: r.name, description: r.description || '',
    scheduled_weekday: r.scheduledDay, color: r.color, position: r.position || 0,
  }));
  must(await sb.from('routine_exercises').delete().eq('routine_id', r.id));
  if (r.exercises.length) {
    must(await sb.from('routine_exercises').insert(r.exercises.map((e, i) => ({
      routine_id: r.id, exercise_id: e.exerciseId, position: i, target_sets: e.targetSets, target_rep_min: e.targetRepMin,
      target_rep_max: e.targetRepMax, per_side: !!e.perSide, target_weight_kg: e.targetWeight || 0, rest_seconds: e.restSeconds, notes: e.notes || '',
    }))));
  }
}
export async function deleteRoutine(sb, id) {
  must(await sb.from('routines').delete().eq('id', id));
}

// ── workouts ──
export async function insertWorkout(sb, user, w) {
  must(await sb.from('workouts').insert({
    id: w.id, user_id: user.id, routine_id: w.routineId, routine_name: w.routineName, color: w.color, program_id: w.programId,
    program_week: w.programWeek, status: 'completed', started_at: new Date(w.startTime).toISOString(), ended_at: new Date(w.endTime).toISOString(), notes: w.notes || '',
  }));
  const exRows = w.exercises.map((e, i) => ({
    id: e.id || crypto.randomUUID(), workout_id: w.id, exercise_id: e.exerciseId, exercise_name: e.name, position: i, notes: e.notes || '',
    target_sets: e.targetSets, target_rep_min: e.targetRepMin, target_rep_max: e.targetRepMax, target_weight_kg: e.targetWeight, rest_seconds: e.restSeconds,
  }));
  if (!exRows.length) return;
  must(await sb.from('workout_exercises').insert(exRows));
  const setRows = [];
  w.exercises.forEach((e, i) => e.sets.forEach((s, j) => setRows.push({
    workout_exercise_id: exRows[i].id, set_number: j + 1, weight_kg: Math.round(s.weight * 100) / 100, reps: s.reps,
    completed: !!s.completed, completed_at: s.completed && s.timestamp ? new Date(s.timestamp).toISOString() : null,
  })));
  if (setRows.length) must(await sb.from('sets').insert(setRows));
}
export async function updateWorkoutNotes(sb, id, notes) {
  must(await sb.from('workouts').update({ notes }).eq('id', id));
}
export async function deleteWorkout(sb, id) {
  must(await sb.from('workouts').delete().eq('id', id));
}
export async function clearHistory(sb, user) {
  must(await sb.from('workouts').delete().eq('user_id', user.id));
  must(await sb.from('activities').delete().eq('user_id', user.id));
}

// ── activities ──
export async function insertActivity(sb, user, a) {
  must(await sb.from('activities').insert({
    id: a.id, user_id: user.id, activity_type_id: a.type, performed_on: isoDate(dayStart(a.startTime)),
    started_at: new Date(a.startTime).toISOString(), duration_minutes: a.duration, notes: a.notes || '',
  }));
}
export async function deleteActivity(sb, id) {
  must(await sb.from('activities').delete().eq('id', id));
}
