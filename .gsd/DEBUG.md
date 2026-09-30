status: fixed
issue: Application crashes to a blank white screen (white screen of death) on load / navigation.
root_cause: PayrollView.tsx contained raw duplicate inline code for the 'DIRECTORY' view referencing undefined variables (moved to PayrollDirectoryTab), causing a React rendering ReferenceError crash.
fix: Replaced the raw inline directory code with the <PayrollDirectoryTab /> component in PayrollView.tsx (commit 7e72550)
