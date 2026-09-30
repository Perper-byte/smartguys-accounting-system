const fs = require('fs');
let data = fs.readFileSync('src/main/services/payroll.service.ts', 'utf8');
data = data.replace(/legal_holiday_rate: Number\(settings\.legal_holiday_rate\) \|\| fallback\.legal_holiday_rate\s*\n\s*\};\s*\}/, `legal_holiday_rate: Number(settings.legal_holiday_rate) || fallback.legal_holiday_rate\n    };\n  },`);
fs.writeFileSync('src/main/services/payroll.service.ts', data);
