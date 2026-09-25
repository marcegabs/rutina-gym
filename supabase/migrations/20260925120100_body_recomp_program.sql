-- ─────────────────────────────────────────────────────────────
-- Rutinas GYM · catalogue + "Body recomp · 4 semanas" program
-- The program is copied into each user's own rows, so they can edit
-- it freely. New sign-ups get it automatically (trigger at the end);
-- existing users can run:  select public.seed_my_program();
-- ─────────────────────────────────────────────────────────────

insert into public.activity_types (id, name, color, sort_order) values
  ('swimming',   'Natación',                '#9DD3CC', 1),
  ('walking',    'Caminata',                '#FFD15C', 2),
  ('pilates',    'Pilates',                 '#F6A6C6', 3),
  ('spinning',   'Spinning',                '#FFB27A', 4),
  ('functional', 'Entrenamiento funcional', '#C9BCFF', 5)
on conflict (id) do update set name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;

-- Creates the program for one user and returns its id.
-- p_start: program start (a Monday). Default: this Monday if today is Mon–Wed, otherwise next Monday.
create function public.seed_body_recomp(p_user uuid, p_start date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start   date;
  v_program uuid;
begin
  v_start := coalesce(
    p_start,
    case when extract(isodow from current_date) <= 3
         then date_trunc('week', current_date)::date
         else date_trunc('week', current_date)::date + 7 end
  );

  -- exercise library (re-running keeps existing rows and your edits)
  insert into public.exercises (user_id, slug, name, muscle_group, equipment, hevy_name, is_compound, instructions)
  select p_user, e.slug, e.name, e.muscle, e.equipment, e.hevy, e.compound, e.cues
  from (values
    ('goblet',        'Sentadilla goblet',            'Cuádriceps',  'Mancuerna', 'Goblet Squat',              true,  'Mancuerna pegada al pecho, rodillas siguen la punta del pie, espalda recta.'),
    ('rdl',           'Peso muerto rumano',           'Femoral',     'Barra',     'Romanian Deadlift',         true,  'Rodillas suaves, lleva la cadera atrás y mantén la barra pegada a las piernas.'),
    ('leg-press',     'Prensa de pierna',             'Cuádriceps',  'Máquina',   'Leg Press',                 true,  'Pies al ancho de hombros; no bloquees las rodillas arriba.'),
    ('kickback',      'Patada de glúteo en máquina',  'Glúteo',      'Máquina',   'Cable Glute Kickback',      false, 'Aprieta el glúteo arriba, sin arquear la espalda baja.'),
    ('lying-curl',    'Curl femoral acostado',        'Femoral',     'Máquina',   'Leg Curl (Machine)',        false, 'Baja en 2 segundos, cadera pegada al banco.'),
    ('calf',          'Elevación de talones',         'Pantorrilla', 'Máquina',   'Standing Calf Raise',       false, 'Estira abajo por completo y sostén 1 segundo arriba.'),
    ('db-bench',      'Press banca con mancuernas',   'Pecho',       'Mancuerna', 'Dumbbell Bench Press',      true,  'Omóplatos juntos, baja controlado hasta la línea del pecho.'),
    ('pec-deck',      'Peck deck',                    'Pecho',       'Máquina',   'Pec Deck Fly',              false, 'Codos ligeramente flexionados, junta al frente y aprieta.'),
    ('machine-press', 'Press militar en máquina',     'Hombro',      'Máquina',   'Shoulder Press (Machine)',  true,  'Espalda pegada al respaldo, no bloquees los codos.'),
    ('lateral',       'Elevación lateral',            'Hombro',      'Mancuerna', 'Lateral Raise (Dumbbell)',  false, 'Sube con los codos hasta la altura del hombro, sin impulso. Peso por mano.'),
    ('front',         'Elevación frontal',            'Hombro',      'Mancuerna', 'Front Raise (Dumbbell)',    false, 'Brazos casi rectos, sube hasta la altura de los ojos. Peso por mano.'),
    ('dip-machine',   'Fondos en máquina (tríceps)',  'Tríceps',     'Máquina',   'Tricep Dip (Machine)',      false, 'Codos pegados al cuerpo, extiende por completo.'),
    ('copa',          'Press copa tríceps',           'Tríceps',     'Mancuerna', 'Overhead Tricep Extension', false, 'Codos apuntando al techo, baja la mancuerna detrás de la cabeza.'),
    ('hack',          'Sentadilla hack',              'Cuádriceps',  'Máquina',   'Hack Squat',                true,  'Baja profundo con la espalda pegada al respaldo.'),
    ('adduction',     'Aducción en máquina',          'Aductores',   'Máquina',   'Hip Adduction (Machine)',   false, 'Cierra controlado y abre lento.'),
    ('leg-ext',       'Extensión de pierna',          'Cuádriceps',  'Máquina',   'Leg Extension (Machine)',   false, 'Pausa arriba 1 segundo.'),
    ('incline-curl',  'Curl femoral inclinado',       'Femoral',     'Máquina',   'Lying Leg Curl',            false, 'Cadera abajo, controla la bajada.'),
    ('lunge',         'Desplante caminando',          'Glúteo',      'Mancuerna', 'Walking Lunge',             true,  '12 por lado. Paso largo, torso erguido. Peso por mano.'),
    ('pulldown',      'Jalón al frente en polea',     'Espalda',     'Polea',     'Lat Pulldown',              true,  'Pecho arriba, jala la barra a la clavícula.'),
    ('seated-row',    'Remo sentado en máquina',      'Espalda',     'Máquina',   'Seated Cable Row',          true,  'Junta los omóplatos al final de cada rep.'),
    ('db-row',        'Remo con mancuerna',           'Espalda',     'Mancuerna', 'Single Arm Dumbbell Row',   true,  '12 por lado. Jala hacia la cadera, espalda plana.'),
    ('straight-pd',   'Pull down barra Z prono',      'Espalda',     'Polea',     'Straight Arm Pulldown',     false, 'Brazos casi rectos, baja la barra hasta los muslos.'),
    ('hammer',        'Curl martillo',                'Bíceps',      'Mancuerna', 'Hammer Curl (Dumbbell)',    false, 'Palmas mirándose, codos quietos. Peso por mano.'),
    ('ez-curl',       'Curl barra Z abierto',         'Bíceps',      'Barra',     'EZ Bar Curl',               false, 'Agarre abierto, sin balancear el cuerpo.'),
    ('shrug',         'Encogimientos con mancuerna',  'Trapecio',    'Mancuerna', 'Dumbbell Shrug',            false, 'Sube los hombros hacia las orejas y sostén 1 segundo.')
  ) as e(slug, name, muscle, equipment, hevy, compound, cues)
  on conflict (user_id, slug) do nothing;

  -- one active program per user: retire the previous one
  update public.programs set is_active = false where user_id = p_user and is_active;

  insert into public.programs (user_id, name, start_date, weeks)
  values (p_user, 'Body recomp · 4 semanas', v_start, 4)
  returning id into v_program;

  insert into public.program_weeks (program_id, week_number, tip, compound_extra_sets, compound_rep_target, weight_increase_kg) values
    (v_program, 1, 'Aprende los movimientos, pesos conservadores.',     0, null, null),
    (v_program, 2, 'Sube 1–2 kg en al menos 2 ejercicios por día.',     0, null, 1.5),
    (v_program, 3, 'Agrega 1 serie extra en los compuestos (5×12).',    1, null, null),
    (v_program, 4, 'Peso más alto, baja a 10 reps en los compuestos.', 0, 10,   null);

  -- routines (re-running refreshes them to the program's version)
  insert into public.routines (user_id, program_id, slug, name, description, scheduled_weekday, color, position)
  values
    (p_user, v_program, 'lower-a', 'Lower A', 'Pierna fuerza, base · descanso 90 s',                      1, '#D4F36B', 0),
    (p_user, v_program, 'upper-a', 'Upper A', 'Empuje: pecho, hombro, tríceps · descanso 90 s',          2, '#C9BCFF', 1),
    (p_user, v_program, 'lower-b', 'Lower B', 'Hipertrofia: glúteo y muslo interno · descanso 60–75 s',  4, '#FFB27A', 2),
    (p_user, v_program, 'upper-b', 'Upper B', 'Jale: espalda, bíceps, hombro posterior · descanso 90 s', 5, '#F6A6C6', 3)
  on conflict (user_id, slug) do update
    set program_id = excluded.program_id, name = excluded.name, description = excluded.description,
        scheduled_weekday = excluded.scheduled_weekday, color = excluded.color, position = excluded.position, archived_at = null;

  delete from public.routine_exercises re
  using public.routines r
  where re.routine_id = r.id and r.user_id = p_user and r.slug in ('lower-a', 'upper-a', 'lower-b', 'upper-b');

  insert into public.routine_exercises (routine_id, exercise_id, position, target_sets, target_rep_min, target_rep_max, per_side, rest_seconds)
  select r.id, x.id, i.pos, i.sets, i.reps, i.reps, i.per_side, i.rest
  from (values
    ('lower-a', 'goblet',        0, 4, 12, false, 90),
    ('lower-a', 'rdl',           1, 4, 12, false, 90),
    ('lower-a', 'leg-press',     2, 4, 12, false, 90),
    ('lower-a', 'kickback',      3, 4, 15, false, 90),
    ('lower-a', 'lying-curl',    4, 4, 12, false, 90),
    ('lower-a', 'calf',          5, 4, 20, false, 90),
    ('upper-a', 'db-bench',      0, 4, 12, false, 90),
    ('upper-a', 'pec-deck',      1, 4, 12, false, 90),
    ('upper-a', 'machine-press', 2, 4, 12, false, 90),
    ('upper-a', 'lateral',       3, 4, 12, false, 90),
    ('upper-a', 'front',         4, 3, 12, false, 90),
    ('upper-a', 'dip-machine',   5, 4, 15, false, 90),
    ('upper-a', 'copa',          6, 3, 15, false, 90),
    ('lower-b', 'hack',          0, 4, 12, false, 75),
    ('lower-b', 'adduction',     1, 4, 20, false, 60),
    ('lower-b', 'leg-ext',       2, 4, 15, false, 60),
    ('lower-b', 'incline-curl',  3, 4, 12, false, 60),
    ('lower-b', 'lunge',         4, 3, 12, true,  75),
    ('lower-b', 'calf',          5, 4, 20, false, 60),
    ('upper-b', 'pulldown',      0, 4, 12, false, 90),
    ('upper-b', 'seated-row',    1, 4, 12, false, 90),
    ('upper-b', 'db-row',        2, 4, 12, true,  90),
    ('upper-b', 'straight-pd',   3, 3, 15, false, 90),
    ('upper-b', 'hammer',        4, 4, 12, false, 90),
    ('upper-b', 'ez-curl',       5, 3, 12, false, 90),
    ('upper-b', 'shrug',         6, 4, 20, false, 90)
  ) as i(routine_slug, exercise_slug, pos, sets, reps, per_side, rest)
  join public.routines  r on r.user_id = p_user and r.slug = i.routine_slug
  join public.exercises x on x.user_id = p_user and x.slug = i.exercise_slug;

  -- weekly plan: gym in the morning, swimming in the afternoon
  insert into public.day_plans (program_id, weekday, morning_label, routine_id, afternoon_activity, afternoon_optional)
  select v_program, d.weekday, d.label, r.id, d.afternoon, d.optional
  from (values
    (1, 'Lower A',         'lower-a', 'swimming', false),
    (2, 'Upper A',         'upper-a', 'swimming', false),
    (3, 'Descanso activo', null,      'swimming', false),
    (4, 'Lower B',         'lower-b', 'swimming', false),
    (5, 'Upper B',         'upper-b', 'swimming', false),
    (6, 'Descanso',        null,      'swimming', true),
    (0, 'Descanso',        null,      null,       false)
  ) as d(weekday, label, routine_slug, afternoon, optional)
  left join public.routines r on r.user_id = p_user and r.slug = d.routine_slug;

  return v_program;
end;
$$;

-- Only the server may seed an arbitrary user; people seed themselves through seed_my_program().
revoke execute on function public.seed_body_recomp(uuid, date) from public, anon, authenticated;

create function public.seed_my_program(p_start date default null)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.seed_body_recomp((select auth.uid()), p_start);
$$;
revoke execute on function public.seed_my_program(date) from public, anon;
grant execute on function public.seed_my_program(date) to authenticated;

-- New sign-up → profile + program, ready to train.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  perform public.seed_body_recomp(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
