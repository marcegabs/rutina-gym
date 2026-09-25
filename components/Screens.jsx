'use client';

import { Icon, Shape, PlayIcon } from './Icons.jsx';
import { ACTIVITIES, MUSCLES, EQUIPMENT, PALETTE, DAY3, actType } from '@/lib/util.js';

// All screens. `vm` holds ready-to-show values (lib/viewModel.js); `app` holds the actions.
export function Screens({ app, vm }) {
  const st = app.state;
  return (
    <div className="shell">
      <Sidebar app={app} vm={vm} />
      <main className="main">
        {st.view !== 'workout' && st.view !== 'complete' && (
          <div className="page" key={st.tab}>
            {vm.isToday && <Today app={app} vm={vm} />}
            {vm.isWorkouts && <Routines app={app} vm={vm} />}
            {vm.isProgress && <Progress app={app} vm={vm} />}
            {vm.isSettings && <Settings app={app} vm={vm} />}
          </div>
        )}
      </main>
      {st.view === 'main' && vm.miniResume && (
        <button className="btn btn-accent mini-resume fade" onClick={app.resume}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}><Icon name="bolt" size={18} /> {vm.miniResumeTxt}</span>
          <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>Continuar <Icon name="arrow" size={18} /></span>
        </button>
      )}
      {st.view === 'main' && <TabBar app={app} />}
      {st.view === 'workout' && vm.w && <Workout app={app} vm={vm} />}
      {st.view === 'complete' && vm.sum && <Complete app={app} vm={vm} />}
      {st.editor && vm.ed && <Editor app={app} vm={vm} />}
      <Sheets app={app} vm={vm} />
      {st.confirm && <Confirm app={app} />}
      {st.toast && <div className="toast" role="status">{st.toast}</div>}
    </div>
  );
}

const TABS = [['today', 'cal', 'Hoy'], ['workouts', 'dumbbell', 'Rutinas'], ['progress', 'chart', 'Progreso'], ['settings', 'sliders', 'Ajustes']];

function TabBar({ app }) {
  return (
    <nav className="tabbar" aria-label="Principal">
      {TABS.map(([t, ic, label]) => (
        <button key={t} className={'tab' + (app.state.tab === t ? ' on' : '')} onClick={() => app.setTab(t)} aria-current={app.state.tab === t ? 'page' : undefined}>
          <Icon name={ic} />{label}
        </button>
      ))}
    </nav>
  );
}

function Sidebar({ app, vm }) {
  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px 26px' }}>
        <Shape name="SCALLOP" fill="var(--accent)" size={40} />
        <span className="disp" style={{ fontSize: 22, fontWeight: 800 }}>Rutinas GYM</span>
      </div>
      {TABS.map(([t, ic, label]) => (
        <button key={t} className={'side-btn' + (app.state.tab === t && app.state.view === 'main' ? ' on' : '')} onClick={() => app.setTab(t)}>
          <Icon name={ic} />{label}
        </button>
      ))}
      <div style={{ flexGrow: 1 }} />
      <button className="btn btn-accent" style={{ marginBottom: 10 }} onClick={() => app.openActivity(null)}><Icon name="plus" size={20} /> Registrar actividad</button>
      <span className="muted" style={{ fontSize: 12.5, padding: '10px 8px 0' }}>{app.state.saving ? 'Guardando…' : 'Todo guardado'}</span>
    </aside>
  );
}

