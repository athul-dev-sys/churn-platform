import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, DollarSign, ShieldAlert, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Customer, fetchCustomerById, scoreBatch } from "../lib/api";

const Metric = ({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) => (
  <article className="relative min-h-[160px] overflow-hidden rounded-2xl border border-white bg-[#fffdfa] p-6 shadow-sm">
    <div className="absolute right-6 top-6 text-[#e8e5e3]">{icon}</div>
    <p className="text-xs font-bold uppercase tracking-[.12em] text-[#2d2b42]">{title}</p>
    <p className="mt-3 text-3xl font-bold tracking-tight text-[#17151a]">{value}</p>
    <p className="mt-3 text-xs font-semibold text-[#666274]">{detail}</p>
  </article>
);

const Reco = ({ impact, title, text }: { impact: string; title: string; text: string }) => (
  <article className="rounded-xl bg-white p-5 shadow-sm">
    <div className="flex justify-between items-center">
      <span className="rounded bg-[#efe9ff] px-2.5 py-1 text-xs font-bold text-[#5f20e2]">{impact}</span>
      <ArrowRight size={16} className="text-[#5f20e2]" />
    </div>
    <h3 className="mt-4 text-base font-bold">{title}</h3>
    <p className="mt-2 text-xs leading-5 text-[#3e3d50]">{text}</p>
  </article>
);

export const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);

  const loadCustomer = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerById(id);
      setCustomer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load customer profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomer();
  }, [id]);

  const handleScoreCustomer = async () => {
    if (!customer) return;
    setScoring(true);
    try {
      await scoreBatch([customer.customerId]);
      await loadCustomer();
    } catch (err) {
      console.error("Scoring error:", err);
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_47%_20%,#fffdf9_0,#f6eedc_58%,#f2e4ca_100%)] p-10 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#6622df] border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-[#555164]">Loading customer profile...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_47%_20%,#fffdf9_0,#f6eedc_58%,#f2e4ca_100%)] p-10">
        <section className="mx-auto max-w-[800px] text-center rounded-3xl bg-white/80 p-12 border border-white">
          <h2 className="text-xl font-bold text-slate-800">Customer Profile Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">{error || `No customer found for '${id}'`}</p>
          <Link to="/customers" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#6622df] px-6 py-2.5 text-xs font-bold text-white">
            <ArrowLeft size={14} /> Back to Directory
          </Link>
        </section>
      </div>
    );
  }

  const latestScore = customer.scores?.[0];
  const scoreVal = latestScore ? Math.round(latestScore.score * 100) : null;
  const riskBand = latestScore?.riskBand || "Unscored";
  const isHighRisk = riskBand === "High";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_47%_20%,#fffdf9_0,#f6eedc_58%,#f2e4ca_100%)] p-6 sm:p-10">
      <section className="mx-auto max-w-[1200px]">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-6">
            <Link aria-label="Back" to="/customers" className="flex h-12 w-12 items-center justify-center rounded-full border border-white bg-white/80 shadow-sm transition hover:bg-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight font-mono">{customer.customerId}</h1>
                <span className={`rounded-md border px-3 py-1 text-xs font-bold ${
                  isHighRisk ? "border-rose-300 bg-rose-100 text-rose-600" :
                  riskBand === "Medium" ? "border-amber-300 bg-amber-100 text-amber-700" :
                  riskBand === "Low" ? "border-emerald-300 bg-emerald-100 text-emerald-700" :
                  "border-slate-300 bg-slate-100 text-slate-600"
                }`}>
                  {riskBand} Risk
                </span>
                {customer.actualChurn && (
                  <span className="rounded-md border border-red-500 bg-red-500 px-3 py-1 text-xs font-bold text-white">
                    Historical Churn Record
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-[#34334a]">
                {customer.contractType} Contract • {customer.internetService} • Paid via {customer.paymentMethod}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleScoreCustomer}
              disabled={scoring}
              className="inline-flex items-center gap-2 rounded-full border border-[#c6c2d4] bg-white px-6 py-2.5 text-xs font-bold text-[#34334a] hover:bg-slate-50 transition"
            >
              <Sparkles size={14} className={scoring ? "animate-spin" : "text-[#6622df]"} />
              {scoring ? "Scoring..." : "Run ML Scoring"}
            </button>
            <Link to="/retention" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6622df] to-[#7c22de] px-6 py-2.5 text-xs font-bold text-white shadow-sm">
              Initiate Playbook <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        <div className="mt-10 grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-7">
            <div className="grid gap-6 md:grid-cols-3">
              <Metric title="Tenure" value={`${customer.tenure} mo`} detail="Account duration" icon={<ShieldAlert size={48} />} />
              <Metric title="Monthly Charges" value={`$${customer.monthlyCharges.toFixed(2)}`} detail="Monthly bill" icon={<DollarSign size={48} />} />
              <Metric title="Total Revenue" value={`$${customer.totalCharges.toFixed(2)}`} detail="Lifetime charges" icon={<DollarSign size={48} />} />
            </div>

            <article className="rounded-2xl border border-white bg-[#fffdfa] p-7 shadow-sm">
              <h2 className="text-xl font-bold">Account Specifications</h2>
              <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#faf6f0]">
                  <p className="font-semibold text-slate-400">Contract Type</p>
                  <p className="mt-1 font-bold text-slate-800 text-sm">{customer.contractType}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#faf6f0]">
                  <p className="font-semibold text-slate-400">Internet Service</p>
                  <p className="mt-1 font-bold text-slate-800 text-sm">{customer.internetService}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#faf6f0]">
                  <p className="font-semibold text-slate-400">Payment Method</p>
                  <p className="mt-1 font-bold text-slate-800 text-sm">{customer.paymentMethod}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#faf6f0]">
                  <p className="font-semibold text-slate-400">Actual Churn Status</p>
                  <p className={`mt-1 font-bold text-sm ${customer.actualChurn ? "text-rose-600" : "text-emerald-600"}`}>
                    {customer.actualChurn ? "Churned" : "Active"}
                  </p>
                </div>
              </div>
            </article>

            {latestScore && (
              <article className="rounded-2xl border border-white bg-[#fffdfa] p-7 shadow-sm">
                <h2 className="text-xl font-bold">Prediction Reason & Drivers</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 bg-[#fbf9f6] p-4 rounded-xl border border-slate-100">
                  {latestScore.reason}
                </p>
              </article>
            )}
          </div>

          <aside className="space-y-7">
            <article className="rounded-2xl border border-white bg-[#fffdfa] p-7 text-center shadow-sm">
              <h2 className="text-xl font-bold">Predicted Churn Risk</h2>
              <p className="mt-1 text-xs text-[#474559]">ML Risk Classification</p>
              
              {scoreVal !== null ? (
                <div className="mx-auto mt-6 flex h-48 w-48 items-center justify-center rounded-full bg-[radial-gradient(circle,#ffe2e2_45%,transparent_46%),conic-gradient(from_210deg,#7721e4,#e71858,#c2147f,#7721e4)] p-[14px]">
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#ffe1e1]">
                    <strong className="text-4xl text-[#e8174c] font-bold">{scoreVal}%</strong>
                    <span className="font-bold tracking-wider text-xs text-[#e8174c] uppercase">{riskBand} RISK</span>
                  </div>
                </div>
              ) : (
                <div className="my-8 py-8 text-slate-400 text-xs font-semibold">
                  No prediction available yet. Click "Run ML Scoring" above to score this account.
                </div>
              )}

              <div className="mt-6 flex justify-between rounded-xl bg-[#faf6f0] px-4 py-3 text-xs text-left">
                <span>Revenue at Risk:</span>
                <b className="text-slate-800">${(latestScore?.revenueAtRisk ?? customer.totalCharges).toFixed(2)}</b>
              </div>
            </article>

            <article className="rounded-2xl border border-white bg-[#fffdfa] p-7 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Bot className="text-[#6923e8]" size={20} /> Actionable Playbooks
              </h2>
              <div className="mt-5 space-y-4">
                <Reco impact="HIGH IMPACT" title="Executive Sync" text="Initiate proactive account review and contract extension terms." />
                <Reco impact="MEDIUM IMPACT" title="Discount Offer" text="Offer a 10% monthly charge reduction for a 1-year contract lock-in." />
              </div>
            </article>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default CustomerDetail;
