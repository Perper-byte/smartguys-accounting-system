const fs = require('fs');
let data = fs.readFileSync('prisma/schema.prisma', 'utf8');
const search =   // Dynamic Payroll Multipliers (Default Philippine DOLE standard multipliers)
  ot_rate            Decimal @default(1.25) @db.Decimal(5, 4) // Regular Overtime (125%)
  night_diff_rate    Decimal @default(0.10) @db.Decimal(5, 4) // Night Differential (10%)
  rest_day_rate      Decimal @default(1.30) @db.Decimal(5, 4) // Rest Day Work (130%)
  special_holiday_rate Decimal @default(1.30) @db.Decimal(5, 4) // Special Non-Working Day (130%)
  legal_holiday_rate   Decimal @default(2.00) @db.Decimal(5, 4) // Regular/Legal Holiday (200%);
const replace =   // Dynamic Payroll Multipliers (Default Philippine DOLE standard multipliers)
  regular_ot_rate            Decimal @default(1.25) @db.Decimal(5, 4)
  regular_night_rate         Decimal @default(1.10) @db.Decimal(5, 4)
  regular_night_ot_rate      Decimal @default(1.375) @db.Decimal(5, 4)
  rest_day_rate              Decimal @default(1.30) @db.Decimal(5, 4)
  rest_day_ot_rate           Decimal @default(1.69) @db.Decimal(5, 4)
  rest_day_night_rate        Decimal @default(1.43) @db.Decimal(5, 4)
  rest_day_night_ot_rate     Decimal @default(1.859) @db.Decimal(5, 4)
  special_holiday_rate       Decimal @default(1.30) @db.Decimal(5, 4)
  special_holiday_ot_rate    Decimal @default(1.69) @db.Decimal(5, 4)
  special_holiday_night_rate Decimal @default(1.43) @db.Decimal(5, 4)
  special_holiday_night_ot_rate Decimal @default(1.859) @db.Decimal(5, 4)
  special_holiday_rest_day_rate Decimal @default(1.50) @db.Decimal(5, 4)
  special_holiday_rest_day_ot_rate Decimal @default(1.95) @db.Decimal(5, 4)
  special_holiday_rest_day_night_rate Decimal @default(1.65) @db.Decimal(5, 4)
  special_holiday_rest_day_night_ot_rate Decimal @default(2.145) @db.Decimal(5, 4)
  legal_holiday_rate         Decimal @default(2.00) @db.Decimal(5, 4);
data = data.replace(search, replace);
data = data.replace(search.replace(/\r\n/g, '\n'), replace); // fallback
fs.writeFileSync('prisma/schema.prisma', data);
