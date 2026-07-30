import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { auditRows } from "../data/demo";
import {
  demoAdministrator,
  isLegacyPinDisabled,
  readLegacyPin,
  saveLegacyPin,
  setLegacyPinDisabled,
} from "../data/legacyAdminDemo";
import { PageHeader } from "../ui/PageHeader";

const sections = ["學習規則", "管理員權限", "舊 PIN 遷移", "流量來源", "系統健康", "操作紀錄"] as const;

export function SettingsPage() {
  const [section, setSection] = useState<(typeof sections)[number]>("學習規則");
  return (
    <section className="page">
      <PageHeader eyebrow="SYSTEM GOVERNANCE" title="系統治理" description="新後台登入、舊 PIN 遷移、角色權限、規則與健康狀態集中管理。" />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="系統治理分類">
          {sections.map((item) => (
            <button className={section === item ? "active" : ""} onClick={() => setSection(item)} key={item}>{item}</button>
          ))}
        </nav>
        <div className="settings-content">
          {section === "學習規則" && <Rules />}
          {section === "管理員權限" && <Roles />}
          {section === "舊 PIN 遷移" && <LegacyPinMigration />}
          {section === "流量來源" && <Sources />}
          {section === "系統健康" && <Health />}
          {section === "操作紀錄" && <Audit />}
        </div>
      </div>
    </section>
  );
}

function Rules() {
  return (
    <section>
      <div className="content-heading">
        <div><p className="panel-kicker">SETTINGS V3</p><h2>學習與判定規則</h2><p>變更只影響後續判定，過去 XP 帳本不會被改寫。</p></div>
        <button className="button primary">建立新版本</button>
      </div>
      <div className="rule-grid">
        {[
          ["測驗預設及格門檻", "80%"],
          ["影片觀看要求", "必須完成"],
          ["卡關判定", "7 天"],
          ["活躍期間", "最近 7 天"],
          ["每日簽到 XP", "10 XP"],
          ["單課完課 XP", "100 XP"],
        ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><button>調整</button></article>)}
      </div>
      <div className="version-note"><RotateCcw size={17} /><span><strong>可回復設定</strong><small>任何變更都會先顯示受影響人數，確認後建立新版本。</small></span></div>
    </section>
  );
}

function Roles() {
  return (
    <section>
      <div className="content-heading">
        <div><p className="panel-kicker">ACCESS CONTROL</p><h2>管理員與權限</h2><p>GitHub Pages 已加入展示登入；正式版仍需串接 Firebase Authentication。</p></div>
        <span className="health-summary"><LockKeyhole size={17} />展示登入已啟用</span>
      </div>
      <article className="demo-admin-account">
        <span className="operator-dot authenticated" />
        <div><strong>{demoAdministrator.displayName}</strong><small>{demoAdministrator.username}</small></div>
        <span className="status-badge">Owner</span>
      </article>
      <div className="role-table">
        <div className="role-head"><span>角色</span><span>成員</span><span>學員/UID</span><span>發布</span><span>設定</span></div>
        {[
          ["Owner", "1", "完整", "允許", "允許"],
          ["Lead teacher", "2", "完整", "允許", "唯讀"],
          ["Assistant", "4", "有限", "不允許", "不允許"],
          ["Content editor", "2", "不允許", "草稿", "不允許"],
          ["Analyst", "1", "遮罩", "不允許", "不允許"],
        ].map((row) => (
          <div className="role-row" key={row[0]}>{row.map((cell, index) => <span key={`${row[0]}-${index}`}>{cell}</span>)}</div>
        ))}
      </div>
      <div className="security-note"><ShieldCheck /><span><strong>展示登入不等於正式安全</strong><small>正式環境必須使用具名帳號、角色權限、撤權與敏感操作重新驗證。</small></span></div>
    </section>
  );
}

