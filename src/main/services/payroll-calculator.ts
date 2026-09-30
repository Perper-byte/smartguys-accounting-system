export interface PayrollMultipliers {
  regular_ot_rate: number;
  regular_night_rate: number;
  regular_night_ot_rate: number;
  rest_day_rate: number;
  rest_day_ot_rate: number;
  rest_day_night_rate: number;
  rest_day_night_ot_rate: number;
  special_holiday_rate: number;
  special_holiday_ot_rate: number;
  special_holiday_night_rate: number;
  special_holiday_night_ot_rate: number;
  special_holiday_rest_day_rate: number;
  special_holiday_rest_day_ot_rate: number;
  special_holiday_rest_day_night_rate: number;
  special_holiday_rest_day_night_ot_rate: number;
  legal_holiday_rate: number;
}

export interface OvertimeHours {
  regular_ot?: number;
  regular_night?: number;
  regular_night_ot?: number;
  rest_day?: number;
  rest_day_ot?: number;
  rest_day_night?: number;
  rest_day_night_ot?: number;
  special_holiday?: number;
  special_holiday_ot?: number;
  special_holiday_night?: number;
  special_holiday_night_ot?: number;
  special_holiday_rest_day?: number;
  special_holiday_rest_day_ot?: number;
  special_holiday_rest_day_night?: number;
  special_holiday_rest_day_night_ot?: number;
  legal_holiday?: number;
}

export interface StatutoryRateTables {
  sss: any[];
  philhealth: any[];
  pagibig: any[];
}

export function calculateHourlyRate(monthlySalary: number): number {
  return (monthlySalary * 12) / 261 / 8;
}

export function calculateOvertimeAndDiff(hourlyRate: number, hours: OvertimeHours, multipliers: PayrollMultipliers): number {
  let total = 0;
  total += (hours.regular_ot || 0) * hourlyRate * multipliers.regular_ot_rate;
  total += (hours.regular_night || 0) * hourlyRate * multipliers.regular_night_rate;
  total += (hours.regular_night_ot || 0) * hourlyRate * multipliers.regular_night_ot_rate;
  total += (hours.rest_day || 0) * hourlyRate * multipliers.rest_day_rate;
  total += (hours.rest_day_ot || 0) * hourlyRate * multipliers.rest_day_ot_rate;
  total += (hours.rest_day_night || 0) * hourlyRate * multipliers.rest_day_night_rate;
  total += (hours.rest_day_night_ot || 0) * hourlyRate * multipliers.rest_day_night_ot_rate;
  total += (hours.special_holiday || 0) * hourlyRate * multipliers.special_holiday_rate;
  total += (hours.special_holiday_ot || 0) * hourlyRate * multipliers.special_holiday_ot_rate;
  total += (hours.special_holiday_night || 0) * hourlyRate * multipliers.special_holiday_night_rate;
  total += (hours.special_holiday_night_ot || 0) * hourlyRate * multipliers.special_holiday_night_ot_rate;
  total += (hours.special_holiday_rest_day || 0) * hourlyRate * multipliers.special_holiday_rest_day_rate;
  total += (hours.special_holiday_rest_day_ot || 0) * hourlyRate * multipliers.special_holiday_rest_day_ot_rate;
  total += (hours.special_holiday_rest_day_night || 0) * hourlyRate * multipliers.special_holiday_rest_day_night_rate;
  total += (hours.special_holiday_rest_day_night_ot || 0) * hourlyRate * multipliers.special_holiday_rest_day_night_ot_rate;
  total += (hours.legal_holiday || 0) * hourlyRate * multipliers.legal_holiday_rate;
  return total;
}

export function calculateStatutoryDeductions(monthlySalary: number, rateTables: StatutoryRateTables) {
  const sss = { ee: 0, er: 0 };
  const philhealth = { ee: 0, er: 0 };
  const pagibig = { ee: 0, er: 0 };

  if (rateTables.sss) {
    const sssRow = rateTables.sss.find(r => monthlySalary >= Number(r.min_salary) && monthlySalary <= Number(r.max_salary));
    if (sssRow) {
      sss.ee = Number(sssRow.fixed_ee_amount) || (monthlySalary * Number(sssRow.ee_rate));
      sss.er = Number(sssRow.fixed_er_amount) || (monthlySalary * Number(sssRow.er_rate));
    }
  }

  if (rateTables.philhealth) {
    const phRow = rateTables.philhealth.find(r => monthlySalary >= Number(r.min_salary) && monthlySalary <= Number(r.max_salary));
    if (phRow) {
      philhealth.ee = Number(phRow.fixed_ee_amount) || (monthlySalary * Number(phRow.ee_rate));
      philhealth.er = Number(phRow.fixed_er_amount) || (monthlySalary * Number(phRow.er_rate));
    }
  }

  if (rateTables.pagibig) {
    const piRow = rateTables.pagibig.find(r => monthlySalary >= Number(r.min_salary) && monthlySalary <= Number(r.max_salary));
    if (piRow) {
      pagibig.ee = Number(piRow.fixed_ee_amount) || (monthlySalary * Number(piRow.ee_rate));
      pagibig.er = Number(piRow.fixed_er_amount) || (monthlySalary * Number(piRow.er_rate));
    }
  }

  return { sss, philhealth, pagibig };
}

