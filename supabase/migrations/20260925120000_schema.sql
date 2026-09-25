-- ─────────────────────────────────────────────────────────────
-- Rutinas GYM · schema v1
-- Postgres 15+ / Supabase. Every user-owned row carries user_id and is
-- protected by row level security, so each person only sees their own data.
-- Weights are stored in kg; the app converts to lb for display.
-- Weekdays follow JavaScript's Date.getDay(): 0 = domingo … 6 = sábado.
-- ─────────────────────────────────────────────────────────────

create type public.unit_system as enum ('kg', 'lb');
create type public.theme_pref as enum ('auto', 'light', 'dark');
create type public.workout_status as enum ('in_progress', 'completed', 'discarded');

-- keeps updated_at current on every update
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── profiles ─────────────────────────────────────────────────
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text,
  units                public.unit_system not null default 'kg',
  default_rest_seconds integer not null default 90 check (default_rest_seconds between 10 and 900),
  theme                public.theme_pref not null default 'auto',
  rest_alert           boolean not null default true,
  daily_goal           smallint not null default 1 check (daily_goal between 1 and 5),
  timezone             text not null default 'UTC',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── activity types (shared catalogue: natación, caminata…) ──
create table public.activity_types (
  id         text primary key,
  name       text not null,
  color      text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order smallint not null default 0
);

-- ── exercise library ─────────────────────────────────────────
create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  slug         text not null default gen_random_uuid()::text,
  name         text not null check (length(btrim(name)) > 0),
  muscle_group text not null default 'Otro',
  equipment    text not null default 'Otro',
  hevy_name    text,
  is_compound  boolean not null default false,
  instructions text not null default '',
  notes        text not null default '',
  video_url    text check (video_url is null or video_url ~* '^https?://'),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, slug)
);

-- ── programs (e.g. body recomp · 4 semanas) ─────────────────
create table public.programs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  start_date date not null,
  weeks      smallint not null check (weeks between 1 and 52),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index programs_one_active_per_user on public.programs (user_id) where is_active;

-- week-by-week progression rules, stored as data
create table public.program_weeks (
  program_id          uuid not null references public.programs (id) on delete cascade,
  week_number         smallint not null check (week_number >= 1),
  tip                 text not null default '',
  compound_extra_sets smallint not null default 0 check (compound_extra_sets between 0 and 5),
  compound_rep_target smallint check (compound_rep_target between 1 and 50), -- null = keep the routine's reps
  weight_increase_kg  numeric(5, 2) check (weight_increase_kg >= 0),          -- suggested bump, null = none
  primary key (program_id, week_number)
);

-- ── routines ─────────────────────────────────────────────────
create table public.routines (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  program_id        uuid references public.programs (id) on delete set null,
  slug              text not null default gen_random_uuid()::text,
  name              text not null check (length(btrim(name)) > 0),
  description       text not null default '',
  scheduled_weekday smallint check (scheduled_weekday between 0 and 6),
  color             text not null default '#D4F36B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position          smallint not null default 0,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, slug)
);

create table public.routine_exercises (
  id               uuid primary key default gen_random_uuid(),
  routine_id       uuid not null references public.routines (id) on delete cascade,
  exercise_id      uuid not null references public.exercises (id) on delete cascade,
  position         smallint not null check (position >= 0),
  target_sets      smallint not null check (target_sets between 1 and 20),
  target_rep_min   smallint not null check (target_rep_min between 1 and 100),
  target_rep_max   smallint not null check (target_rep_max between 1 and 100),
  per_side         boolean not null default false,
  target_weight_kg numeric(6, 2) not null default 0 check (target_weight_kg >= 0),
  rest_seconds     smallint not null default 90 check (rest_seconds between 10 and 900),
  notes            text not null default '',
  check (target_rep_min <= target_rep_max),
  unique (routine_id, position) deferrable initially deferred
);

