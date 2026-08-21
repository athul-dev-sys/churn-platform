import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpDown, ChevronLeft, ChevronRight, RefreshCw, Search, SlidersHorizontal, User } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Customer, fetchCustomers, PaginatedCustomers } from '../lib/api';

const riskStyle: Record<string, string> = {
  High: 'bg-red-50 text-red-700 border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const Customers: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [paginatedData, setPaginatedData] = useState<PaginatedCustomers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(searchParams.get('paymentMethod') || '');
  const [riskBand, setRiskBand] = useState(searchParams.get('riskBand') || '');
  const [contract, setContract] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'score' | 'tenure' | 'charges'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadCustomers = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchCustomers(
        undefined,
        riskBand || undefined,
        page,
        50,
        contract || undefined,
        searchTerm || undefined,
        sortBy,
        sortOrder,
        paymentMethod || undefined
      );
      setPaginatedData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the prediction API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [paymentMethod, riskBand, page, contract, searchTerm, sortBy, sortOrder]);

  const customers = paginatedData?.data || [];

  const toggleSort = (field: 'score' | 'tenure' | 'charges') => {
    setPage(1);
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  const updateContract = (val: string) => { setPage(1); setContract(val); };
  const updateSearch = (val: string) => { setPage(1); setSearchTerm(val); };

  const clearFilters = () => {
    setSearchTerm(''); setPaymentMethod(''); setRiskBand(''); setContract(''); setPage(1);
    setSortBy('score'); setSortOrder('desc');
    setSearchParams({});
  };

  const updatePaymentMethod = (value: string) => { setPage(1); setPaymentMethod(value); setSearchParams(p => { value ? p.set('paymentMethod', value) : p.delete('paymentMethod'); return p; }); };
  const updateRisk = (value: string) => { setPage(1); setRiskBand(value); setSearchParams(p => { value ? p.set('riskBand', value) : p.delete('riskBand'); return p; }); };

  const totalRecords = paginatedData?.total || 0;
  const totalPages = paginatedData?.totalPages || 1;
  const startCount = (page - 1) * 50 + 1;
  const endCount = Math.min(page * 50, totalRecords);

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200/60 pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><p className="eyebrow">Customer Intelligence</p><h1 className="page-title mt-2">Customer Directory</h1><p className="page-subtitle mt-2 max-w-2xl">Search, filter and inspect customer profiles and machine-learning churn risk.</p></div>
          <button onClick={() => void loadCustomers()} disabled={loading} className="glass-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh customers</button>
        </div>
      </header>

      <section className="glass-card rounded-3xl p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={searchTerm} onChange={e => updateSearch(e.target.value)} placeholder="Search Customer ID..." className="w-full rounded-xl border border-slate-200 bg-white/75 py-2.5 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></label>
          <Select value={paymentMethod} onChange={updatePaymentMethod} options={['', 'Electronic check', 'Mailed check', 'Bank transfer', 'Credit card']} placeholder="All Payment Methods" />
          <Select value={riskBand} onChange={updateRisk} options={['', 'High', 'Medium', 'Low']} placeholder="All Risk Bands" />
          <Select value={contract} onChange={updateContract} options={['', 'Month-to-month', 'One year', 'Two year']} placeholder="All Contracts" />
          <button onClick={clearFilters} className="rounded-xl bg-[#6824df] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#571bc2]">Clear Filters</button>
        </div>
      </section>

      {loading ? <StateCard loading /> : error ? <StateCard error={error} onRetry={() => void loadCustomers()} /> : customers.length === 0 ? <StateCard empty /> : (
        <section className="glass-card overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-[#eee8df] px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-bold text-slate-800">Customer Accounts</p>
              <p className="mt-1 text-[11px] text-slate-400">
                Showing {startCount}–{endCount} of {totalRecords.toLocaleString()} records
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#f0e9ff] px-3 py-1 text-[10px] font-bold text-[#6824df] mr-2">Paginated (50/page)</span>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-xs font-bold text-slate-600 px-1">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left"><thead className="bg-slate-50/75"><tr>
            <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Customer</th>
            <Sortable label="Tenure" active={sortBy === 'tenure'} order={sortOrder} onClick={() => toggleSort('tenure')} />
            <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Contract</th>
            <Sortable label="Monthly Charges" active={sortBy === 'charges'} order={sortOrder} onClick={() => toggleSort('charges')} />
            <Sortable label="Churn Score" active={sortBy === 'score'} order={sortOrder} onClick={() => toggleSort('score')} />
            <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Risk</th>
            <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Reason</th>
            <th className="px-5 py-3" />
          </tr></thead><tbody className="divide-y divide-slate-100">
            {customers.map(c => { const score = c.scores?.[0]; const band = score?.riskBand; return <tr key={c.id} className="transition hover:bg-emerald-50/30">
              <td className="px-5 py-4"><Link to={`/customer/${c.customerId}`} className="font-mono text-xs font-bold text-slate-700 hover:text-emerald-700">{c.customerId}</Link></td>
              <td className="px-5 py-4 text-xs text-slate-600">{c.tenure} mo</td>
              <td className="px-5 py-4 text-xs text-slate-600">{c.contractType}</td>
              <td className="px-5 py-4 text-xs font-semibold text-slate-700">${c.monthlyCharges.toFixed(2)}</td>
              <td className="px-5 py-4 text-xs font-bold text-slate-800">{score ? `${(score.score * 100).toFixed(1)}%` : '—'}</td>
              <td className="px-5 py-4">{band ? <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${riskStyle[band]}`}>{band}</span> : <span className="text-xs text-slate-300">—</span>}</td>
              <td className="max-w-[320px] px-5 py-4 text-xs text-slate-400"><span className="block truncate">{score?.reason || 'No prediction available'}</span></td>
              <td className="px-5 py-4 text-right"><Link to={`/customer/${c.customerId}`} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700">View <ChevronRight size={13} /></Link></td>
            </tr>; })}
          </tbody></table></div>
          <div className="flex items-center justify-between border-t border-[#eee8df] px-5 py-4 sm:px-6">
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return <div className="relative"><select value={value} onChange={e => onChange(e.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white/75 px-3 py-2.5 pr-9 text-xs text-slate-600 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">{options.map(o => <option key={o} value={o}>{o || placeholder}</option>)}</select><SlidersHorizontal className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-slate-400" /></div>;
}
function Sortable({ label, active, order, onClick }: { label: string; active: boolean; order: 'asc' | 'desc'; onClick: () => void }) {
  return <th className="px-5 py-3"><button onClick={onClick} className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.14em] ${active ? 'text-emerald-700' : 'text-slate-400'}`}>{label}<ArrowUpDown size={12} className={order === 'asc' && active ? 'rotate-180' : ''} /></button></th>;
}
function StateCard({ loading, error, empty, onRetry }: { loading?: boolean; error?: string; empty?: boolean; onRetry?: () => void }) {
  if (loading) return <div className="glass-card rounded-3xl p-16 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600" /><p className="mt-4 text-sm font-semibold text-slate-600">Loading customer database...</p></div>;
  if (error) return <div className="glass-card rounded-3xl p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle size={22} /></div><h3 className="mt-4 text-sm font-bold text-slate-800">Connection Error</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">{error}</p><button onClick={onRetry} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Try again</button></div>;
  return <div className="glass-card rounded-3xl p-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><User size={20} /></div><h3 className="mt-4 text-sm font-bold text-slate-700">No Customers Found</h3><p className="mt-1 text-xs text-slate-500">No customer accounts matched the current filters.</p></div>;
}
export default Customers;
