import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, Search, ArrowUpDown, X, AlertTriangle, MoreVertical, Check, Plus, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

export function ServicesManagerView() {
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const BASE_CATEGORIES = [
        'Blood Chemistry', 'Enzymes', 'Electrolytes', 'Chemistry Packages',
        'Hematology', 'Clinical Microscopy', '24 Hour Urine Test', 'Serology',
        'Thyroid Function', 'Hepatitis', 'Hormones', 'Tumor Markers',
        'Bacteriology', 'Histopathology', 'Others'
    ];
    const [categoryList, setCategoryList] = useState<string[]>(BASE_CATEGORIES);

    // New Service State
    const [newItem, setNewItem] = useState({ category: 'Blood Chemistry', name: '', price: '' });
    const [touched, setTouched] = useState<{ name: boolean; price: boolean }>({ name: false, price: false });
    const [addingCategory, setAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Edit State (click-to-edit price)
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editPrice, setEditPrice] = useState<string>('');

    // Row action (kebab) menu
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

    // Collapsible category groups
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    // Sorting (default: Procedure Name, ascending)
    const [sortKey, setSortKey] = useState<'name' | 'price'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Newly created item highlight
    const [highlightId, setHighlightId] = useState<number | null>(null);

    // Custom confirm modal (replaces window.confirm)
    const [confirmTarget, setConfirmTarget] = useState<{ id: number; name: string; activate: boolean } | null>(null);

    const CATEGORY_PALETTE = [
        'text-blue-600 bg-blue-50 border-blue-200',
        'text-emerald-600 bg-emerald-50 border-emerald-200',
        'text-purple-600 bg-purple-50 border-purple-200',
        'text-orange-600 bg-orange-50 border-orange-200',
        'text-rose-600 bg-rose-50 border-rose-200',
        'text-cyan-600 bg-cyan-50 border-cyan-200',
        'text-amber-600 bg-amber-50 border-amber-200',
        'text-indigo-600 bg-indigo-50 border-indigo-200',
    ];

    // All categories in play: curated list plus anything already used by real data (dedup, curated order first)
    const allCategories = useMemo(() => {
        const extra = services.map(s => s.category).filter(c => !categoryList.includes(c));
        return [...categoryList, ...Array.from(new Set(extra))];
    }, [categoryList, services]);

    const getCategoryColor = (category: string) => {
        const idx = allCategories.indexOf(category);
        return CATEGORY_PALETTE[(idx >= 0 ? idx : 0) % CATEGORY_PALETTE.length];
    };

    const fetchServices = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getAllServiceItems();
            setServices(data || []);
            return data || [];
        } catch (error) {
            console.error("Failed to fetch services", error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchServices(); }, []);

    // Auto-expand the selected category filter and collapse the rest; clearing the filter expands all again
    useEffect(() => {
        if (categoryFilter) {
            setCollapsed(new Set(allCategories.filter(c => c !== categoryFilter)));
        } else {
            setCollapsed(new Set());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryFilter]);

    // ---- Create form validation ----
    const isDuplicateName = useMemo(() => {
        if (!newItem.name) return false;
        return services.some(s =>
            s.category === newItem.category &&
            s.name.trim().toLowerCase() === newItem.name.trim().toLowerCase()
        );
    }, [services, newItem.category, newItem.name]);

    const priceNum = Number(newItem.price);
    const nameError = touched.name && !newItem.name ? 'Procedure name is required.' : (touched.name && isDuplicateName ? 'This procedure already exists in this category.' : null);
    const priceError = touched.price && (newItem.price === '' || isNaN(priceNum) || priceNum < 0) ? 'Enter a price of 0 or more.' : null;
    const isCreateValid = !!newItem.name && !isDuplicateName && newItem.price !== '' && !isNaN(priceNum) && priceNum >= 0;

    const handleCategorySelect = (value: string) => {
        if (value === '__add_new__') {
            setAddingCategory(true);
            setNewCategoryName('');
        } else {
            setNewItem({ ...newItem, category: value });
        }
    };

    const confirmAddCategory = () => {
        const trimmed = newCategoryName.trim();
        if (!trimmed) return;
        if (!allCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
            setCategoryList(prev => [...prev, trimmed]);
        }
        setNewItem({ ...newItem, category: trimmed });
        setAddingCategory(false);
        setNewCategoryName('');
    };

    const handleCreateService = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage(null);
        setTouched({ name: true, price: true });
        if (!isCreateValid) return;

        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.createServiceItem({ ...newItem, price: Number(newItem.price) });

            if (result.success) {
                const createdCategory = newItem.category;
                const createdName = newItem.name;
                setStatusMessage({ type: 'success', msg: `${createdName} added successfully!` });
                setNewItem({ ...newItem, name: '', price: '' });
                setTouched({ name: false, price: false });

                const fresh = await fetchServices();
                const created = fresh.find((s: any) => s.category === createdCategory && s.name === createdName);
                if (created) {
                    setCollapsed(prev => { const next = new Set(prev); next.delete(createdCategory); return next; });
                    setHighlightId(created.id);
                    setTimeout(() => setHighlightId(null), 2500);
                }
                setTimeout(() => setStatusMessage(null), 3000);
            } else {
                setStatusMessage({ type: 'error', msg: result.error || "Failed to create service." });
            }
        } catch (error) {
            setStatusMessage({ type: 'error', msg: "System Error." });
        } finally {
            setLoading(false);
        }
    };

    // ---- Inline price edit (click the price to edit) ----
    const editPriceNum = Number(editPrice);
    const editPriceInvalid = editingId !== null && (editPrice === '' || isNaN(editPriceNum) || editPriceNum < 0);

    const startEdit = (s: any) => {
        setActiveMenuId(null);
        setEditingId(s.id);
        setEditPrice(s.price.toString());
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditPrice('');
    };

    const handleSaveEdit = async (id: number) => {
        if (editPrice === '' || isNaN(editPriceNum) || editPriceNum < 0) return;
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.updateServiceItem(id, { price: editPriceNum });

            if (result.success) {
                setStatusMessage({ type: 'success', msg: `Price updated successfully!` });
                setEditingId(null);
                setEditPrice('');
                fetchServices();
                setTimeout(() => setStatusMessage(null), 3000);
            } else {
                setStatusMessage({ type: 'error', msg: "Failed to update price." });
            }
        } catch (error) {
            setStatusMessage({ type: 'error', msg: "System Error." });
        } finally {
            setLoading(false);
        }
    };

    const handleEditKeyDown = (e: React.KeyboardEvent, id: number) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(id); }
        if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    };

    // ---- Archive / Restore (custom confirm modal instead of window.confirm) ----
    const requestToggleStatus = (id: number, name: string, currentStatus: boolean) => {
        setActiveMenuId(null);
        setConfirmTarget({ id, name, activate: !currentStatus });
    };

    const confirmToggleStatus = async () => {
        if (!confirmTarget) return;
        const { id, activate } = confirmTarget;
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            await api.updateServiceItem(id, { is_active: activate });
            setStatusMessage({ type: 'success', msg: `Procedure ${activate ? 'restored' : 'archived'}.` });
            fetchServices();
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (error) {
            console.error(error);
            setStatusMessage({ type: 'error', msg: 'System Error.' });
        } finally {
            setLoading(false);
            setConfirmTarget(null);
        }
    };

    const formatCurrency = (val: number) => `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const clearFilters = () => { setSearchQuery(''); setCategoryFilter(''); };

    const filteredServices = services.filter(s => {
        const matchesQuery = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !categoryFilter || s.category === categoryFilter;
        return matchesQuery && matchesCategory;
    });

    // Group by category (curated order first), sort within each group
    const groupedServices = useMemo(() => {
        const groups = new Map<string, any[]>();
        for (const s of filteredServices) {
            if (!groups.has(s.category)) groups.set(s.category, []);
            groups.get(s.category)!.push(s);
        }
        const sortFn = (a: any, b: any) => {
            const cmp = sortKey === 'name' ? a.name.localeCompare(b.name) : a.price - b.price;
            return sortDir === 'asc' ? cmp : -cmp;
        };
        const orderedCategoryNames = [
            ...allCategories.filter(c => groups.has(c)),
            ...[...groups.keys()].filter(c => !allCategories.includes(c)),
        ];
        return orderedCategoryNames.map(cat => ({
            category: cat,
            items: [...groups.get(cat)!].sort(sortFn),
        }));
    }, [filteredServices, sortKey, sortDir, allCategories]);

    const toggleGroup = (category: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(category)) next.delete(category); else next.add(category);
            return next;
        });
    };

    const visibleCategories = groupedServices.map(g => g.category);
    const allCollapsed = visibleCategories.length > 0 && visibleCategories.every(c => collapsed.has(c));
    const toggleAllGroups = () => setCollapsed(allCollapsed ? new Set() : new Set(visibleCategories));

    const toggleSort = (key: 'name' | 'price') => {
        if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('asc'); }
    };

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col text-gray-800 font-sans">
            <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Services & Pricing Manager</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Manage clinic procedures, laboratory tests, and their fixed prices.</p>
                </div>
            </div>

            {statusMessage && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border ${statusMessage.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {statusMessage.type === 'success' ? '✅ ' : '⚠️ '}{statusMessage.msg}
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
                {/* LEFT PANE: ADD NEW */}
                <div className="col-span-1 bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm h-fit">
                    <h3 className="text-lg font-extrabold text-gray-800 mb-5 border-b border-gray-100 pb-3">Add New Procedure</h3>
                    <form onSubmit={handleCreateService} className="space-y-4" noValidate>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                            {addingCategory ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="New category name"
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAddCategory(); } if (e.key === 'Escape') setAddingCategory(false); }}
                                        className="flex-1 bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none"
                                    />
                                    <button type="button" onClick={confirmAddCategory} className="px-3 rounded-md bg-[#1B9387] hover:bg-[#28958B] text-white cursor-pointer" title="Add category">
                                        <Check className="w-4 h-4" style={{ color: '#ffffff' }} />
                                    </button>
                                    <button type="button" onClick={() => setAddingCategory(false)} className="px-3 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-600 cursor-pointer" title="Cancel">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <select value={newItem.category} onChange={e => handleCategorySelect(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none cursor-pointer">
                                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option value="__add_new__">+ Add new category</option>
                                </select>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Procedure Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Ultrasound"
                                value={newItem.name}
                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                onBlur={() => setTouched(t => ({ ...t, name: true }))}
                                aria-invalid={!!nameError}
                                className={`w-full bg-[#FBF8F8] border rounded-md p-2.5 text-sm text-gray-800 font-medium outline-none ${nameError ? 'border-red-300 focus:border-red-400' : 'border-[#B0DCDA] focus:border-[#1B9387]'}`}
                            />
                            {nameError && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{nameError}</p>}
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Fixed Price</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₱</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    placeholder="0.00"
                                    value={newItem.price}
                                    onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                                    onBlur={() => setTouched(t => ({ ...t, price: true }))}
                                    aria-invalid={!!priceError}
                                    className={`w-full bg-[#FBF8F8] border rounded-md p-2.5 pl-6 text-sm text-gray-800 font-mono font-bold outline-none ${priceError ? 'border-red-300 focus:border-red-400' : 'border-[#B0DCDA] focus:border-[#1B9387]'}`}
                                />
                            </div>
                            {priceError && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{priceError}</p>}
                        </div>
                        <button type="submit" disabled={loading || !isCreateValid} className="w-full bg-[#1B9387] hover:bg-[#28958B] text-white font-bold py-3 rounded-md transition mt-6 cursor-pointer shadow-sm uppercase tracking-wider text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? 'Saving...' : 'Add Procedure'}
                        </button>
                    </form>
                </div>

                {/* RIGHT PANE: LIST */}
                <div className="col-span-2 bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-lg font-extrabold text-gray-800 tracking-wide">Master Price List</h3>
                            <span className="text-xs font-bold text-[#1B9387] bg-[#E9FAFA] border border-[#B0DCDA] px-2 py-0.5 rounded-full">
                                {searchQuery || categoryFilter ? `${filteredServices.length} of ${services.length}` : `${services.length} procedure${services.length === 1 ? '' : 's'}`}
                            </span>
                            <button onClick={toggleAllGroups} className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-[#1B9387] cursor-pointer">
                                {allCollapsed ? <ChevronsUpDown className="w-3.5 h-3.5" /> : <ChevronsDownUp className="w-3.5 h-3.5" />}
                                {allCollapsed ? 'Expand all' : 'Collapse all'}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                className="bg-white border border-[#B0DCDA] rounded-md px-2.5 py-1.5 text-xs font-bold text-gray-600 focus:outline-none focus:border-[#1B9387] cursor-pointer"
                            >
                                <option value="">All Categories</option>
                                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input type="text" placeholder="Search procedures..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-56 bg-white border border-[#B0DCDA] rounded-md pl-8 pr-7 py-1.5 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 shadow-sm" />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer" title="Clear search">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto relative">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA] sticky top-0 z-20">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-3.5 border-r border-gray-100">
                                        <button onClick={() => toggleSort('name')} className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                                            Procedure Name <ArrowUpDown className={`w-3 h-3 ${sortKey === 'name' ? 'text-[#1B9387]' : 'text-gray-300'}`} />
                                        </button>
                                    </th>
                                    <th className="p-3.5 border-r border-gray-100 text-right w-32">
                                        <button onClick={() => toggleSort('price')} className="flex items-center gap-1 ml-auto cursor-pointer hover:text-gray-700">
                                            Price <ArrowUpDown className={`w-3 h-3 ${sortKey === 'price' ? 'text-[#1B9387]' : 'text-gray-300'}`} />
                                        </button>
                                    </th>
                                    <th className="p-3.5 text-center w-16">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading && services.length === 0 ? (
                                    <tr><td colSpan={3} className="p-12 text-center text-gray-400 italic font-medium">Loading procedures...</td></tr>
                                ) : services.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-12 text-center">
                                            <p className="text-gray-600 font-bold mb-1">No procedures yet</p>
                                            <p className="text-gray-400 text-sm font-medium">Use the form on the left to add your first procedure.</p>
                                        </td>
                                    </tr>
                                ) : filteredServices.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-12 text-center">
                                            <p className="text-gray-500 italic font-medium mb-2">No procedures match your search.</p>
                                            <button onClick={clearFilters} className="text-xs font-bold text-[#1B9387] hover:underline cursor-pointer">
                                                Clear search &amp; filters
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    groupedServices.map(({ category, items }) => (
                                        <React.Fragment key={category}>
                                            <tr
                                                onClick={() => toggleGroup(category)}
                                                className={`sticky top-[38px] z-10 cursor-pointer select-none border-y border-gray-200 border-l-4 ${getCategoryColor(category).split(' ')[1] /* bg */} `}
                                                style={{ borderLeftColor: 'currentColor' }}
                                            >
                                                <td colSpan={3} className="px-4 py-2">
                                                    <div className={`flex items-center gap-2 ${getCategoryColor(category).split(' ')[0]}`}>
                                                        {collapsed.has(category) ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                        <span className="text-xs font-extrabold uppercase tracking-wider">{category}</span>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{items.length} item{items.length === 1 ? '' : 's'}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {!collapsed.has(category) && items.map((s) => (
                                                <tr key={s.id} className={`transition-colors ${s.is_active ? 'hover:bg-gray-50 even:bg-gray-50/50' : 'bg-gray-100 opacity-60'} ${highlightId === s.id ? '!bg-[#E9FAFA]' : ''}`}>
                                                    <td className="px-4 py-2.5 border-r border-gray-100 font-extrabold text-gray-800">{s.name}</td>
                                                    <td className="px-4 py-2.5 border-r border-gray-100 text-right">
                                                        {editingId === s.id ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    autoFocus
                                                                    value={editPrice}
                                                                    onChange={e => setEditPrice(e.target.value)}
                                                                    onKeyDown={e => handleEditKeyDown(e, s.id)}
                                                                    aria-invalid={editPriceInvalid}
                                                                    className={`w-20 border rounded px-2 py-1 text-right font-mono font-bold text-gray-800 outline-none shadow-sm ${editPriceInvalid ? 'border-red-300' : 'border-[#1B9387]'}`}
                                                                />
                                                                <button onClick={() => handleSaveEdit(s.id)} disabled={editPriceInvalid} className="p-1 rounded text-[#1B9387] hover:bg-[#E9FAFA] disabled:opacity-40 cursor-pointer" title="Save">
                                                                    <Check className="w-4 h-4" style={{ color: editPriceInvalid ? undefined : '#1B9387' }} />
                                                                </button>
                                                                <button onClick={cancelEdit} className="p-1 rounded text-gray-400 hover:bg-gray-100 cursor-pointer" title="Cancel">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => s.is_active && startEdit(s)}
                                                                disabled={!s.is_active}
                                                                className={`font-mono font-bold text-[#1B9387] rounded px-1.5 py-0.5 -mr-1.5 ${s.is_active ? 'hover:bg-[#E9FAFA] cursor-pointer' : 'cursor-default'}`}
                                                                title={s.is_active ? 'Click to edit price' : undefined}
                                                                style={{ color: '#1B9387' }}
                                                            >
                                                                {formatCurrency(s.price)}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center relative">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === s.id ? null : s.id); }}
                                                            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 cursor-pointer"
                                                            style={{ color: '#6b7280' }}
                                                            title="More actions"
                                                        >
                                                            <MoreVertical className="w-4 h-4" style={{ color: '#6b7280' }} />
                                                        </button>
                                                        {activeMenuId === s.id && (
                                                            <div className="absolute right-4 top-10 z-30 w-40 bg-white border border-gray-200 rounded-md shadow-lg py-1 text-left">
                                                                {s.is_active && (
                                                                    <button
                                                                        onClick={() => startEdit(s)}
                                                                        className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 cursor-pointer"
                                                                        style={{ color: '#374151' }}
                                                                    >
                                                                        Edit Price
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => requestToggleStatus(s.id, s.name, s.is_active)}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 cursor-pointer"
                                                                    style={{ color: s.is_active ? '#dc2626' : '#1B9387' }}
                                                                >
                                                                    {s.is_active ? 'Archive' : 'Restore'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Backdrop to close the row action menu on outside click */}
            {activeMenuId !== null && (
                <div className="fixed inset-0 z-20" onClick={() => setActiveMenuId(null)} />
            )}

            {/* CONFIRM ARCHIVE/RESTORE MODAL */}
            {confirmTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-6 w-[400px]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" style={{ color: confirmTarget.activate ? '#1B9387' : '#ef4444' }} />
                                <h3 className="text-lg font-extrabold text-gray-800">{confirmTarget.activate ? 'Restore Procedure' : 'Archive Procedure'}</h3>
                            </div>
                            <button onClick={() => setConfirmTarget(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 font-medium mb-6">
                            {confirmTarget.activate
                                ? <>Restore <span className="font-bold text-gray-800">{confirmTarget.name}</span> so it's available for use again?</>
                                : <>Archive <span className="font-bold text-gray-800">{confirmTarget.name}</span>? It will be hidden from active use until restored.</>}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConfirmTarget(null)} className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-sm font-bold transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button
                                onClick={confirmToggleStatus}
                                className="px-4 py-2 rounded-md text-sm font-bold shadow-sm transition-colors cursor-pointer text-white"
                                style={{ backgroundColor: confirmTarget.activate ? '#1B9387' : '#dc2626' }}
                            >
                                {confirmTarget.activate ? 'Restore' : 'Archive'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}