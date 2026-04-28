import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  GraduationCap,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useState } from "react";
import { cls } from "../lib/utils";

const NAV = [
  { to: "/", label: "ダッシュボード", icon: BarChart3 },
  { to: "/calendar", label: "カレンダー", icon: CalendarDays },
  { to: "/internships", label: "インターン", icon: GraduationCap },
  { to: "/selections", label: "本選考", icon: Briefcase },
  { to: "/companies", label: "企業", icon: Building2 },
  { to: "/settings", label: "通知設定", icon: SettingsIcon },
];

export default function Layout() {
  const { user, clearAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <div className="min-h-full flex flex-col md:flex-row bg-slate-50">
      {/* Header (mobile + desktop) */}
      <header
        className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-md hover:bg-slate-100"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="font-bold text-slate-800 hover:text-primary-600 transition"
          >
            就活マネージャー
          </Link>
        </div>
        <div className="text-xs text-slate-500 truncate max-w-[40%]">
          {user?.display_name || user?.first_name}
        </div>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:border-r md:border-slate-200 md:bg-white md:h-screen md:sticky md:top-0">
        <Link
          to="/"
          className="px-5 py-5 border-b border-slate-100 block hover:bg-slate-50 transition"
        >
          <div className="text-lg font-bold text-slate-800">就活マネージャー</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            インターン＆本選考を一元管理
          </div>
        </Link>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                cls(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition",
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-100"
                )
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="px-2 py-2 text-xs">
            <div className="font-semibold text-slate-700 truncate">
              {user?.display_name || user?.first_name}
            </div>
            <div className="text-slate-400">{user?.email || "メール未設定"}</div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={16} /> ログアウト
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="font-bold">メニュー</div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cls(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium",
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-600 hover:bg-slate-100"
                    )
                  }
                >
                  <n.icon size={18} />
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
              >
                <LogOut size={16} /> ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="max-w-6xl mx-auto w-full px-4 py-5 md:py-8 pb-12 flex-1">
          <Outlet />
        </div>
        <footer className="px-4 pb-6 pt-2 text-[10px] leading-relaxed text-slate-400 text-center max-w-2xl mx-auto">
          ※本アプリは個人が就職活動の情報整理を目的として提供するものであり、内容の正確性・完全性・最新性を保証するものではありません。
          本アプリの利用または利用不能、データの消失、通知の遅延・未達、選考結果等に起因する一切の損害について、開発者は責任を負いません。
          利用者ご自身の判断と責任でご利用ください。
        </footer>
      </main>
    </div>
  );
}