export interface AttendanceDemerits {
  late_minutes: number;
  undertime_hours: number;
  undertime_minutes: number;
  absence_days: number;
}

export interface DemeritBreakdown {
  late_deduction: number;
  undertime_deduction: number;
  absence_deduction: number;
  total_demerits: number;
}

export interface SSSContributionResult {
  regular_ee: number;
  regular_er: number;
  wisp_ee: number;
  wisp_er: number;
  ec: number;
  total_ee: number;
  total_er: number;
}

export interface PhilHealthResult {
  totalPremium: number;
  eeShare: number;
  erShare: number;
}

export interface PagIbigResult {
  totalPremium: number;
  eeShare: number;
  erShare: number;
}

export interface StatutoryResult {
  sss: SSSContributionResult;
  philhealth: PhilHealthResult;
  pagibig: PagIbigResult;
}

export function calculateAttendanceDemerits(hourlyRate: number, demerits: AttendanceDemerits): DemeritBreakdown {
  const minuteRate = hourlyRate / 60;
  const dailyRate = hourlyRate * 8;

  const late_deduction = (demerits.late_minutes || 0) * minuteRate;
  const undertime_deduction = ((demerits.undertime_hours || 0) * hourlyRate) + ((demerits.undertime_minutes || 0) * minuteRate);
  const absence_deduction = (demerits.absence_days || 0) * dailyRate;

  const total_demerits = late_deduction + undertime_deduction + absence_deduction;

  return {
    late_deduction,
    undertime_deduction,
    absence_deduction,
    total_demerits
  };
}

export function getSSSMonthlySalaryCredit(compensation: number): number {
  if (compensation < 5250) return 5000;
  if (compensation >= 34750) return 35000;
  return Math.min(35000, Math.floor((compensation - 5250) / 500) * 500 + 5500);
}

export function calculateSSSContribution(monthlySalary: number): SSSContributionResult {
  const msc = getSSSMonthlySalaryCredit(monthlySalary);
  
  let regular_msc = msc;
  let wisp_msc = 0;
  
  if (msc > 20000) {
    regular_msc = 20000;
    wisp_msc = Math.min(15000, Math.max(0, msc - 20000));
  }
  
  const regular_ee = regular_msc * 0.05;
  const regular_er = regular_msc * 0.10;
  
  const wisp_ee = wisp_msc * 0.05;
  const wisp_er = wisp_msc * 0.10;
  
  const ec = msc >= 20000 ? 30 : 10;
  
  const total_ee = regular_ee + wisp_ee;
  const total_er = regular_er + wisp_er + ec;
  
  return {
    regular_ee,
    regular_er,
    wisp_ee,
    wisp_er,
    ec,
    total_ee,
    total_er
  };
}

export function calculatePhilHealthContribution(monthlySalary: number): PhilHealthResult {
  const clamped = Math.min(100000, Math.max(10000, monthlySalary));
  const totalPremium = Math.round(clamped * 0.05 * 100) / 100;
  const eeShare = Math.round((totalPremium / 2) * 100) / 100;
  const erShare = Math.round((totalPremium - eeShare) * 100) / 100;
  
  return {
    totalPremium,
    eeShare,
    erShare
  };
}

export function calculatePagIbigContribution(monthlySalary: number): PagIbigResult {
  const mfs = Math.min(10000, monthlySalary);
  let eeShare = 0;
  let erShare = 0;
  
  if (monthlySalary <= 1500) {
    eeShare = mfs * 0.01;
    erShare = mfs * 0.02;
  } else {
    eeShare = mfs * 0.02;
    erShare = mfs * 0.02;
  }
  
  eeShare = Math.min(200, eeShare);
  erShare = Math.min(200, erShare);
  
  return {
    totalPremium: eeShare + erShare,
    eeShare,
    erShare
  };
}

export function calculateWithholdingTax(taxableIncome: number, period: 'SEMI_MONTHLY' | 'MONTHLY'): number {
  if (period === 'SEMI_MONTHLY') {
    if (taxableIncome <= 10417) return 0;
    if (taxableIncome <= 16666) return 0 + ((taxableIncome - 10417) * 0.15);
    if (taxableIncome <= 33332) return 937.50 + ((taxableIncome - 16667) * 0.20);
    if (taxableIncome <= 83332) return 4270.70 + ((taxableIncome - 33333) * 0.25);
    if (taxableIncome <= 333332) return 16770.70 + ((taxableIncome - 83333) * 0.30);
    return 91770.70 + ((taxableIncome - 333333) * 0.35);
  } else {
    if (taxableIncome <= 20833) return 0;
    if (taxableIncome <= 33332) return 0 + ((taxableIncome - 20833) * 0.15);
    if (taxableIncome <= 66666) return 1875.00 + ((taxableIncome - 33333) * 0.20);
    if (taxableIncome <= 166666) return 8541.80 + ((taxableIncome - 66667) * 0.25);
    if (taxableIncome <= 666666) return 33541.80 + ((taxableIncome - 166667) * 0.30);
    return 183541.80 + ((taxableIncome - 666667) * 0.35);
  }
}
