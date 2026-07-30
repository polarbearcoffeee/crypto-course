import { useMemo, useState } from "react";
import { CheckCircle2, Download, Search, SlidersHorizontal, UserRoundSearch, X } from "lucide-react";
import { learners, type Learner } from "../data/demo";
import { PageHeader } from "../ui/PageHeader";

export function LearnersPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部狀態");
  const [selected, setSelected] = useState<Learner | null>(null);

  const filtered = useMemo(() => learners.filter((learner) => {
    const matchesQuery = `${learner.nickname} ${learner.id} ${learner.uid}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "全部狀態" || learner.uidStatus === status || learner.learningState === status;
    return matchesQuery && matchesStatus;
  }), [query, status]);

  return (
    <section className="page">
      <PageHeader
        eyebrow="LEARNER OPERATIONS"
        title="學員營運"
        description="把 UID 審核、卡關追蹤與學習進度集中在同一張工作桌。"
        action={<button className="button secondary"><Download size={16} />匯出目前結果</button>}
      />

      <div className="queue-summary">
        <button><span>UID 待審</span><strong>42</strong><small>最久 31 小時</small></button>
        <button><span>需要修正</span><strong>11</strong><small>等待學員回覆</small></button>
        <button><span>學習卡關</span><strong>37</strong><small>超過 7 天</small></button>
        <button><span>未啟動</span><strong>64</strong><small>註冊後未開課</small></button>
      </div>

      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">搜尋學員</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="暱稱、學員編號或精確 UID" />
        </label>
        <label className="select-field">
          <span className="sr-only">狀態</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {["全部狀態", "待審核", "已驗證", "需修正", "已拒絕", "卡關", "已完成", "未啟動"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button className="button ghost"><SlidersHorizontal size={16} />更多篩選</button>
        <span className="result-count">共 {filtered.length} 筆展示資料</span>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>學員</th><th>UID 狀態</th><th>來源</th><th>學習進度</th><th>XP</th><th>最後活動</th><th>追蹤人</th></tr></thead>
          <tbody>
            {filtered.map((learner) => (
              <tr key={learner.id} onClick={() => setSelected(learner)}>
                <td><strong>{learner.nickname}</strong><small>{learner.id}</small></td>
                <td><span className={`status-badge status-${learner.uidStatus}`}>{learner.uidStatus}</span><small>{learner.uid}</small></td>
                <td>{learner.source}</td>
                <td><strong>{learner.learningState}</strong><small>{learner.lesson}</small></td>
                <td>{learner.xp}</td><td>{learner.lastActive}</td><td>{learner.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><UserRoundSearch size={28} /><strong>找不到符合條件的學員</strong><button onClick={() => { setQuery(""); setStatus("全部狀態"); }}>清除篩選</button></div>}
      </div>

      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside className="detail-drawer" onClick={(event) => event.stopPropagation()} aria-label={`${selected.nickname} 詳情`}>
            <button className="drawer-close" onClick={() => setSelected(null)} aria-label="關閉"><X /></button>
            <p className="eyebrow">LEARNER 360°</p><h2>{selected.nickname}</h2><p className="muted">{selected.id} · {selected.source}</p>
            <div className="identity-strip"><span>UID</span><strong>{selected.uid}</strong><span className={`status-badge status-${selected.uidStatus}`}>{selected.uidStatus}</span></div>
            <h3>建議下一步</h3>
            <div className="recommendation"><CheckCircle2 size={18} /><p>{selected.learningState === "卡關" ? "查看最近測驗錯題，指派助教在今天追蹤。" : selected.uidStatus === "待審核" ? "核對 UID 證明後完成審核。" : "目前沒有緊急處理事項。"}</p></div>
            <h3>學習摘要</h3>
            <dl className="detail-grid"><div><dt>目前位置</dt><dd>{selected.lesson}</dd></div><div><dt>累積 XP</dt><dd>{selected.xp}</dd></div><div><dt>最後活動</dt><dd>{selected.lastActive}</dd></div><div><dt>追蹤人</dt><dd>{selected.owner}</dd></div></dl>
            <h3>最近紀錄</h3>
            <ol className="timeline"><li><time>今天</time><span>系統更新學習狀態</span></li><li><time>3 天前</time><span>完成一次課程測驗</span></li><li><time>7 天前</time><span>註冊成為學員</span></li></ol>
            <div className="drawer-actions"><button className="button primary">新增追蹤備註</button><button className="button secondary">變更狀態</button></div>
          </aside>
        </div>
      )}
    </section>
  );
}
