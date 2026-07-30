import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Clock3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDashboard, type DashboardData } from "../data/dashboard";
import {
  dashboardRateDisplay,
  dashboardStatePresentation,
  hasDashboardData,
  type DashboardComponentState,
  type LearnerDrilldownSurface,
} from "../domain/dashboardResilience";

function formatMetric(metric: DashboardData["metrics"][number]) {
  return metric.unit === "percent"
    ? dashboardRateDisplay(metric.numerator, metric.denominator)
    : { value: metric.value.toLocaleString("zh-TW") };
}

type DashboardSectionStates = Readonly<{
  metrics?: DashboardComponentState<DashboardData["metrics"]>;
  funnel?: DashboardComponentState<DashboardData["funnel"]>;
  queues?: DashboardComponentState<DashboardData["queues"]>;
}>;

export type DashboardDrilldownEvent = Readonly<{
  surface: LearnerDrilldownSurface;
  sourceId: string;
  displayedCount: number;
  filters: Readonly<Record<string, string>>;
}>;

export type DashboardPageProps = Readonly<{
  dataOverride?: DashboardData;
  sectionStates?: DashboardSectionStates;
  canViewUidDetails?: boolean;
  onDrilldown?: (event: DashboardDrilldownEvent) => void;
  onRetry?: () => void;
}>;

