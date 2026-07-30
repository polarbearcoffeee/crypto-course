import { z } from "zod";

const metricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number().nonnegative(),
  unit: z.enum(["count", "percent"]),
  comparison: z.number(),
  numerator: z.number().nonnegative(),
  denominator: z.number().nonnegative(),
  freshness: z.string(),
});

const dashboardSchema = z.object({
  asOf: z.string(),
  metrics: z.array(metricSchema),
  funnel: z.array(
    z.object({
      name: z.string(),
      value: z.number().nonnegative(),
      rate: z.number().min(0).max(100),
    }),
  ),
  queues: z.array(
    z.object({
      label: z.string(),
      count: z.number().nonnegative(),
      severity: z.enum(["normal", "attention", "critical"]),
    }),
  ),
});

export type DashboardData = z.infer<typeof dashboardSchema>;

const seedDashboard: DashboardData = {
  asOf: "示範資料｜尚未連接正式資料庫",
  metrics: [
    { id: "registered", label: "已註冊", value: 386, unit: "count", comparison: 12.4, numerator: 386, denominator: 386, freshness: "示範" },
    { id: "uidPending", label: "UID 待審", value: 42, unit: "count", comparison: -8.2, numerator: 42, denominator: 386, freshness: "示範" },
    { id: "activation", label: "啟動率", value: 68.4, unit: "percent", comparison: 4.1, numerator: 264, denominator: 386, freshness: "示範" },
    { id: "active7d", label: "7 日活躍", value: 174, unit: "count", comparison: 6.7, numerator: 174, denominator: 386, freshness: "示範" },
    { id: "completion", label: "完課率", value: 31.6, unit: "percent", comparison: 2.8, numerator: 122, denominator: 386, freshness: "示範" },
    { id: "stuck", label: "卡關學員", value: 37, unit: "count", comparison: -3.1, numerator: 37, denominator: 264, freshness: "示範" },
  ],
  funnel: [
    { name: "完成註冊", value: 386, rate: 100 },
    { name: "UID 已驗證", value: 307, rate: 79.5 },
    { name: "開始第一課", value: 264, rate: 68.4 },
    { name: "完成初階課", value: 122, rate: 31.6 },
    { name: "符合進階資格", value: 78, rate: 20.2 },
  ],
  queues: [
    { label: "UID 等待超過 24 小時", count: 18, severity: "critical" },
    { label: "學習卡關超過 7 天", count: 37, severity: "attention" },
    { label: "已註冊但尚未啟動", count: 64, severity: "attention" },
    { label: "課程內容待發布", count: 3, severity: "normal" },
  ],
};

export async function getDashboard(): Promise<DashboardData> {
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  return dashboardSchema.parse(seedDashboard);
}
