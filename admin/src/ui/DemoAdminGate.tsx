import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Eye, LockKeyhole, ShieldAlert } from "lucide-react";
import {
  demoAdministrator,
  demoSessionKey,
  verifyDemoAdministrator,
} from "../data/legacyAdminDemo";
import { AdminShell } from "./AdminShell";

function hasDemoSession(): boolean {
  try {
    return window.sessionStorage.getItem(demoSessionKey) === "active";
  } catch {
    return false;
  }
}

export function DemoAdminGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(hasDemoSession);
  const [username, setUsername] = useState<string>(demoAdministrator.username);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verifyDemoAdministrator(username, password)) {
      setError("展示帳號或密碼不正確，請使用下方提供的展示資料。");
      return;
    }
    window.sessionStorage.setItem(demoSessionKey, "active");
    setError("");
    setAuthenticated(true);
  }

  function signOut() {
    window.sessionStorage.removeItem(demoSessionKey);
    setPassword("");
    setAuthenticated(false);
  }

  if (authenticated) {
    return (
      <AdminShell
        operator={{
          displayName: demoAdministrator.displayName,
          role: demoAdministrator.role,
        }}
        onLogout={signOut}
      >
        {children}
      </AdminShell>
    );
  }

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="demo-login-title">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">PMC</span>
          <span><strong>交易修煉學院</strong><small>營運控制台展示版</small></span>
        </div>
        <p className="eyebrow">ADMIN DEMO ACCESS</p>
        <h1 id="demo-login-title">管理員登入</h1>
        <p className="login-lede">先用展示帳號進入新後台。這道登入只模擬操作流程，不是正式的安全防護。</p>

        <form onSubmit={signIn} className="login-form">
          <label className="form-field">
            <span>展示帳號</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>展示密碼</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="輸入展示密碼"
              required
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="button primary login-submit" type="submit">
            <LockKeyhole size={16} />
            登入新後台
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="demo-credential">
          <Eye size={18} aria-hidden="true" />
          <span>
            <strong>展示帳號：{demoAdministrator.username}</strong>
            <small>展示密碼：{demoAdministrator.password}</small>
          </span>
        </div>
        <div className="login-warning">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>GitHub Pages 是公開靜態網站，帳密會存在公開程式碼裡。正式版仍需接 Firebase Authentication 與權限規則。</p>
        </div>
      </section>
    </main>
  );
}
