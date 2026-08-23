import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

type BankAccount = { id: string; name: string; account_number?: string | null; ledger_account: string; ledger_account_ref?: { name: string } };
type BankTransaction = { id: string; transaction_date: string; description: string; reference_no?: string | null; amount: number; status: string; matchedEntry?: { reference_no: string } | null };
type LedgerEntry = { id: string; date: string; referenceNo: string; description: string; amount: number };
type ImportRow = { date: string; description: string; referenceNo: string; amount: number };
type DateFormat = 'AUTO' | 'MDY' | 'DMY';

const dateValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (value: number) => `₱ ${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

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
    
    // 🔥 THE FIX: We check if the backend returned an ID instead of checking for "success"!
    if (result?.error || !result?.id) {
        return setStatus({ type: 'error', message: result?.error || 'Could not add transaction.' });
    }
    
    setNewTransaction({ date: dateValue(today), description: '', referenceNo: '', amount: '' });
    setStatus({ type: 'success', message: 'Bank transaction added to the queue.' });
    
    // UI will now instantly refresh!
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
    } else {
      parsed = new Date(text);
    }
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
    
    // 🔥 THE FIX: We check if it returned a count, rather than "success"!
    if (result?.error || result?.count === undefined) {
      setStatus({ type: 'error', message: result?.error || 'Could not import bank transactions.' });
      setImporting(false);
      return;
    }
    
    setImportRows([]);
    setImportFileName('');
    const skippedMessage = result.count !== importRows.length ? ` ${importRows.length - result.count} duplicate(s) skipped.` : '';
    setStatus({ type: 'success', message: `${result.count} bank transaction(s) imported successfully.${skippedMessage}` });
    setImporting(false);
    
    // UI will now instantly refresh!
    await loadData();
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col text-gray-200">
      
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Bank Reconciliation</h2>
          <p className="text-sm text-gray-400 mt-1">Match bank activity to posted ledger entries and keep the cash balance explainable.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="px-4 py-2 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] rounded-md text-sm font-bold text-white cursor-pointer transition">
            Import Statement
            <input type="file" accept=".csv,.xls,.xlsx" onChange={handleImportFile} className="hidden" />
          </label>
          <button onClick={() => setShowSetup(true)} className="px-4 py-2 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] rounded-md text-sm font-bold text-white transition">
            + Bank Account
          </button>
        </div>
      </div>
      
      {status && (
        <div className={`mb-5 p-3 rounded-md text-sm font-bold border ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {status.message}
        </div>
      )}

      <div className="flex gap-3 mb-5">
        <select value={accountId} onChange={event => setAccountId(event.target.value)} className="bg-[#202024] border border-[#29292e] rounded-md px-3 py-2 text-sm text-white min-w-64 outline-none focus:border-[#4f46e5]">
          <option value="">Select bank account</option>
          {accounts.map(account => <option key={account.id} value={account.id}>{account.name} ({account.ledger_account})</option>)}
        </select>
        <select value={dateFormat} onChange={event => setDateFormat(event.target.value as DateFormat)} className="bg-[#202024] border border-[#29292e] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#4f46e5]">
          <option value="AUTO">Date format</option>
          <option value="MDY">MM/DD/YYYY</option>
          <option value="DMY">DD/MM/YYYY</option>
        </select>
        <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="bg-[#202024] border border-[#29292e] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#4f46e5]" />
        <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="bg-[#202024] border border-[#29292e] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#4f46e5]" />
        <button onClick={loadData} disabled={loading} className="px-4 py-2 bg-[#4f46e5] hover:bg-[#5b54f6] rounded-md text-sm font-bold text-white transition disabled:opacity-50">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {!accounts.length ? (
        <div className="flex-1 bg-[#202024] border border-[#29292e] rounded-lg p-12 text-center">
          <p className="text-white font-bold text-lg">Set up a bank account to begin</p>
          <p className="text-gray-400 text-sm mt-2">Link it to the corresponding cash or bank ledger account.</p>
          <button onClick={() => setShowSetup(true)} className="mt-5 px-4 py-2 bg-[#4f46e5] hover:bg-[#5b54f6] rounded-md text-sm font-bold transition">Set up account</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-5">
            <Metric label="Unmatched bank" value={unmatched.length} detail={money(unmatchedBankTotal)} tone="text-amber-400" />
            <Metric label="Ledger candidates" value={entries.length} detail={money(candidateTotal)} tone="text-sky-400" />
            <Metric label="Reconciled" value={matched.length} detail={`${transactions.length ? Math.round(matched.length / transactions.length * 100) : 0}% of activity`} tone="text-emerald-400" />
            <div className="bg-[#202024] border border-[#29292e] rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Difference</p>
              <div className={`text-2xl font-bold mt-2 font-mono ${Number(statementOpening) && Number(statementClosing) ? 'text-white' : 'text-gray-600'}`}>
                {Number(statementOpening) && Number(statementClosing) ? money(Number(statementClosing) - Number(statementOpening) - transactions.reduce((sum, transaction) => sum + transaction.amount, 0)) : '—'}
              </div>
              <p className="text-xs text-gray-400 mt-1">Statement balance check</p>
            </div>
          </div>
          
          <div className="flex gap-3 mb-5">
            <input type="number" step="0.01" placeholder="Statement opening balance" value={statementOpening} onChange={event => setStatementOpening(event.target.value)} className="w-64 bg-[#121214] border border-[#29292e] rounded-md p-2.5 text-sm text-white focus:border-[#4f46e5] outline-none" />
            <input type="number" step="0.01" placeholder="Statement closing balance" value={statementClosing} onChange={event => setStatementClosing(event.target.value)} className="w-64 bg-[#121214] border border-[#29292e] rounded-md p-2.5 text-sm text-white focus:border-[#4f46e5] outline-none" />
          </div>
          
          <form onSubmit={addTransaction} className="bg-[#202024] border border-[#29292e] rounded-lg p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">Add bank activity</h3>
              <span className="text-xs text-gray-500">Use one row per statement line</span>
            </div>
            <div className="grid grid-cols-[140px_1fr_160px_160px_auto] gap-3">
              <input type="date" value={newTransaction.date} onChange={event => setNewTransaction({ ...newTransaction, date: event.target.value })} className="bg-[#121214] border border-[#29292e] rounded-md p-2.5 text-sm text-white focus:border-[#4f46e5] outline-none" />
              <input placeholder="Description" value={newTransaction.description} onChange={event => setNewTransaction({ ...newTransaction, description: event.target.value })} className="bg-[#121214] border border-[#29292e] rounded-md p-2.5 text-sm text-white focus:border-[#4f46e5] outline-none" />
              <input placeholder="Reference" value={newTransaction.referenceNo} onChange={event => setNewTransaction({ ...newTransaction, referenceNo: event.target.value })} className="bg-[#121214] border border-[#29292e] rounded-md p-2.5 text-sm text-white focus:border-[#4f46e5] outline-none" />
              <input type="number" step="0.01" placeholder="Amount (+/-)" value={newTransaction.amount} onChange={event => setNewTransaction({ ...newTransaction, amount: event.target.value })} className="bg-[#121214] border border-[#29292e] rounded-md p-2.5 text-sm text-white focus:border-[#4f46e5] outline-none" />
              <button className="px-4 bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] rounded-md text-sm font-bold text-white transition">Add</button>
            </div>
          </form>

          <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
            <section className="bg-[#202024] border border-[#29292e] rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[#29292e] flex justify-between">
                <h3 className="font-bold text-white">Bank statement</h3>
                <span className="text-xs font-bold text-amber-400">{unmatched.length} unmatched</span>
              </div>
              <div className="overflow-auto">
                {transactions.map(transaction => (
                  <button key={transaction.id} onClick={() => transaction.status === 'UNMATCHED' && setSelectedTransactionId(transaction.id)} className={`w-full text-left p-4 border-b border-[#29292e]/70 ${selectedTransactionId === transaction.id ? 'bg-[#4f46e5]/20' : 'hover:bg-[#29292e]'} ${transaction.status === 'MATCHED' ? 'opacity-70' : ''}`}>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">{new Date(transaction.transaction_date).toLocaleDateString()} {transaction.reference_no || ''}</span>
                      <span className={`font-mono font-bold ${transaction.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {transaction.amount >= 0 ? '+' : '-'}{money(transaction.amount)}
                      </span>
                    </div>
                    <p className="text-sm text-white mt-1">{transaction.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">
                        {transaction.status === 'MATCHED' ? `Matched to ${transaction.matchedEntry?.reference_no || 'entry'}` : 'Select to match'}
                      </p>
                      {transaction.status === 'UNMATCHED' && (
                        <span role="button" tabIndex={0} onClick={event => { event.stopPropagation(); initiateRemove(transaction); }} className="text-[10px] uppercase tracking-wider font-bold text-red-400 hover:text-red-300">
                          Remove
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
            
            <section className="bg-[#202024] border border-[#29292e] rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[#29292e]">
                <h3 className="font-bold text-white">Ledger candidates</h3>
                <p className="text-xs text-gray-500 mt-1">{selectedTransaction ? `Closest amounts first for ${money(selectedTransaction.amount)}` : 'Select a bank line to begin matching.'}</p>
              </div>
              <div className="overflow-auto">
                {suggestedEntries.map(entry => (
                  <div key={entry.id} className="p-4 border-b border-[#29292e]/70 flex justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-gray-400">{new Date(entry.date).toLocaleDateString()} · {entry.referenceNo}</p>
                      <p className="text-sm text-white mt-1">{entry.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-bold text-sky-400">{money(entry.amount)}</p>
                      <button disabled={!selectedTransaction} onClick={() => match(entry.id)} className="mt-2 px-3 py-1 text-[10px] uppercase font-bold rounded bg-[#4f46e5] disabled:bg-[#29292e] disabled:text-gray-600 transition">
                        Match
                      </button>
                    </div>
                  </div>
                ))}
                {!suggestedEntries.length && <p className="p-8 text-center text-sm text-gray-500">No unreconciled ledger entries in this period.</p>}
              </div>
            </section>
          </div>
          <div className="mt-4 text-right">
            {matched.length > 0 && <button onClick={() => matched[0] && unmatch(matched[0].id)} className="text-xs text-gray-500 hover:text-white transition">Undo most recent match</button>}
          </div>
        </>
      )}

      {/* IMPORT MODAL */}
      {importRows.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-[720px] max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Review Bank Import</h3>
                <p className="text-xs text-gray-400 mt-1">{importFileName} · {importRows.length} transaction(s)</p>
              </div>
              <button onClick={() => setImportRows([])} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="overflow-auto border border-[#29292e] rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-[#121214] sticky top-0">
                  <tr className="text-xs uppercase tracking-wider text-gray-400">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Reference</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 100).map((row, index) => (
                    <tr key={`${row.date}-${index}`} className="border-t border-[#29292e]/70">
                      <td className="p-3 text-gray-300 whitespace-nowrap">{row.date}</td>
                      <td className="p-3 text-white">{row.description}</td>
                      <td className="p-3 text-gray-400">{row.referenceNo || '—'}</td>
                      <td className={`p-3 text-right font-mono font-bold ${row.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {row.amount >= 0 ? '+' : '-'}{money(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importRows.length > 100 && <p className="p-3 text-center text-xs text-gray-500">Showing the first 100 rows. All {importRows.length} rows will be imported.</p>}
            </div>
            <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-[#29292e]">
              <button onClick={() => setImportRows([])} disabled={importing} className="px-4 py-2 bg-[#29292e] hover:bg-[#323238] text-gray-300 rounded text-sm font-bold transition">Cancel</button>
              <button onClick={confirmImport} disabled={importing || !accountId} className="px-4 py-2 bg-[#4f46e5] hover:bg-[#5b54f6] disabled:opacity-50 text-white rounded text-sm font-bold transition">
                {importing ? 'Importing...' : `Import ${importRows.length} Transactions`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE TRANSACTION MODAL */}
      {transactionToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-[420px]">
            <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">Remove bank transaction?</h3>
            <p className="text-sm text-gray-300 mb-6">
              Remove <strong className="text-white">{transactionToRemove.description}</strong> from the active reconciliation queue? The record will remain available in the audit history.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#29292e]">
              <button onClick={() => setTransactionToRemove(null)} className="px-4 py-2 bg-[#29292e] hover:bg-[#3a3a42] text-gray-300 rounded text-sm font-bold transition">Cancel</button>
              <button onClick={removeTransaction} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-bold transition">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* SETUP ACCOUNT MODAL */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form onSubmit={createAccount} className="bg-[#202024] border border-[#3e3e44] rounded-lg p-6 w-[440px]">
            <h3 className="text-lg font-bold text-white">Add bank account</h3>
            <div className="space-y-3 mt-5">
              <input required placeholder="Account name" value={setup.name} onChange={event => setSetup({ ...setup, name: event.target.value })} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-2.5 text-sm text-white focus:border-[#4f46e5] outline-none" />
              <input placeholder="Account number (optional)" value={setup.accountNumber} onChange={event => setSetup({ ...setup, accountNumber: event.target.value })} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-2.5 text-sm text-white focus:border-[#4f46e5] outline-none" />
              <select required value={setup.ledgerAccount} onChange={event => setSetup({ ...setup, ledgerAccount: event.target.value })} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-2.5 text-sm text-white focus:border-[#4f46e5] outline-none">
                <option value="">Link ledger account</option>
                {ledgerAccounts.map(account => <option key={account.code} value={account.code}>{account.code} - {account.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowSetup(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-[#4f46e5] hover:bg-[#5b54f6] rounded-md text-sm font-bold text-white transition">Save account</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) { 
  return (
    <div className="bg-[#202024] border border-[#29292e] rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">{label}</p>
      <div className={`text-2xl font-bold mt-2 ${tone}`}>{value}</div>
      <p className="text-xs text-gray-400 mt-1">{detail}</p>
    </div>
  ); 
}