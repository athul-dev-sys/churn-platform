import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart2, Layers, RefreshCw, TrendingDown } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Customer, fetchCustomers } from '../lib/api';

const tone = (score: number) => score > 60 ? '#e11d50' : score > 30 ? '#b05aeb' : '#7027dc';

export const RiskAnalytics: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true); setError(null);
    try { const res = await fetchCustomers(undefined, undefined, 1, 10000); setCustomers(Array.isArray(res) ? res : res.data || []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to connect to the prediction API.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadData(); }, []);

  const contractData = useMemo(() => {
    const normalize = (val: string) => {
      const lower = (val || '').trim().toLowerCase();
      if (lower.includes('month')) return 'Month-to-month';
      if (lower.includes('one') || lower.includes('1')) return 'One year';
      if (lower.includes('two') || lower.includes('2')) return 'Two year';
      return val || 'Unknown';
    };
    return aggregate(customers, c => normalize(c.contractType));
  }, [customers]);
  const internetData = useMemo(() => aggregate(customers, c => c.internetService === 'No' ? 'No Internet' : c.internetService), [customers]);
  const tenureData = useMemo(() => {
    const buckets = [{ name: '0-12 mos', min: 0, max: 12 }, { name: '13-24 mos', min: 13, max: 24 }, { name: '25-36 mos', min: 25, max: 36 }, { name: '37-48 mos', min: 37, max: 48 }, { name: '49-60 mos', min: 49, max: 60 }, { name: '61+ mos', min: 61, max: 999 }];
    return buckets.map(b => {
      const rows = customers.filter(c => c.tenure >= b.min && c.tenure <= b.max);
      const avg = rows.length ? rows.reduce((sum, c) => sum + (c.scores?.[0]?.score ?? 0), 0) / rows.length : 0;
      return { name: b.name, avgScore: Number((avg * 100).toFixed(1)), customers: rows.length };
    });
  }, [customers]);

  return <div className="space-y-6">
    <header className="border-b border-slate-200/60 pb-6"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="eyebrow">Risk Intelligence</p><h1 className="page-title mt-2">Risk Analytics</h1><p className="page-subtitle mt-2 max-w-2xl">Explore churn risk patterns across contracts, internet services and customer tenure.</p></div><button onClick={() => void loadData()} disabled={loading} className="glass-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh analytics</button></div></header>
    {loading ? <State loading /> : error ? <State error={error} onRetry={() => void loadData()} /> : customers.length === 0 ? <State empty /> : <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <ChartCard icon={<Layers size={17} />} title="Risk by Contract Type" description="Average predicted churn probability grouped by contract type."><BarChartBox data={contractData} /></ChartCard>
      <ChartCard icon={<BarChart2 size={17} />} title="Risk by Internet Service" description="Average predicted churn probability by internet service configuration."><BarChartBox data={internetData} /></ChartCard>
      <section className="glass-card rounded-3xl p-5 sm:p-6 lg:col-span-2"><div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><TrendingDown size={17} /></span><div><p className="eyebrow">Customer Lifecycle</p><h2 className="mt-1 text-lg font-bold text-slate-900">Risk Trend Over Tenure</h2><p className="mt-1 text-xs text-slate-400">Average predicted churn probability across tenure buckets.</p></div></div><div className="mt-5 h-[300px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={tenureData} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}><defs><linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.28} /><stop offset="95%" stopColor="#10b981" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit="%" /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="avgScore" stroke="#10b981" strokeWidth={3} fill="url(#riskArea)" name="Average Churn Score" /></AreaChart></ResponsiveContainer></div></section>
    </div>}
  </div>;
};

function aggregate(customers: Customer[], key: (c: Customer) => string) {
  const groups: Record<string, { total: number; count: number }> = {};
  customers.forEach(c => { const name = key(c) || 'Unknown'; const score = c.scores?.[0]?.score ?? 0; groups[name] ??= { total: 0, count: 0 }; groups[name].total += score; groups[name].count += 1; });
  return Object.entries(groups).map(([name, g]) => ({ name, avgScore: Number(((g.total / g.count) * 100).toFixed(1)), count: g.count }));
}
function ChartCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) { return <section className="glass-card rounded-3xl p-5 sm:p-6"><div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-600">{icon}</span><div><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{description}</p></div></div><div className="mt-5 h-[290px]">{children}</div></section>; }
function BarChartBox({ data }: { data: Array<{ name: string; avgScore: number }> }) { return <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit="%" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="avgScore" name="Average Churn Score" radius={[8,8,0,0]} maxBarSize={52}>{data.map((entry, i) => <Cell key={i} fill={tone(entry.avgScore)} />)}</Bar></BarChart></ResponsiveContainer>; }
const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', fontSize: 12 };
function State({ loading, error, empty, onRetry }: { loading?: boolean; error?: string; empty?: boolean; onRetry?: () => void }) { if (loading) return <div className="glass-card rounded-3xl p-16 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600" /><p className="mt-4 text-sm font-semibold text-slate-600">Calculating risk dimensions...</p></div>; if (error) return <div className="glass-card rounded-3xl p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle size={22} /></div><h3 className="mt-4 text-sm font-bold text-slate-800">Connection Error</h3><p className="mx-auto mt-2 max-w-md text-xs text-slate-500">{error}</p><button onClick={onRetry} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Try again</button></div>; return <div className="glass-card rounded-3xl p-16 text-center text-sm text-slate-500">No customer profiles are available for analytics.</div>; }
export default RiskAnalytics;
