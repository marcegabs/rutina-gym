# Rutinas GYM

A personal training app for the gym, in Spanish and built for the phone: today's workout, set logging with − / + steppers, an automatic rest timer, last time's numbers, progress, and a daily goal of one activity (gym, natación, caminata, pilates, spinning, funcional).

**Stack:** Next.js 16 (App Router) on **Vercel** · Postgres + Auth on **Supabase**.

```
app/                  layout, page, styles, web-app manifest
components/           AppRoot (sign-in + loading), TrainingApp (state + actions), Screens (all UI), Icons
lib/
  util.js             dates (es), units, formatting
  engine.js           workout rules: suggestions, weekly progression, streaks
  viewModel.js        turns state into what each screen shows
  data.js             Supabase reads and writes
  supabase.js         browser client
supabase/
  migrations/         schema + "Body recomp · 4 semanas" program
  queries.sql         example queries
docs/data-model.md    diagram and table reference
prototype/            the original design-canvas prototype (reference only)
```

## 1. Database (Supabase, ~5 min)

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. **SQL Editor** → paste and run `supabase/migrations/20260925120000_schema.sql`, then `20260925120100_body_recomp_program.sql`.
3. **Authentication → Sign In / Providers → Email**: for a personal app you can turn **Confirm email** off, so you can sign in straight away. (If you leave it on, see step 3 of Vercel below.)
4. Copy **Project Settings → API**: the Project URL and the `anon` public key.

Every new account gets the program, routines and exercises automatically. The program starts on the next Monday (or this Monday if it's Monday–Wednesday); change it in the app under **Ajustes → Programa**.

## 2. Run it on your computer (optional)

```bash
cp .env.example .env.local   # then paste your URL and anon key
npm install
npm run dev                  # http://localhost:3000
```

## 3. Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repo. Framework is detected as Next.js; no build settings to change.
3. **Environment Variables** (before the first deploy):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Or connect Supabase from Vercel's **Integrations** and it adds them for you.
4. Deploy. Then in Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel address (e.g. `https://rutinas-gym.vercel.app`) so confirmation emails link back to the app.
5. On your phone, open the site and use **Add to Home Screen** — it opens full-screen like an app.

The anon key is meant to be public: row level security on every table means each account only reads and writes its own rows. Never put the `service_role` key in Vercel's `NEXT_PUBLIC_*` variables.

## How data flows

- Everything loads once after sign-in; each change shows instantly and saves to Supabase in the background. If a save fails you see a message and the app reloads from the server.
- The workout **in progress** is kept on the phone (localStorage) so a weak gym signal never interrupts you. It's written to the database when you tap **Terminar**. If you close the browser mid-workout, it resumes where you left off on the same phone.

## The program

**Body recomp · 4 semanas** — Upper/Lower, 4 gym days + natación diaria.

| Día | Mañana (gym) | Tarde |
|---|---|---|
| Lunes | Lower A — pierna fuerza | Natación |
| Martes | Upper A — empuje | Natación |
| Miércoles | Descanso activo | Natación |
| Jueves | Lower B — pierna hipertrofia | Natación |
| Viernes | Upper B — jale + hombros | Natación |
| Sábado | Descanso | Natación opcional |
| Domingo | Descanso | — |

Weekly progression is stored as data (`program_weeks`) and applied automatically when you start a workout: week 2 hint to add 1–2 kg, week 3 +1 set on compound lifts (5×12), week 4 heavier with 10 reps on compound lifts.

## Security notes

- Row level security is on for every table; policies only allow `auth.uid()` to touch its own rows.
- `seed_body_recomp(user)` can only be called by the server; the app calls `seed_my_program()`, which always uses the signed-in user.
