import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'

const withdrawalDays = [8, 18, 28]
const withdrawalOptions = [100, 360, 900, 2000, 10000, 15000, 30000]

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Page = 'home' | 'projections' | 'holidays' | 'help'

const navItems: { page: Page; icon: string; title: string; hint: string }[] = [
  { page: 'home', icon: '⌂', title: 'Inicio', hint: 'Resumen y calendario' },
  { page: 'projections', icon: '↗', title: 'Proyecciones', hint: 'Próximos retiros y metas' },
  { page: 'holidays', icon: '▣', title: 'Feriados', hint: 'Fechas especiales' },
  { page: 'help', icon: '?', title: 'Ayuda', hint: 'Cómo usar la aplicación' },
]

const pageTitles: Record<Exclude<Page, 'home'>, [string, string]> = {
  projections: ['Tus proyecciones', 'Compara tus próximos retiros y el saldo que quedaría.'],
  holidays: ['Feriados', 'Consulta y administra las fechas que no cuentan como jornadas de trabajo.'],
  help: ['Centro de ayuda', 'Guía rápida para planificar tus retiros.'],
}

type Holiday = {
  date: string
  name: string
  type: 'national' | 'custom'
}

type Projection = {
  date: Date
  balanceBefore: number
  withdrawal: number
  remaining: number
  workdays: number
  reservedDays: number
  effectiveDays: number
  goal: number | null
  balanceAfterExtraWeek: number
  nextGoal: number | null
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function money(value: number) {
  return value.toLocaleString('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1

  return new Date(year, month - 1, day)
}

function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function makeKey(date: Date) {
  return dateKey(date.getFullYear(), date.getMonth(), date.getDate())
}

function getNationalHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)

  const fixed: [number, number, string][] = [
    [1, 1, 'Año Nuevo'],
    [5, 1, 'Día del Trabajo'],
    [6, 7, 'Batalla de Arica y Día de la Bandera'],
    [6, 29, 'San Pedro y San Pablo'],
    [7, 23, 'Día de la Fuerza Aérea del Perú'],
    [7, 28, 'Fiestas Patrias'],
    [7, 29, 'Fiestas Patrias'],
    [8, 6, 'Batalla de Junín'],
    [8, 30, 'Santa Rosa de Lima'],
    [10, 8, 'Combate de Angamos'],
    [11, 1, 'Día de Todos los Santos'],
    [12, 8, 'Inmaculada Concepción'],
    [12, 9, 'Batalla de Ayacucho'],
    [12, 25, 'Navidad'],
  ]

  return [
    ...fixed.map(([month, day, name]) => ({
      date: dateKey(year, month - 1, day),
      name,
      type: 'national' as const,
    })),
    {
      date: makeKey(addDays(easter, -3)),
      name: 'Jueves Santo',
      type: 'national' as const,
    },
    {
      date: makeKey(addDays(easter, -2)),
      name: 'Viernes Santo',
      type: 'national' as const,
    },
  ]
}

function getUpcomingWithdrawals(today: Date, count = 3) {
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const dates: Date[] = []

  for (let offset = 0; offset < 13; offset++) {
    const monthDate = new Date(
      today.getFullYear(),
      today.getMonth() + offset,
      1,
    )

    for (const day of withdrawalDays) {
      const date = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        day,
      )
      if (date >= todayStart) dates.push(date)
    }
  }

  return dates
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, count)
}

function getMondayKey(date: Date) {
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return makeKey(monday)
}

function countReservedDays(keys: string[]) {
  return new Set(keys.map((key) => {
    const [year, month, day] = key.split('-').map(Number)
    return getMondayKey(new Date(year, month - 1, day))
  })).size
}

function highestGoal(balance: number) {
  return [...withdrawalOptions]
    .reverse()
    .find((goal) => balance >= goal) ?? null
}

