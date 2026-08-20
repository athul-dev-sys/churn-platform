import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Play, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChurnScore, Customer, fetchCustomers, scoreBatch } from '../lib/api';

export const RetentionActions: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<{ processed: number; scores: ChurnScore[] } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true); setError(null); setSelectedIds([]); setBatchResult(null); setBatchError(null);
    try { setCustomers(await fetchCustomers()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to connect to the prediction API.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadData(); }, []);

  const atRisk = customers.filter(c => c.scores?.[0]?.riskBand === 'High' || c.scores?.[0]?.riskBand === 'Medium');
  const selectAll = (checked: boolean) => setSelectedIds(checked ? atRisk.map(c => c.customerId) : []);
  const toggle = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const runBatch = async () => {
    if (!selectedIds.length) return;
    setBatchLoading(true); setBatchError(null); setBatchResult(null);
    try { const result = await scoreBatch(selectedIds); setBatchResult(result); setCustomers(await fetchCustomers()); }
    catch (err) { setBatchError(err instanceof Error ? err.message : 'Batch prediction process failed.'); }
    finally { setBatchLoading(false); }
  };

  return <div className="space-y-6">
    <header className="border-b border-slate-200/60 pb-6"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="eyebrow">Retention Intelligence</p><h1 className="page-title mt-2">Retention Action Center</h1><p className="page-subtitle mt-2 max-w-2xl">Prioritize at-risk customers, review recommended campaigns and trigger fresh model scoring.</p></div><button onClick={() => void loadData()} disabled={loading} className="glass-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Reload system</button></div></header>
    {loading ? <div className="glass-card rounded-3xl p-16 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600"/><p className="mt-4 text-sm font-semibold text-slate-600">Initializing action panel...</p></div> : error ? <ErrorState message={error} onRetry={() => void loadData()} /> : <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <section className="space-y-4"><div><p className="eyebrow">Retention Playbook</p><h2 className="mt-1 text-lg font-bold text-slate-900">Recommended Campaigns</h2></div>
        <Campaign tone="amber" label="Contract Migration" title="Save Month-to-Month Subscribers" text="Offer elevated-risk month-to-month customers a transition incentive toward a longer agreement." target="Target: tenure < 24 months + Month-to-month" />
        <Campaign tone="rose" label="Price Audit" title="Fiber High-Charge Loyalty Credit" text="Review high-charge Fiber Optic customers and consider a loyalty credit or bundle adjustment." target="Target: Fiber optic + monthly charges > $80" />
        <Campaign tone="emerald" label="Autopay Promotion" title="Paperless Payment Upgrade" text="Encourage eligible customers to move from manual payment methods to an automatic payment option." target="Target: payment method indicates manual/check payment" />
      </section>

      <section className="glass-card rounded-3xl p-5 sm:p-6 lg:col-span-2"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><Sparkles size={17}/></span><div><p className="eyebrow">Model Operations</p><h2 className="mt-1 text-lg font-bold text-slate-900">Scoring Command Console</h2></div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">At risk: {atRisk.length}</span></div><p className="mt-3 text-xs leading-5 text-slate-500">Select High and Medium risk accounts and trigger the existing batch scoring endpoint.</p>
        {batchLoading && <Alert tone="blue" icon={<RefreshCw size={16} className="animate-spin"/>} title="Scoring pipeline active" text="Calling the backend batch scoring endpoint and refreshing customer scores."/>}
        {batchError && <Alert tone="red" icon={<AlertCircle size={16}/>} title="Batch scoring failed" text={batchError}/>} 
        {batchResult && <Alert tone="green" icon={<CheckCircle2 size={16}/>} title="Scoring cycle complete" text={`Updated ${batchResult.processed} customer accounts.`}/>} 
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#eee8df] bg-white/55 p-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-slate-600">Selected customers: <b>{selectedIds.length}</b></span><button onClick={() => void runBatch()} disabled={!selectedIds.length || batchLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6824df] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#571bc2] disabled:cursor-not-allowed disabled:bg-slate-300"><Play size={14} fill="currentColor"/> Execute batch prediction</button></div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200/60"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-50/80"><tr><th className="w-10 px-4 py-3"><input type="checkbox" checked={atRisk.length > 0 && selectedIds.length === atRisk.length} onChange={e => selectAll(e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"/></th>{['Customer','Risk','Churn Score','Monthly Bill','Profile'].map(h=><th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-[.13em] text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{atRisk.map(c=>{const score=c.scores?.[0];const band=score?.riskBand||'Medium';const checked=selectedIds.includes(c.customerId);return <tr key={c.id} className="hover:bg-emerald-50/30"><td className="px-4 py-3"><input type="checkbox" checked={checked} onChange={()=>toggle(c.customerId)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"/></td><td className="px-4 py-3 font-mono font-bold text-slate-700">{c.customerId}</td><td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${band==='High'?'border-red-200 bg-red-50 text-red-700':'border-amber-200 bg-amber-50 text-amber-700'}`}>{band}</span></td><td className="px-4 py-3 font-bold text-slate-700">{score?`${(score.score*100).toFixed(0)}%`:'—'}</td><td className="px-4 py-3 text-slate-500">${c.monthlyCharges.toFixed(2)}</td><td className="px-4 py-3 text-right"><Link to={`/customer/${c.customerId}`} className="font-bold text-emerald-600 hover:text-emerald-700">Profile</Link></td></tr>})}{atRisk.length===0&&<tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No High or Medium risk profiles are currently loaded.</td></tr>}</tbody></table></div>
      </section>
    </div>}
  </div>;
};

function Campaign({ tone, label, title, text, target }: { tone:'amber'|'rose'|'emerald'; label:string; title:string; text:string; target:string }) { const c={amber:'border-l-amber-500 bg-amber-50/40 text-amber-700',rose:'border-l-rose-500 bg-rose-50/40 text-rose-700',emerald:'border-l-emerald-500 bg-emerald-50/40 text-emerald-700'}[tone]; return <article className={`glass-card rounded-2xl border-l-4 p-5 ${c}`}><span className="text-[9px] font-bold uppercase tracking-[.14em]">{label}</span><h3 className="mt-2 text-sm font-bold text-slate-900">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p><div className="mt-3 rounded-xl border border-white/80 bg-white/60 p-2.5 text-[10px] font-semibold text-slate-600">{target}</div></article>; }
function Alert({ tone, icon, title, text }: { tone:'blue'|'red'|'green'; icon:React.ReactNode; title:string; text:string }) { const c={blue:'border-blue-100 bg-blue-50 text-blue-700',red:'border-red-100 bg-red-50 text-red-700',green:'border-emerald-100 bg-emerald-50 text-emerald-700'}[tone]; return <div className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${c}`}><span className="mt-0.5">{icon}</span><div><p className="text-xs font-bold">{title}</p><p className="mt-1 text-[11px] opacity-80">{text}</p></div></div>; }
function ErrorState({ message, onRetry }: { message:string; onRetry:()=>void }) { return <div className="glass-card rounded-3xl p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle size={22}/></div><h3 className="mt-4 text-sm font-bold text-slate-800">Connection Error</h3><p className="mx-auto mt-2 max-w-md text-xs text-slate-500">{message}</p><button onClick={onRetry} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Try again</button></div>; }
export default RetentionActions;
