import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, HelpCircle, HeartPulse, Home, LogOut, FileText, ShieldAlert, Hexagon, X, BookOpen, CheckCircle } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/risk", label: "Risk Monitoring", icon: ShieldAlert },
  { to: "/customers", label: "Customer Health", icon: HeartPulse },
  { to: "/revenue", label: "Revenue Exposure", icon: FileText },
  { to: "/retention", label: "Retention Action", icon: BarChart3 },
];

export const AppLayout: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  const handleLogout = () => {
    setLoggedOut(true);
    setTimeout(() => {
      setLoggedOut(false);
      setShowLogout(false);
    }, 1500);
  };

  return (
    <div
      className="min-h-screen bg-[#f8f1e5] text-[#171624]"
      style={{
        backgroundImage: "linear-gradient(rgba(255, 248, 235, 0.56), rgba(255, 248, 235, 0.56)), url('/assets/cream-abstract-bg.png')",
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <aside className="fixed bottom-0 left-0 top-0 z-20 hidden w-72 flex-col border-r border-white/60 bg-[#fffdf9]/70 px-3 py-7 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3 px-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0e8ff] text-[#6824df]">
            <Hexagon size={24} strokeWidth={2.3} />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight text-[#15131d]">ChurnGuard AI</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#6c6878]">Customer Intelligence</p>
          </div>
        </div>

        <nav className="mt-11 space-y-2">
          {links.map(({ to, label, icon: LinkIcon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-5 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-gradient-to-r from-[#6923e8] to-[#7c2de2] text-white shadow-md shadow-purple-200"
                    : "text-[#303048] hover:bg-[#f6f0ea]"
                }`
              }
            >
              <LinkIcon size={21} strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-[#eee6dc] px-2 pt-4">
          <button
            onClick={() => setShowHelp(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#303048] transition hover:bg-[#f6f0ea]"
          >
            <HelpCircle size={20} />
            Help & Documentation
          </button>
          <button
            onClick={() => setShowLogout(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#303048] transition hover:bg-[#f6f0ea]"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-72">
        <div className="mx-auto max-w-[1540px] px-6 py-7 xl:px-10">
          <Outlet />
        </div>
      </main>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white bg-[#fffdfb] p-7 shadow-2xl">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#efe9ff] text-[#6421e8]">
                <BookOpen size={20} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Platform Help & Guide</h3>
                <p className="text-xs text-slate-500">ChurnGuard AI Operational Overview</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-xs leading-5 text-slate-600">
              <p><b>Customer Health:</b> Search and inspect individual profiles, monthly charges, tenure, and ML predictions.</p>
              <p><b>Retention Action Center:</b> Select at-risk customers to trigger batch ML scoring or launch targeted retention campaigns.</p>
              <p><b>Risk Analytics:</b> View risk distributions by contract type, internet service tier, and customer tenure cohorts.</p>
              <p><b>Revenue Exposure:</b> Monitor overall financial risk across high and medium churn risk accounts.</p>
            </div>
            <div className="mt-6 text-right">
              <button
                onClick={() => setShowHelp(false)}
                className="rounded-xl bg-[#6421e8] px-5 py-2 text-xs font-bold text-white shadow-sm"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white bg-[#fffdfb] p-7 text-center shadow-2xl">
            {loggedOut ? (
              <div className="py-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle size={24} />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-900">Session Terminated</p>
                <p className="mt-1 text-xs text-slate-500">You have been logged out safely.</p>
              </div>
            ) : (
              <>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <LogOut size={22} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">Log out of ChurnGuard?</h3>
                <p className="mt-2 text-xs text-slate-500">Your current workspace preferences and batch selections will be saved.</p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowLogout(false)}
                    className="w-1/2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-1/2 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
