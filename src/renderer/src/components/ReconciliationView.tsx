import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

type BankAccount = { id: string; name: string; account_number?: string | null; ledger_account: string; ledger_account_ref?: { name: string } };
type BankTransaction = { id: string; transaction_date: string; description: string; reference_no?: string | null; amount: number; status: string; matchedEntry?: { reference_no: string } | null };
type LedgerEntry = { id: string; date: string; referenceNo: string; description: string; amount: number };
type ImportRow = { date: string; description: string; referenceNo: string; amount: number };
type DateFormat = 'AUTO' | 'MDY' | 'DMY';

const dateValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (value: number) => `₱ ${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ReconciliationView({ userId }: { userId: string }) {
  const today = new Date();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState('');
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [startDate, setStartDate] = useState(dateValue(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(dateValue(today));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Modals
  const [showSetup, setShowSetup] = useState(false);
  const [setup, setSetup] = useState({ name: '', accountNumber: '', ledgerAccount: '' });
  const [newTransaction, setNewTransaction] = useState({ date: dateValue(today), description: '', referenceNo: '', amount: '' });
  const [transactionToRemove, setTransactionToRemove] = useState<BankTransaction | null>(null);
  
  // Imports
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [dateFormat, setDateFormat] = useState<DateFormat>('AUTO');
  const [statementOpening, setStatementOpening] = useState('');
  const [statementClosing, setStatementClosing] = useState('');
  const loadRequestRef = useRef(0);

  const api = (window as any).api || (window as any).electronAPI;
  const selectedTransaction = transactions.find(transaction => transaction.id === selectedTransactionId);

  const loadAccounts = useCallback(async () => {
    const [bankData, accountData] = await Promise.all([api.getBankAccounts(), api.getAccounts()]);
    setAccounts(Array.isArray(bankData) ? bankData : []);
    setLedgerAccounts(Array.isArray(accountData) ? accountData : []);
    if (!accountId && bankData?.[0]) setAccountId(bankData[0].id);
  }, [api, accountId]);

  const loadData = useCallback(async () => {
    if (!accountId) return;
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const data = await api.getReconciliationData(accountId, startDate, endDate);
      if (requestId !== loadRequestRef.current) return;
      if (data?.error) setStatus({ type: 'error', message: data.error });
      else { setTransactions(data.transactions || []); setEntries(data.entries || []); }
    } catch {
      if (requestId === loadRequestRef.current) setStatus({ type: 'error', message: 'Could not load reconciliation activity.' });
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [api, accountId, startDate, endDate]);

  useEffect(() => { loadAccounts().catch(() => setStatus({ type: 'error', message: 'Could not load bank accounts.' })); }, [loadAccounts]);
  useEffect(() => { loadData(); }, [loadData]);

  const unmatched = transactions.filter(transaction => transaction.status === 'UNMATCHED');
  const matched = transactions.filter(transaction => transaction.status === 'MATCHED');
  const unmatchedBankTotal = unmatched.reduce((total, transaction) => total + transaction.amount, 0);
  const candidateTotal = entries.reduce((total, entry) => total + entry.amount, 0);
  
  const suggestedEntries = useMemo(() => {
    if (!selectedTransaction) return entries;
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const reference = normalize(selectedTransaction.reference_no || '');
    const description = normalize(selectedTransaction.description);
    const score = (entry: LedgerEntry) => {
      const amountScore = Math.abs(entry.amount - selectedTransaction.amount) < 0.01 ? 1000 : -Math.abs(entry.amount - selectedTransaction.amount);
      const referenceScore = reference && normalize(entry.referenceNo).includes(reference) ? 200 : 0;
      const descriptionScore = description ? description.split(/\s+/).filter(word => word.length > 3 && normalize(entry.description).includes(word)).length * 10 : 0;
      const days = Math.abs(new Date(entry.date).getTime() - new Date(selectedTransaction.transaction_date).getTime()) / 86400000;
      return amountScore + referenceScore + descriptionScore - days;
    };
    return [...entries].sort((a, b) => score(b) - score(a));
  }, [entries, selectedTransaction]);

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await api.createBankAccount(setup);
    if (!result?.success) return setStatus({ type: 'error', message: result?.error || 'Could not create bank account.' });
    setSetup({ name: '', accountNumber: '', ledgerAccount: '' });
    setShowSetup(false);
    setStatus({ type: 'success', message: 'Bank account added.' });
    await loadAccounts();
    setAccountId(result.data.id);
  };

  const addTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountId || !newTransaction.description || !Number(newTransaction.amount)) {
      return setStatus({ type: 'error', message: 'Date, description, and a non-zero amount are required.' });
    }
    const result = await api.createBankTransaction({ ...newTransaction, bankAccountId: accountId, amount: Number(newTransaction.amount) });
    if (!result || !result.success) return setStatus({ type: 'error', message: result?.error || 'Could not add transaction.' });
    
    setNewTransaction({ date: dateValue(today), description: '', referenceNo: '', amount: '' });
    setStatus({ type: 'success', message: 'Bank transaction added to the queue.' });
    await loadData();
  };

  const match = async (entryId: string) => {
    if (!selectedTransactionId) return;
    const result = await api.matchBankTransaction(selectedTransactionId, entryId, userId);
    if (!result?.success) return setStatus({ type: 'error', message: result?.error || 'Could not match transaction.' });
    setSelectedTransactionId('');
    setStatus({ type: 'success', message: 'Transaction reconciled.' });
    await loadData();
  };

  const unmatch = async (transactionId: string) => {
    const result = await api.unmatchBankTransaction(transactionId);
    if (!result?.success) return setStatus({ type: 'error', message: result?.error || 'Could not undo match.' });
    setStatus({ type: 'success', message: 'Match removed.' });
    await loadData();
  };

  const initiateRemove = (transaction: BankTransaction) => {
    if (transaction.status !== 'UNMATCHED') return;
    setTransactionToRemove(transaction);
  };

  const removeTransaction = async () => {
    if (!transactionToRemove) return;
    const result = await api.removeBankTransaction(transactionToRemove.id, userId);
    if (!result?.success) return setStatus({ type: 'error', message: result?.error || 'Could not remove bank transaction.' });
    
    setTransactionToRemove(null);
    setSelectedTransactionId(current => current === transactionToRemove.id ? '' : current);
    setStatus({ type: 'success', message: 'Bank transaction removed from the queue.' });
    await loadData();
  };

  const normalizeHeader = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const parseImportDate = (value: unknown) => {
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return dateValue(new Date(parsed.y, parsed.m - 1, parsed.d));
    }
    const text = String(value ?? '').trim();
    const parts = text.split(/[/-]/).map(Number);
    let parsed: Date;
    if (parts.length === 3 && parts.every(Number.isFinite) && dateFormat !== 'AUTO') {
      const [first, second, third] = parts;
      parsed = dateFormat === 'DMY' ? new Date(third, second - 1, first) : new Date(third, first - 1, second);
    } else { parsed = new Date(text); }
    return Number.isNaN(parsed.getTime()) ? '' : dateValue(parsed);
  };
  const parseImportAmount = (value: unknown) => {
    const text = String(value ?? '').trim().replace(/[₱$€£,\s]/g, '');
    if (text.startsWith('(') && text.endsWith(')')) return -Number(text.slice(1, -1));
    return Number(text);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const headerRow = rows.findIndex(row => row.some(cell => ['date', 'transactiondate', 'description', 'details', 'amount', 'debit', 'credit'].includes(normalizeHeader(cell))));
      if (headerRow < 0) throw new Error('Could not find a header row. Expected Date, Description, and Amount columns.');

      const headers = rows[headerRow].map(normalizeHeader);
      const findColumn = (names: string[]) => headers.findIndex(header => names.includes(header));
      const dateColumn = findColumn(['date', 'transactiondate', 'valuedate']);
      const descriptionColumn = findColumn(['description', 'details', 'narration', 'particulars', 'transactiondescription']);
      const referenceColumn = findColumn(['reference', 'referenceno', 'transactionid', 'checkno', 'checknumber']);
      const amountColumn = findColumn(['amount', 'transactionamount']);
      const debitColumn = findColumn(['debit', 'withdrawal', 'withdrawals']);
      const creditColumn = findColumn(['credit', 'deposit', 'deposits']);
      if (dateColumn < 0 || descriptionColumn < 0 || (amountColumn < 0 && debitColumn < 0 && creditColumn < 0)) throw new Error('Required columns are missing. Include Date, Description, and Amount, or Debit/Credit columns.');

      const parsedRows = rows.slice(headerRow + 1).map(row => {
        const debit = debitColumn >= 0 ? parseImportAmount(row[debitColumn]) : 0;
        const credit = creditColumn >= 0 ? parseImportAmount(row[creditColumn]) : 0;
        const amount = amountColumn >= 0 ? parseImportAmount(row[amountColumn]) : credit - debit;
        return { date: parseImportDate(row[dateColumn]), description: String(row[descriptionColumn] ?? '').trim(), referenceNo: referenceColumn >= 0 ? String(row[referenceColumn] ?? '').trim() : '', amount };
      }).filter(row => row.date || row.description || row.amount);
      const invalidRows = parsedRows.filter(row => !row.date || !row.description || !Number.isFinite(row.amount) || row.amount === 0);
      if (invalidRows.length) throw new Error(`${invalidRows.length} row(s) have an invalid date, description, or non-zero amount.`);
      if (!parsedRows.length) throw new Error('No transaction rows found in the file.');
      setImportRows(parsedRows);
      setImportFileName(file.name);
      setStatus(null);
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Could not read the bank statement file.' });
    }
  };

  const confirmImport = async () => {
    if (!accountId || !importRows.length) return;
    setImporting(true);
    const result = await api.importBankTransactions({ bankAccountId: accountId, userId, fileName: importFileName, transactions: importRows });
    
    if (result?.error || result?.count === undefined) {
      setStatus({ type: 'error', message: result?.error || 'Could not import bank transactions.' });
      setImporting(false);
      return;
    }
    
    setImportRows([]);
    setImportFileName('');
    const skippedMessage = result.skippedCount ? ` ${result.skippedCount} duplicate(s) skipped.` : '';
    setStatus({ type: 'success', message: `${result.count} bank transaction(s) imported successfully.${skippedMessage}` });
    setImporting(false);
    await loadData();
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4 lg:p-8 bg-gray-50/30">
      <div className="w-full max-w-7xl h-full flex flex-col font-sans text-gray-800 bg-white shadow-sm border border-transparent rounded-xl p-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Bank Reconciliation</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">Match bank activity to posted ledger entries and keep the cash balance explainable.</p>
          </div>
          
          {/* UX FIX: Only show Import and Add Account actions if accounts exist */}
          {accounts.length > 0 && (
            <div className="flex items-center gap-3">
              {/* UX FIX: CSV Date format is strictly tied to importing. Moved it here and clarified the label. */}
              <select 
                title="Format parsing for CSV imports"
                value={dateFormat} 
                onChange={event => setDateFormat(event.target.value as DateFormat)} 
                className="px-3 py-2.5 bg-white hover:bg-[#FBF8F8] border border-[#B0DCDA] rounded-md text-[11px] font-extrabold text-[#1B9387] cursor-pointer transition shadow-sm uppercase tracking-wider outline-none"
              >
                <option value="AUTO">CSV Date: Auto</option>
                <option value="MDY">CSV Date: MM/DD/YY</option>
                <option value="DMY">CSV Date: DD/MM/YY</option>
              </select>
              
              <label className="px-5 py-2.5 bg-white hover:bg-[#FBF8F8] border border-[#B0DCDA] rounded-md text-sm font-bold text-[#1B9387] cursor-pointer transition shadow-sm uppercase tracking-wider">
                Import Statement
                <input type="file" accept=".csv,.xls,.xlsx" onChange={handleImportFile} className="hidden" />
              </label>
              
              <button onClick={() => setShowSetup(true)} className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] border border-transparent rounded-md text-sm font-bold text-white transition cursor-pointer shadow-sm uppercase tracking-wider">
                + Bank Account
              </button>
            </div>
          )}
        </div>
        
        {status && (
          <div className={`mb-5 p-4 rounded-md text-sm font-bold shadow-sm border shrink-0 flex justify-between items-center animate-in fade-in ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
            <span>{status.type === 'success' ? '✅ ' : '⚠️ '}{status.message}</span>
            <button onClick={() => setStatus(null)} className="opacity-50 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        )}

        {!accounts.length ? (
          // UX FIX: True Empty State. Removes all confusing/premature filters.
          <div className="flex-1 bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl flex flex-col items-center justify-center text-center p-12">
            <span className="text-4xl mb-4">🏦</span>
            <p className="text-gray-800 font-extrabold text-xl tracking-wide">Set up a bank account to begin</p>
            <p className="text-gray-500 text-sm mt-2 font-medium">Link it to the corresponding cash or bank ledger account.</p>
            <button onClick={() => setShowSetup(true)} className="mt-6 px-6 py-3 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold uppercase tracking-wider transition cursor-pointer shadow-md">
              Set Up Account
            </button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-300">
            {/* FILTERS */}
            <div className="flex gap-3 mb-6 shrink-0 bg-[#FBF8F8] p-3 rounded-lg border border-[#B0DCDA]">
              <select value={accountId} onChange={event => setAccountId(event.target.value)} className="bg-white border border-[#B0DCDA] rounded-md px-3 py-2.5 text-sm text-gray-800 font-bold min-w-[250px] outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] transition shadow-sm">
                <option value="">Select bank account</option>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name} ({account.ledger_account})</option>)}
              </select>
              {/* Date Format moved up to Header Actions */}
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="bg-white border border-[#B0DCDA] rounded-md px-3 py-2.5 text-sm text-gray-800 font-medium outline-none focus:border-[#1B9387] transition shadow-sm" />
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="bg-white border border-[#B0DCDA] rounded-md px-3 py-2.5 text-sm text-gray-800 font-medium outline-none focus:border-[#1B9387] transition shadow-sm" />
              <button onClick={loadData} disabled={loading} className="px-5 py-2.5 bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] rounded-md text-sm font-bold transition disabled:opacity-50 cursor-pointer shadow-sm uppercase tracking-wider">
                {loading ? '↻ Loading...' : 'Refresh'}
              </button>
            </div>

            {/* METRICS & STATEMENT BALANCES */}
            <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
              <Metric label="Unmatched bank" value={unmatched.length} detail={money(unmatchedBankTotal)} tone="text-orange-500" />
              <Metric label="Ledger candidates" value={entries.length} detail={money(candidateTotal)} tone="text-blue-600" />
              <Metric label="Reconciled" value={matched.length} detail={`${transactions.length ? Math.round(matched.length / transactions.length * 100) : 0}% of activity`} tone="text-[#1B9387]" />
              
              <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold">Statement Check</p>
                  <p className={`text-lg font-black font-mono tabular-nums leading-none ${Number(statementOpening) && Number(statementClosing) ? 'text-gray-800' : 'text-gray-400'}`}>
                    {Number(statementOpening) && Number(statementClosing) ? money(Number(statementClosing) - Number(statementOpening) - transactions.reduce((sum, transaction) => sum + transaction.amount, 0)) : '—'}
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <input type="number" step="0.01" placeholder="Opening Bal." value={statementOpening} onChange={event => setStatementOpening(event.target.value)} className="w-1/2 bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-inner placeholder:text-gray-400 placeholder:font-sans placeholder:font-normal" />
                  <input type="number" step="0.01" placeholder="Closing Bal." value={statementClosing} onChange={event => setStatementClosing(event.target.value)} className="w-1/2 bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-inner placeholder:text-gray-400 placeholder:font-sans placeholder:font-normal" />
                </div>
              </div>
            </div>
            
            {/* ADD TRANSACTION FORM */}
            <form onSubmit={addTransaction} className="bg-white border border-[#B0DCDA] rounded-xl p-4 mb-6 shrink-0 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-extrabold text-gray-800 uppercase tracking-wide text-sm">Add manual bank activity</h3>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Use one row per statement line</span>
              </div>
              <div className="grid grid-cols-[140px_1fr_160px_160px_auto] gap-3">
                <input type="date" value={newTransaction.date} onChange={event => setNewTransaction({ ...newTransaction, date: event.target.value })} className="bg-[#FBF8F8] border border-gray-200 rounded-md p-2.5 text-sm font-medium text-gray-800 focus:border-[#1B9387] focus:bg-white outline-none transition" />
                <input placeholder="Description" value={newTransaction.description} onChange={event => setNewTransaction({ ...newTransaction, description: event.target.value })} className="bg-[#FBF8F8] border border-gray-200 rounded-md p-2.5 text-sm font-medium text-gray-800 focus:border-[#1B9387] focus:bg-white outline-none transition" />
                <input placeholder="Reference No." value={newTransaction.referenceNo} onChange={event => setNewTransaction({ ...newTransaction, referenceNo: event.target.value })} className="bg-[#FBF8F8] border border-gray-200 rounded-md p-2.5 text-sm font-medium text-gray-800 focus:border-[#1B9387] focus:bg-white outline-none transition" />
                <input type="number" step="0.01" placeholder="Amount (+/-)" value={newTransaction.amount} onChange={event => setNewTransaction({ ...newTransaction, amount: event.target.value })} className="bg-[#FBF8F8] border border-gray-200 rounded-md p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] focus:bg-white outline-none font-mono transition tabular-nums" />
                <button className="px-5 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] rounded-md text-sm font-bold text-[#1B9387] uppercase tracking-wider transition cursor-pointer shadow-sm">Add Line</button>
              </div>
            </form>

            {/* TWO PANE SPLIT */}
            <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
              
              {/* LEFT: BANK STATEMENT */}
              <section className="bg-white border border-[#B0DCDA] rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] flex justify-between items-center shrink-0">
                  <h3 className="font-extrabold text-gray-800 uppercase tracking-wide">Bank Statement</h3>
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">
                    {unmatched.length} Unmatched
                  </span>
                </div>
                <div className="overflow-auto bg-gray-50/30">
                  {transactions.map(transaction => {
                    const isSelected = selectedTransactionId === transaction.id;
                    const isMatched = transaction.status === 'MATCHED';
                    return (
                      <button 
                        key={transaction.id} 
                        onClick={() => !isMatched && setSelectedTransactionId(transaction.id)} 
                        className={`w-full text-left p-4 border-b border-gray-100 transition-all ${isSelected ? 'bg-[#E9FAFA] border-l-4 border-l-[#1B9387] shadow-inner' : 'hover:bg-white border-l-4 border-l-transparent'} ${isMatched ? 'opacity-60 bg-gray-100/50 cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-bold ${isSelected ? 'text-[#1B9387]' : 'text-gray-500'}`}>{new Date(transaction.transaction_date).toLocaleDateString()} <span className="ml-2 font-mono text-gray-400">{transaction.reference_no || ''}</span></span>
                          <span className={`font-mono font-black tabular-nums ${transaction.amount >= 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
                            {transaction.amount >= 0 ? '+' : '-'}{money(transaction.amount)}
                          </span>
                        </div>
                        <p className={`text-sm mt-1.5 font-bold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{transaction.description}</p>
                        
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100/50">
                          <p className={`text-[10px] font-extrabold uppercase tracking-wider ${isMatched ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {isMatched ? `✓ Matched to ${transaction.matchedEntry?.reference_no || 'entry'}` : isSelected ? '▶ Matching...' : 'Select to match'}
                          </p>
                          {!isMatched && (
                            <span role="button" tabIndex={0} onClick={event => { event.stopPropagation(); initiateRemove(transaction); }} className="text-[10px] uppercase tracking-wider font-extrabold text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition">
                              Remove
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                  {!transactions.length && <p className="p-12 text-center text-sm font-medium text-gray-400 italic">No bank activity found for this period.</p>}
                </div>
              </section>
              
              {/* RIGHT: LEDGER CANDIDATES */}
              <section className="bg-white border border-[#B0DCDA] rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] shrink-0">
                  <h3 className="font-extrabold text-gray-800 uppercase tracking-wide">Ledger Candidates</h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    {selectedTransaction ? <>Matching against <strong className="text-gray-800 font-mono bg-white px-1 border border-gray-200 rounded">{money(selectedTransaction.amount)}</strong></> : 'Select a bank line on the left to begin matching.'}
                  </p>
                </div>
                <div className="overflow-auto bg-gray-50/30">
                  {suggestedEntries.map(entry => (
                    <div key={entry.id} className="p-4 border-b border-gray-100 flex justify-between gap-4 bg-white hover:bg-gray-50 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-500">{new Date(entry.date).toLocaleDateString()} <span className="ml-2 font-mono text-gray-400">{entry.referenceNo}</span></p>
                        <p className="text-sm text-gray-800 font-bold mt-1.5 truncate">{entry.description}</p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col justify-between items-end">
                        <p className="text-sm font-mono font-black text-blue-600 tabular-nums">{money(entry.amount)}</p>
                        <button disabled={!selectedTransaction} onClick={() => match(entry.id)} className="mt-2 px-4 py-1.5 text-[10px] uppercase tracking-wider font-extrabold rounded-md bg-[#1B9387] text-white hover:bg-[#28958B] disabled:bg-gray-200 disabled:text-gray-400 transition cursor-pointer disabled:cursor-not-allowed shadow-sm">
                          Match
                        </button>
                      </div>
                    </div>
                  ))}
                  {!suggestedEntries.length && <p className="p-12 text-center text-sm font-medium text-gray-400 italic">No unreconciled ledger entries in this period.</p>}
                </div>
              </section>
            </div>

            <div className="mt-4 text-right shrink-0">
              {matched.length > 0 && <button onClick={() => matched[0] && unmatch(matched[0].id)} className="text-xs font-bold text-gray-400 hover:text-red-500 transition cursor-pointer uppercase tracking-wider">↩ Undo most recent match</button>}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MODALS                                     */}
        {/* ========================================== */}

        {/* IMPORT MODAL */}
        {importRows.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
            <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-0 w-[720px] max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-[#B0DCDA] bg-[#FBF8F8] flex justify-between items-start shrink-0">
                <div>
                  <h3 className="text-lg font-extrabold text-gray-800 uppercase tracking-wide">Review Bank Import</h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium"><span className="font-bold text-gray-800">{importFileName}</span> · {importRows.length} transaction(s)</p>
                </div>
                <button onClick={() => setImportRows([])} className="text-gray-400 hover:text-gray-700 text-xl font-bold cursor-pointer">×</button>
              </div>
              <div className="overflow-auto bg-gray-50/30 p-6">
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#FBF8F8] border-b border-gray-200 sticky top-0">
                      <tr className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                        <th className="p-3">Date</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importRows.slice(0, 100).map((row, index) => (
                        <tr key={`${row.date}-${index}`} className="hover:bg-gray-50 transition">
                          <td className="p-3 font-medium text-gray-600 whitespace-nowrap">{row.date}</td>
                          <td className="p-3 font-bold text-gray-800">{row.description}</td>
                          <td className="p-3 font-mono text-gray-500 text-xs">{row.referenceNo || '—'}</td>
                          <td className={`p-3 text-right font-mono font-black tabular-nums ${row.amount >= 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
                            {row.amount >= 0 ? '+' : '-'}{money(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 100 && <p className="mt-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Showing the first 100 rows. All {importRows.length} rows will be imported.</p>}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button onClick={() => setImportRows([])} disabled={importing} className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer shadow-sm">Cancel</button>
                <button onClick={confirmImport} disabled={importing || !accountId} className="px-6 py-2.5 bg-[#1B9387] hover:bg-[#28958B] disabled:opacity-50 disabled:bg-gray-400 text-white rounded-md text-sm font-bold uppercase tracking-wider transition cursor-pointer shadow-sm flex items-center gap-2">
                  {importing ? <><span className="animate-spin text-lg">↻</span> Importing...</> : `Import ${importRows.length} Transactions`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REMOVE TRANSACTION MODAL */}
        {transactionToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
            <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-8 w-[420px] animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-extrabold text-gray-800 mb-2 uppercase tracking-wide">Remove bank transaction?</h3>
              <p className="text-sm text-gray-600 mb-8 font-medium leading-relaxed">
                Remove <strong className="text-gray-800">{transactionToRemove.description}</strong> from the active reconciliation queue? The record will remain available in the audit history.
              </p>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setTransactionToRemove(null)} className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer">Cancel</button>
                <button onClick={removeTransaction} className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm uppercase tracking-wider">Remove</button>
              </div>
            </div>
          </div>
        )}

        {/* SETUP ACCOUNT MODAL */}
        {showSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
            <form onSubmit={createAccount} className="bg-white border border-[#B0DCDA] rounded-xl overflow-hidden shadow-2xl w-[440px] animate-in zoom-in-95 duration-200 flex flex-col">
              <div className="px-6 py-5 border-b border-[#B0DCDA] bg-[#FBF8F8]">
                <h3 className="text-lg font-extrabold text-gray-800 uppercase tracking-wide">Add Bank Account</h3>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Account Name *</label><input required placeholder="e.g. BDO Checking" value={setup.name} onChange={event => setSetup({ ...setup, name: event.target.value })} className="w-full bg-[#FBF8F8] border border-gray-200 rounded-md p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none transition focus:bg-white" /></div>
                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Account Number</label><input placeholder="Optional" value={setup.accountNumber} onChange={event => setSetup({ ...setup, accountNumber: event.target.value })} className="w-full bg-[#FBF8F8] border border-gray-200 rounded-md p-2.5 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none transition focus:bg-white" /></div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Link Ledger Account *</label>
                  <select required value={setup.ledgerAccount} onChange={event => setSetup({ ...setup, ledgerAccount: event.target.value })} className="w-full bg-[#FBF8F8] border border-gray-200 rounded-md p-2.5 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none transition focus:bg-white">
                    <option value="">Select ledger account</option>
                    {ledgerAccounts.map(account => <option key={account.code} value={account.code}>{account.code} - {account.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button type="button" onClick={() => setShowSetup(false)} className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer shadow-sm">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-[#1B9387] hover:bg-[#28958B] rounded-md text-sm font-bold text-white uppercase tracking-wider transition cursor-pointer shadow-sm">Save account</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) { 
  return (
    <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold">{label}</p>
      <div className={`text-3xl font-black mt-2 font-mono tabular-nums ${tone}`}>{value}</div>
      <p className="text-xs text-gray-500 mt-1 font-bold">{detail}</p>
    </div>
  ); 
} 