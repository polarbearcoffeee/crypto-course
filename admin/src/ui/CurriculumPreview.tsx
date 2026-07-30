import styles from "./CurriculumPreview.module.css";

export type CurriculumPreviewState =
  | "locked"
  | "unlocked"
  | "failed"
  | "passed"
  | "empty"
  | "error";

export type CurriculumPreviewViewport = "desktop" | "mobile";

export type CurriculumPreviewLesson = {
  title: string;
  description: string;
  question: string;
  options: readonly string[];
};

type CurriculumPreviewProps = {
  state: CurriculumPreviewState;
  viewport: CurriculumPreviewViewport;
  lesson?: CurriculumPreviewLesson;
  errorMessage?: string;
};

const stateCopy = {
  locked: {
    title: "課程尚未解鎖",
    detail: "完成上一單元並通過測驗後，即可進入本單元。",
    tone: "warning",
  },
  unlocked: {
    title: "可以開始學習",
    detail: "本單元已解鎖，學員可以觀看內容並進行測驗。",
    tone: "success",
  },
  failed: {
    title: "測驗尚未通過",
    detail: "保留本次進度，複習內容後可再次作答。",
    tone: "danger",
  },
  passed: {
    title: "本單元已通過",
    detail: "學習紀錄已完成，下一單元已為學員解鎖。",
    tone: "success",
  },
} as const;

export function CurriculumPreview({
  state,
  viewport,
  lesson,
  errorMessage = "預覽資料暫時無法載入，請稍後再試。",
}: CurriculumPreviewProps) {
  const viewportLabel = viewport === "desktop" ? "桌機" : "手機";

  return (
    <section
      aria-label={`${viewportLabel}課程預覽`}
      className={`${styles.preview} ${styles[viewport]}`}
      data-preview-only="true"
      data-state={state}
      data-viewport={viewport}
    >
      <header className={styles.toolbar}>
        <strong>學員畫面預覽</strong>
        <span className={styles.mode}>{viewportLabel}模式 · 唯讀</span>
      </header>

      <div className={styles.content}>
        {state === "empty" ? (
          <PreviewMessage
            title="尚無可預覽內容"
            detail="請先建立課程單元，再回到這裡確認學員看到的畫面。"
          />
        ) : state === "error" ? (
          <PreviewMessage title="預覽載入失敗" detail={errorMessage} />
        ) : lesson ? (
          <>
            <p className={styles.eyebrow}>COURSE PREVIEW</p>
            <h2 className={styles.title}>{lesson.title}</h2>
            <p className={styles.description}>{lesson.description}</p>
            <div className={styles.status} data-tone={stateCopy[state].tone}>
              <strong>{stateCopy[state].title}</strong>
              <span>{stateCopy[state].detail}</span>
            </div>
            {state !== "locked" && (
              <div className={styles.quiz}>
                <p>{lesson.question}</p>
                <ol className={styles.options}>
                  {lesson.options.map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          <PreviewMessage
            title="缺少單元資料"
            detail="這個狀態需要課程內容才能預覽。"
          />
        )}
      </div>
    </section>
  );
}

function PreviewMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.message} role="status">
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
