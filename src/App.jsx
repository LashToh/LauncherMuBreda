import { useEffect, useMemo, useState } from 'react';
import { FiSettings } from 'react-icons/fi';
import LanguageSwitch from './components/LanguageSwitch/LanguageSwitch';
import NewsPanel from './components/NewsPanel/NewsPanel';
import ServerStatus from './components/ServerStatus/ServerStatus';
import SettingsModal from './components/SettingsModal/SettingsModal';
import SocialBar from './components/SocialBar/SocialBar';
import TitleBar from './components/TitleBar/TitleBar';
import UpdateBar from './components/UpdateBar/UpdateBar';
import { getDictionary } from './i18n';
import { fetchNews, fetchServerInfo } from './services/api';
import './App.scss';

const fallbackConfig = {
  apiUrl: 'https://api.mubreda.net',
  websiteUrl: 'https://mubreda.net',
  discordUrl: 'https://discord.gg/SV6yW7XK7',
  instagramUrl: 'https://www.instagram.com/mubredaonline/',
  facebookUrl: 'https://www.facebook.com/mubredaonline/',
  donateUrl: 'https://mubreda.net/donate',
};

const fallbackSettings = {
  soundOn: true,
  musicOn: true,
  resolutionIndex: 5,
  windowMode: true,
  language: 'es',
};

export default function App() {
  const [config, setConfig] = useState(fallbackConfig);
  const [settings, setSettings] = useState(fallbackSettings);
  const [resolutions, setResolutions] = useState([]);
  const [language, setLanguage] = useState('es');
  const [news, setNews] = useState([]);
  const [server, setServer] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(fallbackSettings);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');
  const [updateStatus, setUpdateStatus] = useState('checking');
  const [progress, setProgress] = useState(null);

  const t = useMemo(() => getDictionary(language), [language]);

  useEffect(() => {
    let unsubscribe = () => {};

    async function boot() {
      if (!window.mubreda) return;

      const bootstrap = await window.mubreda.getBootstrap();
      const nextConfig = bootstrap.config || fallbackConfig;
      const nextSettings = bootstrap.settings || fallbackSettings;

      setConfig(nextConfig);
      setSettings(nextSettings);
      setDraft(nextSettings);
      setResolutions(bootstrap.resolutions || []);
      setLanguage(nextSettings.language || nextConfig.language || 'es');

      unsubscribe = window.mubreda.onUpdateProgress((payload) => {
        setProgress(payload);
      });

      // Non-blocking: keep Play visible even if API is slow/unreachable
      setUpdateStatus('checking');
      Promise.race([
        window.mubreda.checkUpdates(),
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: false,
                skipped: true,
                allowPlay: true,
                reason: 'TIMEOUT',
              }),
            4000,
          ),
        ),
      ])
        .then((update) => {
          if (update.available) setUpdateStatus('available');
          else if (update.skipped || !update.ok) setUpdateStatus('skipped');
          else setUpdateStatus('ready');
        })
        .catch(() => setUpdateStatus('skipped'));

      Promise.all([
        fetchServerInfo(nextConfig.apiUrl).catch(() => null),
        fetchNews(nextConfig.apiUrl).catch(() => []),
      ])
        .then(([serverInfo, newsItems]) => {
          setServer(serverInfo);
          setNews(newsItems);
        })
        .catch(() => {});
    }

    boot();
    return () => unsubscribe();
  }, []);

  async function handleLanguageChange(code) {
    setLanguage(code);
    setError('');
    const saved = await window.mubreda?.saveGameSettings({ language: code });
    if (saved) {
      setSettings((prev) => ({ ...prev, ...saved }));
      setDraft((prev) => ({ ...prev, ...saved }));
    }
    await window.mubreda?.saveLauncherConfig({ language: code });
    setConfig((prev) => ({ ...prev, language: code }));
  }

  async function handleSaveSettings() {
    const saved = await window.mubreda?.saveGameSettings(draft);
    if (saved) {
      setSettings(saved);
      setDraft(saved);
      if (saved.language) setLanguage(saved.language);
    }
    setSettingsOpen(false);
  }

  async function handlePlay() {
    setLaunching(true);
    setError('');
    try {
      const result = await window.mubreda?.launchGame();
      if (!result?.ok) {
        setError(result?.message || t.launchError);
      }
    } catch (err) {
      setError(err.message || t.launchError);
    } finally {
      setLaunching(false);
    }
  }

  async function handleUpdate() {
    setUpdateStatus('updating');
    setProgress(null);
    const result = await window.mubreda?.applyUpdate();
    if (result?.ok && result.applied) {
      setUpdateStatus('ready');
    } else if (result?.ok && !result.applied) {
      setUpdateStatus('ready');
    } else {
      setUpdateStatus('failed');
    }
  }

  return (
    <div className="launcher">
      <div className="launcher__bg" aria-hidden="true" />
      <div className="launcher__gradient" aria-hidden="true" />
      <div className="launcher__vignette" aria-hidden="true" />
      <div className="launcher__embers" aria-hidden="true" />

      <TitleBar title="MU Breda Season 21" />

      <main className="launcher__main">
        <div className="launcher__content">
          <div className="launcher__brand">
            <img
              className="launcher__logo"
              src="./assets/logo-mubreda.webp"
              alt="MU Breda"
            />
            <p className="launcher__tagline">Season 21 — The Crusader Awakens</p>
          </div>

          <div className="launcher__actions">
            <ServerStatus t={t} server={server} />

            <UpdateBar
              t={t}
              status={updateStatus}
              progress={progress}
              onUpdate={handleUpdate}
            />

            <div className="launcher__cta">
              <button
                type="button"
                className="launcher__play"
                onClick={handlePlay}
                disabled={launching}
              >
                {launching ? t.launching : t.play}
              </button>
              <button
                type="button"
                className="launcher__settings"
                aria-label={t.settings}
                onClick={() => {
                  setDraft(settings);
                  setSettingsOpen(true);
                }}
              >
                <FiSettings />
              </button>
            </div>

            {error ? <p className="launcher__error">{error}</p> : null}

            <SocialBar t={t} config={config} />
          </div>

          <div className="launcher__news">
            <NewsPanel t={t} items={news} />
          </div>
        </div>

        <div className="launcher__right">
          <LanguageSwitch value={language} onChange={handleLanguageChange} />
        </div>
      </main>

      <SettingsModal
        t={t}
        open={settingsOpen}
        draft={draft}
        resolutions={resolutions}
        onChange={(partial) => setDraft((prev) => ({ ...prev, ...partial }))}
        onSave={handleSaveSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
