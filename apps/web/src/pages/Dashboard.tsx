import React from 'react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  return (
    <div className="p-8 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-bold text-sky-400">Churn Analytics Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Overview of customer retention, risk score distribution, and revenue at risk.
          </p>
        </div>
      </header>

      {/* KPI Cards Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-xl">
          <p className="text-xs uppercase tracking-wider text-slate-400">Total Customers</p>
          <p className="text-2xl font-bold text-white mt-1">1,250</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-xl">
          <p className="text-xs uppercase tracking-wider text-red-400">High Risk Customers</p>
          <p className="text-2xl font-bold text-red-400 mt-1">180</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-xl">
          <p className="text-xs uppercase tracking-wider text-amber-400">Medium Risk</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">320</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-xl">
          <p className="text-xs uppercase tracking-wider text-emerald-400">Low Risk</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">750</p>
        </div>
      </div>

      {/* Table Placeholder */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Sample At-Risk Accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 uppercase text-xs">
              <tr>
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Tenure</th>
                <th className="py-3 px-4">Contract</th>
                <th className="py-3 px-4">Monthly Charges</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="py-3 px-4 font-mono">CUST-9821</td>
                <td className="py-3 px-4">24 mos</td>
                <td className="py-3 px-4">Month-to-month</td>
                <td className="py-3 px-4">$85.50</td>
                <td className="py-3 px-4">
                  <Link to="/customer/CUST-9821" className="text-sky-400 hover:underline">
                    View Detail &rarr;
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
