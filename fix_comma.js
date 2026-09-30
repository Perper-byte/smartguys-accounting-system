const fs = require('fs');
let data = fs.readFileSync('src/main/services/payroll.service.ts', 'utf8');
data = data.replace(/  \},\s*\n\s*\},\s*\n\s*async calculateEmployeePayroll/, `  },\n\n  async calculateEmployeePayroll`);
fs.writeFileSync('src/main/services/payroll.service.ts', data);
