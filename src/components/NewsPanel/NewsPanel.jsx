import './NewsPanel.scss';

export default function NewsPanel({ t, items = [] }) {
  const list = items.slice(0, 4);

  return (
    <section className="news-panel" aria-label={t.news}>
      <h2 className="news-panel__title">{t.news}</h2>
      {list.length === 0 ? (
        <p className="news-panel__empty">{t.noNews}</p>
      ) : (
        <ul className="news-panel__list">
          {list.map((item) => (
            <li key={item.id || item.title} className="news-panel__item">
              <span className="news-panel__item-title">{item.title}</span>
              {item.createdAt || item.date ? (
                <span className="news-panel__item-date">
                  {item.createdAt || item.date}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