/* ─────────────── Hoy ─────────────── */
function Today({ app, vm }) {
  return (
    <div className="today-grid enter">
      <div className="today-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span className="label">{vm.greeting}</span>
          <h1 className="disp h-date">{vm.todayDate}</h1>
        </div>
        <div className="week-badge">
          <Shape name="STAR8" fill="var(--accent)" size={64} style={{ position: 'absolute', inset: 0 }} />
          <span className="disp" style={{ position: 'relative', fontSize: 22, fontWeight: 800, lineHeight: 1, color: '#17161B' }}>{vm.weekCount}</span>
          <span style={{ position: 'relative', fontSize: 9, fontWeight: 800, letterSpacing: '.06em', color: '#17161B' }}>DÍAS SEM</span>
        </div>
      </div>
      <div className="col">
        {vm.hasProgram ? <ProgramCard vm={vm} /> : (
          <section className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="label">Programa</span>
            <span style={{ fontSize: 15 }}>Aún no tienes el programa body recomp cargado.</span>
            <button className="btn btn-ink" onClick={app.loadProgram}>Cargar mi programa</button>
          </section>
        )}
        <Hero app={app} vm={vm} />
      </div>
      <div className="col">
        <GoalCard app={app} vm={vm} />
        <WeekCard vm={vm} />
        {vm.lastW && (
          <button className="card row-btn" style={{ padding: '14px 16px 14px 14px', display: 'flex', alignItems: 'center', gap: 14 }}
            onClick={() => { app.set({ tab: 'progress', progTab: 'history', openHist: vm.lastW.id }); app.scrollTop(); }}>
            <span style={{ width: 56, height: 56, borderRadius: 20, background: vm.lastW.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#17161B' }}><Icon name="check" size={26} sw={2.6} /></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flexGrow: 1, minWidth: 0 }}>
              <span className="label">Lo último</span>
              <span style={{ fontWeight: 700, fontSize: 17 }}>{vm.lastW.title}</span>
              <span className="muted" style={{ fontSize: 14 }}>{vm.lastW.meta}</span>
            </span>
            <span className="muted"><Icon name="chev" size={20} /></span>
          </button>
        )}
      </div>
    </div>
  );
}

function ProgramCard({ vm }) {
  return (
    <section className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span className="label">{vm.prog.name}</span>
        <span className="disp" style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap' }}>{vm.prog.week}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${vm.prog.segs.length || 4}, minmax(0, 1fr))`, gap: 6 }}>
        {vm.prog.segs.map((g, i) => <span key={i} className={g.cls} />)}
      </div>
      <span style={{ fontSize: 14.5, lineHeight: 1.4 }}>{vm.prog.tip}</span>
    </section>
  );
}

function Hero({ app, vm }) {
  if (vm.hasActive) {
    return (
      <section className="card enter hero" style={{ background: 'var(--inv)', color: 'var(--invInk)' }}>
        <Shape name="SPARK" fill="var(--accent)" size={150} style={{ position: 'absolute', right: -34, top: -34 }} />
        <span className="label" style={{ color: 'var(--accent)', position: 'relative' }}>En curso</span>
        <h2 className="disp hero-title" style={{ fontSize: 38 }}>{vm.activeName}</h2>
        <p style={{ margin: 0, fontSize: 15, opacity: 0.75, position: 'relative' }}>{vm.activeInfo}</p>
        <button className="cta cta-accent" style={{ marginTop: 6 }} onClick={app.resume}><span style={{ flexGrow: 1, fontSize: 18, fontWeight: 700 }}>Continuar entreno</span><span className="cta-ic"><Icon name="arrow" size={24} /></span></button>
      </section>
    );
  }
  return (
    <>
      {vm.showPlan && (
        <section className="card enter hero" style={{ background: vm.plan.color, color: '#17161B' }}>
          <Shape name="SCALLOP" fill="rgba(255,255,255,.55)" size={170} face className="spin-slow" style={{ position: 'absolute', right: -40, top: -46 }} />
          <span className="pill">{vm.plan.tag}</span>
          <div style={{ position: 'relative' }}>
            <h2 className="disp hero-title">{vm.plan.name}</h2>
            <p style={{ margin: '12px 0 0', fontSize: 16, fontWeight: 600 }}>{vm.plan.meta}</p>
            {vm.plan.desc && <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.75 }}>{vm.plan.desc}</p>}
          </div>
          <ol className="plan-list">
            {vm.plan.items.map((it) => (
              <li key={it.key}><span className="n">{it.n}</span><span style={{ flexGrow: 1, fontWeight: 600 }}>{it.name}</span><span style={{ opacity: 0.72, whiteSpace: 'nowrap' }}>{it.spec}</span></li>
            ))}
          </ol>
          {vm.plan.pm && <span className="pill" style={{ background: 'rgba(255,255,255,.55)' }}>{vm.plan.pm}</span>}
          <button className="cta" style={{ background: '#17161B', color: '#F4EFE7', position: 'relative' }} onClick={() => app.startWorkout(vm.plan.id)}>
            <span style={{ flexGrow: 1, fontSize: 18, fontWeight: 700, letterSpacing: '.02em' }}>EMPEZAR ENTRENO</span>
            <span className="cta-ic" style={{ background: 'var(--accent)', color: '#17161B' }}><Icon name="arrow" size={24} /></span>
          </button>
        </section>
      )}
      {vm.showRestDay && (
        <section className="card enter hero" style={{ background: '#9DD3CC', color: '#17161B', minHeight: 200 }}>
          <Shape name="FLOWER" fill="rgba(255,255,255,.5)" size={180} face style={{ position: 'absolute', right: -40, bottom: -50 }} />
          <span className="label" style={{ color: '#17161B', opacity: 0.6, position: 'relative' }}>Sin gym programado</span>
          <h2 className="disp hero-title">{vm.restTitle}</h2>
          <p style={{ margin: 0, fontSize: 16, maxWidth: 230, position: 'relative' }}>{vm.restDayTxt}</p>
        </section>
      )}
      {vm.showSwitch && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="label" style={{ padding: '0 4px' }}>{vm.switchLabel}</span>
          <div className="noscroll switch-row">
            {vm.todayChips.map((c) => (
              <button key={c.id} className={'chip' + (c.on ? ' on' : '')} onClick={() => app.set({ todayPick: c.id })}><span className="dot" style={{ background: c.color }} />{c.name}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function GoalCard({ app, vm }) {
  const g = vm.goal;
  return (
    <section className={'goal' + (g.done ? ' done' : '')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shape name="FLOWER" fill="var(--accent)" size={68} style={{ position: 'absolute', inset: 0 }} />
          <span className="disp" style={{ position: 'relative', fontSize: 26, fontWeight: 800, color: '#17161B' }}>{g.streak}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flexGrow: 1 }}>
          <span className="label">Meta diaria · {g.streak} {g.streakLabel}</span>
          <span className="disp" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.05 }}>{g.title}</span>
          <span className="sub" style={{ fontSize: 14 }}>{g.sub}</span>
        </div>
        {g.done && <span style={{ width: 44, height: 44, borderRadius: 99, background: 'var(--accent)', color: '#17161B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="check" size={24} sw={2.8} /></span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="sub" style={{ fontSize: 13, fontWeight: 600 }}>¿Nadaste, caminaste o fuiste a clase? Tócalo para registrarlo</span>
        <div className="noscroll switch-row goal-row">
          {ACTIVITIES.map((t) => (
            <button key={t.id} className="chip" onClick={() => app.openActivity(t.id)}><span className="dot" style={{ background: t.color }} />{t.name}</button>
          ))}
        </div>
      </div>
    </section>
  );
}

function WeekCard({ vm }) {
  return (
    <section className="card" style={{ padding: '18px 14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 6px' }}>
        <span className="label">Esta semana</span><span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{vm.weekRange}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
        {vm.week.map((d) => (
          <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }} title={d.title}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{d.letter}</span>
            <span className={d.cls}>{d.num}</span>
            <span className="dot" style={{ width: 7, height: 7, background: d.dot }} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────── Rutinas ─────────────── */
function Routines({ app, vm }) {
  return (
    <div className="enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px 4px' }}>
        <h1 className="disp h-page">Rutinas</h1>
        <button className="btn btn-ink" onClick={() => app.openEditor(null)}><Icon name="plus" size={20} /> Nueva</button>
      </div>
      <section className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 6 }}>
          <span className="label">Tu semana</span><span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Gym (mañana) · Tarde</span>
        </div>
        {vm.weekPlan.map((p) => (
          <div key={p.key} className={'plan-row' + (p.today ? ' today' : '')}>
            <span style={{ width: 40, fontWeight: 700, flexShrink: 0 }}>{p.day}</span>
            <span className="dot" style={{ background: p.color }} />
            <span style={{ flexGrow: 1, fontWeight: 600 }}>{p.am}</span>
            <span className="muted" style={{ fontSize: 14, textAlign: 'right' }}>{p.pm}</span>
          </div>
        ))}
        {vm.progTips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            <span className="label" style={{ paddingBottom: 2 }}>Progresión por semanas</span>
            {vm.progTips.map((t) => (
              <div key={t.key} className={'tip-row' + (t.now ? ' now' : '')}><span style={{ width: 76, flexShrink: 0, fontWeight: 700 }}>{t.n}</span><span>{t.tip}</span></div>
            ))}
          </div>
        )}
      </section>
      <div className="routine-grid">
        {vm.routines.map((r) => (
          <article key={r.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Shape name="SCALLOP" fill={r.color} size={52} style={{ flexShrink: 0 }} />
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <h2 className="disp" style={{ margin: 0, fontSize: 24, lineHeight: 1, fontWeight: 800, textTransform: 'uppercase' }}>{r.name}</h2>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{r.meta}</p>
                {r.desc && <p style={{ margin: '4px 0 0', fontSize: 14 }}>{r.desc}</p>}
              </div>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {r.items.map((it) => (
                <li key={it.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 15 }}>
                  <span>{it.name}</span><span className="muted" style={{ whiteSpace: 'nowrap' }}>{it.spec}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-accent" style={{ flexGrow: 1 }} onClick={() => app.startWorkout(r.id)}>Empezar <Icon name="arrow" size={20} /></button>
              <button className="icon-btn" aria-label={'Editar ' + r.name} onClick={() => app.openEditor(r.id)}><Icon name="pencil" size={20} /></button>
              <button className="icon-btn" aria-label={'Duplicar ' + r.name} onClick={() => app.duplicateRoutine(r.id)}><Icon name="copy" size={20} /></button>
              <button className="icon-btn" aria-label={'Borrar ' + r.name} onClick={() => app.deleteRoutine(r.id)}><Icon name="trash" size={20} /></button>
            </div>
          </article>
        ))}
      </div>
      {vm.routines.length === 0 && (
        <div className="card" style={{ padding: '28px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <span className="disp" style={{ fontSize: 22, fontWeight: 800 }}>Aún no hay rutinas</span>
          <span className="muted" style={{ fontSize: 15 }}>Crea una para verla en Hoy.</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Progreso ─────────────── */
function Progress({ app, vm }) {
  const st = app.state;
  return (
    <div className="enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1 className="disp h-page" style={{ padding: '6px 4px 4px' }}>Progreso</h1>
      <div className="stats-grid">
        {vm.stats.map((s) => (
          <div key={s.label} className={'card' + (s.accent ? ' stat-accent' : '')} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label">{s.label}</span>
            <span className="disp" style={{ fontSize: 36, lineHeight: 1.05, fontWeight: 800 }}>{s.value}</span>
            <span style={{ fontSize: 13, opacity: 0.72 }}>{s.sub}</span>
          </div>
        ))}
        <section className="card consist" style={{ padding: '18px 16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}><span className="label">Constancia</span><span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>días activos por semana</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 6, alignItems: 'end', height: 128 }}>
            {vm.weeks8.map((k) => (
              <div key={k.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{k.count}</span>
                <span className={k.cls} style={{ height: k.height }} />
                <span className="muted" style={{ fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{k.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="seg-wrap mobile-only">
        <button className={'seg' + (st.progTab === 'lifts' ? ' on' : '')} onClick={() => app.set({ progTab: 'lifts' })}>Ejercicios</button>
        <button className={'seg' + (st.progTab === 'history' ? ' on' : '')} onClick={() => app.set({ progTab: 'history' })}>Historial</button>
      </div>
      <div className="prog-cols">
        <div className={'col' + (st.progTab === 'lifts' ? '' : ' hide-mobile')}>
          <span className="label desktop-only" style={{ padding: '0 4px' }}>Ejercicios · ahora vs antes</span>
          {vm.lifts.map((l) => (
            <article key={l.id} className="card" style={{ overflow: 'hidden' }}>
              <button className="row-btn" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }} aria-expanded={l.open} onClick={() => app.set({ openLift: l.open ? null : l.id })}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, width: '100%' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 17 }}>{l.name}</span><span className="muted" style={{ fontSize: 13 }}>{l.muscle}</span></span>
                  <span className={l.trendCls}>{l.trendTxt}</span>
                </span>
                <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, width: '100%' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span className="label">Anterior</span><span className="muted" style={{ fontSize: 16, fontWeight: 600 }}>{l.prev}</span></span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span className="label">Actual</span><span className="disp" style={{ fontSize: 21, fontWeight: 800 }}>{l.cur}</span></span>
                </span>
              </button>
              {l.open && (
                <div className="fade" style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <svg viewBox="0 0 300 66" width="100%" height="66" preserveAspectRatio="none" aria-hidden="true" style={{ overflow: 'visible' }}>
                    <polyline points={l.spark} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    <circle cx={l.lastX} cy={l.lastY} r="5" fill="var(--accent)" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span className="muted">Mejor · {l.sessions}</span><span style={{ fontWeight: 700 }}>{l.best}</span></div>
                  {l.recent.map((rs) => (
                    <div key={rs.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, paddingTop: 9, borderTop: '1px solid var(--line)' }}><span className="muted" style={{ flexShrink: 0 }}>{rs.date}</span><span style={{ textAlign: 'right' }}>{rs.sets}</span></div>
                  ))}
                </div>
              )}
            </article>
          ))}
          {vm.lifts.length === 0 && <div className="card muted" style={{ padding: 22, textAlign: 'center' }}>Termina un entreno para ver aquí tus levantamientos.</div>}
        </div>
        <div className={'col' + (st.progTab === 'history' ? '' : ' hide-mobile')}>
          <span className="label desktop-only" style={{ padding: '0 4px' }}>Historial</span>
          {vm.history.map((h) => (
            <article key={h.id} className="card" style={{ overflow: 'hidden' }}>
              <button className="row-btn" style={{ padding: '14px 16px 14px 14px', display: 'flex', alignItems: 'center', gap: 14 }} aria-expanded={h.open} onClick={() => app.set({ openHist: h.open ? null : h.id })}>
                <span style={{ width: 48, height: 48, borderRadius: 16, background: h.color, flexShrink: 0 }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{h.name}</span>
                  <span className="muted" style={{ fontSize: 13.5 }}>{h.date} · {h.meta}</span>
                </span>
                <span className="muted"><Icon name="down" size={20} /></span>
              </button>
              {h.open && (
                <div className="fade" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column' }}>
                  {h.exercises.map((he) => (
                    <div key={he.key} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0', borderTop: '1px solid var(--line)' }}><span style={{ fontWeight: 600, fontSize: 15 }}>{he.name}</span><span className="muted" style={{ fontSize: 13.5 }}>{he.sets}</span></div>
                  ))}
                  {h.notes && <p style={{ margin: '4px 0 8px', fontSize: 14, padding: '12px 14px', borderRadius: 16, background: 'var(--soft)' }}>{h.notes}</p>}
                  <button className="btn btn-danger" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => app.deleteHistoryItem(h)}><Icon name="trash" size={18} /> {h.delLabel}</button>
                </div>
              )}
            </article>
          ))}
          {vm.history.length === 0 && <div className="card muted" style={{ padding: 22, textAlign: 'center' }}>Aún no hay nada registrado.</div>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Ajustes ─────────────── */
function Settings({ app, vm }) {
  const P = app.state.db.profile;
  return (
    <div className="enter" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 620 }}>
      <h1 className="disp h-page" style={{ padding: '6px 4px 0' }}>Ajustes</h1>
      <Group label="Perfil">
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="tos-name" style={{ fontSize: 14, fontWeight: 600 }}>Nombre</label>
          <input id="tos-name" className="field" placeholder="Tu nombre" value={P.name} onChange={(e) => app.setProfile('name', e.target.value)} autoComplete="off" />
          <span className="muted" style={{ fontSize: 13.5 }}>{app.props.user.email}</span>
        </div>
      </Group>
      {vm.hasProgram && (
        <Group label="Programa">
          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}><span style={{ fontWeight: 600 }}>{vm.prog.week}</span><span className="muted" style={{ fontSize: 13.5 }}>{vm.prog.start}</span></span>
              <button className="mini-step" aria-label="Retrasar el inicio una semana" onClick={() => app.shiftProgram(1)}><Icon name="minus" size={18} /></button>
              <span className="disp" style={{ minWidth: 40, textAlign: 'center', fontSize: 19, fontWeight: 700 }}>{vm.prog.weekNum}</span>
              <button className="mini-step" aria-label="Adelantar el inicio una semana" onClick={() => app.shiftProgram(-1)}><Icon name="plus" size={18} /></button>
            </div>
            <span className="muted" style={{ fontSize: 13.5 }}>Usa − / + si vas una semana adelantada o atrasada.</span>
          </div>
        </Group>
      )}
      <Group label="Entrenamiento">
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontWeight: 600 }}>Unidades</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['kg', 'lb'].map((x) => <button key={x} className={'chip' + (P.units === x ? ' on' : '')} style={{ minWidth: 60, justifyContent: 'center' }} onClick={() => app.setProfile('units', x)}>{x}</button>)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 600 }}>Descanso por defecto</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {[[60, '1:00'], [75, '1:15'], [90, '1:30'], [120, '2:00']].map(([x, l]) => <button key={x} className={'chip' + (P.defaultRest === x ? ' on' : '')} style={{ justifyContent: 'center' }} onClick={() => app.setProfile('defaultRest', x)}>{l}</button>)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontWeight: 600 }}>Aviso de descanso</span><span className="muted" style={{ fontSize: 13.5 }}>Pitido + vibración al terminar el descanso</span></span>
            <button className={'toggle' + (P.sound ? ' on' : '')} role="switch" aria-checked={!!P.sound} aria-label="Aviso de descanso" onClick={() => app.setProfile('sound', !P.sound)}><span className="knob" /></button>
          </div>
        </div>
      </Group>
      <Group label="Apariencia">
        <div className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {[['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([x, l]) => <button key={x} className={'chip' + (P.theme === x ? ' on' : '')} style={{ justifyContent: 'center' }} onClick={() => app.setProfile('theme', x)}>{l}</button>)}
        </div>
      </Group>
      <Group label="Biblioteca">
        <button className="list-row" onClick={() => app.set({ sheet: 'library' })}><Icon name="dumbbell" /><span style={{ flexGrow: 1, fontWeight: 600 }}>Ejercicios</span><span className="muted" style={{ fontSize: 14 }}>{app.state.db.exercises.length} ejercicios</span><Icon name="chev" size={18} /></button>
        <button className="list-row" onClick={() => app.setTab('workouts')}><Icon name="cal" /><span style={{ flexGrow: 1, fontWeight: 600 }}>Rutinas</span><span className="muted" style={{ fontSize: 14 }}>{app.state.db.routines.length} rutinas</span><Icon name="chev" size={18} /></button>
      </Group>
      <Group label="Datos">
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="status ok"><Icon name="info" size={20} /><span>Guardado en tu cuenta — lo ves igual en el teléfono y en la computadora.</span></div>
          <span className="muted" style={{ fontSize: 14 }}>{vm.counts}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-line" onClick={app.resetProgram}>Restablecer programa</button>
            <button className="btn btn-danger" onClick={app.clearHistory}>Borrar historial</button>
            <button className="btn btn-line" onClick={app.props.onSignOut}><Icon name="logout" size={18} /> Cerrar sesión</button>
          </div>
        </div>
      </Group>
      <p className="muted" style={{ textAlign: 'center', fontSize: 13, margin: '6px 0 0' }}>Rutinas GYM · v0.4</p>
    </div>
  );
}
function Group({ label, children }) {
  return <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><span className="label" style={{ padding: '0 4px' }}>{label}</span>{children}</section>;
}

/* ─────────────── Entreno ─────────────── */
function Workout({ app, vm }) {
  const w = vm.w, ci = w.ci, st = app.state;
  return (
    <div className="workout fade">
      <header className="w-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="icon-btn" aria-label="Opciones del entreno" onClick={() => app.set({ sheet: 'menu' })}><Icon name="dots" /></button>
          <div style={{ flexGrow: 1, minWidth: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="label" style={{ color: 'var(--ink)' }}>{w.name}</span>
            <span className="muted" style={{ fontSize: 13.5, fontWeight: 600 }}>{w.pos}</span>
          </div>
          <span className="disp elapsed" aria-label="Tiempo transcurrido">{w.elapsed}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="bar-track" style={{ flexGrow: 1 }}><div className="bar-fill" style={{ width: w.progressPct + '%' }} /></div>
          <span className="muted" style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{w.progressTxt}</span>
        </div>
      </header>
      <div className="w-body">
        <div className="noscroll w-strip">
          {w.strip.map((s) => (
            <button key={s.key} className={s.cls} aria-label={s.aria} onClick={() => app.gotoEx(s.i)}><span className="ex-n">{s.n}</span><span className="ex-name">{s.name}</span></button>
          ))}
        </div>
        <div className="w-main" data-scroll="">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '2px 4px 0' }}>
            <h1 className="disp" style={{ margin: 0, fontSize: 36, lineHeight: 0.95, fontWeight: 800, textTransform: 'uppercase' }}>{w.ex.name}</h1>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="tag">{w.ex.spec}</span>
              <span className="tag"><Icon name="clock" size={15} />{w.ex.rest}</span>
              <span className="tag">{w.ex.muscle}</span>
              {w.ex.adj && <span className="tag" style={{ background: 'var(--accent)', color: '#17161B' }}>{w.ex.adj}</span>}
              {w.ex.hevy && <span className="tag">{w.ex.hevy}</span>}
            </div>
            {w.isSkipped && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 16px', borderRadius: 18, background: 'var(--soft)' }}>
                <span style={{ flexGrow: 1, fontWeight: 600, fontSize: 14 }}>Saltado</span>
                <button className="btn btn-ink" style={{ minHeight: 40 }} onClick={app.unskip}>Hacerlo igual</button>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="label">{w.prevLabel}</span>
              {w.prevSets ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{w.prevSets.map((p) => <span key={p.key} style={{ fontSize: 15.5, fontWeight: 600 }}>{p.txt}</span>)}</div>
              ) : <span className="muted" style={{ fontSize: 14.5, lineHeight: 1.35 }}>Sin datos previos — es tu primera vez.</span>}
            </div>
            <div className="card" style={{ padding: '14px 16px', background: 'var(--accent)', color: '#17161B', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="label" style={{ color: '#17161B', opacity: 0.65 }}>Objetivo de hoy</span>
              <span className="disp" style={{ fontSize: 28, lineHeight: 1, fontWeight: 800 }}>{w.targetW}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{w.targetR}</span>
              <span style={{ fontSize: 13, lineHeight: 1.35, opacity: 0.78 }}>{w.reason}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <a className="video-btn" href={w.video} target="_blank" rel="noopener noreferrer"><PlayIcon />{w.videoLabel}</a>
            {w.ex.how && <button className={'how-btn' + (w.showHow ? ' on' : '')} aria-expanded={w.showHow} onClick={() => app.set({ showHow: !st.showHow })}><Icon name="info" size={18} /> Técnica</button>}
          </div>
          {w.showHow && w.ex.how && <p className="fade note-box">{w.ex.how}</p>}
          {w.ex.note && <p className="note-box"><strong>Nota · </strong>{w.ex.note}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {w.sets.map((s) => <SetRow key={s.key} app={app} s={s} ci={ci} unit={vm.unit} stepLabel={w.stepLabel} />)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <button className="btn btn-line" onClick={() => app.addSet(ci)}><Icon name="plus" size={18} /> Agregar serie</button>
              <button className="btn btn-line" onClick={() => app.removeSet(ci)}><Icon name="minus" size={18} /> Quitar serie</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            <button className="tool" onClick={app.skipEx}><Icon name="skip" />Saltar</button>
            <button className="tool" onClick={() => app.openPicker('swap')}><Icon name="swap" />Cambiar</button>
            <button className="tool" onClick={() => app.openPicker('add')}><Icon name="plus" />Agregar</button>
            <button className="tool" onClick={() => app.set({ sheet: 'notes' })}><Icon name="note" />Notas</button>
          </div>
        </div>
        <div className="w-dock">
          {w.resting && (
            <div className="rest enter" role="timer" aria-live="off">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="label" style={{ color: 'var(--accent)' }}>Descanso</span>
                  <span className="disp" style={{ fontSize: 60, fontWeight: 800, lineHeight: 0.95, letterSpacing: '-.04em' }}>{w.restClock}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-soft" onClick={app.restPlus}>+30 s</button>
                  <button className="btn btn-accent" style={{ minWidth: 88 }} onClick={app.restSkip}>Saltar</button>
                </div>
              </div>
              <div className="bar-track"><div className="bar-fill" style={{ width: w.restPct + '%', transition: 'width .25s linear' }} /></div>
              <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.78 }}>{w.restNext}</span>
            </div>
          )}
          {w.restDone && (
            <div className="go pop" role="status">
              <Shape name="BURST" fill="#17161B" size={52} style={{ flexShrink: 0 }} />
              <span style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}><span className="disp" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>¡Listo — a darle!</span><span style={{ fontSize: 14, fontWeight: 600, opacity: 0.75, marginTop: 4 }}>{w.restNext}</span></span>
              <button className="icon-btn" style={{ background: 'rgba(23,22,27,.1)' }} aria-label="Cerrar" onClick={app.restSkip}><Icon name="x" size={20} /></button>
            </div>
          )}
          <button className={w.cta.cls} onClick={app.ctaAction}>
            <span style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}><span style={{ fontSize: 19, fontWeight: 700 }}>{w.cta.label}</span><span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>{w.cta.sub}</span></span>
            <span className="cta-ic"><Icon name={w.cta.kind === 'complete' ? 'check' : 'arrow'} size={26} sw={2.8} /></span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SetRow({ app, s, ci, unit, stepLabel }) {
  if (s.state === 'active') {
    return (
      <div className="set-card enter">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
          <span className="disp" style={{ fontSize: 22, fontWeight: 800 }}>{s.label} <span className="muted" style={{ fontSize: 16, fontWeight: 600 }}>{s.of}</span></span>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{stepLabel}</span>
        </div>
        <Stepper label={'Peso · ' + unit} aria={'Peso en ' + unit} value={s.wVal} mode="decimal"
          onMinus={() => app.step(ci, s.i, 'w', -1)} onPlus={() => app.step(ci, s.i, 'w', 1)} onChange={(v) => app.typeW(ci, s.i, v)} />
        <Stepper label="Reps" aria="Reps" value={s.rVal} mode="numeric"
          onMinus={() => app.step(ci, s.i, 'r', -1)} onPlus={() => app.step(ci, s.i, 'r', 1)} onChange={(v) => app.typeR(ci, s.i, v)} />
      </div>
    );
  }
  if (s.state === 'done') {
    return (
      <div className="set-done pop">
        <span className="chk"><Icon name="check" size={24} sw={2.8} /></span>
        <span style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.62, letterSpacing: '.04em' }}>{s.label} · {s.time}</span>
          <span className="disp" style={{ fontSize: 20, fontWeight: 700 }}>{s.txt}</span>
        </span>
        {s.pr && <span className="pr">PR</span>}
        <button className="icon-btn" aria-label={'Deshacer ' + s.label} onClick={() => app.undoSet(ci, s.i)}><Icon name="undo" size={20} /></button>
      </div>
    );
  }
  return (
    <button className="set-pending" onClick={() => app.focusSet(ci, s.i)}>
      <span className="muted" style={{ fontSize: 14, fontWeight: 700, width: 56, flexShrink: 0 }}>{s.label}</span>
      <span style={{ fontSize: 17, fontWeight: 600, flexGrow: 1 }}>{s.txt}</span>
      <span className="muted"><Icon name="pencil" size={18} /></span>
    </button>
  );
}

function Stepper({ label, aria, value, mode, onMinus, onPlus, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="label" style={{ padding: '0 4px' }}>{label}</span>
      <div className="stepper">
        <button className="step-btn" aria-label={'Menos ' + aria.toLowerCase()} onClick={onMinus}><Icon name="minus" size={26} sw={2.6} /></button>
        <input className="step-in" type="text" inputMode={mode} aria-label={aria} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
        <button className="step-btn" aria-label={'Más ' + aria.toLowerCase()} onClick={onPlus}><Icon name="plus" size={26} sw={2.6} /></button>
      </div>
    </div>
  );
}

/* ─────────────── Resumen ─────────────── */
function Complete({ app, vm }) {
  const s = vm.sum;
  return (
    <div className="complete fade">
      <div className="complete-inner">
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
          <Shape name="BURST" fill="#17161B" size={132} style={{ alignSelf: 'flex-start', marginBottom: 10 }} />
          <span className="label" style={{ color: '#17161B', opacity: 0.6 }}>{s.date}</span>
          <h1 className="disp" style={{ margin: 0, fontSize: 54, lineHeight: 0.88, fontWeight: 800, textTransform: 'uppercase' }}>Entreno<br />completo</h1>
          <p style={{ margin: '8px 0 0', fontSize: 19, fontWeight: 700 }}>{s.name}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {[['Duración', s.duration], ['Ejercicios', s.exercises], ['Series', s.sets], ['Volumen', s.volume]].map(([l, v]) => (
            <div key={l} className="sum-tile"><span className="label" style={{ color: '#17161B', opacity: 0.6 }}>{l}</span><span className="disp" style={{ fontSize: l === 'Volumen' ? 26 : 32, fontWeight: 800, lineHeight: 1.25 }}>{v}</span></div>
          ))}
        </div>
        <div style={{ padding: 18, borderRadius: 24, background: '#17161B', color: '#F4EFE7', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="label" style={{ color: 'var(--accent)' }}>Récords personales</span>
          {s.prs.length ? s.prs.map((p) => (
            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 16 }}><span style={{ fontWeight: 600 }}>{p.name}</span><span className="disp" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{p.txt}</span></div>
          )) : <span style={{ fontSize: 15, opacity: 0.8 }}>Sin récords hoy — presentarte ya es ganar.</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="tos-sum-note" className="label" style={{ color: '#17161B', opacity: 0.65, padding: '0 4px' }}>Notas</label>
          <textarea id="tos-sum-note" className="field" style={{ background: 'rgba(255,255,255,.65)', color: '#17161B', boxShadow: 'none' }} placeholder="¿Cómo te sentiste?" value={s.notes} onChange={(e) => app.summaryNote(e.target.value)} />
        </div>
        <button className="cta" style={{ background: '#17161B', color: '#F4EFE7', marginTop: 4 }} onClick={app.doneSummary}><span style={{ flexGrow: 1, fontSize: 19, fontWeight: 700 }}>Listo</span><span className="cta-ic" style={{ background: 'var(--accent)', color: '#17161B' }}><Icon name="check" size={26} sw={2.8} /></span></button>
        <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, opacity: 0.6 }}>{app.state.saving ? 'Guardando en tu cuenta…' : 'Guardado en tu historial'}</span>
      </div>
    </div>
  );
}

/* ─────────────── Hojas ─────────────── */
function Sheet({ title, onClose, tall, children, wide }) {
  return (
    <div className="scrim">
      <div className={'sheet' + (tall ? ' tall' : '') + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 20px 12px', flexShrink: 0 }}>
          <h2 className="disp" style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{title}</h2>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Sheets({ app, vm }) {
  const st = app.state, close = () => app.set({ sheet: null, picker: null, act: null });
  const a = st.db.active;
  if (st.sheet === 'menu' && a && vm.w) {
    return (
      <Sheet title="Opciones del entreno" onClose={close}>
        <div className="sheet-body">
          <button className="cta cta-accent" onClick={app.finish}><span style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}><span style={{ fontSize: 18, fontWeight: 700 }}>Terminar y guardar</span><span style={{ fontSize: 14, opacity: 0.7, fontWeight: 600 }}>{vm.w.progressTxt} registradas</span></span><span className="cta-ic"><Icon name="check" size={24} sw={2.6} /></span></button>
          <button className="list-row" onClick={app.leave}><Icon name="arrow" size={20} style={{ transform: 'rotate(180deg)' }} /><span style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}><span style={{ fontWeight: 600 }}>Salir por ahora</span><span className="muted" style={{ fontSize: 13.5 }}>Sigue abierto — continúa desde Hoy</span></span></button>
          <button className="list-row" style={{ color: 'var(--danger)' }} onClick={app.discard}><Icon name="trash" size={20} /><span style={{ fontWeight: 600, flexGrow: 1 }}>Descartar entreno</span></button>
        </div>
      </Sheet>
    );
  }
  if (st.sheet === 'notes' && a && vm.w) {
    return (
      <Sheet title="Notas" onClose={close}>
        <div className="sheet-body">
          <label htmlFor="tos-ex-note" style={{ fontWeight: 600, fontSize: 14 }}>{vm.w.ex.name}</label>
          <textarea id="tos-ex-note" className="field" placeholder="Altura del asiento, agarre, cómo se sintió…" value={vm.w.ex.note} onChange={(e) => app.exNote(e.target.value)} />
          <label htmlFor="tos-w-note" style={{ fontWeight: 600, fontSize: 14 }}>Todo el entreno</label>
          <textarea id="tos-w-note" className="field" placeholder="Energía, sueño, algo que quieras recordar" value={vm.w.notes} onChange={(e) => app.workoutNote(e.target.value)} />
          <button className="btn btn-ink" style={{ minHeight: 56 }} onClick={close}>Listo</button>
        </div>
      </Sheet>
    );
  }
  if (st.sheet === 'picker' && st.picker) {
    const p = vm.picker;
    return (
      <Sheet title={p.title} onClose={close} tall>
        <div style={{ padding: '0 20px 12px', flexShrink: 0, position: 'relative' }}>
          <span className="muted" style={{ position: 'absolute', left: 36, top: 15 }}><Icon name="search" size={20} /></span>
          <input className="field" style={{ paddingLeft: 48 }} placeholder="Buscar o crear" aria-label="Buscar ejercicios" value={p.query} onChange={(e) => app.pickerQuery(e.target.value)} autoComplete="off" autoFocus />
        </div>
        <div className="sheet-body" style={{ gap: 8 }}>
          {p.canCreate && <button className="list-row" style={{ background: 'var(--accent)', color: '#17161B' }} onClick={() => app.createExercise(p.createName)}><Icon name="plus" size={20} /><span style={{ fontWeight: 700 }}>Crear “{p.createName}”</span></button>}
          {p.results.map((r) => (
            <button key={r.id} className="list-row" onClick={() => app.pickExercise(r.id)}><span style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}><span style={{ fontWeight: 600 }}>{r.name}</span><span className="muted" style={{ fontSize: 13.5 }}>{r.meta}</span></span><Icon name="plus" size={20} /></button>
          ))}
        </div>
      </Sheet>
    );
  }
  if (st.sheet === 'library') {
    return (
      <Sheet title="Ejercicios" onClose={close} tall>
        <div className="sheet-body" style={{ gap: 8 }}>
          <button className="btn btn-ink" style={{ minHeight: 52 }} onClick={app.newLibraryExercise}><Icon name="plus" size={20} /> Nuevo ejercicio</button>
          {vm.library.map((x) => (
            <div key={x.id} className="card" style={{ borderRadius: 22, overflow: 'hidden' }}>
              <button className="row-btn" style={{ minHeight: 60, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }} aria-expanded={x.open} onClick={() => app.set({ openExercise: x.open ? null : x.id })}>
                <span style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}><span style={{ fontWeight: 600 }}>{x.name}</span><span className="muted" style={{ fontSize: 13.5 }}>{x.meta}</span></span><Icon name="pencil" size={18} />
              </button>
              {x.open && (
                <div className="fade" style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input className="field" aria-label="Nombre del ejercicio" value={x.name} onChange={(e) => app.updExercise(x.id, 'name', e.target.value)} autoComplete="off" />
                  <span className="label">Grupo muscular</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{MUSCLES.map((m) => <button key={m} className={'chip sm' + (x.muscleGroup === m ? ' on' : '')} onClick={() => app.updExercise(x.id, 'muscleGroup', m)}>{m}</button>)}</div>
                  <span className="label">Equipo</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{EQUIPMENT.map((m) => <button key={m} className={'chip sm' + (x.equipment === m ? ' on' : '')} onClick={() => app.updExercise(x.id, 'equipment', m)}>{m}</button>)}</div>
                  <textarea className="field" aria-label="Técnica" placeholder="Indicaciones de técnica" value={x.instructions} onChange={(e) => app.updExercise(x.id, 'instructions', e.target.value)} style={{ minHeight: 76 }} />
                  <span className="label">Video</span>
                  <input className="field" aria-label="Link de video" placeholder="Pega un link de YouTube (opcional)" value={x.videoUrl} onChange={(e) => app.updExercise(x.id, 'videoUrl', e.target.value.trim())} autoComplete="off" />
                  <a className="video-btn" style={{ alignSelf: 'flex-start' }} href={x.video} target="_blank" rel="noopener noreferrer"><PlayIcon />Ver video</a>
                  <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => app.deleteExercise(x.id)}><Icon name="trash" size={18} /> Borrar ejercicio</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Sheet>
    );
  }
  if (st.sheet === 'activity' && st.act) {
    const A = st.act;
    return (
      <Sheet title="Registrar actividad" onClose={close} tall>
        <div className="sheet-body" style={{ gap: 14 }}>
          <span className="muted" style={{ fontSize: 14, marginTop: -6 }}>Los entrenos de gym cuentan solos — esto es para todo lo demás.</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {ACTIVITIES.map((t) => (
              <button key={t.id} className={'act-btn' + (A.type === t.id ? ' on' : '')} aria-pressed={A.type === t.id} onClick={() => app.actUpdate({ type: t.id })}>
                <Shape name="FLOWER" fill={t.color} size={36} style={{ flexShrink: 0 }} /><span>{t.name}</span>
              </button>
            ))}
          </div>
          <span className="label" style={{ marginTop: 4 }}>Duración</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="step-btn" aria-label="5 minutos menos" onClick={() => app.actUpdate({ duration: Math.max(5, A.duration - 5) })}><Icon name="minus" size={24} sw={2.6} /></button>
            <span className="disp" style={{ flexGrow: 1, textAlign: 'center', fontSize: 32, fontWeight: 800 }}>{A.duration} min</span>
            <button className="step-btn" aria-label="5 minutos más" onClick={() => app.actUpdate({ duration: Math.min(600, A.duration + 5) })}><Icon name="plus" size={24} sw={2.6} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
            {[15, 30, 45, 60, 90].map((m) => <button key={m} className={'chip' + (A.duration === m ? ' on' : '')} style={{ justifyContent: 'center', padding: 0 }} onClick={() => app.actUpdate({ duration: m })}>{m}</button>)}
          </div>
          <span className="label" style={{ marginTop: 4 }}>Cuándo</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            {[['Hoy', 0], ['Ayer', 1]].map(([l, d]) => <button key={d} className={'chip' + (A.day === d ? ' on' : '')} style={{ justifyContent: 'center' }} onClick={() => app.actUpdate({ day: d })}>{l}</button>)}
          </div>
          <label htmlFor="tos-act-note" className="label" style={{ marginTop: 4 }}>Notas</label>
          <textarea id="tos-act-note" className="field" style={{ minHeight: 76 }} placeholder="Distancia, clase, cómo te sentiste (opcional)" value={A.notes} onChange={(e) => app.actUpdate({ notes: e.target.value })} />
          <button className="cta cta-ink" style={{ marginTop: 4 }} onClick={app.saveActivity}>
            <span style={{ flexGrow: 1, fontSize: 18, fontWeight: 700 }}>{A.type ? 'Registrar ' + actType(A.type).name.toLowerCase() : 'Elige una actividad'}</span>
            <span className="cta-ic"><Icon name="check" size={24} sw={2.8} /></span>
          </button>
        </div>
      </Sheet>
    );
  }
  return null;
}

function Editor({ app, vm }) {
  const ed = vm.ed, raw = app.state.editor;
  return (
    <div className="scrim" style={{ zIndex: 35 }}>
      <div className="sheet tall wide" role="dialog" aria-modal="true" aria-label={ed.title}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 12px', flexShrink: 0 }}>
          <button className="icon-btn" aria-label="Cancelar" onClick={() => app.set({ editor: null })}><Icon name="x" size={20} /></button>
          <h2 className="disp" style={{ margin: 0, fontSize: 24, fontWeight: 800, flexGrow: 1 }}>{ed.title}</h2>
          <button className="btn btn-ink" onClick={app.saveEditor}>Guardar</button>
        </div>
        <div className="sheet-body" style={{ gap: 14, paddingBottom: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="tos-ed-name" className="label">Nombre</label>
            <input id="tos-ed-name" className="field disp" style={{ fontSize: 22, fontWeight: 700 }} placeholder="p. ej. Lower C" value={ed.name} onChange={(e) => { const v = e.target.value; app.editorUpdate((x) => { x.name = v; }); }} autoComplete="off" />
            <input className="field" aria-label="Descripción" placeholder="Descripción corta (opcional)" value={ed.desc} onChange={(e) => { const v = e.target.value; app.editorUpdate((x) => { x.description = v; }); }} autoComplete="off" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="label">Día</span>
            <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {[null, 1, 2, 3, 4, 5, 6, 0].map((d) => <button key={String(d)} className={'chip sm' + (raw.scheduledDay === d ? ' on' : '')} onClick={() => app.editorUpdate((x) => { x.scheduledDay = d; })}>{d == null ? 'Cualquiera' : DAY3[d]}</button>)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="label">Color</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PALETTE.map((c) => <button key={c} className={'swatch-btn' + (raw.color === c ? ' on' : '')} style={{ background: c }} aria-label={'Color ' + c} aria-pressed={raw.color === c} onClick={() => app.editorUpdate((x) => { x.color = c; })} />)}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}><span className="label">Ejercicios</span><span className="muted" style={{ fontSize: 13.5, fontWeight: 600 }}>{ed.duration}</span></div>
          {ed.items.length === 0 && <div className="muted" style={{ padding: 18, borderRadius: 20, boxShadow: 'inset 0 0 0 1.5px var(--line)', textAlign: 'center', fontSize: 15 }}>Aún no hay ejercicios.</div>}
          {ed.items.map((it) => (
            <div key={it.key} className="card" style={{ borderRadius: 22, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 8px 14px' }}>
                <button className="row-btn" style={{ flexGrow: 1, minWidth: 0, minHeight: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: 0 }} aria-expanded={it.open} onClick={() => app.editorUpdate((x) => { x.open = x.open === it.i ? null : it.i; })}>
                  <span style={{ fontWeight: 700, fontSize: 15.5 }}>{it.n} · {it.name}</span><span className="muted" style={{ fontSize: 13 }}>{it.spec}</span>
                </button>
                <button className="mini-step" aria-label={'Subir ' + it.name} onClick={() => app.editorMove(it.i, -1)}><Icon name="up" size={18} /></button>
                <button className="mini-step" aria-label={'Bajar ' + it.name} onClick={() => app.editorMove(it.i, 1)}><Icon name="down" size={18} /></button>
              </div>
              {it.open && (
                <div className="fade" style={{ padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {it.fields.map((f) => (
                    <div key={f.k} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                      <span style={{ flexGrow: 1, fontSize: 14.5, fontWeight: 600 }}>{f.label}</span>
                      <button className="mini-step" aria-label={'Menos ' + f.label} onClick={() => (f.k === 'targetWeight' ? app.editorWeight(it.i, -1, it.step) : app.editorBump(it.i, f.k, -f.d, f.min, f.max))}><Icon name="minus" size={18} /></button>
                      <span className="disp" style={{ minWidth: 56, textAlign: 'center', fontSize: 19, fontWeight: 700 }}>{f.val}</span>
                      <button className="mini-step" aria-label={'Más ' + f.label} onClick={() => (f.k === 'targetWeight' ? app.editorWeight(it.i, 1, it.step) : app.editorBump(it.i, f.k, f.d, f.min, f.max))}><Icon name="plus" size={18} /></button>
                    </div>
                  ))}
                  <button className="btn btn-danger" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => app.editorUpdate((x) => { x.exercises.splice(it.i, 1); x.open = null; })}><Icon name="trash" size={18} /> Quitar</button>
                </div>
              )}
            </div>
          ))}
          <button className="btn btn-line" style={{ minHeight: 56 }} onClick={() => app.openPicker('editor')}><Icon name="plus" size={20} /> Agregar ejercicio</button>
        </div>
      </div>
    </div>
  );
}

function Confirm({ app }) {
  const C = app.state.confirm;
  return (
    <div className="scrim" style={{ zIndex: 55, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card pop" role="alertdialog" aria-modal="true" aria-label={C.title} style={{ width: '100%', maxWidth: 360, padding: 24, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}>
        <h2 className="disp" style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{C.title}</h2>
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 15.5, lineHeight: 1.45 }}>{C.body}</p>
        <button className={C.danger ? 'btn btn-danger-fill' : 'btn btn-ink'} style={{ minHeight: 54 }} onClick={() => { const fn = C.action; app.set({ confirm: null }); fn(); }}>{C.yes}</button>
        <button className="btn" style={{ minHeight: 54 }} onClick={() => app.set({ confirm: null })}>Cancelar</button>
      </div>
    </div>
  );
}
