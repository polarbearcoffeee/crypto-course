import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Database, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import { auditRows } from "../data/demo";
import { PageHeader } from "../ui/PageHeader";

const sections = ["學習規則", "管理員權限", "流量來源", "系統健康", "操作紀錄"] as const;

export function SettingsPage() {
  const [section, setSection] = useState<(typeof sections)[number]>("學習規則");
  return <section className="page">
    <PageHeader eyebrow="SYSTEM GOVERNANCE" title="系統治理" description="重要設定有版本、有原因、有權限，也能知道系統目前是否健康。" />
    <div className="settings-layout"><nav className="settings-nav" aria-label="系統治理分類">{sections.map((item) => <button className={section === item ? "active" : ""} onClick={() => setSection(item)} key={item}>{item}</button>)}</nav><div className="settings-content">
      {section === "學習規則" && <Rules />}
      {section === "管理員權限" && <Roles />}
      {section === "流量來源" && <Sources />}
      {section === "系統健康" && <Health />}
      {section === "操作紀錄" && <Audit />}
    </div></div>
  </section>;
}

function Rules() { return <section><div className="content-heading"><div><p className="panel-kicker">SETTINGS V3</p><h2>學習與判定規則</h2><p>變更只影響後續判定，過去 XP 帳本不會被改寫。</p></div><button className="button primary">建立新版本</button></div><div className="rule-grid">{[["測驗預設及格門檻","80%"],["影片觀看要求","必須完成"],["卡關判定","7 天"],["活躍期間","最近 7 天"],["每日簽到 XP","10 XP"],["單課完課 XP","100 XP"]].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><button>調整</button></article>)}</div><div className="version-note"><RotateCcw size={17}/><span><strong>可回復設定</strong><small>任何變更都會先顯示受影響人數，確認後建立新版本。</small></span></div></section>; }
function Roles() { return <section><div className="content-heading"><div><p className="panel-kicker">ACCESS CONTROL</p><h2>管理員與權限</h2><p>展示版不建立真實帳號，僅確認角色矩陣。</p></div><button className="button primary">邀請管理員</button></div><div className="role-table"><div className="role-head"><span>角色</span><span>成員</span><span>學員/UID</span><span>發布</span><span>設定</span></div>{[["Owner","1","完整","允許","允許"],["Lead teacher","2","完整","允許","唯讀"],["Assistant","4","有限","不允許","不允許"],["Content editor","2","不允許","草稿","不允許"],["Analyst","1","遮罩","不允許","不允許"]].map((row) => <div className="role-row" key={row[0]}>{row.map((cell, index) => <span key={`${row[0]}-${index}`}>{cell}</span>)}</div>)}</div><div className="security-note"><ShieldCheck/><span><strong>共享 PIN 將在正式版移除</strong><small>正式環境改為具名帳號、角色權限與敏感操作重新驗證。</small></span></div></section>; }
function Sources() { return <section><div className="content-heading"><div><p className="panel-kicker">SOURCE REGISTRY</p><h2>流量來源登錄表</h2><p>停用來源不會刪除既有歸因紀錄。</p></div><button className="button primary">新增來源</button></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>代碼</th><th>顯示名稱</th><th>負責人</th><th>狀態</th><th>期間</th></tr></thead><tbody>{[["YT-ORG","YouTube 自然流量","內容團隊","啟用","長期"],["DC-PMC","PMC Discord","社群團隊","啟用","長期"],["FB-0726","Facebook 7 月活動","Mina","啟用","7/01–7/31"],["OLD-LINE","舊 LINE 活動","Allen","已停用","已結束"]].map((row) => <tr key={row[0]}>{row.map((cell,index)=><td key={cell}>{index===0?<code>{cell}</code>:cell}</td>)}</tr>)}</tbody></table></div></section>; }
function Health() { return <section><div className="content-heading"><div><p className="panel-kicker">DEMO ENVIRONMENT</p><h2>系統健康</h2><p>展示版只檢查前端元件；外部服務標示為尚未連接。</p></div><span className="health-summary"><AlertTriangle size={17}/>展示模式</span></div><div className="health-grid">{[[Activity,"前端應用","正常","剛剛"],[LockKeyhole,"管理員登入","尚未連接","—"],[Database,"展示資料","正常","剛剛"],[Database,"正式資料庫","尚未連接","—"],[CheckCircle2,"自動測試","正常","本次建置"],[ShieldCheck,"權限規則","待實作","—"]].map(([Icon,label,status,time]) => { const C=Icon as typeof Activity; return <article key={String(label)}><C/><span><strong>{String(label)}</strong><small>{String(time)}</small></span><em className={status==="正常"?"good":""}>{String(status)}</em></article>})}</div></section>; }
function Audit() { return <section><div className="content-heading"><div><p className="panel-kicker">IMMUTABLE LOG</p><h2>操作紀錄</h2><p>正式版記錄操作者、前後值、原因、請求編號及結果。</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>時間</th><th>操作者</th><th>動作</th><th>對象</th><th>結果</th></tr></thead><tbody>{auditRows.map((row)=><tr key={`${row.time}${row.target}`}><td>{row.time}</td><td>{row.actor}</td><td>{row.action}</td><td>{row.target}</td><td>{row.result}</td></tr>)}</tbody></table></div></section>; }
