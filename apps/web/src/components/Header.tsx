import React, { useState } from "react";
import { Bell, CheckCircle, Hexagon, ShieldAlert, Settings, X, User } from "lucide-react";
import { NavLink } from "react-router-dom";

export const Header: React.FC = () => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [threshold, setThreshold] = useState(60);
  const [autoRefresh, setAutoRefresh] = useState(true);

  return (
    <header className="sticky top-0 z-30 flex h-[80px] items-center border-b border-[#e9e2d8] bg-[#fffdfb]/95 px-8 backdrop-blur">
      <div className="flex items-center gap-3">
        <Hexagon size={27} className="text-[#6421e8]" strokeWidth={2.2} />
        <span className="text-2xl font-bold tracking-tight text-[#15131d]">ChurnGuard AI</span>
      </div>

      <nav className="ml-12 hidden h-full items-center gap-8 md:flex">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex h-full items-center text-sm font-bold transition ${
              isActive ? "border-b-[3px] border-[#6421e8] text-[#15131d]" : "text-[#555268] hover:text-[#15131d]"
            }`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/risk"
          className={({ isActive }) =>
            `flex h-full items-center text-sm font-bold transition ${
              isActive ? "border-b-[3px] border-[#6421e8] text-[#15131d]" : "text-[#555268] hover:text-[#15131d]"
            }`
          }
        >
          Risk Analytics
        </NavLink>
        <NavLink
          to="/customers"
          className={({ isActive }) =>
            `flex h-full items-center text-sm font-bold transition ${
              isActive ? "border-b-[3px] border-[#6421e8] text-[#15131d]" : "text-[#555268] hover:text-[#15131d]"
            }`
          }
        >
          Customer Health
        </NavLink>
        <NavLink
          to="/retention"
          className={({ isActive }) =>
            `flex h-full items-center text-sm font-bold transition ${
              isActive ? "border-b-[3px] border-[#6421e8] text-[#15131d]" : "text-[#555268] hover:text-[#15131d]"
            }`
          }
        >
          Retention Action Center
        </NavLink>
      </nav>

      <div className="relative ml-auto flex items-center gap-5 text-[#33344c]">
        {/* Notifications Button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifs(!showNotifs);
              setShowSettings(false);
              setShowProfile(false);
            }}
            aria-label="Notifications"
            className="relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Bell size={22} strokeWidth={1.9} />
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Notifications</span>
                <button onClick={() => setShowNotifs(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <div className="flex gap-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
                  <div>
                    <p className="font-bold">High Risk Surge Alert</p>
                    <p className="mt-0.5 text-[11px] text-rose-700">12 Month-to-month accounts crossed 75% risk score.</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-bold">Batch Scoring Completed</p>
                    <p className="mt-0.5 text-[11px] text-emerald-700">Updated predictions for priority customer queue.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Settings Button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowSettings(!showSettings);
              setShowNotifs(false);
              setShowProfile(false);
            }}
            aria-label="Settings"
            className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Settings size={22} strokeWidth={1.9} />
          </button>

          {showSettings && (
            <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Platform Settings</span>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>High Risk Threshold</span>
                    <span className="text-[#6421e8]">{threshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="90"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="mt-2 w-full accent-[#6421e8]"
                  />
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="font-semibold text-slate-700">Auto-refresh Dashboard</span>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#6421e8]"
                  />
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">
                  Model Engine: <b>XGBoost Classifier v2.1</b> (Inference API: Active)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfile(!showProfile);
              setShowNotifs(false);
              setShowSettings(false);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#6421e8] to-[#333750] text-xs font-bold text-white ring-2 ring-white shadow-sm hover:opacity-90"
          >
            CA
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#efe9ff] text-[#6421e8]">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Churn Analyst</p>
                  <p className="text-[11px] text-slate-500">analyst@churnguard.ai</p>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <p className="rounded-lg bg-slate-50 p-2 font-medium text-slate-600">
                  Role: <b>Retention Strategist</b>
                </p>
                <p className="rounded-lg bg-slate-50 p-2 font-medium text-slate-600">
                  Workspace: <b>Cognizant Hackathon Org</b>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