-- what each weekday looks like inside a program (gym in the morning, activity in the afternoon)
create table public.day_plans (
  program_id         uuid not null references public.programs (id) on delete cascade,
  weekday            smallint not null check (weekday between 0 and 6),
  morning_label      text not null,
  routine_id         uuid references public.routines (id) on delete set null,
  afternoon_activity text references public.activity_types (id),
  afternoon_optional boolean not null default false,
  primary key (program_id, weekday)
);

-- ── workout log ──────────────────────────────────────────────
create table public.workouts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  routine_id       uuid references public.routines (id) on delete set null,
  routine_name     text not null,               -- snapshot, survives renames/deletes
  color            text,
  program_id       uuid references public.programs (id) on delete set null,
  program_week     smallint,
  status           public.workout_status not null default 'in_progress',
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_minutes integer generated always as (
    case when ended_at is null then null
         else greatest(1, round(extract(epoch from (ended_at - started_at)) / 60)::integer) end
  ) stored,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (status <> 'completed' or ended_at is not null)
);
-- only one open workout at a time (the app resumes it)
create unique index workouts_one_in_progress on public.workouts (user_id) where status = 'in_progress';
create index workouts_user_started on public.workouts (user_id, started_at desc);

create table public.workout_exercises (
  id               uuid primary key default gen_random_uuid(),
  workout_id       uuid not null references public.workouts (id) on delete cascade,
  exercise_id      uuid references public.exercises (id) on delete set null,
  exercise_name    text not null,               -- snapshot
  position         smallint not null check (position >= 0),
  target_sets      smallint,
  target_rep_min   smallint,
  target_rep_max   smallint,
  target_weight_kg numeric(6, 2),
  rest_seconds     smallint,
  skipped          boolean not null default false,
  notes            text not null default '',
  unique (workout_id, position) deferrable initially deferred
);
create index workout_exercises_exercise on public.workout_exercises (exercise_id);

create table public.sets (
  id                  uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number          smallint not null check (set_number >= 1),
  weight_kg           numeric(6, 2) not null default 0 check (weight_kg >= 0),
  reps                smallint not null default 0 check (reps between 0 and 1000),
  completed           boolean not null default false,
  completed_at        timestamptz,
  check (completed = (completed_at is not null)),
  unique (workout_exercise_id, set_number) deferrable initially deferred
);

-- ── other activities (count toward the daily goal) ──────────
create table public.activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  activity_type_id text not null references public.activity_types (id),
  performed_on     date not null,
  started_at       timestamptz,
  duration_minutes smallint not null check (duration_minutes between 1 and 1440),
  notes            text not null default '',
  created_at       timestamptz not null default now()
);
create index activities_user_day on public.activities (user_id, performed_on desc);

-- ── updated_at triggers ──────────────────────────────────────
create trigger profiles_updated  before update on public.profiles  for each row execute function public.set_updated_at();
create trigger exercises_updated before update on public.exercises for each row execute function public.set_updated_at();
create trigger programs_updated  before update on public.programs  for each row execute function public.set_updated_at();
create trigger routines_updated  before update on public.routines  for each row execute function public.set_updated_at();
create trigger workouts_updated  before update on public.workouts  for each row execute function public.set_updated_at();

-- ── row level security ───────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.activity_types    enable row level security;
alter table public.exercises         enable row level security;
alter table public.programs          enable row level security;
alter table public.program_weeks     enable row level security;
alter table public.routines          enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.day_plans         enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets              enable row level security;
alter table public.activities        enable row level security;

create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "activity types are readable" on public.activity_types for select to authenticated using (true);

create policy "own exercises" on public.exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own programs" on public.programs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own routines" on public.routines for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own workouts" on public.workouts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own activities" on public.activities for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- child tables inherit access from their parent row
create policy "own program weeks" on public.program_weeks for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())));
create policy "own day plans" on public.day_plans for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())));
create policy "own routine exercises" on public.routine_exercises for all to authenticated
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())));
create policy "own workout exercises" on public.workout_exercises for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy "own sets" on public.sets for all to authenticated
  using (exists (select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id
                 where we.id = workout_exercise_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id
                      where we.id = workout_exercise_id and w.user_id = (select auth.uid())));

-- ── views (security_invoker: they respect the policies above) ─

