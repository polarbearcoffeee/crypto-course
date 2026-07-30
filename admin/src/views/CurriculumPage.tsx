import { useState } from "react";
import { AlertTriangle, Check, Clock3, Eye, FileDiff, Plus, Save } from "lucide-react";
import { curriculumRows } from "../data/demo";
import { PageHeader } from "../ui/PageHeader";

export function CurriculumPage() {
  const [tab, setTab] = useState<"課程內容" | "發布紀錄" | "內容健康">("課程內容");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  function saveDraft() {
    setDirty(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="page">
      <PageHeader eyebrow="CURRICULUM CONTROL" title="課程發布" description="編輯、審核、預覽與發布分開，任何正式變更都有版本可以追回。" action={<button className="button primary"><Plus size={16} />建立課程草稿</button>} />
      <div className="tabs" role="tablist">{(["課程內容", "發布紀錄", "內容健康"] as const).map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>

      {tab === "課程內容" && <div className="curriculum-layout">
        <section className="panel">
          <div className="section-heading"><div><p className="panel-kicker">BEGINNER / V3</p><h2>初階交易修煉課</h2></div><span>4 個單元</span></div>
          <div className="lesson-list">{curriculumRows.map((row) => <button className="lesson-row" key={row.lesson} onClick={() => setDirty(true)}><span className="lesson-index">{row.lesson}</span><span><strong>{row.title}</strong><small>{row.duration} · {row.questions} 題測驗</small></span><span className={`status-badge status-${row.status}`}>{row.status}</span><small>{row.health}</small></button>)}</div>
        </section>
        <aside className="editor-panel">
          <div className="section-heading"><div><p className="panel-kicker">DRAFT EDITOR</p><h2>第 3 課｜風險與倉位管理</h2></div>{dirty && <span className="unsaved">尚未儲存</span>}</div>
          <label className="form-field"><span>課程標題</span><input defaultValue="風險與倉位管理" onChange={() => setDirty(true)} /></label>
          <label className="form-field"><span>學習目標</span><textarea defaultValue="能計算單筆交易最大可承受損失，並依停損距離反推倉位。" onChange={() => setDirty(true)} /></label>
          <div className="form-grid"><label className="form-field"><span>預估時間</span><input defaultValue="32 分鐘" onChange={() => setDirty(true)} /></label><label className="form-field"><span>及格門檻</span><input defaultValue="80%" onChange={() => setDirty(true)} /></label></div>
          <div className="validation-summary"><Check size={17} /><span>標題、學習目標與測驗內容已通過展示驗證</span></div>
          <div className="editor-actions"><button className="button secondary"><Eye size={16} />預覽學員畫面</button><button className="button primary" onClick={saveDraft}><Save size={16} />{saved ? "已儲存" : "儲存草稿"}</button></div>
        </aside>
      </div>}

      {tab === "發布紀錄" && <div className="release-list">
        {[["v3", "目前版本", "今天 09:00", "新增風險測驗說明"], ["v2", "已封存", "2026/07/20", "修正 K 線題目"], ["v1", "舊站匯入", "2026/07/01", "初始課程快照"]].map((row) => <article key={row[0]}><strong>{row[0]}</strong><span className="status-badge">{row[1]}</span><time>{row[2]}</time><p>{row[3]}</p><button className="button ghost"><FileDiff size={15} />比較版本</button></article>)}
      </div>}

      {tab === "內容健康" && <div className="health-board"><article><AlertTriangle /><span><strong>1 個媒體提醒</strong><small>第 3 課影片回應較慢，展示模式不會真的連線檢查。</small></span><button className="button secondary">查看課程</button></article><article><Clock3 /><span><strong>1 份草稿超過 7 天</strong><small>第 4 課尚未送出審核。</small></span><button className="button secondary">開啟草稿</button></article></div>}
    </section>
  );
}
