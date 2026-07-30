import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  Eye,
  FileDiff,
  RotateCcw,
  Save,
  Send,
  X,
} from "lucide-react";
import {
  readDemoLessons,
  resetDemoLessons,
  saveDemoLessons,
  type DemoLesson,
  type DemoQuizQuestion,
} from "../data/legacyAdminDemo";
import { PageHeader } from "../ui/PageHeader";

function getLessonErrors(lesson: DemoLesson): string[] {
  const errors: string[] = [];
  if (!lesson.title.trim()) errors.push("課程標題不可空白");
  if (!lesson.meta.trim()) errors.push("閱讀時間不可空白");
  if (lesson.points.every((point) => !point.trim())) errors.push("至少需要一項文字重點");
  if (lesson.passThreshold < 0 || lesson.passThreshold > 100) errors.push("及格門檻必須介於 0 到 100");
  if (lesson.videoUrl.trim()) {
    try {
      new URL(lesson.videoUrl);
    } catch {
      errors.push("影片網址格式不正確");
    }
  }
  lesson.quiz.forEach((question, questionIndex) => {
    if (!question.prompt.trim()) errors.push(`第 ${questionIndex + 1} 題題目不可空白`);
    if (question.options.length !== 4 || question.options.some((option) => !option.trim())) {
      errors.push(`第 ${questionIndex + 1} 題必須有四個完整選項`);
    }
    if (question.correctIndex < 0 || question.correctIndex > 3) {
      errors.push(`第 ${questionIndex + 1} 題正確答案超出範圍`);
    }
  });
  return errors;
}

