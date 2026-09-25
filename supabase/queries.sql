-- ─────────────────────────────────────────────────────────────
-- Rutinas GYM · example queries the app needs
-- Run them as a signed-in user (RLS limits every query to your rows).
-- In the Supabase SQL editor you run as an admin instead, so replace
-- (select auth.uid()) with your user id there.
-- ─────────────────────────────────────────────────────────────

-- Hoy: today's plan inside the active program
select pr.name as program,
       public.program_week(pr.id) as week,
       pw.tip,
       dp.morning_label,
       r.name  as routine,
       rs.exercise_count,
       rs.estimated_minutes,
       at.name as afternoon,
       dp.afternoon_optional
from public.programs pr
join public.day_plans dp on dp.program_id = pr.id and dp.weekday = extract(dow from current_date)
left join public.program_weeks pw on pw.program_id = pr.id and pw.week_number = public.program_week(pr.id)
left join public.routines r on r.id = dp.routine_id
left join public.v_routine_summary rs on rs.routine_id = r.id
left join public.activity_types at on at.id = dp.afternoon_activity
where pr.user_id = (select auth.uid()) and pr.is_active;

-- A routine's exercises with this week's adjustments (week 3: +1 set, week 4: 10 reps on compounds)
select re.position,
       x.name,
       x.hevy_name,
       re.target_sets + case when x.is_compound then coalesce(pw.compound_extra_sets, 0) else 0 end as sets,
       case when x.is_compound and pw.compound_rep_target is not null then pw.compound_rep_target else re.target_rep_max end as reps,
       re.per_side,
       re.rest_seconds,
       lp.sets_summary as last_time,
       coalesce(x.video_url, 'https://www.youtube.com/results?search_query=' || replace(x.name || ' técnica correcta', ' ', '+')) as video
from public.routine_exercises re
join public.routines r  on r.id = re.routine_id
join public.exercises x on x.id = re.exercise_id
left join public.programs pr on pr.id = r.program_id
left join public.program_weeks pw on pw.program_id = pr.id and pw.week_number = public.program_week(pr.id)
left join public.v_last_performance lp on lp.exercise_id = x.id
where r.slug = 'lower-a' and r.user_id = (select auth.uid())
order by re.position;

-- Start a workout, log one set, finish
with w as (
  insert into public.workouts (user_id, routine_id, routine_name, color, program_id, program_week)
  select r.user_id, r.id, r.name, r.color, r.program_id, public.program_week(r.program_id)
  from public.routines r where r.slug = 'lower-a' and r.user_id = (select auth.uid())
  returning id
), we as (
  insert into public.workout_exercises (workout_id, exercise_id, exercise_name, position, target_sets, target_rep_min, target_rep_max, rest_seconds)
  select w.id, x.id, x.name, 0, 4, 12, 12, 90
  from w, public.exercises x where x.slug = 'goblet' and x.user_id = (select auth.uid())
  returning id
)
insert into public.sets (workout_exercise_id, set_number, weight_kg, reps, completed, completed_at)
select we.id, 1, 12, 12, true, now() from we;

update public.workouts set status = 'completed', ended_at = now()
where user_id = (select auth.uid()) and status = 'in_progress';

-- Log a swim
insert into public.activities (user_id, activity_type_id, performed_on, duration_minutes, notes)
values ((select auth.uid()), 'swimming', current_date, 45, '1 km');

-- Progreso: now vs before for every exercise
select l.exercise_name,
       trim_scale(l.top_weight_kg) || ' kg × ' || l.top_reps as current,
       trim_scale(prev.top_weight_kg) || ' kg × ' || prev.top_reps as previous,
       trim_scale(pr.weight_kg) || ' kg × ' || pr.reps as best
from public.v_last_performance l
left join lateral (
  select s.top_weight_kg, s.top_reps from public.v_exercise_sessions s
  where s.exercise_id = l.exercise_id and s.started_at < l.started_at
  order by s.started_at desc limit 1
) prev on true
left join public.v_personal_records pr on pr.exercise_id = l.exercise_id
order by l.started_at desc;

-- Daily goal: streak and active days this week
select public.activity_streak() as streak_days,
       (select count(distinct day) from public.v_active_days
        where day >= date_trunc('week', current_date)::date) as active_days_this_week;