function App() {
  const today = new Date()
  const todayKey = makeKey(today)

  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [initialBalance, setInitialBalance] = useState('')
  const [dailyEarning, setDailyEarning] = useState('')
  const [conservative, setConservative] = useState(false)

  const [holidayName, setHolidayName] = useState('')
  const [holidayDate, setHolidayDate] = useState('')
  const [showHolidayForm, setShowHolidayForm] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activePage, setActivePage] = useState<Page>('home')
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [calcDisplay, setCalcDisplay] = useState('0')
  const [calcStored, setCalcStored] = useState<number | null>(null)
  const [calcOperator, setCalcOperator] = useState<string | null>(null)
  const [calcNewNumber, setCalcNewNumber] = useState(false)

  const [customHolidays, setCustomHolidays] = useState<Holiday[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('retirosmart-holidays') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(
      'retirosmart-holidays',
      JSON.stringify(customHolidays),
    )
  }, [customHolidays])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7

  const holidays = useMemo(() => {
    const national: Holiday[] = []
    for (let y = year - 1; y <= year + 2; y++) {
      national.push(...getNationalHolidays(y))
    }

    const merged = [...national, ...customHolidays]
    return Array.from(
      new Map(merged.map((holiday) => [holiday.date, holiday])).values(),
    )
  }, [year, customHolidays])

  const holidayMap = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.date, holiday])),
    [holidays],
  )

  const startingBalance = Math.max(0, Number(initialBalance) || 0)
  const earning = Math.max(0, Number(dailyEarning) || 0)

  const selectedThisMonth = selectedDays.filter((key) =>
    key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}-`),
  ).length

  const eligibleDays = selectedDays.filter(
    (key) => key >= todayKey && !holidayMap.has(key),
  )

  const generalReservedDays = conservative
    ? Math.min(eligibleDays.length, countReservedDays(eligibleDays))
    : 0

  const generalEffectiveDays = Math.max(
    0,
    eligibleDays.length - generalReservedDays,
  )

  const projectedBalance = startingBalance + earning * generalEffectiveDays
  const upcomingWithdrawals = getUpcomingWithdrawals(today)

  function countEffectiveDays(keys: string[]) {
    const reserved = conservative
      ? Math.min(keys.length, countReservedDays(keys))
      : 0

    return Math.max(0, keys.length - reserved)
  }

  const projections = useMemo(() => {
    const result: Projection[] = []
    let balance = startingBalance
    let previousDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    )

    for (const date of upcomingWithdrawals) {
      const daysSincePrevious = eligibleDays.filter(
        (key) => key > makeKey(previousDate) && key <= makeKey(date),
      )

      const newEarnings = earning * countEffectiveDays(daysSincePrevious)
      const balanceBefore = balance + newEarnings
      const goal = highestGoal(balanceBefore)
      const withdrawal = goal ?? 0
      const remaining = balanceBefore - withdrawal

      const extraWeekEnd = addDays(date, 7)
      const extraWeekDays = eligibleDays.filter(
        (key) => key > makeKey(date) && key <= makeKey(extraWeekEnd),
      )

      const balanceAfterExtraWeek =
        remaining + earning * countEffectiveDays(extraWeekDays)

      const nextGoal =
        withdrawalOptions.find(
          (option) =>
            option > withdrawal && option <= balanceAfterExtraWeek,
        ) ?? null

      const cumulativeKeys = eligibleDays.filter(
        (key) => key <= makeKey(date),
      )

      const reservedDays = conservative
        ? Math.min(cumulativeKeys.length, countReservedDays(cumulativeKeys))
        : 0

      result.push({
        date,
        balanceBefore,
        withdrawal,
        remaining,
        workdays: daysSincePrevious.length,
        reservedDays,
        effectiveDays: countEffectiveDays(daysSincePrevious),
        goal,
        balanceAfterExtraWeek,
        nextGoal,
      })

      balance = remaining
      previousDate = date
    }

    return result
  }, [
    startingBalance,
    earning,
    conservative,
    eligibleDays,
    upcomingWithdrawals,
  ])

  function changeMonth(direction: number) {
    const newDate = new Date(year, month + direction, 1)
    setMonth(newDate.getMonth())
    setYear(newDate.getFullYear())
  }

  function toggleDay(day: number) {
    const key = dateKey(year, month, day)
    if (holidayMap.has(key) || key < todayKey) return

    setSelectedDays((previous) =>
      previous.includes(key)
        ? previous.filter((date) => date !== key)
        : [...previous, key],
    )
  }

  function addCustomHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = holidayName.trim()
    if (!name || !holidayDate) return

    if (holidayMap.has(holidayDate)) {
      alert('Ya existe un feriado registrado para esa fecha.')
      return
    }

    setCustomHolidays((previous) => [
      ...previous,
      { date: holidayDate, name, type: 'custom' },
    ])

    setSelectedDays((previous) =>
      previous.filter((key) => key !== holidayDate),
    )

    setHolidayName('')
    setHolidayDate('')
    setShowHolidayForm(false)
  }

  function removeCustomHoliday(date: string) {
    setCustomHolidays((previous) =>
      previous.filter((holiday) => holiday.date !== date),
    )
  }

  function clearCurrentMonth() {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    setSelectedDays((previous) =>
      previous.filter((key) => !key.startsWith(prefix)),
    )
  }

  function formatHolidayDate(key: string) {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function goToPage(page: Page) {
    setActivePage(page)
    setDrawerOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function calculatorInput(value: string) {
    if (calcNewNumber || calcDisplay === '0' || calcDisplay === 'Error') {
      setCalcDisplay(value === '.' ? '0.' : value)
      setCalcNewNumber(false)
    } else if (value !== '.' || !calcDisplay.includes('.')) {
      setCalcDisplay(calcDisplay + value)
    }
  }

  function calculate(a: number, b: number, operator: string) {
    if (operator === '+') return a + b
    if (operator === '−') return a - b
    if (operator === '×') return a * b
    if (operator === '÷') return b === 0 ? NaN : a / b
    return b
  }

  function calculatorOperator(operator: string) {
    const current = Number(calcDisplay)

    if (calcOperator && calcStored !== null && !calcNewNumber) {
      const next = calculate(calcStored, current, calcOperator)
      setCalcStored(next)
      setCalcDisplay(String(next))
    } else {
      setCalcStored(current)
    }

    setCalcOperator(operator)
    setCalcNewNumber(true)
  }

  function calculatorEquals() {
    if (calcStored === null || !calcOperator) return

    const result = calculate(
      calcStored,
      Number(calcDisplay),
      calcOperator,
    )

    setCalcDisplay(Number.isFinite(result) ? String(result) : 'Error')
    setCalcStored(null)
    setCalcOperator(null)
    setCalcNewNumber(true)
  }

  function calculatorClear() {
    setCalcDisplay('0')
    setCalcStored(null)
    setCalcOperator(null)
    setCalcNewNumber(false)
  }

  function calculatorPercent() {
    setCalcDisplay(String(Number(calcDisplay) / 100))
    setCalcNewNumber(true)
  }

  const monthHolidays = holidays
    .filter((holiday) =>
      holiday.date.startsWith(
        `${year}-${String(month + 1).padStart(2, '0')}-`,
      ),
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  const nextProjection = projections[0]

  return (
    <main className={`app page-${activePage}`}>
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon">R</span>
          <span>
            Retiro<span className="brand-accent">Smart</span>
          </span>
        </a>

        <div className="topbar-actions">
          <span className="today-label">
            {today.toLocaleDateString('es-PE', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          <button
            className="menu-button"
            type="button"
            aria-label={drawerOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <span aria-hidden="true">{drawerOpen ? '×' : '☰'}</span>
            <span className="menu-button-label">Menú</span>
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <nav
            className="app-drawer"
            aria-label="Navegación principal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-heading">
              <div>
                <strong>RetiroSmart</strong>
                <small>Menú principal</small>
              </div>
              <button
                type="button"
                className="drawer-close"
                aria-label="Cerrar menú"
                onClick={() => setDrawerOpen(false)}
              >
                ×
              </button>
            </div>

            {navItems.map((item) => (
              <button
                key={item.page}
                type="button"
                className={`drawer-link ${activePage === item.page ? 'active' : ''}`}
                onClick={() => goToPage(item.page)}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            ))}

            <p className="drawer-note">Tus cálculos se basan en los datos que ingresas. Son estimaciones, no retiros reales.</p>
          </nav>
        </div>
      )}

      {activePage !== 'home' && (
        <section className="page-heading">
          <p className="eyebrow">RETIROSMART</p>
          <h1>{pageTitles[activePage][0]}</h1>
          <p>{pageTitles[activePage][1]}</p>
        </section>
      )}

      <section className="welcome" id="inicio">
        <div className="welcome-content">
          <p className="eyebrow">TU PLANIFICADOR FINANCIERO</p>
          <h1>Tu dinero, más claro</h1>
          <p className="subtitle">
            Configura tu saldo, organiza tus jornadas y revisa cuánto podrías retirar.
          </p>
        </div>
        <div className="welcome-icon" aria-hidden="true">↗</div>
      </section>

      <section className="finance-layout">
        <article className="finance-panel">
          <div className="finance-panel-head">
            <span className="finance-panel-icon" aria-hidden="true">S/</span>
            <div>
              <p className="eyebrow">TU PUNTO DE PARTIDA</p>
              <h2>Tu saldo y tus ganancias</h2>
            </div>
          </div>
          <p className="subtitle">
            Completa estos dos datos y tu proyección se calcula sola.
          </p>

          <div className="finance-fields">
            <label>
              <span className="field-label">Saldo actual</span>
              <span className="money-input">
                <span className="money-prefix">S/</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={initialBalance}
                  onChange={(event) => setInitialBalance(event.target.value)}
                />
              </span>
              <small className="field-hint">Lo que tienes hoy disponible.</small>
            </label>

            <label>
              <span className="field-label">Ganancia diaria</span>
              <span className="money-input">
                <span className="money-prefix">S/</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={dailyEarning}
                  onChange={(event) => setDailyEarning(event.target.value)}
                />
              </span>
              <small className="field-hint">Lo que ganas en un día de trabajo.</small>
            </label>
          </div>

          <label className="conservative-toggle">
            <input
              className="conservative-input"
              type="checkbox"
              checked={conservative}
              onChange={(event) => setConservative(event.target.checked)}
            />
            <span className="toggle-copy">
              <strong>Calcular con un día de descanso por semana</strong>
              <small>
                {conservative
                  ? generalReservedDays > 0
                    ? `Activado: se descuentan ${generalReservedDays} de tus ${eligibleDays.length} días marcados.`
                    : 'Activado: marca días en el calendario y verás cuántos se descuentan.'
                  : 'Si lo activas, se cuenta un día menos de trabajo por cada semana que marques. Ej.: marcas 5 días y se calculan 4. Así tu proyección es más realista.'}
              </small>
            </span>
            <span className="conservative-radio" aria-hidden="true" />
          </label>
        </article>

        <article className="balance-panel">
          <div className="balance-panel-top">
            <span>Saldo proyectado</span>
            <span className="balance-arrow" aria-hidden="true">↗</span>
          </div>

          <strong className="balance-number">
            {money(projectedBalance)}
          </strong>

          <p>Estimación según los días de trabajo seleccionados.</p>

          <div className="balance-divider" />

          <div className="balance-stats">
            <div>
              <span>Días seleccionados</span>
              <strong>{eligibleDays.length}</strong>
            </div>
            <div>
              <span>Días descontados</span>
              <strong>{generalReservedDays}</strong>
            </div>
          </div>
        </article>
      </section>

      {/* Recomendación principal */}
      <section className="recommendation-card">
        <div className="recommendation-top">
          <div>
            <p className="eyebrow">RESUMEN DE TU PLAN</p>
            <h2>Tu próximo retiro</h2>
          </div>
          <span className="recommendation-icon" aria-hidden="true">S/</span>
        </div>

        {initialBalance.trim() === '' ? (
          <p className="recommendation-message">
            Introduce tu saldo actual para comenzar a calcular tu próximo retiro.
          </p>
        ) : eligibleDays.length === 0 ? (
          <p className="recommendation-message">
            Selecciona tus días de trabajo en el calendario para obtener
            una proyección más personalizada.
          </p>
        ) : nextProjection ? (
          <>
            <p className="recommendation-date">
              Próxima fecha prevista:{' '}
              <strong>
                {nextProjection.date.toLocaleDateString('es-PE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>
            </p>

            <div className="recommendation-metrics">
              <div className="recommendation-metric">
                <span>Saldo antes del retiro</span>
                <strong>{money(nextProjection.balanceBefore)}</strong>
              </div>

              <div className="recommendation-metric">
                <span>Retiro simulado</span>
                <strong>
                  {nextProjection.withdrawal > 0
                    ? money(nextProjection.withdrawal)
                    : 'Aún no disponible'}
                </strong>
              </div>

              <div className="recommendation-metric">
                <span>Saldo restante</span>
                <strong>{money(nextProjection.remaining)}</strong>
              </div>
            </div>

            <p className="recommendation-note">
              {nextProjection.withdrawal > 0
                ? 'La simulación utiliza la meta de retiro más alta que alcanza tu saldo estimado.'
                : 'Tu saldo estimado todavía no alcanza la meta mínima de S/ 100.'}
              {' '}Los resultados dependen de los días y ganancias que registres.
            </p>
          </>
        ) : (
          <p className="recommendation-message">
            No hay fechas de retiro disponibles para calcular.
          </p>
        )}

        <button
          type="button"
          className="recommendation-button"
          onClick={() =>
            document.getElementById('planificacion')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }
        >
          Ver calendario y planificación
          <span aria-hidden="true"> ↓</span>
        </button>
      </section>

      <section className="calendar-card" id="planificacion">
        <div className="calendar-header">
          <div>
            <p className="eyebrow">PLANIFICACIÓN</p>
            <h2>Calendario de trabajo</h2>
            <p className="subtitle">
              Azul: hoy · Verde: trabajo · Rojo: feriado · Naranja: retiro.
            </p>
          </div>

          <div className="month-controls">
            <button
              className="nav-button"
              onClick={() => changeMonth(-1)}
              aria-label="Mes anterior"
              type="button"
            >
              ‹
            </button>
            <strong>{monthNames[month]} {year}</strong>
            <button
              className="nav-button"
              onClick={() => changeMonth(1)}
              aria-label="Mes siguiente"
              type="button"
            >
              ›
            </button>
          </div>
        </div>

                  <div className="monthly-holidays">
            <div className="monthly-holidays-icon">!</div>

            <div className="monthly-holidays-copy">
              <strong>Feriados de este mes</strong>

              <small>
                {monthHolidays.length === 0
                  ? 'No hay feriados registrados este mes.'
                  : monthHolidays.map((holiday) => holiday.name).join(', ')}
              </small>
            </div>

            <span className="monthly-holidays-count">
              {monthHolidays.length}
            </span>
          </div>

          <div className="calendar-grid">
            
          </div>

        <div className="calendar-grid">
          {weekDays.map((day) => (
            <div className="weekday" key={day}>{day}</div>
          ))}

          {Array.from({ length: firstDay }, (_, index) => (
            <div className="empty-day" key={`empty-${index}`} />
          ))}

          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1
            const key = dateKey(year, month, day)
            const holiday = holidayMap.get(key)
            const isToday = key === todayKey
            const isSelected = selectedDays.includes(key)
            const isWithdrawal = withdrawalDays.includes(day)
            const isPast = key < todayKey

            const classes = [
                'day-button',
                isSelected ? 'selected' : '',
                isToday ? 'today' : '',
                isWithdrawal ? 'withdrawal' : '',
                holiday ? 'holiday' : '',
                isPast && !isToday ? 'past-day' : '',
              ].filter(Boolean).join(' ')

            return (
              <button
                key={key}
                type="button"
                className={classes}
                onClick={() => toggleDay(day)}
                disabled={Boolean(holiday) || isPast}
                title={
                  holiday?.name ??
                  (isToday
                    ? 'Hoy'
                    : isWithdrawal
                      ? 'Fecha de retiro'
                      : isPast
                        ? 'Fecha pasada'
                        : 'Seleccionar día de trabajo')
                }
                aria-label={`${day} de ${monthNames[month]}${
                  holiday ? `, feriado: ${holiday.name}` : ''
                }${isToday ? ', hoy' : ''}`}
                aria-pressed={isSelected}
              >
                <span>{day}</span>

                {isToday && (
                  <span className="today-label">HOY</span>
                )}
                {holiday && <span className="holiday-mark">F</span>}
                {!holiday && isWithdrawal && <span className="withdrawal-dot" />}
                {isSelected && <span className="selected-dot" />}
              </button>
            )
          })}
        </div>

        <div className="legend">
          <span><i className="legend-dot dot-today" /> Hoy</span>
          <span><i className="legend-dot dot-selected" /> Trabajo</span>
          <span><i className="legend-dot dot-withdrawal" /> Retiro</span>
          <span><i className="legend-dot dot-holiday" /> Feriado</span>
        </div>

        <div className="calendar-footer">
          <div>
            <strong>
              {selectedThisMonth} días seleccionados en {monthNames[month].toLowerCase()}
            </strong>
            <p>Los feriados y las fechas pasadas no se pueden seleccionar.</p>
          </div>

          <button
            className="secondary-button"
            onClick={clearCurrentMonth}
            type="button"
          >
            Limpiar mes
          </button>
        </div>
      </section>

      <section className="holiday-layout" id="feriados">
        <article className="calendar-card holiday-list-card">
          <div className="holiday-heading">
            <div>
              <p className="eyebrow">CALENDARIO OFICIAL Y PERSONAL</p>
              <h2>Feriados de {monthNames[month]}</h2>
            </div>

            <button
              className={`add-holiday-button ${showHolidayForm ? 'is-open' : ''}`}
              type="button"
              onClick={() => setShowHolidayForm((visible) => !visible)}
              aria-label={
                showHolidayForm
                  ? 'Cerrar formulario de feriado'
                  : 'Agregar un feriado'
              }
              aria-expanded={showHolidayForm}
              title={showHolidayForm ? 'Cerrar' : 'Agregar feriado'}
            >
              {showHolidayForm ? '×' : '+'}
            </button>
          </div>

          <p className="subtitle">
            Los días rojos se excluyen de las ganancias proyectadas.
          </p>

          {showHolidayForm && (
            <form className="holiday-form" onSubmit={addCustomHoliday}>
              <div className="holiday-form-title">
                <strong>Agregar fecha personalizada</strong>
                <span>Se guardará en este navegador.</span>
              </div>

              <label>
                Nombre del evento
                <input
                  value={holidayName}
                  onChange={(event) => setHolidayName(event.target.value)}
                  placeholder="Ej. Día no laborable"
                  required
                />
              </label>

              <label>
                Fecha
                <input
                  type="date"
                  value={holidayDate}
                  onChange={(event) => setHolidayDate(event.target.value)}
                  required
                />
              </label>

              <div className="holiday-form-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowHolidayForm(false)}
                >
                  Cancelar
                </button>
                <button className="primary-button" type="submit">
                  Guardar feriado
                </button>
              </div>
            </form>
          )}

          {monthHolidays.length === 0 ? (
            <p className="empty-holidays">
              No hay feriados registrados para este mes.
            </p>
          ) : (
            <div className="holiday-list">
              {monthHolidays.map((holiday) => (
                <div
                  className="holiday-row"
                  key={`${holiday.date}-${holiday.name}`}
                >
                  <span className="holiday-date">
                    {formatHolidayDate(holiday.date)}
                  </span>
                  <span className="holiday-name">{holiday.name}</span>

                  {holiday.type === 'custom' ? (
                    <button
                      className="remove-holiday"
                      onClick={() => removeCustomHoliday(holiday.date)}
                      aria-label={`Eliminar feriado ${holiday.name}`}
                      title="Eliminar feriado"
                      type="button"
                    >
                      ×
                    </button>
                  ) : (
                    <span className="national-tag">Nacional</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="projections-section" id="proyecciones">
        <div className="projections-heading">
          <div>
            <p className="eyebrow">TUS PRÓXIMAS METAS</p>
            <h2>Proyección de retiros</h2>
            <p className="subtitle">
              Simulación orientativa de retiros y saldo restante.
            </p>
          </div>
          <span className="projection-heading-badge">
            {projections.length} próximos retiros
          </span>
        </div>

        <div className="projection-grid">
          {projections.map((projection) => {
            const date = projection.date
            const progress = Math.min(
              100,
              projection.balanceBefore / 30000 * 100,
            )

            return (
              <article className="projection-card" key={makeKey(date)}>
                <div className="projection-top">
                  <div>
                    <span className="projection-caption">FECHA DE RETIRO</span>
                    <h3>{date.getDate()} de {monthNames[date.getMonth()]}</h3>
                    <span className="projection-year">{date.getFullYear()}</span>
                  </div>
                  <span className="projection-calendar-icon" aria-hidden="true">↗</span>
                </div>

                <div className="projection-balance-block">
                  <p className="projection-caption">SALDO ANTES DEL RETIRO</p>
                  <strong className="projection-amount">
                    {money(projection.balanceBefore)}
                  </strong>
                </div>

                <div className="projection-progress-header">
                  <span>Progreso hacia S/ 30,000</span>
                  <strong>{progress.toFixed(1)}%</strong>
                </div>

                <div
                  className="chart-track"
                  role="progressbar"
                  aria-label="Progreso hacia la meta de treinta mil soles"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div className="chart-fill" style={{ width: `${progress}%` }} />
                </div>

                <div className="simulation-result">
                  <span className="simulation-label">RETIRO SIMULADO</span>
                  {projection.withdrawal > 0 ? (
                    <>
                      <strong>{money(projection.withdrawal)}</strong>
                      <small>Meta más alta alcanzable</small>
                    </>
                  ) : (
                    <>
                      <strong>Sin retiro todavía</strong>
                      <small>No se alcanza la meta mínima de S/ 100.</small>
                    </>
                  )}
                </div>

                <div className="remaining-balance">
                  <span>Saldo que queda</span>
                  <strong>{money(projection.remaining)}</strong>
                </div>

                <div className="projection-stats">
                  <div>
                    <span>Días planificados</span>
                    <strong>{projection.workdays}</strong>
                  </div>
                  <div>
                    <span>Ganancia diaria</span>
                    <strong>{money(earning)}</strong>
                  </div>
                </div>

                {conservative && (
                  <div className="reserve-note">
                    <span className="reserve-note-icon">✓</span>
                    <span>
                      Calculado con un día de descanso por semana. Se descuentan jornadas.
                    </span>
                  </div>
                )}

                <div className="withdrawal-options">
                  <h4>Metas de retiro</h4>
                  {withdrawalOptions.map((amount) => {
                    const canWithdraw = projection.balanceBefore >= amount
                    const difference = Math.max(
                      0,
                      amount - projection.balanceBefore,
                    )

                    return (
                      <div className="withdrawal-option" key={amount}>
                        <div className="option-amount">
                          <span>{money(amount)}</span>
                          <small>
                            {canWithdraw
                              ? 'Saldo suficiente'
                              : `Faltan ${money(difference)}`}
                          </small>
                        </div>
                        <span
                          className={`option-status ${
                            canWithdraw ? 'available' : 'unavailable'
                          }`}
                        >
                          {canWithdraw ? 'Alcanzado' : 'Pendiente'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="wait-recommendation">
                  <strong>¿Conviene esperar una semana?</strong>
                  <p>
                    En 7 días, el saldo simulado sería{' '}
                    {money(projection.balanceAfterExtraWeek)}.
                    {projection.nextGoal
                      ? ` Podrías alcanzar la meta de ${money(projection.nextGoal)} si esperas, según tus días planificados.`
                      : ' Con los días seleccionados, esperar una semana no alcanza una meta superior de la lista.'}
                  </p>
                </div>
              </article>
            )
          })}
        </div>

        <div className="projection-disclaimer">
          <span className="disclaimer-icon">i</span>
          <p>
            Simulación hipotética: se retira la meta más alta alcanzable y el
            saldo restante pasa a la siguiente fecha, sumando las ganancias de
            los días seleccionados. No se registra ningún retiro real.
            La recomendación de esperar una semana solo considera las jornadas
            que ya seleccionaste. Verifica las condiciones de tu plataforma.
          </p>
        </div>
      </section>

      <section className="help-card" id="ayuda">
        <div className="help-card-icon" aria-hidden="true">?</div>
        <div>
          <p className="eyebrow">AYUDA</p>
          <h2>¿Cómo usar RetiroSmart?</h2>
          <ol>
            <li>Ingresa tu saldo actual y la ganancia diaria estimada.</li>
            <li>Selecciona en el calendario los días en los que planeas trabajar.</li>
            <li>Revisa el saldo proyectado y compara las metas de retiro disponibles.</li>
          </ol>
          <p>Las cifras son simulaciones basadas en la información ingresada; no representan ganancias garantizadas ni realizan retiros reales.</p>
        </div>
      </section>

      <footer className="footer">
        RetiroSmart <span>·</span> Planifica hoy, decide mejor.
      </footer>

      <button
        className="calculator-fab"
        type="button"
        onClick={() => setCalculatorOpen((open) => !open)}
        aria-label={calculatorOpen ? 'Cerrar calculadora' : 'Abrir calculadora'}
        title="Calculadora"
      >
        {calculatorOpen ? '×' : '▦'}
      </button>

      {calculatorOpen && (
        <aside className="calculator-panel" aria-label="Calculadora flotante">
          <div className="calculator-header">
            <div>
              <strong>Calculadora</strong>
              <small>Independiente de tu saldo</small>
            </div>
            <button
              type="button"
              onClick={() => setCalculatorOpen(false)}
              aria-label="Cerrar calculadora"
            >
              ×
            </button>
          </div>

          <div className="calculator-display" aria-live="polite">
            {calcDisplay}
          </div>

          <div className="calculator-keys">
            {[
              { label: 'C', action: calculatorClear, kind: 'utility' },
              {
                label: '⌫',
                action: () => setCalcDisplay((value) =>
                  value.length > 1 ? value.slice(0, -1) : '0',
                ),
                kind: 'utility',
              },
              { label: '%', action: calculatorPercent, kind: 'utility' },
              { label: '÷', action: () => calculatorOperator('÷'), kind: 'operator' },
              { label: '7', action: () => calculatorInput('7'), kind: '' },
              { label: '8', action: () => calculatorInput('8'), kind: '' },
              { label: '9', action: () => calculatorInput('9'), kind: '' },
              { label: '×', action: () => calculatorOperator('×'), kind: 'operator' },
              { label: '4', action: () => calculatorInput('4'), kind: '' },
              { label: '5', action: () => calculatorInput('5'), kind: '' },
              { label: '6', action: () => calculatorInput('6'), kind: '' },
              { label: '−', action: () => calculatorOperator('−'), kind: 'operator' },
              { label: '1', action: () => calculatorInput('1'), kind: '' },
              { label: '2', action: () => calculatorInput('2'), kind: '' },
              { label: '3', action: () => calculatorInput('3'), kind: '' },
              { label: '+', action: () => calculatorOperator('+'), kind: 'operator' },
              {
                label: '±',
                action: () => setCalcDisplay((value) => String(Number(value) * -1)),
                kind: 'utility',
              },
              { label: '0', action: () => calculatorInput('0'), kind: '' },
              { label: '.', action: () => calculatorInput('.'), kind: '' },
              { label: '=', action: calculatorEquals, kind: 'equals' },
            ].map((key) => (
              <button
                key={key.label}
                type="button"
                className={`calculator-key ${key.kind}`}
                onClick={key.action}
              >
                {key.label}
              </button>
            ))}
          </div>
        </aside>
      )}
    </main>
  )
}

export default App
