import { CheckCircle2, ExternalLink, Github, Link2, ShieldAlert } from "lucide-react";
import { PageHeader } from "../ui/PageHeader";

const publicLinks = [
  {
    title: "課程前台",
    description: "學員註冊、闖關、測驗、XP 與排行榜。",
    href: "https://polarbearcoffeee.github.io/crypto-course/",
  },
  {
    title: "新後台儀表板",
    description: "新的學習營運管理中心。",
    href: "https://polarbearcoffeee.github.io/crypto-course/admin/",
  },
  {
    title: "進階課程預留頁",
    description: "目前仍是敬請期待頁面。",
    href: "https://polarbearcoffeee.github.io/crypto-course/advanced-course.html",
  },
] as const;

const adminLinks = [
  ["學員營運", "#/learners"],
  ["課程與測驗編輯", "#/curriculum"],
  ["學習分析", "#/analytics"],
  ["系統治理", "#/settings"],
  ["平台連結", "#/resources"],
] as const;

const githubLinks = [
  {
    title: "GitHub 程式碼倉庫",
    href: "https://github.com/polarbearcoffeee/crypto-course",
  },
  {
    title: "新後台程式碼",
    href: "https://github.com/polarbearcoffeee/crypto-course/tree/main/admin",
  },
  {
    title: "GitHub Actions",
    href: "https://github.com/polarbearcoffeee/crypto-course/actions",
  },
  {
    title: "GitHub Pages 設定",
    href: "https://github.com/polarbearcoffeee/crypto-course/settings/pages",
  },
  {
    title: "OpenSpec 改版提案",
    href: "https://github.com/polarbearcoffeee/crypto-course/blob/main/openspec/changes/build-learning-operations-admin/proposal.md",
  },
  {
    title: "最終驗收文件",
    href: "https://github.com/polarbearcoffeee/crypto-course/blob/main/docs/acceptance/final-acceptance.md",
  },
] as const;

export function PlatformLinksPage() {
  return (
    <section className="page">
      <PageHeader
        eyebrow="PLATFORM DIRECTORY"
        title="平台連結中心"
        description="前台、後台、GitHub、部署與規格文件都集中在這裡，不用再翻對話找網址。"
        action={(
          <a className="button primary" href="https://github.com/polarbearcoffeee/crypto-course/actions" target="_blank" rel="noreferrer">
            <Github size={16} />
            查看部署狀態
          </a>
        )}
      />

      <section className="link-section" aria-labelledby="public-links-title">
        <div className="section-heading">
          <div><p className="panel-kicker">PUBLIC PAGES</p><h2 id="public-links-title">公開網站</h2></div>
          <span><CheckCircle2 size={14} />GitHub Pages 展示環境</span>
        </div>
        <div className="link-card-grid">
          {publicLinks.map((link) => (
            <a href={link.href} target="_blank" rel="noreferrer" className="link-card" key={link.href}>
              <Link2 size={20} aria-hidden="true" />
              <span><strong>{link.title}</strong><small>{link.description}</small></span>
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <section className="link-section" aria-labelledby="admin-links-title">
        <div className="section-heading">
          <div><p className="panel-kicker">ADMIN ROUTES</p><h2 id="admin-links-title">後台直達頁面</h2></div>
        </div>
        <div className="admin-route-list">
          {adminLinks.map(([label, hash]) => (
            <a key={hash} href={`/crypto-course/admin/${hash}`}>
              <span>{label}</span>
              <code>{hash}</code>
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <section className="link-section" aria-labelledby="github-links-title">
        <div className="section-heading">
          <div><p className="panel-kicker">PROJECT & DELIVERY</p><h2 id="github-links-title">GitHub 與專案文件</h2></div>
        </div>
        <div className="github-link-list">
          {githubLinks.map((link) => (
            <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>
              <Github size={17} aria-hidden="true" />
              <span>{link.title}</span>
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <div className="link-security-note">
        <ShieldAlert size={18} aria-hidden="true" />
        <p><strong>展示環境提醒：</strong>新後台登入、課程儲存與學員操作目前只存在這台瀏覽器，不會寫入正式 Firebase，也不能當成正式權限防護。</p>
      </div>
    </section>
  );
}
