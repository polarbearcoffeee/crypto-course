import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  MessageSquarePlus,
  Search,
  SlidersHorizontal,
  UserRoundSearch,
  X,
} from "lucide-react";
import {
  buildLearnerCsv,
  readDemoLearners,
  saveDemoLearners,
  type DemoLearner,
} from "../data/legacyAdminDemo";
import { PageHeader } from "../ui/PageHeader";

const statusOptions = ["全部狀態", "待審核", "已驗證", "需修正", "已拒絕", "卡關", "已完成", "未啟動"] as const;

export function LearnersPage() {
  const [learners, setLearners] = useState(readDemoLearners);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("全部狀態");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");

  const selected = learners.find((learner) => learner.id === selectedId) ?? null;
  const filtered = useMemo(() => learners.filter((learner) => {
    const matchesQuery = `${learner.nickname} ${learner.id} ${learner.uid}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "全部狀態" || learner.uidStatus === status || learner.learningState === status;
    return matchesQuery && matchesStatus;
  }), [learners, query, status]);

  const queueCounts = {
    pending: learners.filter((learner) => learner.uidStatus === "待審核").length,
    correction: learners.filter((learner) => learner.uidStatus === "需修正").length,
    stuck: learners.filter((learner) => learner.learningState === "卡關").length,
    notStarted: learners.filter((learner) => learner.learningState === "未啟動").length,
  };

  function updateLearner(learnerId: string, update: (learner: DemoLearner) => DemoLearner, message: string) {
    const updated = learners.map((learner) => learner.id === learnerId ? update(learner) : learner);
    setLearners(updated);
    saveDemoLearners(updated);
    setFeedback(message);
  }

  function exportCurrentResults() {
    const csv = buildLearnerCsv(filtered);
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(csv)}`;
    link.download = "crypto-course-demo-learners.csv";
    link.click();
    setFeedback(`已匯出 ${filtered.length} 筆展示資料`);
  }

  function addNote() {
    if (!selected || !note.trim()) return;
    const body = note.trim();
    updateLearner(
      selected.id,
      (learner) => ({ ...learner, notes: [`剛剛｜${body}`, ...learner.notes] }),
      `已替 ${selected.nickname} 新增展示備註`,
    );
    setNote("");
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="LEARNER OPERATIONS"
        title="學員營運"
        description="舊後台的學員資料已整合進來，並補上搜尋、篩選、UID 處理、狀態、備註與 CSV 匯出展示流程。"
        action={(
          <button className="button secondary" type="button" onClick={exportCurrentResults}>
            <Download size={16} />
            匯出目前結果
          </button>
        )}
      />

      {feedback && <div className="operation-feedback" role="status"><CheckCircle2 size={16} />{feedback}</div>}

      <div className="queue-summary">
        <button type="button" onClick={() => setStatus("待審核")}><span>UID 待審</span><strong>{queueCounts.pending}</strong><small>點擊直接篩選</small></button>
        <button type="button" onClick={() => setStatus("需修正")}><span>需要修正</span><strong>{queueCounts.correction}</strong><small>等待學員補件</small></button>
        <button type="button" onClick={() => setStatus("卡關")}><span>學習卡關</span><strong>{queueCounts.stuck}</strong><small>需要助教追蹤</small></button>
        <button type="button" onClick={() => setStatus("未啟動")}><span>未啟動</span><strong>{queueCounts.notStarted}</strong><small>註冊後未開課</small></button>
      </div>

      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">搜尋學員</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="暱稱、學員編號或展示 UID" />
        </label>
        <label className="select-field">
          <span className="sr-only">狀態</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])}>
            {statusOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button className="button ghost" type="button" onClick={() => { setQuery(""); setStatus("全部狀態"); }}>
          <SlidersHorizontal size={16} />
          清除篩選
        </button>
        <span className="result-count">共 {filtered.length} 筆展示資料</span>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>學員</th><th>UID 狀態</th><th>來源</th><th>學習進度</th><th>XP</th><th>最後活動</th><th>追蹤人</th></tr></thead>
          <tbody>
            {filtered.map((learner) => (
              <tr key={learner.id} onClick={() => { setSelectedId(learner.id); setFeedback(""); }}>
                <td><strong>{learner.nickname}</strong><small>{learner.id}</small></td>
                <td><span className={`status-badge status-${learner.uidStatus}`}>{learner.uidStatus}</span><small>{learner.uid}</small></td>
                <td>{learner.source}</td>
                <td><strong>{learner.learningState}</strong><small>{learner.lesson}</small></td>
                <td>{learner.xp}</td><td>{learner.lastActive}</td><td>{learner.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state">
            <UserRoundSearch size={28} />
            <strong>找不到符合條件的學員</strong>
            <button type="button" onClick={() => { setQuery(""); setStatus("全部狀態"); }}>清除篩選</button>
          </div>
        )}
      </div>

      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelectedId(null)}>
          <aside className="detail-drawer" onClick={(event) => event.stopPropagation()} aria-label={`${selected.nickname} 詳情`}>
            <button className="drawer-close" type="button" onClick={() => setSelectedId(null)} aria-label="關閉"><X /></button>
            <p className="eyebrow">LEARNER 360°</p>
            <h2>{selected.nickname}</h2>
            <p className="muted">{selected.id} · {selected.source}</p>
            <div className="identity-strip">
              <span>展示 UID</span>
              <strong>{selected.uid}</strong>
              <span className={`status-badge status-${selected.uidStatus}`}>{selected.uidStatus}</span>
            </div>

            <h3>UID 處理</h3>
            <div className="uid-actions">
              <button
                className="button primary"
                type="button"
                onClick={() => updateLearner(selected.id, (learner) => ({ ...learner, uidStatus: "已驗證" }), "UID 已標記為已驗證")}
              >
                核准
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => updateLearner(selected.id, (learner) => ({ ...learner, uidStatus: "需修正" }), "UID 已標記為需修正")}
              >
                要求修正
              </button>
              <button
                className="button ghost"
                type="button"
                onClick={() => updateLearner(selected.id, (learner) => ({ ...learner, uidStatus: "已拒絕" }), "UID 已標記為已拒絕")}
              >
                拒絕
              </button>
            </div>

            <h3>學習摘要</h3>
            <dl className="detail-grid">
              <div><dt>目前位置</dt><dd>{selected.lesson}</dd></div>
              <div><dt>累積 XP</dt><dd>{selected.xp}</dd></div>
              <div><dt>最後活動</dt><dd>{selected.lastActive}</dd></div>
              <div><dt>追蹤人</dt><dd>{selected.owner}</dd></div>
            </dl>
            <label className="form-field learner-state-field">
              <span>學習狀態</span>
              <select
                value={selected.learningState}
                onChange={(event) => updateLearner(
                  selected.id,
                  (learner) => ({ ...learner, learningState: event.target.value as DemoLearner["learningState"] }),
                  "學習狀態已更新",
                )}
              >
                <option>進行中</option><option>卡關</option><option>已完成</option><option>未啟動</option>
              </select>
            </label>

            <h3>內部追蹤備註</h3>
            <div className="note-composer">
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="輸入助教追蹤內容" />
              <button className="button primary" type="button" onClick={addNote} disabled={!note.trim()}>
                <MessageSquarePlus size={16} />
                新增備註
              </button>
            </div>
            {feedback && <p className="drawer-feedback" role="status">{feedback}</p>}
            {selected.notes.length > 0 ? (
              <ol className="timeline">
                {selected.notes.map((item, index) => <li key={`${item}-${index}`}><time>展示紀錄</time><span>{item}</span></li>)}
              </ol>
            ) : <p className="muted">目前沒有展示備註。</p>}
          </aside>
        </div>
      )}
    </section>
  );
}