export function CurriculumPage() {
  const [tab, setTab] = useState<"課程內容" | "發布紀錄" | "內容健康">("課程內容");
  const [lessons, setLessons] = useState(readDemoLessons);
  const [selectedId, setSelectedId] = useState(() => lessons[0]?.id ?? "");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedId) ?? lessons[0];
  const errors = useMemo(
    () => selectedLesson ? getLessonErrors(selectedLesson) : ["找不到課程"],
    [selectedLesson],
  );
  const invalidLessons = useMemo(
    () => lessons.filter((lesson) => getLessonErrors(lesson).length > 0),
    [lessons],
  );

  function replaceSelected(update: (lesson: DemoLesson) => DemoLesson) {
    setLessons((current) => current.map((lesson) => (
      lesson.id === selectedId ? update(lesson) : lesson
    )));
    setDirty(true);
    setSaved(false);
  }

  function updateLesson<K extends keyof DemoLesson>(key: K, value: DemoLesson[K]) {
    replaceSelected((lesson) => ({ ...lesson, [key]: value }));
  }

  function updateQuestion(questionId: string, update: (question: DemoQuizQuestion) => DemoQuizQuestion) {
    replaceSelected((lesson) => ({
      ...lesson,
      quiz: lesson.quiz.map((question) => (
        question.id === questionId ? update(question) : question
      )),
    }));
  }

  function saveDraft() {
    if (!selectedLesson || errors.length > 0) return;
    saveDemoLessons(lessons);
    setDirty(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function publishLesson() {
    if (!selectedLesson || errors.length > 0) return;
    const published = lessons.map((lesson) => (
      lesson.id === selectedId ? { ...lesson, status: "已發布" as const } : lesson
    ));
    setLessons(published);
    saveDemoLessons(published);
    setDirty(false);
    setSaved(true);
  }

  function restoreLegacyContent() {
    const restored = resetDemoLessons();
    setLessons(restored);
    setSelectedId(restored[0]?.id ?? "");
    setDirty(false);
    setSaved(true);
  }

  if (!selectedLesson) {
    return <section className="page"><p>目前沒有可編輯的課程。</p></section>;
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="CURRICULUM CONTROL"
        title="課程與測驗管理"
        description="舊教師後台的 6 堂課、文字重點、影片網址與 18 題測驗已集中到新版編輯器。"
        action={(
          <button className="button secondary" type="button" onClick={restoreLegacyContent}>
            <RotateCcw size={16} />
            還原舊站展示內容
          </button>
        )}
      />
      <div className="demo-mode-banner">
        <AlertTriangle size={17} />
        <span><strong>展示儲存模式</strong>變更只會保存在目前瀏覽器，不會寫入正式 Firebase 或影響學員。</span>
      </div>
      <div className="tabs" role="tablist">
        {(["課程內容", "發布紀錄", "內容健康"] as const).map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "課程內容" && (
        <div className="curriculum-layout">
          <section className="panel">
            <div className="section-heading">
              <div><p className="panel-kicker">LEGACY BEGINNER COURSE</p><h2>初階加密貨幣課程</h2></div>
              <span>{lessons.length} 堂 · {lessons.reduce((total, lesson) => total + lesson.quiz.length, 0)} 題</span>
            </div>
            <div className="lesson-list">
              {lessons.map((lesson, index) => (
                <button
                  type="button"
                  className={`lesson-row${lesson.id === selectedId ? " selected" : ""}`}
                  key={lesson.id}
                  onClick={() => setSelectedId(lesson.id)}
                >
                  <span className="lesson-index">{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{lesson.title}</strong><small>{lesson.meta} · {lesson.quiz.length} 題測驗</small></span>
                  <span className={`status-badge status-${lesson.status}`}>{lesson.status}</span>
                  <small>{getLessonErrors(lesson).length === 0 ? "內容正常" : `${getLessonErrors(lesson).length} 項錯誤`}</small>
                </button>
              ))}
            </div>
          </section>

          <aside className="editor-panel">
            <div className="section-heading">
              <div><p className="panel-kicker">LESSON & QUIZ EDITOR</p><h2>{selectedLesson.title}</h2></div>
              {dirty && <span className="unsaved">尚未儲存</span>}
            </div>
            <label className="form-field">
              <span>課程標題</span>
              <input value={selectedLesson.title} onChange={(event) => updateLesson("title", event.target.value)} />
            </label>
            <label className="form-field">
              <span>閱讀時間</span>
              <input value={selectedLesson.meta} onChange={(event) => updateLesson("meta", event.target.value)} />
            </label>
            <label className="form-field">
              <span>文字重點（每行一項）</span>
              <textarea
                value={selectedLesson.points.join("\n")}
                onChange={(event) => updateLesson("points", event.target.value.split("\n"))}
              />
            </label>
            <label className="form-field">
              <span>影片網址（可留空）</span>
              <input
                type="url"
                placeholder="https://www.youtube.com/embed/..."
                value={selectedLesson.videoUrl}
                onChange={(event) => updateLesson("videoUrl", event.target.value)}
              />
            </label>
            <div className="form-grid">
              <label className="form-field">
                <span>及格門檻</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={selectedLesson.passThreshold}
                  onChange={(event) => updateLesson("passThreshold", Number(event.target.value))}
                />
              </label>
              <label className="form-field">
                <span>內容狀態</span>
                <select
                  value={selectedLesson.status}
                  onChange={(event) => updateLesson("status", event.target.value as DemoLesson["status"])}
                >
                  <option>草稿</option>
                  <option>審核中</option>
                  <option>已發布</option>
                </select>
              </label>
            </div>

            <div className="quiz-editor">
              <div className="section-heading">
                <div><p className="panel-kicker">QUIZ</p><h2>課後測驗</h2></div>
                <span>{selectedLesson.quiz.length} 題</span>
              </div>
              {selectedLesson.quiz.map((question, questionIndex) => (
                <fieldset className="quiz-question" key={question.id}>
                  <legend>第 {questionIndex + 1} 題</legend>
                  <label className="form-field">
                    <span>題目</span>
                    <textarea
                      value={question.prompt}
                      onChange={(event) => updateQuestion(question.id, (current) => ({
                        ...current,
                        prompt: event.target.value,
                      }))}
                    />
                  </label>
                  <div className="quiz-options">
                    {question.options.map((option, optionIndex) => (
                      <label className="form-field" key={`${question.id}-${optionIndex}`}>
                        <span>選項 {String.fromCharCode(65 + optionIndex)}</span>
                        <input
                          value={option}
                          onChange={(event) => updateQuestion(question.id, (current) => ({
                            ...current,
                            options: current.options.map((item, index) => (
                              index === optionIndex ? event.target.value : item
                            )),
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                  <label className="form-field">
                    <span>正確答案</span>
                    <select
                      value={question.correctIndex}
                      onChange={(event) => updateQuestion(question.id, (current) => ({
                        ...current,
                        correctIndex: Number(event.target.value),
                      }))}
                    >
                      {question.options.map((_, optionIndex) => (
                        <option value={optionIndex} key={optionIndex}>
                          選項 {String.fromCharCode(65 + optionIndex)}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              ))}
            </div>

            <div className={`validation-summary${errors.length > 0 ? " invalid" : ""}`}>
              {errors.length === 0 ? <Check size={17} /> : <AlertTriangle size={17} />}
              <span>
                {errors.length === 0
                  ? "標題、文字重點、網址、門檻與四選一測驗均通過展示驗證"
                  : errors.join("；")}
              </span>
            </div>
            <div className="editor-actions">
              <button className="button secondary" type="button" onClick={() => setPreviewOpen(true)}>
                <Eye size={16} />
                預覽學員畫面
              </button>
              <button className="button secondary" type="button" onClick={saveDraft} disabled={errors.length > 0}>
                <Save size={16} />
                {saved ? "已儲存" : "儲存草稿"}
              </button>
              <button className="button primary" type="button" onClick={publishLesson} disabled={errors.length > 0}>
                <Send size={16} />
                展示發布
              </button>
            </div>
          </aside>
        </div>
      )}

      {tab === "發布紀錄" && (
        <div className="release-list">
          {[
            ["demo-v4", "展示整合", "本次版本", "舊站 6 堂課與 18 題測驗移入新後台"],
            ["v3", "目前版本", "2026/07/30", "建立新版課程發布流程"],
            ["v1", "舊站匯入", "2026/07/01", "保留原始課程快照"],
          ].map((row) => (
            <article key={row[0]}>
              <strong>{row[0]}</strong><span className="status-badge">{row[1]}</span>
              <time>{row[2]}</time><p>{row[3]}</p>
              <button className="button ghost" type="button"><FileDiff size={15} />比較版本</button>
            </article>
          ))}
        </div>
      )}

      {tab === "內容健康" && (
        <div className="health-board">
          <article>
            {invalidLessons.length === 0 ? <Check /> : <AlertTriangle />}
            <span>
              <strong>{invalidLessons.length === 0 ? "所有課程內容通過展示驗證" : `${invalidLessons.length} 堂課需要修正`}</strong>
              <small>檢查標題、文字重點、影片網址、門檻及四選一測驗。</small>
            </span>
            <button className="button secondary" type="button" onClick={() => setTab("課程內容")}>查看課程</button>
          </article>
          <article>
            <Clock3 />
            <span><strong>正式媒體健康檢查尚未連接</strong><small>展示版不會真的連線檢查 YouTube 或外部媒體。</small></span>
          </article>
        </div>
      )}

      {previewOpen && (
        <div className="drawer-backdrop" onClick={() => setPreviewOpen(false)}>
          <aside className="detail-drawer curriculum-preview-drawer" onClick={(event) => event.stopPropagation()} aria-label="課程學員畫面預覽">
            <button className="drawer-close" type="button" onClick={() => setPreviewOpen(false)} aria-label="關閉預覽"><X /></button>
            <p className="eyebrow">LEARNER PREVIEW</p>
            <h2>{selectedLesson.title}</h2>
            <p className="muted">{selectedLesson.meta} · 及格門檻 {selectedLesson.passThreshold}%</p>
            <ul className="preview-points">
              {selectedLesson.points.filter(Boolean).map((point) => <li key={point}>{point}</li>)}
            </ul>
            <h3>課後測驗預覽</h3>
            {selectedLesson.quiz.map((question, index) => (
              <article className="preview-question" key={question.id}>
                <strong>{index + 1}. {question.prompt}</strong>
                <ol type="A">{question.options.map((option) => <li key={option}>{option}</li>)}</ol>
              </article>
            ))}
          </aside>
        </div>
      )}
    </section>
  );
}
