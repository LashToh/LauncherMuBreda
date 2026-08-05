import './TitleBar.scss';

export default function TitleBar({ title = 'MU Breda' }) {
  return (
    <header className="titlebar">
      <div className="titlebar__drag">
        <img src="./assets/logo-b-mark.png" alt="" className="titlebar__mark" />
        <span className="titlebar__title">{title}</span>
      </div>
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
