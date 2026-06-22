'use client'

import { useState, useRef, useEffect } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  setMonth,
  setYear,
  getYear,
  getMonth,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: string // YYYY-MM-DD
  onChange: (date: string) => void
  placeholder?: string
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
  hasError?: boolean
  id?: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseLocalDate(value: string): Date | null {
  if (!value) return null
  // Append time to avoid UTC offset shifting the day
  const d = new Date(value + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select a date',
  minDate,
  maxDate,
  disabled,
  hasError,
  id,
}: DatePickerProps) {
  const selectedDate = parseLocalDate(value || '')

  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'days' | 'months' | 'years'>('days')
  const [viewDate, setViewDate] = useState<Date>(() => selectedDate ?? new Date())
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep viewDate in sync when selected value changes externally
  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate)
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setView('days')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const currentYear = getYear(viewDate)
  // Provide a generous year range: 100 years back up to 10 years ahead
  const yearRange = Array.from({ length: 110 }, (_, i) => currentYear - 99 + i).reverse()

  const isDisabledDay = (day: Date) => {
    if (minDate) {
      const min = new Date(minDate)
      min.setHours(0, 0, 0, 0)
      if (day < min) return true
    }
    if (maxDate) {
      const max = new Date(maxDate)
      max.setHours(23, 59, 59, 999)
      if (day > max) return true
    }
    return false
  }

  const handleDayClick = (day: Date) => {
    if (isDisabledDay(day)) return
    onChange(format(day, 'yyyy-MM-dd'))
    setIsOpen(false)
    setView('days')
  }

  const handleTodayClick = () => {
    const today = new Date()
    if (!isDisabledDay(today)) {
      onChange(format(today, 'yyyy-MM-dd'))
      setIsOpen(false)
      setView('days')
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) setView('days')
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          hasError
            ? 'border-destructive focus:ring-destructive'
            : isOpen
            ? 'border-primary ring-2 ring-ring ring-offset-2'
            : 'border-input hover:border-primary/60',
        )}
      >
        <span className={cn('truncate', selectedDate ? 'text-foreground' : 'text-muted-foreground')}>
          {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : placeholder}
        </span>
        <Calendar
          className={cn(
            'h-4 w-4 flex-shrink-0 transition-colors ml-2',
            isOpen ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-1.5 w-full min-w-[288px] rounded-lg border border-border bg-white shadow-2xl',
            'animate-in fade-in-0 zoom-in-95 duration-150 origin-top',
          )}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-[hsl(var(--surface-inset))] rounded-t-lg select-none">
            {view === 'days' && (
              <>
                <button
                  type="button"
                  onClick={() => setViewDate(subMonths(viewDate, 1))}
                  className="p-1.5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView('months')}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-sm font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {format(viewDate, 'MMMM yyyy')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewDate(addMonths(viewDate, 1))}
                  className="p-1.5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {view === 'months' && (
              <>
                <button
                  type="button"
                  onClick={() => setView('days')}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  aria-label="Back to calendar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView('years')}
                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-primary/10"
                >
                  {format(viewDate, 'yyyy')}
                </button>
                <div className="w-8" />
              </>
            )}

            {view === 'years' && (
              <>
                <div className="w-8" />
                <span className="text-sm font-semibold text-foreground">Select Year</span>
                <button
                  type="button"
                  onClick={() => setView('months')}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  aria-label="Back to months"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Days view */}
          {view === 'days' && (
            <div className="p-3">
              {/* Weekday labels */}
              <div className="grid grid-cols-7 mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-bold text-muted-foreground py-1.5 uppercase tracking-wider"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-px">
                {days.map((day) => {
                  const isSel = selectedDate && isSameDay(day, selectedDate)
                  const isCurrentMonth = isSameMonth(day, viewDate)
                  const isDisabled = isDisabledDay(day)
                  const isTodayDate = isToday(day)

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        'h-8 w-full text-xs rounded-md font-medium transition-all duration-100 select-none',
                        isSel && 'bg-primary text-primary-foreground shadow-sm scale-105',
                        !isSel && isCurrentMonth && !isDisabled && 'hover:bg-primary/10 hover:text-primary text-foreground',
                        !isSel && !isCurrentMonth && 'text-muted-foreground/40',
                        !isSel && isTodayDate && isCurrentMonth && 'ring-1 ring-primary/60 text-primary font-semibold',
                        isDisabled && 'opacity-25 cursor-not-allowed',
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={handleTodayClick}
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Today
                </button>
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Months view */}
          {view === 'months' && (
            <div className="p-3 grid grid-cols-3 gap-2">
              {MONTHS.map((month, idx) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => {
                    setViewDate(setMonth(viewDate, idx))
                    setView('days')
                  }}
                  className={cn(
                    'py-2.5 text-sm rounded-md font-medium transition-all duration-100',
                    getMonth(viewDate) === idx
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-primary/10 hover:text-primary text-foreground',
                  )}
                >
                  {month}
                </button>
              ))}
            </div>
          )}

          {/* Years view — scrollable */}
          {view === 'years' && (
            <div className="p-2 h-52 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-3 gap-1.5">
                {yearRange.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setViewDate(setYear(viewDate, year))
                      setView('months')
                    }}
                    className={cn(
                      'py-1.5 text-sm rounded-md font-medium transition-all duration-100',
                      getYear(viewDate) === year
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-primary/10 hover:text-primary text-foreground',
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
