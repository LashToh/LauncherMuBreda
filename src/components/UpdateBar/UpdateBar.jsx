import './UpdateBar.scss';

export default function UpdateBar({
  t,
  status,
  progress,
  onUpdate,
}) {
  const percent =
    progress?.total > 0
      ? Math.min(100, Math.round((progress.received / progress.total) * 100))
      : progress?.fileCount
        ? Math.round((progress.fileIndex / progress.fileCount) * 100)
        : 0;

  let message = t.checkingUpdate;
  if (status === 'ready') message = t.upToDate;
  if (status === 'available') message = t.updateAvailable;
  if (status === 'updating') message = t.updating;
  if (status === 'failed') message = t.updateFailed;
  if (status === 'skipped') message = t.updateSkipped;

  return (
    <div className={`update-bar is-${status}`}>
      <div className="update-bar__row">
        <span>{message}</span>
        {status === 'available' ? (
          <button type="button" className="update-bar__action" onClick={onUpdate}>
            {t.downloadUpdate}
          </button>
        ) : null}
      </div>
      {(status === 'updating' || status === 'checking') && (
        <div className="update-bar__track">
          <div
            className="update-bar__fill"
            style={{ width: status === 'checking' ? '35%' : `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
