export interface DailyPunchLog {
  date: Date;
  timeIn: Date | null;
  timeOut: Date | null;
  shiftType: 'REGULAR' | 'REST_DAY' | 'SPECIAL_HOLIDAY' | 'LEGAL_HOLIDAY' | 'SPECIAL_REST_DAY';
  scheduledTimeIn?: Date;
  scheduledTimeOut?: Date;
}

export interface OvertimeHours {
  regular_ot: number;
  regular_night: number;
  regular_night_ot: number;
  rest_day: number;
  rest_day_ot: number;
  rest_day_night: number;
  rest_day_night_ot: number;
  special_holiday: number;
  special_holiday_ot: number;
  special_holiday_night: number;
  special_holiday_night_ot: number;
  special_holiday_rest_day: number;
  special_holiday_rest_day_ot: number;
  special_holiday_rest_day_night: number;
  special_holiday_rest_day_night_ot: number;
  legal_holiday: number;
  legal_holiday_ot?: number;
  legal_holiday_night?: number;
  legal_holiday_night_ot?: number;
}

export interface AttendanceDemerits {
  late_minutes: number;
  undertime_minutes: number;
  absences_days: number;
}

export interface ConsolidatedTimesheetRow {
  employeeId: string;
  totalHours: OvertimeHours;
  totalDemerits: AttendanceDemerits;
  baseHours: number;
}

const ND_START_HOUR = 22; // 10 PM
const ND_END_HOUR = 6;    // 6 AM

function isNightDifferential(date: Date): boolean {
  const hour = date.getHours();
  return hour >= ND_START_HOUR || hour < ND_END_HOUR;
}

export function classifyDailyPunch(punch: DailyPunchLog): { baseHours: number; overtimeHours: OvertimeHours; demerits: AttendanceDemerits } {
  let baseHours = 0;
  const overtimeHours: OvertimeHours = {
    regular_ot: 0,
    regular_night: 0,
    regular_night_ot: 0,
    rest_day: 0,
    rest_day_ot: 0,
    rest_day_night: 0,
    rest_day_night_ot: 0,
    special_holiday: 0,
    special_holiday_ot: 0,
    special_holiday_night: 0,
    special_holiday_night_ot: 0,
    special_holiday_rest_day: 0,
    special_holiday_rest_day_ot: 0,
    special_holiday_rest_day_night: 0,
    special_holiday_rest_day_night_ot: 0,
    legal_holiday: 0,
    legal_holiday_ot: 0,
    legal_holiday_night: 0,
    legal_holiday_night_ot: 0
  };
  const demerits: AttendanceDemerits = {
    late_minutes: 0,
    undertime_minutes: 0,
    absences_days: 0
  };

  if (!punch.timeIn || !punch.timeOut) {
    demerits.absences_days = 1;
    return { baseHours, overtimeHours, demerits };
  }

  // Calculate late and undertime if scheduled times exist
  if (punch.scheduledTimeIn && punch.timeIn > punch.scheduledTimeIn) {
    demerits.late_minutes = Math.floor((punch.timeIn.getTime() - punch.scheduledTimeIn.getTime()) / 60000);
  }
  
  if (punch.scheduledTimeOut && punch.timeOut < punch.scheduledTimeOut) {
    demerits.undertime_minutes = Math.floor((punch.scheduledTimeOut.getTime() - punch.timeOut.getTime()) / 60000);
  }

  // Break time deduction: assume 1 hour break if they worked > 4 hours
  let totalMinutesWorked = (punch.timeOut.getTime() - punch.timeIn.getTime()) / 60000;
  if (totalMinutesWorked > 240) {
    totalMinutesWorked -= 60; // 1 hr lunch break
  }

  let remainingMinutes = totalMinutesWorked > 0 ? totalMinutesWorked : 0;
  let currentMinute = new Date(punch.timeIn);

  // We need to simulate minute by minute or hour by hour to correctly classify night diff
  // A simpler approach for the classifier utility:
  
  let baseMinutes = 0;
  let otMinutes = 0;
  let baseNdMinutes = 0;
  let otNdMinutes = 0;

  let totalCounted = 0;
  
  // Actually, we must skip the break time. Let's assume the break happens right in the middle, or we just count minutes and cap base at 8 hours.
  // To be precise with night diff, we just iterate through every minute they actually worked.
  // We'll skip the 60 minutes in the middle of their shift.
  const breakStartMin = totalMinutesWorked > 240 ? Math.floor((totalMinutesWorked + 60) / 2) - 30 : -1;
  const breakEndMin = breakStartMin > 0 ? breakStartMin + 60 : -1;

  let minuteCounter = 0;
  let actualWorkMinute = 0;

  while (actualWorkMinute < totalMinutesWorked && minuteCounter < (totalMinutesWorked + (totalMinutesWorked > 240 ? 60 : 0))) {
    const isBreak = breakStartMin !== -1 && minuteCounter >= breakStartMin && minuteCounter < breakEndMin;
    if (!isBreak) {
      const isNd = isNightDifferential(currentMinute);
      if (actualWorkMinute < 480) { // First 8 hours
        if (isNd) {
          baseNdMinutes++;
        } else {
          baseMinutes++;
        }
      } else { // Overtime
        if (isNd) {
          otNdMinutes++;
        } else {
          otMinutes++;
        }
      }
      actualWorkMinute++;
    }
    
    currentMinute.setMinutes(currentMinute.getMinutes() + 1);
    minuteCounter++;
  }

  const hoursBase = baseMinutes / 60;
  const hoursBaseNd = baseNdMinutes / 60;
  const hoursOt = otMinutes / 60;
  const hoursOtNd = otNdMinutes / 60;

  baseHours = hoursBase + hoursBaseNd;

  switch (punch.shiftType) {
    case 'REGULAR':
      overtimeHours.regular_night = hoursBaseNd;
      overtimeHours.regular_ot = hoursOt;
      overtimeHours.regular_night_ot = hoursOtNd;
      break;
    case 'REST_DAY':
      overtimeHours.rest_day = hoursBase;
      overtimeHours.rest_day_night = hoursBaseNd;
      overtimeHours.rest_day_ot = hoursOt;
      overtimeHours.rest_day_night_ot = hoursOtNd;
      baseHours = 0; // Handled by multiplier entirely? Standard DOLE rule implies all hours on rest day have a multiplier.
      break;
    case 'SPECIAL_HOLIDAY':
      overtimeHours.special_holiday = hoursBase;
      overtimeHours.special_holiday_night = hoursBaseNd;
      overtimeHours.special_holiday_ot = hoursOt;
      overtimeHours.special_holiday_night_ot = hoursOtNd;
      baseHours = 0;
      break;
    case 'SPECIAL_REST_DAY':
      overtimeHours.special_holiday_rest_day = hoursBase;
      overtimeHours.special_holiday_rest_day_night = hoursBaseNd;
      overtimeHours.special_holiday_rest_day_ot = hoursOt;
      overtimeHours.special_holiday_rest_day_night_ot = hoursOtNd;
      baseHours = 0;
      break;
    case 'LEGAL_HOLIDAY':
      overtimeHours.legal_holiday = hoursBase;
      overtimeHours.legal_holiday_night = hoursBaseNd;
      overtimeHours.legal_holiday_ot = hoursOt;
      overtimeHours.legal_holiday_night_ot = hoursOtNd;
      baseHours = 0;
      break;
  }

  return { baseHours, overtimeHours, demerits };
}

