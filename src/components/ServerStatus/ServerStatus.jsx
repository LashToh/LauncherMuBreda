import './ServerStatus.scss';

export default function ServerStatus({ t, server }) {
  const online = Boolean(server?.stats?.online);
  const players = server?.stats?.playersOnline;
  const season = server?.season || '21';
  const name = server?.name || 'MU Breda';

  return (
    <div className="server-status">
      <div className="server-status__row">
        <span className={`server-status__dot${online ? ' is-online' : ''}`} />
        <strong>{name}</strong>
        <span className="server-status__badge">
          {online ? t.serverOnline : t.serverOffline}
        </span>
      </div>
      <div className="server-status__meta">
        <span>
          {t.season} {season}
        </span>
        {players != null ? (
          <span>
            {t.players}: {players}
          </span>
        ) : null}
        {server?.exp ? <span>EXP {server.exp}</span> : null}
      </div>
    </div>
  );
}
