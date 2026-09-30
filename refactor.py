import re

with open('src/renderer/src/components/PayrollView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
content = content.replace("import * as XLSX from 'xlsx'", "import * as XLSX from 'xlsx'\nimport { PayrollDirectoryTab } from './payroll/PayrollDirectoryTab'\nimport { PayrollHistoryTab } from './payroll/PayrollHistoryTab'")

# Change view state
content = content.replace("useState<'RUN' | 'DIRECTORY' | 'HISTORY'>('RUN')", "useState<'GRID' | 'SETTINGS' | 'IMPORT' | 'HISTORY' | 'DIRECTORY'>('GRID')")

# Change fetch triggers
content = content.replace("if (view === 'RUN')", "if (view === 'GRID')")

# Fix the header tabs
old_tabs = r"""<div className="flex bg-\[#FBF8F8\] p-1\.5 rounded-lg border border-\[#B0DCDA\] shadow-inner">.*?</div>"""
new_tabs = """<div className="flex bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner gap-1">
            <button
              onClick={() => {
                setView('GRID')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'GRID' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              Payroll Grid
            </button>
            <button
              onClick={() => {
                setView('SETTINGS')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'SETTINGS' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              DOLE Settings
            </button>
            <button
              onClick={() => {
                setView('IMPORT')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'IMPORT' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              DTR Import
            </button>
            <button
              onClick={() => {
                setView('HISTORY')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'HISTORY' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              History
            </button>
            <button
              onClick={() => {
                setView('DIRECTORY')
                setStatus(null)
              }}
              className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'DIRECTORY' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}
            >
              Directory
            </button>
          </div>"""
content = re.sub(old_tabs, new_tabs, content, flags=re.DOTALL)

# Replace the views
content = content.replace("view === 'RUN'", "view === 'GRID'")

# Remove HISTORY TAB block and insert component
content = re.sub(r"\{\/\* ========================================== \*\/\}\n\s*\{\/\* PAYSLIP HISTORY TAB                        \*\/\}.*?\{\/\* ========================================== \*\/\}\n\s*\{\/\* EMPLOYEE DIRECTORY TAB", " {/* HISTORY TAB */}\n        {view === 'HISTORY' && <PayrollHistoryTab payrollHistory={payrollHistory} />}\n\n        {/* DIRECTORY TAB", content, flags=re.DOTALL)

# Remove DIRECTORY TAB and MODALS block and insert component
content = re.sub(r"\{\/\* ========================================== \*\/\}\n\s*\{\/\* EMPLOYEE DIRECTORY TAB \(Overhauled UI\).*?</div>\n    </div>\n  \)\n\}", " {/* DIRECTORY TAB */}\n        {view === 'DIRECTORY' && <PayrollDirectoryTab employees={employees} fetchEmployees={fetchEmployees} setStatus={setStatus} />}\n\n        {/* PLACEHOLDERS for Settings and Import */}\n        {view === 'SETTINGS' && <div className=\"p-8 text-center text-gray-500\">DOLE Settings Placeholder</div>}\n        {view === 'IMPORT' && <div className=\"p-8 text-center text-gray-500\">DTR Import Placeholder</div>}\n      </div>\n    </div>\n  )\n}", content, flags=re.DOTALL)

# We need to remove the helper functions formatTIN, formatSSS, etc.
content = re.sub(r"// --- ID Formatting Masks \(Philippines\) ---.*?const formatPHIC =.*?return num\.replace.*?\}\)\n  \}", "", content, flags=re.DOTALL)

# Remove handleSaveEmployee, openEditEmployee, confirmToggleStatus
content = re.sub(r"const handleSaveEmployee = async.*?\}\n  \}", "", content, flags=re.DOTALL)
content = re.sub(r"const openEditEmployee = \(emp.*?\}\n  \}", "", content, flags=re.DOTALL)
content = re.sub(r"const confirmToggleStatus = async.*?\}\n  \}", "", content, flags=re.DOTALL)

# Also remove filteredEmployees and filteredHistory
content = re.sub(r"// Filtered Data.*?return \(", "return (", content, flags=re.DOTALL)

with open('src/renderer/src/components/PayrollView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
