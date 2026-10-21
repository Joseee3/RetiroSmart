
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'

const withdrawalDays = [8, 18, 28]
const withdrawalOptions = [100, 360, 900, 2000, 10000, 15000, 30000]

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

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
  const [dailyEarning, setDailyEarning] = useState('80')
  const [conservative, setConservative] = useState(false)

  const [holidayName, setHolidayName] = useState('')
  const [holidayDate, setHolidayDate] = useState('')
  const [showHolidayForm, setShowHolidayForm] = useState(false)

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

  function balanceAt(target: Date, baseBalance: number) {
    const targetKey = makeKey(target)
    const workdays = eligibleDays.filter((key) => key <= targetKey)
    return {
      workdays: workdays.length,
      reservedDays: conservative
        ? Math.min(workdays.length, countReservedDays(workdays))
        : 0,
      effectiveDays: countEffectiveDays(workdays),
      balance: baseBalance + earning * countEffectiveDays(workdays),
    }
  }

  // La simulación elige la meta más alta alcanzable y la descuenta.
  // Las ganancias entre fechas de retiro se suman al saldo restante.
  const projections = useMemo(() => {
    const result: Projection[] = []
    let balance = startingBalance
    let previousDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

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
          (option) => option > withdrawal && option <= balanceAfterExtraWeek,
        ) ?? null

      const cumulativeKeys = eligibleDays.filter((key) => key <= makeKey(date))
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
    selectedDays,
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

  function calculatorInput(value: string) {
    if (calcNewNumber || calcDisplay === '0' || calcDisplay === 'Error') {
      setCalcDisplay(value === '.' ? '0.' : value)
      setCalcNewNumber(false)
    } else if (value !== '.' || !calcDisplay.includes('.')) {
      setCalcDisplay(calcDisplay + value)
    }
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

  function calculate(a: number, b: number, operator: string) {
    if (operator === '+') return a + b
    if (operator === '−') return a - b
    if (operator === '×') return a * b
    if (operator === '÷') return b === 0 ? NaN : a / b
    return b
  }

  function calculatorEquals() {
    if (calcStored === null || !calcOperator) return
    const result = calculate(calcStored, Number(calcDisplay), calcOperator)
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
    const value = Number(calcDisplay) / 100
    setCalcDisplay(String(value))
    setCalcNewNumber(true)
  }

  const monthHolidays = holidays
    .filter((holiday) =>
      holiday.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}-`),
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon">R</span>
          <span>Retiro<span className="brand-accent">Smart</span></span>
        </a>
        <span className="today-label">
          {today.toLocaleDateString('es-PE', {
            weekday: 'short', day: 'numeric', month: 'short',
          })}
        </span>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">TU PLANIFICADOR FINANCIERO</p>
          <h1>Planifica tus ganancias.</h1>
          <p className="subtitle">
            Organiza tus jornadas, contempla imprevistos y planifica tus retiros.
          </p>
        </div>
        <div className="welcome-icon" aria-hidden="true">↗</div>
      </section>

      <section className="finance-layout">
        <article className="finance-panel">
          <p className="eyebrow">CONFIGURACIÓN FINANCIERA</p>
          <h2>Tu saldo y tus ganancias</h2>
          <p className="subtitle">
            Introduce tu saldo actual cada vez que abras la aplicación.
          </p>

          <div className="finance-fields">
            <label>
              Saldo actual (S/)
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej. 900.00"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
              />
            </label>
            <label>
              Ganancia diaria (S/)
              <input
                type="number"
                min="0"
                step="0.01"
                value={dailyEarning}
                onChange={(event) => setDailyEarning(event.target.value)}
              />
            </label>
          </div>

          <label className="conservative-toggle">
            <input
              className="conservative-input"
              type="checkbox"
              checked={conservative}
              onChange={(event) => setConservative(event.target.checked)}
            />
            <span className="conservative-radio" aria-hidden="true" />
            <span className="toggle-copy">
              <strong>Escenario conservador</strong>
              <small>Reservar una jornada por cada semana con días seleccionados.</small>
            </span>
          </label>
        </article>

        <article className="balance-panel">
          <div className="balance-panel-top">
            <span>Saldo proyectado</span>
            <span className="balance-arrow" aria-hidden="true">↗</span>
          </div>
          <strong className="balance-number">{money(projectedBalance)}</strong>
          <p>Estimación según los días de trabajo seleccionados.</p>
          <div className="balance-divider" />
          <div className="balance-stats">
            <div><span>Días seleccionados</span><strong>{eligibleDays.length}</strong></div>
            <div><span>Días de reserva</span><strong>{generalReservedDays}</strong></div>
          </div>
        </article>
      </section>

      <section className="calendar-card">
        <div className="calendar-header">
          <div>
            <p className="eyebrow">PLANIFICACIÓN</p>
            <h2>Calendario de trabajo</h2>
            <p className="subtitle">Azul: hoy · Verde: trabajo · Rojo: feriado · Naranja: retiro.</p>
          </div>
          <div className="month-controls">
            <button className="nav-button" onClick={() => changeMonth(-1)} aria-label="Mes anterior" type="button">‹</button>
            <strong>{monthNames[month]} {year}</strong>
            <button className="nav-button" onClick={() => changeMonth(1)} aria-label="Mes siguiente" type="button">›</button>
          </div>
        </div>

        <div className="calendar-grid">
          {weekDays.map((day) => <div className="weekday" key={day}>{day}</div>)}
          {Array.from({ length: firstDay }, (_, index) => <div className="empty-day" key={`empty-${index}`} />)}
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
              isPast ? 'past-day' : '',
            ].filter(Boolean).join(' ')

            return (
              <button
                key={key}
                type="button"
                className={classes}
                onClick={() => toggleDay(day)}
                disabled={Boolean(holiday) || isPast}
                title={holiday?.name ?? (isToday ? 'Hoy' : isWithdrawal ? 'Fecha de retiro' : isPast ? 'Fecha pasada' : 'Seleccionar día de trabajo')}
                aria-label={`${day} de ${monthNames[month]}${holiday ? `, feriado: ${holiday.name}` : ''}${isToday ? ', hoy' : ''}`}
                aria-pressed={isSelected}
              >
                <span>{day}</span>
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
            <strong>{selectedThisMonth} días seleccionados en {monthNames[month].toLowerCase()}</strong>
            <p>Los feriados y las fechas pasadas no se pueden seleccionar.</p>
          </div>
          <button className="secondary-button" onClick={clearCurrentMonth} type="button">Limpiar mes</button>
        </div>
      </section>

      <section className="holiday-layout">
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
              aria-label={showHolidayForm ? 'Cerrar formulario de feriado' : 'Agregar un feriado'}
              aria-expanded={showHolidayForm}
              title={showHolidayForm ? 'Cerrar' : 'Agregar feriado'}
            >
              {showHolidayForm ? '×' : '+'}
            </button>
          </div>
          <p className="subtitle">Los días rojos se excluyen de las ganancias proyectadas.</p>

          {showHolidayForm && (
            <form className="holiday-form" onSubmit={addCustomHoliday}>
              <div className="holiday-form-title">
                <strong>Agregar fecha personalizada</strong>
                <span>Se guardará en este navegador.</span>
              </div>
              <label>
                Nombre del evento
                <input value={holidayName} onChange={(event) => setHolidayName(event.target.value)} placeholder="Ej. Día no laborable" required />
              </label>
              <label>
                Fecha
                <input type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} required />
              </label>
              <div className="holiday-form-actions">
                <button className="secondary-button" type="button" onClick={() => setShowHolidayForm(false)}>Cancelar</button>
                <button className="primary-button" type="submit">Guardar feriado</button>
              </div>
            </form>
          )}

          {monthHolidays.length === 0 ? (
            <p className="empty-holidays">No hay feriados registrados para este mes.</p>
          ) : (
            <div className="holiday-list">
              {monthHolidays.map((holiday) => (
                <div className="holiday-row" key={`${holiday.date}-${holiday.name}`}>
                  <span className="holiday-date">{formatHolidayDate(holiday.date)}</span>
                  <span className="holiday-name">{holiday.name}</span>
                  {holiday.type === 'custom' ? (
                    <button className="remove-holiday" onClick={() => removeCustomHoliday(holiday.date)} aria-label={`Eliminar feriado ${holiday.name}`} title="Eliminar feriado" type="button">×</button>
                  ) : <span className="national-tag">Nacional</span>}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="projections-section">
        <div className="projections-heading">
          <div>
            <p className="eyebrow">TUS PRÓXIMAS METAS</p>
            <h2>Proyección de retiros</h2>
            <p className="subtitle">Simulación orientativa de retiros y saldo restante.</p>
          </div>
          <span className="projection-heading-badge">{projections.length} próximos retiros</span>
        </div>

        <div className="projection-grid">
          {projections.map((projection) => {
            const date = projection.date
            const progress = Math.min(100, projection.balanceBefore / 30000 * 100)

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
                  <strong className="projection-amount">{money(projection.balanceBefore)}</strong>
                </div>

                <div className="projection-progress-header">
                  <span>Progreso hacia S/ 30,000</span>
                  <strong>{progress.toFixed(1)}%</strong>
                </div>
                <div className="chart-track" role="progressbar" aria-label="Progreso hacia la meta de treinta mil soles" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
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
                  <div><span>Días planificados</span><strong>{projection.workdays}</strong></div>
                  <div><span>Ganancia diaria</span><strong>{money(earning)}</strong></div>
                </div>

                {conservative && (
                  <div className="reserve-note">
                    <span className="reserve-note-icon">✓</span>
                    <span>Escenario conservador activo. Se descuentan jornadas reservadas.</span>
                  </div>
                )}

                <div className="withdrawal-options">
                  <h4>Metas de retiro</h4>
                  {withdrawalOptions.map((amount) => {
                    const canWithdraw = projection.balanceBefore >= amount
                    const difference = Math.max(0, amount - projection.balanceBefore)

                    return (
                      <div className="withdrawal-option" key={amount}>
                        <div className="option-amount">
                          <span>{money(amount)}</span>
                          <small>{canWithdraw ? 'Saldo suficiente' : `Faltan ${money(difference)}`}</small>
                        </div>
                        <span className={`option-status ${canWithdraw ? 'available' : 'unavailable'}`}>
                          {canWithdraw ? 'Alcanzado' : 'Pendiente'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="wait-recommendation">
                  <strong>¿Conviene esperar una semana?</strong>
                  <p>
                    En 7 días, el saldo simulado sería {money(projection.balanceAfterExtraWeek)}.
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
            <button type="button" onClick={() => setCalculatorOpen(false)} aria-label="Cerrar calculadora">×</button>
          </div>

          <div className="calculator-display" aria-live="polite">
            {calcDisplay}
          </div>

          <div className="calculator-keys">
            {[
              { label: 'C', action: calculatorClear, kind: 'utility' },
              { label: '⌫', action: () => setCalcDisplay((value) => value.length > 1 ? value.slice(0, -1) : '0'), kind: 'utility' },
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
              { label: '±', action: () => setCalcDisplay((value) => String(Number(value) * -1)), kind: 'utility' },
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
