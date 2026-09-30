export interface PayrollMultipliers {
  ot_rate: number;
  night_diff_rate: number;
  rest_day_rate: number;
  special_holiday_rate: number;
  legal_holiday_rate: number;
}

export interface OvertimeHours {
  regular_ot: number;
  night_diff: number;
  rest_day: number;
  special_holiday: number;
  legal_holiday: number;
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
  total += (hours.regular_ot || 0) * hourlyRate * multipliers.ot_rate;
  total += (hours.night_diff || 0) * hourlyRate * multipliers.night_diff_rate;
  total += (hours.rest_day || 0) * hourlyRate * multipliers.rest_day_rate;
  total += (hours.special_holiday || 0) * hourlyRate * multipliers.special_holiday_rate;
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
