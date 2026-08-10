import { LANG_OPTIONS } from '../../i18n';
import './LanguageSwitch.scss';

export default function LanguageSwitch({ value, onChange }) {
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANG_OPTIONS.map((lang) => (
        <button
          key={lang.code}
          type="button"
          className={`lang-switch__btn${value === lang.code ? ' is-active' : ''}`}
          onClick={() => onChange(lang.code)}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
