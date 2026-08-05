import './TitleBar.scss';

export default function TitleBar() {
  return (
    <header className="titlebar">
      <div className="titlebar__drag" />
      <div className="titlebar__controls">
        <button
          type="button"
          className="titlebar__btn"
          aria-label="Minimize"
          onClick={() => window.mubreda?.windowMinimize()}
        >
          ─
        </button>
        <button
          type="button"
          className="titlebar__btn titlebar__btn--close"
          aria-label="Close"
          onClick={() => window.mubreda?.windowClose()}
        >
          ×
        </button>
      </div>
    </header>
  );
}
