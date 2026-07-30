export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="page placeholder-page">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-lede">{description}</p>
      <div className="placeholder-notice">
        <strong>模組已建立路由，功能尚未開放</strong>
        <p>這個狀態是刻意保留，避免把未完成的功能誤標成可用。</p>
      </div>
    </section>
  );
}
