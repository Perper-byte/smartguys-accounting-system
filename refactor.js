const fs = require('fs');
const path = require('path');

let content = fs.readFileSync('src/renderer/src/components/PayrollView.tsx', 'utf-8');

// Add imports
content = content.replace("import * as XLSX from 'xlsx'", "import * as XLSX from 'xlsx'\nimport { PayrollDirectoryTab } from './payroll/PayrollDirectoryTab'\nimport { PayrollHistoryTab } from './payroll/PayrollHistoryTab'")

// Change view state
content = content.replace("useState<'RUN' | 'DIRECTORY' | 'HISTORY'>('RUN')", "useState<'GRID' | 'SETTINGS' | 'IMPORT' | 'HISTORY' | 'DIRECTORY'>('GRID')")

// Change fetch triggers
content = content.replace("if (view === 'RUN')", "if (view === 'GRID')")

// Fix the header tabs
const oldTabsRegex = /<div className="flex bg-\[#FBF8F8\] p-1\.5 rounded-lg border border-\[#B0DCDA\] shadow-inner">.*?<\/div>/s;
const newTabs = `<div className="flex bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner gap-1">
            <button
              onClick={() => {
                setView('GRID')
                setStatus(null)
              }}
              className={\`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer \${view === 'GRID' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}\`}
            >
              Payroll Grid
            </button>
            <button
              onClick={() => {
                setView('SETTINGS')
                setStatus(null)
              }}
              className={\`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer \${view === 'SETTINGS' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}\`}
            >
              DOLE Settings
            </button>
            <button
              onClick={() => {
                setView('IMPORT')
                setStatus(null)
              }}
              className={\`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer \${view === 'IMPORT' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}\`}
            >
              DTR Import
            </button>
            <button
              onClick={() => {
                setView('HISTORY')
                setStatus(null)
              }}
              className={\`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer \${view === 'HISTORY' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}\`}
            >
              History
            </button>
            <button
              onClick={() => {
                setView('DIRECTORY')
                setStatus(null)
              }}
              className={\`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer \${view === 'DIRECTORY' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}\`}
            >
              Directory
            </button>
          </div>`;
content = content.replace(oldTabsRegex, newTabs);

// Replace the views
content = content.replace(/view === 'RUN'/g, "view === 'GRID'");

// Remove HISTORY TAB block and insert component
content = content.replace(/\{\/\* ========================================== \*\/\}\n\s*\{\/\* PAYSLIP HISTORY TAB                        \*\/\}.*?\{\/\* ========================================== \*\/\}\n\s*\{\/\* EMPLOYEE DIRECTORY TAB/s, 
" {/* HISTORY TAB */}\n        {view === 'HISTORY' && <PayrollHistoryTab payrollHistory={payrollHistory} />}\n\n        {/* DIRECTORY TAB");

// Remove DIRECTORY TAB and MODALS block and insert component
content = content.replace(/\{\/\* ========================================== \*\/\}\n\s*\{\/\* EMPLOYEE DIRECTORY TAB \(Overhauled UI\).*?<\/div>\n    <\/div>\n  \)\n\}/s, 
" {/* DIRECTORY TAB */}\n        {view === 'DIRECTORY' && <PayrollDirectoryTab employees={employees} fetchEmployees={fetchEmployees} setStatus={setStatus} />}\n\n        {/* PLACEHOLDERS for Settings and Import */}\n        {view === 'SETTINGS' && <div className=\"p-8 text-center text-gray-500\">DOLE Settings Placeholder</div>}\n        {view === 'IMPORT' && <div className=\"p-8 text-center text-gray-500\">DTR Import Placeholder</div>}\n      </div>\n    </div>\n  )\n}");

// We need to remove the helper functions formatTIN, formatSSS, etc.
content = content.replace(/\/\/ --- ID Formatting Masks \(Philippines\) ---.*?const formatPHIC =.*?return num\.replace.*?\}\)\n  \}/s, "");

// Remove handleSaveEmployee, openEditEmployee, confirmToggleStatus
content = content.replace(/const handleSaveEmployee = async.*?\}\n  \}/s, "");
content = content.replace(/const openEditEmployee = \(emp.*?\}\n  \}/s, "");
content = content.replace(/const confirmToggleStatus = async.*?\}\n  \}/s, "");

// Also remove filteredEmployees and filteredHistory
content = content.replace(/\/\/ Filtered Data.*?return \(/s, "return (");

fs.writeFileSync('src/renderer/src/components/PayrollView.tsx', content);
