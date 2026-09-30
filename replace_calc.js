const fs = require('fs');
let data = fs.readFileSync('src/main/services/payroll-calculator.ts', 'utf8');

const interfaceReplacement = `export interface PayrollMultipliers {
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
}`;

data = data.replace(/export interface PayrollMultipliers \{[\s\S]*?export interface OvertimeHours \{[\s\S]*?\}/, interfaceReplacement);

const calcReplacement = `export function calculateOvertimeAndDiff(hourlyRate: number, hours: OvertimeHours, multipliers: PayrollMultipliers): number {
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
}`;

data = data.replace(/export function calculateOvertimeAndDiff\([\s\S]*?\)\s*:\s*number\s*\{[\s\S]*?\n\}/, calcReplacement);

fs.writeFileSync('src/main/services/payroll-calculator.ts', data);