function LegacyPinMigration() {
  const [pin, setPin] = useState(readLegacyPin);
  const [disabled, setDisabled] = useState(isLegacyPinDisabled);
  const [message, setMessage] = useState("");
  const validPin = /^\d{4,8}$/.test(pin);

  function storePin() {
    if (!validPin) return;
    saveLegacyPin(pin);
    setMessage("舊 PIN 展示值已更新；只保存在目前瀏覽器。");
  }

  function toggleDisabled() {
    const next = !disabled;
    setLegacyPinDisabled(next);
    setDisabled(next);
    setMessage(next ? "已標記舊 PIN 停止使用。" : "已恢復舊 PIN 遷移狀態。");
  }

  return (
    <section>
      <div className="content-heading">
        <div><p className="panel-kicker">SHARED PIN RETIREMENT</p><h2>舊教師後台 PIN 遷移</h2><p>保留舊 PIN 的交接狀態，但新後台登入不再使用這組 PIN。</p></div>
        <span className={`migration-state ${disabled ? "retired" : ""}`}>{disabled ? "已標記停用" : "遷移中"}</span>
      </div>
      <div className="pin-migration-panel">
        <KeyRound size={24} />
        <label className="form-field">
          <span>舊站共用 PIN（展示值）</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(event) => { setPin(event.target.value.replace(/\D/g, "")); setMessage(""); }}
          />
          {!validPin && <small className="field-error">請輸入 4 到 8 位數字。</small>}
        </label>
        <div className="pin-actions">
          <button className="button secondary" type="button" onClick={storePin} disabled={!validPin}>儲存展示值</button>
          <button className="button primary" type="button" onClick={toggleDisabled}>
            {disabled ? "恢復遷移狀態" : "標記舊 PIN 已停用"}
          </button>
        </div>
      </div>
      {message && <p className="operation-feedback" role="status"><CheckCircle2 size={16} />{message}</p>}
      <div className="security-note">
        <AlertTriangle />
        <span><strong>不會修改正式 Firestore</strong><small>正式切換仍需先建立具名 Owner、驗證登入與撤權，再停用舊站寫入。</small></span>
      </div>
    </section>
  );
}

function Sources() {
  return (
    <section>
      <div className="content-heading">
        <div><p className="panel-kicker">SOURCE REGISTRY</p><h2>流量來源登錄表</h2><p>停用來源不會刪除既有歸因紀錄。</p></div>
        <button className="button primary">新增來源</button>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>代碼</th><th>顯示名稱</th><th>負責人</th><th>狀態</th><th>期間</th></tr></thead>
          <tbody>
            {[
              ["YT-ORG", "YouTube 自然流量", "內容團隊", "啟用", "長期"],
              ["DC-PMC", "PMC Discord", "社群團隊", "啟用", "長期"],
              ["FB-0726", "Facebook 7 月活動", "Mina", "啟用", "7/01–7/31"],
              ["OLD-LINE", "舊 LINE 活動", "Allen", "已停用", "已結束"],
            ].map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={cell}>{index === 0 ? <code>{cell}</code> : cell}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Health() {
  const rows = [
    [Activity, "前端應用", "正常", "剛剛"],
    [LockKeyhole, "展示登入", "正常", "本次建置"],
    [Database, "展示資料", "正常", "目前瀏覽器"],
    [LockKeyhole, "正式 Authentication", "尚未連接", "—"],
    [Database, "正式資料庫", "尚未連接", "—"],
    [ShieldCheck, "正式權限規則", "待實作", "—"],
  ] as const;

  return (
    <section>
      <div className="content-heading">
        <div><p className="panel-kicker">DEMO ENVIRONMENT</p><h2>系統健康</h2><p>展示版可操作；外部服務仍明確標記為尚未連接。</p></div>
        <span className="health-summary"><AlertTriangle size={17} />展示模式</span>
      </div>
      <div className="health-grid">
        {rows.map(([Icon, label, status, time]) => (
          <article key={label}>
            <Icon /><span><strong>{label}</strong><small>{time}</small></span>
            <em className={status === "正常" ? "good" : ""}>{status}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function Audit() {
  return (
    <section>
      <div className="content-heading"><div><p className="panel-kicker">IMMUTABLE LOG</p><h2>操作紀錄</h2><p>正式版記錄操作者、前後值、原因、請求編號及結果。</p></div></div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>時間</th><th>操作者</th><th>動作</th><th>對象</th><th>結果</th></tr></thead>
          <tbody>{auditRows.map((row) => <tr key={`${row.time}${row.target}`}><td>{row.time}</td><td>{row.actor}</td><td>{row.action}</td><td>{row.target}</td><td>{row.result}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
