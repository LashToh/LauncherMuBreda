import './TitleBar.scss';

export default function TitleBar() {
  async function minimize() {
    if (window.mubreda?.windowMinimize) {
      await window.mubreda.windowMinimize();
      return;
    }
    window.blur();
  }

  async function close() {
    if (window.mubreda?.windowClose) {
      await window.mubreda.windowClose();
      return;
    }
    window.close();
  }

  return (
    <header className="titlebar">
      <div className="titlebar__drag" />
      <div className="titlebar__controls">
        <button
          type="button"
          className="titlebar__btn"
          aria-label="Minimize"
          onClick={minimize}
        >
          ─
        </button>
        <button
          type="button"
          className="titlebar__btn titlebar__btn--close"
          aria-label="Close"
          onClick={close}
        >
          ×
        </button>
      </div>
    </header>
  );
}
