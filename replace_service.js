const fs = require('fs');
let data = fs.readFileSync('src/main/services/payroll.service.ts', 'utf8');

const serviceReplacement = `async getPayrollSettings() {
    const settings = await prisma.systemSetting.findFirst()
    const fallback = {
      regular_ot_rate: 1.25,
      regular_night_rate: 1.10,
      regular_night_ot_rate: 1.375,
      rest_day_rate: 1.30,
      rest_day_ot_rate: 1.69,
      rest_day_night_rate: 1.43,
      rest_day_night_ot_rate: 1.859,
      special_holiday_rate: 1.30,
      special_holiday_ot_rate: 1.69,
      special_holiday_night_rate: 1.43,
      special_holiday_night_ot_rate: 1.859,
      special_holiday_rest_day_rate: 1.50,
      special_holiday_rest_day_ot_rate: 1.95,
      special_holiday_rest_day_night_rate: 1.65,
      special_holiday_rest_day_night_ot_rate: 2.145,
      legal_holiday_rate: 2.00
    };

    if (!settings) {
      return fallback;
    }

    return {
      regular_ot_rate: Number(settings.regular_ot_rate) || fallback.regular_ot_rate,
      regular_night_rate: Number(settings.regular_night_rate) || fallback.regular_night_rate,
      regular_night_ot_rate: Number(settings.regular_night_ot_rate) || fallback.regular_night_ot_rate,
      rest_day_rate: Number(settings.rest_day_rate) || fallback.rest_day_rate,
      rest_day_ot_rate: Number(settings.rest_day_ot_rate) || fallback.rest_day_ot_rate,
      rest_day_night_rate: Number(settings.rest_day_night_rate) || fallback.rest_day_night_rate,
      rest_day_night_ot_rate: Number(settings.rest_day_night_ot_rate) || fallback.rest_day_night_ot_rate,
      special_holiday_rate: Number(settings.special_holiday_rate) || fallback.special_holiday_rate,
      special_holiday_ot_rate: Number(settings.special_holiday_ot_rate) || fallback.special_holiday_ot_rate,
      special_holiday_night_rate: Number(settings.special_holiday_night_rate) || fallback.special_holiday_night_rate,
      special_holiday_night_ot_rate: Number(settings.special_holiday_night_ot_rate) || fallback.special_holiday_night_ot_rate,
      special_holiday_rest_day_rate: Number(settings.special_holiday_rest_day_rate) || fallback.special_holiday_rest_day_rate,
      special_holiday_rest_day_ot_rate: Number(settings.special_holiday_rest_day_ot_rate) || fallback.special_holiday_rest_day_ot_rate,
      special_holiday_rest_day_night_rate: Number(settings.special_holiday_rest_day_night_rate) || fallback.special_holiday_rest_day_night_rate,
      special_holiday_rest_day_night_ot_rate: Number(settings.special_holiday_rest_day_night_ot_rate) || fallback.special_holiday_rest_day_night_ot_rate,
      legal_holiday_rate: Number(settings.legal_holiday_rate) || fallback.legal_holiday_rate
    };
  }`;

data = data.replace(/async getPayrollSettings\(\) \{[\s\S]*?legal_holiday_rate: Number\(settings\.legal_holiday_rate\) \|\| 2\.00\s*\n\s*\}/, serviceReplacement);

fs.writeFileSync('src/main/services/payroll.service.ts', data);
