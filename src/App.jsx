import { useEffect, useMemo, useState } from 'react';
import { FiSettings } from 'react-icons/fi';
import NewsPanel from './components/NewsPanel/NewsPanel';
import ServerStatus from './components/ServerStatus/ServerStatus';
import SettingsModal from './components/SettingsModal/SettingsModal';
import SocialBar from './components/SocialBar/SocialBar';
import TitleBar from './components/TitleBar/TitleBar';
import UpdateBar from './components/UpdateBar/UpdateBar';
import {
  FALLBACK_CONFIG,
  FALLBACK_RESOLUTIONS,
  FALLBACK_SETTINGS,
} from './constants';
import { getDictionary } from './i18n';
import { fetchNews, fetchServerInfo } from './services/api';
import './App.scss';

export default function App() {
  const [config, setConfig] = useState(FALLBACK_CONFIG);
  const [settings, setSettings] = useState(FALLBACK_SETTINGS);
  const [resolutions, setResolutions] = useState(FALLBACK_RESOLUTIONS);
  // Launcher UI strings only. No ES/EN/PT switch — this Breda pack breaks
  // if the game client leaves English (old builds rewrote Language on click).
  const [language, setLanguage] = useState('es');
  const [news, setNews] = useState([]);
  const [server, setServer] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(FALLBACK_SETTINGS);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');
  const [updateStatus, setUpdateStatus] = useState('checking');
  const [progress, setProgress] = useState(null);

  const t = useMemo(() => getDictionary(language), [language]);
  const resolutionOptions =
    resolutions?.length > 0 ? resolutions : FALLBACK_RESOLUTIONS;

  useEffect(() => {
    let unsubscribe = () => {};

    async function boot() {
      if (!window.mubreda) return;

      const bootstrap = await window.mubreda.getBootstrap();
      const nextConfig = { ...FALLBACK_CONFIG, ...(bootstrap.config || {}) };
      const nextSettings = { ...FALLBACK_SETTINGS, ...(bootstrap.settings || {}) };
      const nextResolutions =
        bootstrap.resolutions?.length > 0
          ? bootstrap.resolutions
          : FALLBACK_RESOLUTIONS;

      setConfig(nextConfig);
      setSettings(nextSettings);
      setDraft(nextSettings);
      setResolutions(nextResolutions);
      setLanguage(nextConfig.language || 'es');

      unsubscribe = window.mubreda.onUpdateProgress((payload) => {
        setProgress(payload);
      });

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
            2000,
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

  async function handleSaveSettings() {
    const saved = await window.mubreda?.saveGameSettings(draft);
    if (saved) {
      setSettings(saved);
      setDraft(saved);
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
    if (result?.ok && result.applied) setUpdateStatus('ready');
    else if (result?.ok && !result.applied) setUpdateStatus('ready');
    else setUpdateStatus('failed');
  }

  return (
    <div className="launcher">
      <div className="launcher__bg" aria-hidden="true" />
      <div className="launcher__gradient" aria-hidden="true" />
      <div className="launcher__vignette" aria-hidden="true" />
      <div className="launcher__embers" aria-hidden="true" />

      <TitleBar />

      <main className="launcher__main">
        <div className="launcher__content">
          <div className="launcher__brand">
            <img
              className="launcher__logo"
              src="./assets/logo-mubreda-launcher.webp"
              alt="MU Breda"
            />
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
        </div>

        <aside className="launcher__right">
          <div className="launcher__news">
            <NewsPanel t={t} items={news} />
          </div>
        </aside>
      </main>

      <SettingsModal
        t={t}
        open={settingsOpen}
        draft={draft}
        resolutions={resolutionOptions}
        onChange={(partial) => setDraft((prev) => ({ ...prev, ...partial }))}
        onSave={handleSaveSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
