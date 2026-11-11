"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Calendar, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { 
  startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, subMonths, startOfQuarter, 
  endOfQuarter, subQuarters, format 
} from "date-fns"

interface EnterpriseDateRangePickerProps {
  startDate?: Date | null
  endDate?: Date | null
  onDateChange?: (start: Date | null, end: Date | null) => void
  className?: string
}

type PresetValue = 'today' | 'yesterday' | 'last7' | 'last14' | 'last28' | 'last30' | 
                   'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 
                   'thisQuarter' | 'lastQuarter' | 'custom'

interface DatePreset {
  value: PresetValue
  label: string
  getRange: () => { from: Date; to: Date }
}

export function EnterpriseDateRangePicker({ 
  startDate, 
  endDate, 
  onDateChange,
  className 
}: EnterpriseDateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<PresetValue>('today')
  const [tempStart, setTempStart] = useState<Date | null>(startDate || null)
  const [tempEnd, setTempEnd] = useState<Date | null>(endDate || null)
  const [selectingStart, setSelectingStart] = useState(true)
  const [currentMonth1, setCurrentMonth1] = useState(new Date())
  const [currentMonth2, setCurrentMonth2] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1)
  )
  const [compareEnabled, setCompareEnabled] = useState(false)

  const presets: DatePreset[] = [
    {
      value: 'today',
      label: 'Today',
      getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) })
    },
    {
      value: 'yesterday',
      label: 'Yesterday',
      getRange: () => ({ 
        from: startOfDay(subDays(new Date(), 1)), 
        to: endOfDay(subDays(new Date(), 1)) 
      })
    },
    {
      value: 'last7',
      label: 'Last 7 days',
      getRange: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) })
    },
    {
      value: 'last14',
      label: 'Last 14 days',
      getRange: () => ({ from: startOfDay(subDays(new Date(), 13)), to: endOfDay(new Date()) })
    },
    {
      value: 'last28',
      label: 'Last 28 days',
      getRange: () => ({ from: startOfDay(subDays(new Date(), 27)), to: endOfDay(new Date()) })
    },
    {
      value: 'last30',
      label: 'Last 30 days',
      getRange: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) })
    },
    {
      value: 'thisWeek',
      label: 'This week',
      getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) })
    },
    {
      value: 'lastWeek',
      label: 'Last week',
      getRange: () => {
        const lastWeek = subDays(new Date(), 7)
        return { 
          from: startOfWeek(lastWeek, { weekStartsOn: 1 }), 
          to: endOfWeek(lastWeek, { weekStartsOn: 1 }) 
        }
      }
    },
    {
      value: 'thisMonth',
      label: 'This month',
      getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })
    },
    {
      value: 'lastMonth',
      label: 'Last month',
      getRange: () => {
        const lastMonth = subMonths(new Date(), 1)
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
      }
    },
    {
      value: 'thisQuarter',
      label: 'This quarter',
      getRange: () => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) })
    },
    {
      value: 'lastQuarter',
      label: 'Last quarter',
      getRange: () => {
        const lastQuarter = subQuarters(new Date(), 1)
        return { from: startOfQuarter(lastQuarter), to: endOfQuarter(lastQuarter) }
      }
    }
  ]

  useEffect(() => {
    setTempStart(startDate || null)
    setTempEnd(endDate || null)
  }, [startDate, endDate])

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const firstDayOfWeek = firstDay.getDay()

    const days: (number | null)[] = []
    
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    
    return days
  }

  const handlePresetClick = (preset: DatePreset) => {
    setSelectedPreset(preset.value)
    const range = preset.getRange()
    setTempStart(range.from)
    setTempEnd(range.to)
    
    // Auto-update when preset is clicked
    if (onDateChange) {
      onDateChange(range.from, range.to)
    }
    setOpen(false)
  }

  const handleDateClick = (day: number, monthDate: Date) => {
    const selectedDate = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      day
    )

    if (selectingStart) {
      setTempStart(startOfDay(selectedDate))
      setTempEnd(null)
      setSelectingStart(false)
      setSelectedPreset('custom')
    } else {
      if (tempStart && selectedDate < tempStart) {
        setTempEnd(endOfDay(tempStart))
        setTempStart(startOfDay(selectedDate))
      } else {
        setTempEnd(endOfDay(selectedDate))
      }
      setSelectingStart(true)
      setSelectedPreset('custom')
    }
  }

  const isDateInRange = (day: number, monthDate: Date) => {
    if (!tempStart || !tempEnd) return false
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
    return date >= tempStart && date <= tempEnd
  }

  const isStartDate = (day: number, monthDate: Date) => {
    if (!tempStart) return false
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
    return date.toDateString() === tempStart.toDateString()
  }

  const isEndDate = (day: number, monthDate: Date) => {
    if (!tempEnd) return false
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
    return date.toDateString() === tempEnd.toDateString()
  }

  const formatDateRange = () => {
    if (!tempStart && !tempEnd) return "Select date range"
    if (tempStart && !tempEnd) return `${format(tempStart, 'MMM d, yyyy')} - ...`
    if (tempStart && tempEnd) {
      return `${format(tempStart, 'MMM d, yyyy')} - ${format(tempEnd, 'MMM d, yyyy')}`
    }
    return "Select date range"
  }

  const handleUpdate = () => {
    if (onDateChange && tempStart && tempEnd) {
      onDateChange(tempStart, tempEnd)
    }
    setOpen(false)
  }

  const handleCancel = () => {
    setTempStart(startDate || null)
    setTempEnd(endDate || null)
    setOpen(false)
  }

  const handlePrevMonth = (calendar: 1 | 2) => {
    if (calendar === 1) {
      setCurrentMonth1(new Date(currentMonth1.getFullYear(), currentMonth1.getMonth() - 1))
      setCurrentMonth2(new Date(currentMonth2.getFullYear(), currentMonth2.getMonth() - 1))
    }
  }

  const handleNextMonth = (calendar: 1 | 2) => {
    if (calendar === 2) {
      setCurrentMonth1(new Date(currentMonth1.getFullYear(), currentMonth1.getMonth() + 1))
      setCurrentMonth2(new Date(currentMonth2.getFullYear(), currentMonth2.getMonth() + 1))
    }
  }

  const days1 = getDaysInMonth(currentMonth1)
  const days2 = getDaysInMonth(currentMonth2)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal h-9 sm:h-10 px-2 sm:px-3 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] sm:text-sm rounded-md",
            !tempStart && !tempEnd && "text-slate-500",
            className
          )}
        >
          <Calendar className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 flex-shrink-0" />
          <span className="text-[11px] sm:text-sm font-normal truncate">{formatDateRange()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto max-w-[calc(100vw-1rem)] p-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl overflow-hidden" 
        align="end"
        sideOffset={4}
      >
        <div className="flex items-stretch">
          {/* Left Sidebar - Presets - Hidden on mobile, visible on md+ */}
          <div className="hidden md:flex w-40 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0 flex-col max-h-[430px]">
            <div className="px-3 pt-4 pb-2 flex-shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Quick Select</p>
            </div>
            <div className="overflow-y-auto px-3 pb-4 space-y-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                    selectedPreset === preset.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {selectedPreset === preset.value ? (
                    <Check className="h-3 w-3 flex-shrink-0" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border-2 border-slate-300 dark:border-slate-600 flex-shrink-0" />
                  )}
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Section - Calendars */}
          <div className="p-3 sm:p-5">
            {/* Dual Calendar - Single calendar on mobile, dual on md+ */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-4">
              {/* Calendar 1 */}
              <div className="w-full sm:w-auto">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => handlePrevMonth(1)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-target"
                  >
                    <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex-1 text-center">
                    {monthNames[currentMonth1.getMonth()]} {currentMonth1.getFullYear()}
                  </h3>
                  <div className="w-6 sm:block hidden" />
                  <button
                    onClick={() => handleNextMonth(2)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-target sm:hidden"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-7 mb-1">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 w-8 sm:w-9 py-1">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {days1.map((day, index) => {
                    if (day === null) return <div key={`empty-${index}`} className="w-8 h-8 sm:w-9 sm:h-9" />
                    const inRange = isDateInRange(day, currentMonth1)
                    const isStart = isStartDate(day, currentMonth1)
                    const isEnd = isEndDate(day, currentMonth1)
                    const isSelected = isStart || isEnd
                    return (
                      <button
                        key={day}
                        onClick={() => handleDateClick(day, currentMonth1)}
                        className={cn(
                          "w-8 h-8 sm:w-9 sm:h-9 text-xs font-medium rounded-md transition-all duration-150 flex items-center justify-center touch-target",
                          "hover:bg-slate-100 dark:hover:bg-slate-800",
                          inRange && !isSelected && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-none",
                          isStart && "bg-blue-600 text-white font-bold rounded-l-md rounded-r-none",
                          isEnd && "bg-blue-600 text-white font-bold rounded-r-md rounded-l-none",
                          isStart && isEnd && "rounded-md",
                          !inRange && !isSelected && "text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Divider - Hidden on mobile */}
              <div className="hidden sm:block w-px bg-slate-200 dark:bg-slate-700 self-stretch" />

              {/* Calendar 2 - Hidden on mobile */}
              <div className="hidden sm:block">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-6" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white w-32 text-center">
                    {monthNames[currentMonth2.getMonth()]} {currentMonth2.getFullYear()}
                  </h3>
                  <button
                    onClick={() => handleNextMonth(2)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-7 mb-1">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 w-9 py-1">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {days2.map((day, index) => {
                    if (day === null) return <div key={`empty-${index}`} className="w-9 h-9" />
                    const inRange = isDateInRange(day, currentMonth2)
                    const isStart = isStartDate(day, currentMonth2)
                    const isEnd = isEndDate(day, currentMonth2)
                    const isSelected = isStart || isEnd
                    return (
                      <button
                        key={day}
                        onClick={() => handleDateClick(day, currentMonth2)}
                        className={cn(
                          "w-9 h-9 text-xs font-medium rounded-md transition-all duration-150 flex items-center justify-center",
                          "hover:bg-slate-100 dark:hover:bg-slate-800",
                          inRange && !isSelected && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-none",
                          isStart && "bg-blue-600 text-white font-bold rounded-l-md rounded-r-none",
                          isEnd && "bg-blue-600 text-white font-bold rounded-r-md rounded-l-none",
                          isStart && isEnd && "rounded-md",
                          !inRange && !isSelected && "text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3 sm:pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Selected range display */}
                <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-2 sm:px-3 py-2 border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {tempStart ? format(tempStart, 'MMM d, yyyy') : '—'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 text-xs flex-shrink-0">→</span>
                  <span className="text-[10px] sm:text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {tempEnd ? format(tempEnd, 'MMM d, yyyy') : '—'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 sm:ml-4">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="flex-1 sm:flex-none px-3 sm:px-4 h-10 sm:h-9 border-slate-300 dark:border-slate-600 font-semibold text-xs touch-target"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdate}
                    disabled={!tempStart || !tempEnd}
                    className="flex-1 sm:flex-none px-3 sm:px-4 h-10 sm:h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md disabled:opacity-50 touch-target"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
