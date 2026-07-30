import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import { PageHeader } from "../ui/PageHeader";

const trend = [
  { day: "7/24", registration: 24, activation: 16, completion: 5 },
  { day: "7/25", registration: 31, activation: 20, completion: 8 },
  { day: "7/26", registration: 27, activation: 21, completion: 9 },
  { day: "7/27", registration: 45, activation: 29, completion: 11 },
  { day: "7/28", registration: 38, activation: 28, completion: 13 },
  { day: "7/29", registration: 52, activation: 34, completion: 16 },
  { day: "7/30", registration: 49, activation: 36, completion: 18 },
];

const sources = [
  ["YouTube", "148", "84.5%", "72.3%", "38.5%", "4.2 天"],
  ["Discord", "96", "81.2%", "70.8%", "35.4%", "3.8 天"],
  ["Facebook", "72", "68.1%", "55.6%", "22.2%", "6.1 天"],
  ["朋友推薦", "51", "88.2%", "74.5%", "41.2%", "3.2 天"],
  ["未知", "19", "47.4%", "36.8%", "10.5%", "—"],
];

export function AnalyticsPage() {
  const [range, setRange] = useState("最近 7 天");
  return <section className="page">
    <PageHeader eyebrow="LEARNING INTELLIGENCE" title="學習分析" description="每個比例都保留分子、分母、期間與定義，不只展示一個漂亮數字。" action={<select className="standalone-select" value={range} onChange={(event) => setRange(event.target.value)}><option>最近 7 天</option><option>最近 30 天</option><option>本季</option></select>} />
    <div className="analysis-callout"><Info size={17} /><span><strong>展示指標 v1</strong>｜資料皆為合成範例，正式事件追蹤尚未開始。</span></div>
    <section className="panel trend-panel"><div className="section-heading"><div><p className="panel-kicker">TREND</p><h2>註冊、啟動與完課趨勢</h2></div><div className="legend"><span className="reg">註冊</span><span className="act">啟動</span><span className="comp">完課</span></div></div><div className="trend-chart"><ResponsiveContainer><AreaChart data={trend}><defs><linearGradient id="reg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cbef3a" stopOpacity=".3"/><stop offset="100%" stopColor="#cbef3a" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#2b2e27" vertical={false}/><XAxis dataKey="day" stroke="#73786b"/><YAxis stroke="#73786b"/><Tooltip contentStyle={{ background: "#191b17", border: "1px solid #34372f" }}/><Area type="monotone" dataKey="registration" stroke="#cbef3a" fill="url(#reg)" strokeWidth={2}/><Area type="monotone" dataKey="activation" stroke="#72a7ff" fill="transparent" strokeWidth={2}/><Area type="monotone" dataKey="completion" stroke="#f3bd51" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></section>
    <div className="analytics-grid"><section className="panel"><div className="section-heading"><div><p className="panel-kicker">COHORT</p><h2>註冊週留存</h2></div></div><div className="cohort-grid"><span /><strong>D0</strong><strong>D1</strong><strong>D3</strong><strong>D7</strong><span>7/01</span><i data-level="5">100%</i><i data-level="4">76%</i><i data-level="3">61%</i><i data-level="2">44%</i><span>7/08</span><i data-level="5">100%</i><i data-level="4">73%</i><i data-level="3">58%</i><i data-level="2">41%</i><span>7/15</span><i data-level="5">100%</i><i data-level="4">79%</i><i data-level="3">64%</i><i data-level="1">—</i></div></section>
      <section className="panel"><div className="section-heading"><div><p className="panel-kicker">QUESTION HEALTH</p><h2>需要改善的題目</h2></div></div><div className="weak-questions"><article><span>第 3 課・第 4 題</span><strong>34% 首答正確</strong><small>停損距離與倉位換算</small></article><article><span>第 2 課・第 7 題</span><strong>49% 首答正確</strong><small>結構高低點判斷</small></article><article><span>第 1 課・第 3 題</span><strong>58% 首答正確</strong><small>交易與投機的差異</small></article></div></section></div>
    <section className="panel source-panel"><div className="section-heading"><div><p className="panel-kicker">ATTRIBUTION</p><h2>來源品質</h2></div><span>First-touch</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>來源</th><th>註冊</th><th>UID 驗證率</th><th>啟動率</th><th>完課率</th><th>中位完課時間</th></tr></thead><tbody>{sources.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={cell}>{index === 0 ? <strong>{cell}</strong> : cell}</td>)}</tr>)}</tbody></table></div></section>
  </section>;
}
