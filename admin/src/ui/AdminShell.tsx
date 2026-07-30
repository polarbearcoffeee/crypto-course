import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Gauge,
  GraduationCap,
  Menu,
  Settings2,
} from "lucide-react";

const navigation = [
  { to: "/", label: "營運總覽", icon: Gauge },
  { to: "/learners", label: "學員營運", icon: GraduationCap },
  { to: "/curriculum", label: "課程發布", icon: BookOpenCheck },
  { to: "/analytics", label: "學習分析", icon: BarChart3 },
  { to: "/settings", label: "系統治理", icon: Settings2 },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside
        id="primary-navigation"
        className="sidebar"
        aria-label="主要導覽"
        style={isMobileMenuOpen ? { display: "flex" } : undefined}
      >
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">PMC</span>
          <span>
            <strong>交易修煉學院</strong>
            <small>營運控制台</small>
          </span>
        </div>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={pathname === to ? "nav-link active" : "nav-link"}
              activeOptions={{ exact: to === "/" }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="system-signal">
          <Activity size={18} aria-hidden="true" />
          <span><strong>開發環境</strong><small>僅使用示範資料</small></span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label={isMobileMenuOpen ? "關閉導覽" : "開啟導覽"}
            aria-controls="primary-navigation"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
          >
            <Menu size={20} />
          </button>
          <div>
            <span className="environment-label">DEV / ASIA–TAIPEI</span>
          </div>
          <div className="operator">
            <span className="operator-dot" aria-hidden="true" />
            <span>尚未登入</span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
