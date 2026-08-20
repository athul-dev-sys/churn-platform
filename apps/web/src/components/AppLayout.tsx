import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, HelpCircle, HeartPulse, Home, LogOut, FileText, ShieldAlert, Hexagon } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/risk", label: "Risk Monitoring", icon: ShieldAlert },
  { to: "/customers", label: "Customer Health", icon: HeartPulse },
  { to: "/revenue", label: "Revenue", icon: FileText },
  { to: "/retention", label: "Retention action", icon: BarChart3 },
];

export const AppLayout: React.FC = () => (
  <div className="min-h-screen bg-[#f8f1e5] text-[#171624]" style={{ backgroundImage: "linear-gradient(rgba(255, 248, 235, 0.56), rgba(255, 248, 235, 0.56)), url('/assets/cream-abstract-bg.png')", backgroundAttachment: "fixed", backgroundSize: "cover", backgroundPosition: "center" }}>
    <aside className="fixed bottom-0 left-0 top-0 z-20 hidden w-72 flex-col border-r border-white/60 bg-[#fffdf9]/70 px-3 py-7 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0e8ff] text-[#6824df]"><Hexagon size={24} strokeWidth={2.3} /></span>
        <div><p className="text-lg font-bold tracking-tight text-[#15131d]">ChurnGuard AI</p><p className="mt-0.5 text-[11px] font-medium text-[#6c6878]">Customer Intelligence</p></div>
      </div>
      <nav className="mt-11 space-y-2">
        {links.map(({ to, label, icon: LinkIcon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-5 py-3 text-sm font-semibold transition ${isActive ? "bg-gradient-to-r from-[#6923e8] to-[#7c2de2] text-white shadow-md shadow-purple-200" : "text-[#303048] hover:bg-[#f6f0ea]"}`}><LinkIcon size={21} strokeWidth={1.9} />{label}</NavLink>)}
      </nav>
      <div className="mt-auto border-t border-[#eee6dc] px-2 pt-4"><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#303048] hover:bg-[#f6f0ea]"><HelpCircle size={20} />Help</button><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#303048] hover:bg-[#f6f0ea]"><LogOut size={20} />Logout</button></div>
    </aside>
    <main className="min-h-screen lg:ml-72"><div className="mx-auto max-w-[1540px] px-6 py-7 xl:px-10"><Outlet /></div></main>
  </div>
);

export default AppLayout;