export function DashboardPage({
  dataOverride,
  sectionStates,
  canViewUidDetails = true,
  onDrilldown,
  onRetry,
}: DashboardPageProps = {}) {
  const dashboard = useQuery({
    queryKey: ["dashboard", "default"],
    queryFn: getDashboard,
  });

  if (dashboard.isPending && !dataOverride) {
    return <DashboardState title="正在整理營運資料…" />;
  }

  if (dashboard.isError && !dashboard.data && !dataOverride) {
    return <DashboardState title="儀表板資料讀取失敗" detail="請重試；既有數值不會被當成最新資料。" />;
  }

  const data = dataOverride ?? dashboard.data;
  if (!data) {
    return <DashboardState title="儀表板沒有可顯示的資料" />;
  }
  const readyAt = data.asOf;
  const metricsState = sectionStates?.metrics ?? {
    status: "ready",
    data: data.metrics,
    updatedAt: readyAt,
  };
  const funnelState = sectionStates?.funnel ?? {
    status: "ready",
    data: data.funnel,
    updatedAt: readyAt,
  };
  const queuesState = sectionStates?.queues ?? {
    status: "ready",
    data: data.queues,
    updatedAt: readyAt,
  };

  return (
    <section className="page dashboard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">TODAY’S OPERATIONS</p>
          <h1>營運總覽</h1>
          <p className="page-lede">先處理需要人介入的工作，再看招生與學習表現。</p>
        </div>
        <div className="freshness">
          <Clock3 size={16} aria-hidden="true" />
          <span>{data.asOf}</span>
        </div>
      </div>

      <section aria-labelledby="metrics-title">
        <div className="section-heading">
          <h2 id="metrics-title">核心指標</h2>
          <span>比較上期</span>
        </div>
        <DashboardComponentBoundary state={metricsState} onRetry={onRetry}>
          {(metrics) => (
            <div className="metric-grid">
              {metrics.map((metric) => {
                const improving = metric.id === "uidPending" || metric.id === "stuck"
                  ? metric.comparison < 0
                  : metric.comparison >= 0;
                const display = formatMetric(metric);
                const uidRestricted =
                  metric.id === "uidPending" && !canViewUidDetails;
                return (
                  <button
                    aria-label={
                      uidRestricted
                        ? `${metric.label}，權限受限`
                        : `查看${metric.label}學員名單`
                    }
                    className="metric"
                    disabled={uidRestricted}
                    key={metric.id}
                    onClick={() =>
                      onDrilldown?.({
                        surface: "card",
                        sourceId: metric.id,
                        displayedCount: metric.numerator,
                        filters: { metric: metric.id },
                      })
                    }
                    type="button"
                  >
                    <span className="metric-topline">
                      <span>{metric.label}</span>
                      <span className={improving ? "delta good" : "delta bad"}>
                        {metric.comparison >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(metric.comparison)}%
                      </span>
                    </span>
                    <strong>{display.value}</strong>
                    <small>
                      {display.note ??
                        `${metric.numerator.toLocaleString("zh-TW")} / ${metric.denominator.toLocaleString("zh-TW")}`}
                      {" · "}
                      {metric.freshness}
                    </small>
                  </button>
                );
              })}
            </div>
          )}
        </DashboardComponentBoundary>
      </section>

      <div className="dashboard-grid">
        <section className="panel funnel-panel" aria-labelledby="funnel-title">
          <div className="section-heading">
            <div>
              <p className="panel-kicker">轉換路徑</p>
              <h2 id="funnel-title">從註冊到進階資格</h2>
            </div>
          </div>
          <DashboardComponentBoundary state={funnelState} onRetry={onRetry}>
            {(funnel) => (
              <>
                <div className="chart-wrap" aria-label="學員轉換漏斗圖">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnel} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid stroke="#2b2e27" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={110} tick={{ fill: "#aaafa1", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: "rgba(203, 239, 58, 0.05)" }}
                        contentStyle={{ background: "#191b17", border: "1px solid #34372f", color: "#f1f3e9" }}
                        formatter={(value) => [`${Number(value).toLocaleString("zh-TW")} 人`, "人數"]}
                      />
                      <Bar dataKey="value" fill="#cbef3a" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ol className="funnel-ledger">
                  {funnel.map((stage) => (
                    <li key={stage.name}>
                      <button
                        aria-label={`查看${stage.name}學員名單`}
                        onClick={() =>
                          onDrilldown?.({
                            surface: "funnel-stage",
                            sourceId: stage.name,
                            displayedCount: stage.value,
                            filters: { funnelStage: stage.name },
                          })
                        }
                        type="button"
                      >
                        <span>{stage.name}</span>
                        <strong>
                          {stage.name.includes("尚未追蹤")
                            ? "尚未追蹤"
                            : `${stage.rate.toFixed(1)}%`}
                        </strong>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </DashboardComponentBoundary>
        </section>

        <section className="panel queue-panel" aria-labelledby="queue-title">
          <div className="section-heading">
            <div>
              <p className="panel-kicker">需要介入</p>
              <h2 id="queue-title">今日工作佇列</h2>
            </div>
          </div>
          <DashboardComponentBoundary state={queuesState} onRetry={onRetry}>
            {(queues) => (
              <div className="queue-list">
                {queues.map((queue) => (
                  <button
                    aria-label={`查看${queue.label}${queue.label.includes("學員") ? "名單" : "學員名單"}`}
                    className="queue-row"
                    type="button"
                    key={queue.label}
                    onClick={() =>
                      onDrilldown?.({
                        surface: "card",
                        sourceId: queue.label,
                        displayedCount: queue.count,
                        filters: { queue: queue.label },
                      })
                    }
                  >
                    <span className={`severity ${queue.severity}`} aria-hidden="true" />
                    <span>{queue.label}</span>
                    <strong>{queue.count}</strong>
                    <span className="queue-action">查看</span>
                  </button>
                ))}
              </div>
            )}
          </DashboardComponentBoundary>
          <p className="panel-note">正式資料接上後，每一列都會保留相同篩選條件並導向學員清單。</p>
        </section>
      </div>
    </section>
  );
}

function DashboardComponentBoundary<T>({
  state,
  onRetry,
  children,
}: Readonly<{
  state: DashboardComponentState<T>;
  onRetry?: () => void;
  children: (data: T) => React.ReactNode;
}>) {
  const presentation = dashboardStatePresentation(state);
  return (
    <div className="dashboard-component" data-state={state.status}>
      <span className="sr-only" role="status">
        {presentation.announcement}
      </span>
      {(state.status === "partial" || state.status === "stale") && (
        <div className={`dashboard-state-banner ${state.status}`}>
          <strong>{presentation.label}</strong>
          <span>{presentation.announcement}</span>
          {presentation.canRetry && onRetry && (
            <button onClick={onRetry} type="button">重試</button>
          )}
        </div>
      )}
      {hasDashboardData(state) ? (
        children(state.data)
      ) : (
        <div
          className="dashboard-component-message"
          role={state.status === "error" ? "alert" : "status"}
        >
          <strong>{presentation.label}</strong>
          <span>{presentation.announcement}</span>
          {presentation.canRetry && onRetry && (
            <button onClick={onRetry} type="button">重試</button>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardState({ title, detail }: { title: string; detail?: string }) {
  return (
    <section className="page dashboard-state" role="status">
      <p className="eyebrow">營運總覽</p>
      <h1>{title}</h1>
      {detail && <p>{detail}</p>}
    </section>
  );
}
