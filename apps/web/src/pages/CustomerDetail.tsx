import React from 'react';
import { useParams, Link } from 'react-router-dom';

export const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-8 space-y-6">
      <nav className="text-sm text-slate-400">
        <Link to="/" className="hover:text-slate-200">&larr; Back to Dashboard</Link>
      </nav>

      <header className="pb-4 border-b border-slate-800">
        <h1 className="text-3xl font-bold text-sky-400">Customer Profile: {id || 'CUST-9821'}</h1>
        <p className="text-slate-400 text-sm mt-1">
          Detailed churn risk analysis, historical scores, and feature factors.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">
            Account Metadata
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Customer ID</p>
              <p className="font-mono text-slate-200">{id || 'CUST-9821'}</p>
            </div>
            <div>
              <p className="text-slate-400">Tenure</p>
              <p className="text-slate-200">24 months</p>
            </div>
            <div>
              <p className="text-slate-400">Contract Type</p>
              <p className="text-slate-200">Month-to-month</p>
            </div>
            <div>
              <p className="text-slate-400">Internet Service</p>
              <p className="text-slate-200">Fiber optic</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">
            ML Churn Risk Assessment
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Churn Probability</span>
              <span className="text-xl font-bold text-red-400">78%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Risk Band</span>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-950 text-red-400 rounded-full border border-red-800">
                HIGH
              </span>
            </div>
            <div className="pt-2">
              <span className="text-slate-400 text-sm block mb-1">Key Contributing Reason</span>
              <p className="text-xs bg-slate-900/80 p-3 rounded text-slate-300 border border-slate-700/50">
                High monthly charges combined with month-to-month contract structure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