-- one row per logged exercise: top set, volume and a readable summary
create view public.v_exercise_sessions with (security_invoker = on) as
select w.user_id,
       we.exercise_id,
       we.exercise_name,
       w.id            as workout_id,
       w.started_at,
       top.weight_kg   as top_weight_kg,
       top.reps        as top_reps,
       agg.sets_done,
       agg.volume_kg,
       agg.sets_summary
from public.workout_exercises we
join public.workouts w on w.id = we.workout_id and w.status = 'completed'
cross join lateral (
  select count(*)::int                                              as sets_done,
         sum(s.weight_kg * s.reps)                                  as volume_kg,
         string_agg(trim_scale(s.weight_kg)::text || '×' || s.reps, ' · ' order by s.set_number) as sets_summary
  from public.sets s where s.workout_exercise_id = we.id and s.completed
) agg
cross join lateral (
  select s.weight_kg, s.reps from public.sets s
  where s.workout_exercise_id = we.id and s.completed
  order by s.weight_kg desc, s.reps desc limit 1
) top
where agg.sets_done > 0;

-- "what did I do last time?" — shown at the top of every exercise
create view public.v_last_performance with (security_invoker = on) as
select distinct on (user_id, exercise_id) *
from public.v_exercise_sessions
where exercise_id is not null
order by user_id, exercise_id, started_at desc;

-- heaviest set ever per exercise (ties broken by reps)
create view public.v_personal_records with (security_invoker = on) as
select distinct on (user_id, exercise_id)
       user_id, exercise_id, exercise_name, top_weight_kg as weight_kg, top_reps as reps, started_at as achieved_at
from public.v_exercise_sessions
where exercise_id is not null
order by user_id, exercise_id, top_weight_kg desc, top_reps desc, started_at asc;

-- every day with some physical activity (gym or otherwise), in the user's timezone
create view public.v_active_days with (security_invoker = on) as
select w.user_id,
       (w.started_at at time zone coalesce(p.timezone, 'UTC'))::date as day,
       'gym'::text     as kind,
       w.routine_name  as label,
       w.color
from public.workouts w
left join public.profiles p on p.id = w.user_id
where w.status = 'completed'
union all
select a.user_id, a.performed_on, a.activity_type_id, t.name, t.color
from public.activities a
join public.activity_types t on t.id = a.activity_type_id;

-- exercise count and estimated minutes per routine (same formula as the app)
create view public.v_routine_summary with (security_invoker = on) as
select r.id as routine_id,
       r.user_id,
       r.name,
       count(re.id)::int as exercise_count,
       greatest(10, (round((coalesce(sum(re.target_sets * (45 + re.rest_seconds) + 60), 0) / 60.0 + 5) / 5) * 5)::int) as estimated_minutes
from public.routines r
left join public.routine_exercises re on re.routine_id = r.id
where r.archived_at is null
group by r.id;

-- ── helper functions ─────────────────────────────────────────

-- program week for a date: 0 = not started yet, 1…weeks, > weeks = finished
create function public.program_week(p_program uuid, p_on date default current_date)
returns integer language sql stable security invoker set search_path = '' as $$
  select case when p_on < pr.start_date then 0
              else ((p_on - pr.start_date) / 7) + 1 end
  from public.programs pr where pr.id = p_program;
$$;

-- consecutive days with activity, ending today (or yesterday if today is still open)
create function public.activity_streak(p_today date default null)
returns integer language sql stable security invoker set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  tz as (
    select coalesce((select p.timezone from public.profiles p where p.id = (select uid from me)), 'UTC') as zone
  ),
  today as (select coalesce(p_today, (now() at time zone (select zone from tz))::date) as d),
  days as (select distinct day from public.v_active_days where user_id = (select uid from me)),
  anchor as (
    select case when exists (select 1 from days where day = (select d from today))
                then (select d from today) else (select d from today) - 1 end as d
  ),
  ranked as (
    select (select d from anchor) - day as gap,
           row_number() over (order by day desc) - 1 as rn
    from days where day <= (select d from anchor)
  )
  select count(*)::int from ranked where gap = rn;
$$;
