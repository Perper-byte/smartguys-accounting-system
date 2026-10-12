// src/renderer/src/utils/dtr-classifier.test.ts
import { classifyDailyPunch, DailyPunchLog } from './dtr-classifier'

describe('DTR Punch Classifier Utility', () => {
  test('marks absence when timeIn or timeOut is missing', () => {
    const missingTimeIn: DailyPunchLog = {
      date: new Date('2026-10-12'),
      timeIn: null,
      timeOut: new Date('2026-10-12T17:00:00'),
      shiftType: 'REGULAR'
    }

    const result = classifyDailyPunch(missingTimeIn)
    expect(result.demerits.absences_days).toBe(1)
    expect(result.baseHours).toBe(0)
  })

  test('calculates tardiness / late minutes when punch is after scheduled time in', () => {
    const punch: DailyPunchLog = {
      date: new Date('2026-10-12'),
      scheduledTimeIn: new Date('2026-10-12T08:00:00'),
      scheduledTimeOut: new Date('2026-10-12T17:00:00'),
      timeIn: new Date('2026-10-12T08:35:00'), // 35 mins late
      timeOut: new Date('2026-10-12T17:00:00'),
      shiftType: 'REGULAR'
    }

    const result = classifyDailyPunch(punch)
    expect(result.demerits.late_minutes).toBe(35)
    expect(result.demerits.undertime_minutes).toBe(0)
    expect(result.demerits.absences_days).toBe(0)
  })

  test('calculates undertime minutes when punch is before scheduled time out', () => {
    const punch: DailyPunchLog = {
      date: new Date('2026-10-12'),
      scheduledTimeIn: new Date('2026-10-12T08:00:00'),
      scheduledTimeOut: new Date('2026-10-12T17:00:00'),
      timeIn: new Date('2026-10-12T08:00:00'),
      timeOut: new Date('2026-10-12T16:45:00'), // 15 mins undertime
      shiftType: 'REGULAR'
    }

    const result = classifyDailyPunch(punch)
    expect(result.demerits.late_minutes).toBe(0)
    expect(result.demerits.undertime_minutes).toBe(15)
  })

  test('calculates base hours deducting 1 hour lunch break for standard 8-hour shift', () => {
    const punch: DailyPunchLog = {
      date: new Date('2026-10-12'),
      scheduledTimeIn: new Date('2026-10-12T08:00:00'),
      scheduledTimeOut: new Date('2026-10-12T17:00:00'),
      timeIn: new Date('2026-10-12T08:00:00'),
      timeOut: new Date('2026-10-12T17:00:00'), // 9 hours elapsed, minus 1 hr lunch = 8 hrs
      shiftType: 'REGULAR'
    }

    const result = classifyDailyPunch(punch)
    expect(result.baseHours).toBe(8)
    expect(result.demerits.late_minutes).toBe(0)
    expect(result.demerits.undertime_minutes).toBe(0)
  })
})

