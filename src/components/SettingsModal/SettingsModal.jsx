import './SettingsModal.scss';

export default function SettingsModal({
  t,
  open,
  draft,
  resolutions,
  onChange,
  onSave,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="settings-modal" role="dialog" aria-modal="true" aria-label={t.settings}>
      <button type="button" className="settings-modal__backdrop" aria-label={t.close} onClick={onClose} />
      <div className="settings-modal__panel">
        <header className="settings-modal__header">
          <h2>{t.settings}</h2>
          <button type="button" onClick={onClose} aria-label={t.close}>
            ×
          </button>
        </header>

        <div className="settings-modal__grid">
          <label className="settings-modal__field">
            <span>{t.sound}</span>
            <button
              type="button"
              className={`settings-modal__toggle${draft.soundOn ? ' is-on' : ''}`}
              onClick={() => onChange({ soundOn: !draft.soundOn })}
            >
              {draft.soundOn ? t.on : t.off}
            </button>
          </label>

          <label className="settings-modal__field">
            <span>{t.music}</span>
            <button
              type="button"
              className={`settings-modal__toggle${draft.musicOn ? ' is-on' : ''}`}
              onClick={() => onChange({ musicOn: !draft.musicOn })}
            >
              {draft.musicOn ? t.on : t.off}
            </button>
          </label>

          <label className="settings-modal__field settings-modal__field--wide">
            <span>{t.resolution}</span>
            <select
              value={draft.resolutionIndex}
              onChange={(e) => onChange({ resolutionIndex: Number(e.target.value) })}
            >
              {resolutions.map((item) => (
                <option key={item.index} value={item.index}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-modal__field settings-modal__field--wide">
            <span>{t.windowMode}</span>
            <button
              type="button"
              className={`settings-modal__toggle${draft.windowMode ? ' is-on' : ''}`}
              onClick={() => onChange({ windowMode: !draft.windowMode })}
            >
              {draft.windowMode ? t.on : t.off}
            </button>
          </label>
        </div>

        <footer className="settings-modal__footer">
          <button type="button" className="settings-modal__save" onClick={onSave}>
            {t.save}
          </button>
        </footer>
      </div>
    </div>
  );
}
