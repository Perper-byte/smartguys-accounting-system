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
