import { LANG_OPTIONS } from '../../i18n';
import './LanguageSwitch.scss';

export default function LanguageSwitch({ value, onChange, available = [] }) {
  const availability = new Map(
    (available || []).map((item) => [item.code, item.available !== false]),
  );

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANG_OPTIONS.map((lang) => {
        const isAvailable = availability.size === 0 ? true : availability.get(lang.code) !== false;
        return (
          <button
            key={lang.code}
            type="button"
            className={`lang-switch__btn${value === lang.code ? ' is-active' : ''}`}
            disabled={!isAvailable}
            title={isAvailable ? lang.label : `${lang.label} (no Data/Local)`}
            onClick={() => onChange(lang.code)}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