export function aggregateDtrRecords(records: DailyPunchLog[]): { totalHours: OvertimeHours; totalDemerits: AttendanceDemerits; totalBaseHours: number } {
  const totalHours: OvertimeHours = {
    regular_ot: 0,
    regular_night: 0,
    regular_night_ot: 0,
    rest_day: 0,
    rest_day_ot: 0,
    rest_day_night: 0,
    rest_day_night_ot: 0,
    special_holiday: 0,
    special_holiday_ot: 0,
    special_holiday_night: 0,
    special_holiday_night_ot: 0,
    special_holiday_rest_day: 0,
    special_holiday_rest_day_ot: 0,
    special_holiday_rest_day_night: 0,
    special_holiday_rest_day_night_ot: 0,
    legal_holiday: 0,
    legal_holiday_ot: 0,
    legal_holiday_night: 0,
    legal_holiday_night_ot: 0
  };
  const totalDemerits: AttendanceDemerits = {
    late_minutes: 0,
    undertime_minutes: 0,
    absences_days: 0
  };
  let totalBaseHours = 0;

  for (const record of records) {
    const { baseHours, overtimeHours, demerits } = classifyDailyPunch(record);
    totalBaseHours += baseHours;

    for (const key of Object.keys(totalHours) as (keyof OvertimeHours)[]) {
      totalHours[key] += overtimeHours[key];
    }
    
    totalDemerits.late_minutes += demerits.late_minutes;
    totalDemerits.undertime_minutes += demerits.undertime_minutes;
    totalDemerits.absences_days += demerits.absences_days;
  }

  return { totalHours, totalDemerits, totalBaseHours };
}
