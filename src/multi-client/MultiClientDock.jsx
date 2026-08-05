import { useEffect, useState } from 'react';

export default function MultiClientDock() {
  const [clients, setClients] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  async function refresh() {
    if (!window.mubreda?.listClients) return;
    const result = await window.mubreda.listClients();
    setClients(result.clients || []);
    setCollapsed(Boolean(result.collapsed));
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, []);

  async function onFocus(hwnd) {
    await window.mubreda?.focusClient(hwnd);
    refresh();
  }

  async function onLaunch() {
    await window.mubreda?.launchClient();
    setTimeout(refresh, 800);
  }

  async function onToggle() {
    if (collapsed) {
      await window.mubreda?.restoreAllClients();
      setCollapsed(false);
    } else {
      await window.mubreda?.minimizeAllClients();
      setCollapsed(true);
    }
    refresh();
  }

  if (collapsed) {
    return (
      <div className="dock dock--collapsed">
        <button
          type="button"
          className="dock__circle"
          title="Restaurar clientes"
          onClick={onToggle}
        >
          ▲
        </button>
      </div>
    );
  }

  return (
    <div className="dock">
      <div className="dock__panel">
        {clients.map((client) => (
          <button
            key={client.hwnd}
            type="button"
            className="dock__avatar"
            title={client.title}
            style={{ '--avatar-color': client.color }}
            onClick={() => onFocus(client.hwnd)}
          >
            <span>{client.initial}</span>
          </button>
        ))}

        <button
          type="button"
          className="dock__avatar dock__avatar--add"
          title="Abrir nuevo cliente"
          onClick={onLaunch}
        >
          +
        </button>
      </div>

      <button
        type="button"
        className="dock__circle"
        title="Minimizar clientes"
        onClick={onToggle}
      >
        ▼
      </button>
    </div>
  );
}
