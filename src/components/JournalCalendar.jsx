import { useMemo, useState } from 'react'
import { useApp } from '../context'
import { dayKey } from '../lib/activity'
import { entriesByDay, monthGrid, shiftMonth } from '../lib/calendar'
import { moodTone } from '../lib/moods'

/**
 * 일기 달력. 일기를 쓴 날은 그날 기분 색으로 칠하고 누를 수 있다. 누르면 onSelect(날짜)로 그날 일기만 보게 한다.
 * 다시 누르면 고르기를 푼다(onSelect(null)).
 */
export default function JournalCalendar({ items, selected, onSelect }) {
  const { t, nativeLang } = useApp()
  const locale = nativeLang === 'ko' ? 'ko-KR' : 'en-US'
  const today = new Date()
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const byDay = useMemo(() => entriesByDay(items), [items])
  const weeks = monthGrid(view.year, view.month)

  const monthName = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(
    new Date(view.year, view.month, 1),
  )
  const fullDate = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', weekday: 'long' })
  // 2026-11-01은 일요일: 요일 머리글을 그 주에서 뽑는다.
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 10, 1 + index)),
  )

  return (
    <div className="journal-calendar">
      <div className="calendar-head">
        <button className="icon-button" aria-label={t('calendarPrev')} onClick={() => setView(shiftMonth(view, -1))}>
          ‹
        </button>
        <h3 aria-live="polite">{monthName}</h3>
        <button className="icon-button" aria-label={t('calendarNext')} onClick={() => setView(shiftMonth(view, 1))}>
          ›
        </button>
      </div>
      <table className="calendar-grid">
        <caption className="sr-only">{t('calendarLabel', { month: monthName })}</caption>
        <thead>
          <tr>
            {weekdays.map((name, index) => (
              <th key={index} scope="col">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, row) => (
            <tr key={row}>
              {week.map((cell, column) => {
                if (!cell) return <td key={column} />
                const entries = byDay.get(cell.key)
                const isToday = cell.key === dayKey(today)
                if (!entries) {
                  return (
                    <td key={column}>
                      <span className={isToday ? 'calendar-day today' : 'calendar-day'}>{cell.day}</span>
                    </td>
                  )
                }
                const mood = entries.find((item) => item.mood)?.mood
                const [year, month, day] = cell.key.split('-').map(Number)
                return (
                  <td key={column}>
                    <button
                      className={`calendar-day has-entry tone-${mood ? moodTone(mood) : 'none'}`}
                      aria-pressed={selected === cell.key}
                      onClick={() => onSelect(selected === cell.key ? null : cell.key)}
                    >
                      <span aria-hidden="true">{cell.day}</span>
                      <span className="sr-only">
                        {t('calendarDay', {
                          date: fullDate.format(new Date(year, month - 1, day)),
                          count: entries.length,
                        })}
                      </span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
