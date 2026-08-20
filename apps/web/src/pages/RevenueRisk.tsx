import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { Customer, fetchCustomers, fetchSummary, SummaryStats } from '../lib/api';

const money = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const RevenueRisk: React.FC = () => {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true); setError(null);
    try { const [s, cRes] = await Promise.all([fetchSummary(), fetchCustomers(undefined, undefined, 1, 1000)]); setSummary(s); setCustomers(Array.isArray(cRes) ? cRes : cRes.data || []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to connect to the prediction API.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadData(); }, []);

  const highRisk = useMemo(() => customers.filter(c => c.scores?.[0]?.riskBand === 'High').sort((a,b) => (b.scores?.[0]?.revenueAtRisk || b.monthlyCharges) - (a.scores?.[0]?.revenueAtRisk || a.monthlyCharges)).slice(0, 10), [customers]);
  const byContract = useMemo(() => {
    const names = ['Month-to-month', 'One year', 'Two year'];
    return names.map(name => ({
      name,
      revenueRisk: customers.filter(c => c.contractType && c.contractType.toLowerCase().replace(/-/g, ' ') === name.toLowerCase().replace(/-/g, ' ') && c.scores?.[0]?.riskBand === 'High').reduce((sum,c) => sum + (c.scores?.[0]?.revenueAtRisk || c.monthlyCharges), 0)
    }));
  }, [customers]);

  return <div className="space-y-6">
    <header className="border-b border-slate-200/60 pb-6"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="eyebrow">Revenue Intelligence</p><h1 className="page-title mt-2">Revenue Risk</h1><p className="page-subtitle mt-2 max-w-2xl">Identify revenue exposure from customers with elevated predicted churn.</p></div><button onClick={() => void loadData()} disabled={loading} className="glass-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh revenue data</button></div></header>
    {loading ? <State loading /> : error ? <State error={error} onRetry={() => void loadData()} /> : <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat title="Revenue at Risk" value={money(summary?.totalRevenueAtRisk ?? 0)} text="High-risk monthly charge exposure" icon={<DollarSign size={19} />} tone="red" />
        <Stat title="High-risk Customers" value={(summary?.highRiskCount ?? 0).toLocaleString()} text="Accounts requiring attention" icon={<AlertTriangle size={19} />} tone="amber" />
        <Stat title="Average At-risk Charge" value={summary && summary.highRiskCount ? money(summary.totalRevenueAtRisk / summary.highRiskCount) : '$0.00'} text="Average monthly bill in high-risk group" icon={<TrendingUp size={19} />} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <section className="glass-card overflow-hidden rounded-3xl p-5 sm:p-6"><p className="eyebrow">Exposure Watchlist</p><h2 className="mt-1 text-lg font-bold text-slate-900">Top High-Exposure Customers</h2><p className="mt-1 text-xs text-slate-400">High-risk accounts with the largest estimated monthly revenue exposure.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-slate-50/75"><tr>{['Customer','Contract','Tenure','Monthly Bill','Churn Score','Profile'].map(h => <th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{highRisk.map(c => { const score = c.scores?.[0]; const exposure = score?.revenueAtRisk || c.monthlyCharges; return <tr key={c.id} className="hover:bg-emerald-50/30"><td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{c.customerId}</td><td className="px-4 py-3 text-xs text-slate-600">{c.contractType}</td><td className="px-4 py-3 text-xs text-slate-500">{c.tenure} mo</td><td className="px-4 py-3 text-xs font-bold text-slate-700">{money(exposure)}</td><td className="px-4 py-3 text-xs font-bold text-red-600">{score ? `${(score.score*100).toFixed(0)}%` : '—'}</td><td className="px-4 py-3"><Link to={`/customer/${c.customerId}`} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Inspect</Link></td></tr>; })}{highRisk.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">No high-risk customer profiles currently identified.</td></tr>}</tbody></table></div></section>

        <section className="glass-card rounded-3xl p-5 sm:p-6"><p className="eyebrow">Contract Exposure</p><h2 className="mt-1 text-lg font-bold text-slate-900">Revenue Risk by Contract</h2><p className="mt-1 text-xs text-slate-400">Estimated monthly exposure across contract types.</p><div className="mt-5 h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={byContract} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:10 }} /><YAxis tick={{ fill:'#64748b', fontSize:10 }} tickFormatter={v => `$${Number(v)/1000}k`} /><Tooltip formatter={v => [money(Number(v)), 'Revenue Risk']} contentStyle={tooltipStyle} /><Bar dataKey="revenueRisk" radius={[8,8,0,0]} maxBarSize={52}>{byContract.map((e,i)=><Cell key={i} fill={e.name === 'Month-to-month' ? '#ef4444' : e.name === 'One year' ? '#f59e0b' : '#10b981'} />)}</Bar></BarChart></ResponsiveContainer></div></section>
      </div>
    </>}
  </div>;
};
function Stat({ title, value, text, icon, tone }: { title:string; value:string; text:string; icon:React.ReactNode; tone:'red'|'amber'|'emerald' }) { const styles={red:'bg-red-50 text-red-600',amber:'bg-[#f3ebff] text-[#6824df]',emerald:'bg-[#f3ebff] text-[#6824df]'}; return <div className="glass-card rounded-3xl p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">{title}</p><p className="mt-3 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-[11px] text-slate-400">{text}</p></div><span className={`rounded-xl p-3 ${styles[tone]}`}>{icon}</span></div></div>; }
function State({ loading, error, onRetry }: { loading?:boolean; error?:string; onRetry?:()=>void }) { if(loading)return <div className="glass-card rounded-3xl p-16 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600"/><p className="mt-4 text-sm font-semibold text-slate-600">Analyzing revenue exposure...</p></div>; return <div className="glass-card rounded-3xl p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle size={22}/></div><h3 className="mt-4 text-sm font-bold text-slate-800">Connection Error</h3><p className="mx-auto mt-2 max-w-md text-xs text-slate-500">{error}</p><button onClick={onRetry} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Try again</button></div>; }
const tooltipStyle={borderRadius:12,border:'1px solid #e2e8f0',background:'#fff',fontSize:12};
export default RevenueRisk;
