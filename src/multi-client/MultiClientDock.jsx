import { useEffect, useRef, useState } from 'react';

function orderKey(client) {
  return String(client.title || client.pid || client.hwnd)
    .trim()
    .toLowerCase();
}

export default function MultiClientDock() {
  const [clients, setClients] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [draggingHwnd, setDraggingHwnd] = useState(null);
  const [picker, setPicker] = useState(null); // { name, x, y }
  const dragMoved = useRef(false);
  const arrowDrag = useRef({ active: false, moved: false, x: 0, y: 0 });
  const busyToggle = useRef(false);

  async function refresh() {
    if (!window.mubreda?.listClients) return;
    const result = await window.mubreda.listClients();
    setClients(result.clients || []);
    setClassOptions(result.classOptions || []);
    if (!busyToggle.current) {
      setCollapsed(Boolean(result.collapsed));
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, []);

  async function onFocus(hwnd) {
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    await window.mubreda?.focusClient(hwnd);
  }

  async function onLaunch() {
    await window.mubreda?.launchClient();
    setTimeout(refresh, 1000);
  }

  function onToggle() {
    if (arrowDrag.current.moved) {
      arrowDrag.current.moved = false;
      return;
    }
    if (busyToggle.current) return;

    const nextCollapsed = !collapsed;
    busyToggle.current = true;
    setCollapsed(nextCollapsed);
    setPicker(null);

    Promise.resolve(window.mubreda?.setDockCollapsed(nextCollapsed))
      .catch(() => {})
      .finally(() => {
        busyToggle.current = false;
      });
  }

  function onAvatarDragStart(event, hwnd) {
    setDraggingHwnd(hwnd);
    dragMoved.current = false;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/hwnd', hwnd);
  }

  function onAvatarDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  async function onAvatarDrop(event, targetHwnd) {
    event.preventDefault();
    const sourceHwnd = event.dataTransfer.getData('text/hwnd') || draggingHwnd;
    setDraggingHwnd(null);
    if (!sourceHwnd || sourceHwnd === targetHwnd) return;

    dragMoved.current = true;
    const next = [...clients];
    const from = next.findIndex((c) => c.hwnd === sourceHwnd);
    const to = next.findIndex((c) => c.hwnd === targetHwnd);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setClients(next);
    await window.mubreda?.reorderClients(next.map(orderKey));
  }

  function openClassPicker(event, client) {
    event.preventDefault();
    event.stopPropagation();
    setPicker({
      name: client.label,
      x: Math.min(event.clientX, 8),
      y: Math.min(event.clientY, window.innerHeight - 220),
    });
  }

  async function chooseClass(group) {
    if (!picker?.name) return;
    const result = await window.mubreda?.setClientClass({
      name: picker.name,
      group,
    });
    if (result?.clients) setClients(result.clients);
    setPicker(null);
    refresh();
  }

  function onArrowPointerDown(event) {
    arrowDrag.current = {
      active: true,
      moved: false,
      x: event.screenX,
      y: event.screenY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onArrowPointerMove(event) {
    if (!arrowDrag.current.active) return;
    const dx = event.screenX - arrowDrag.current.x;
    const dy = event.screenY - arrowDrag.current.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    arrowDrag.current.moved = true;
    arrowDrag.current.x = event.screenX;
    arrowDrag.current.y = event.screenY;
    window.mubreda?.moveDockBy(dx, dy);
  }

  function onArrowPointerUp(event) {
    arrowDrag.current.active = false;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
  }

  const arrowButton = (
    <button
      type="button"
      className="dock__circle"
      title={collapsed ? 'Expandir dock / arrastrar para mover' : 'Ocultar dock / arrastrar para mover'}
      onClick={onToggle}
      onPointerDown={onArrowPointerDown}
      onPointerMove={onArrowPointerMove}
      onPointerUp={onArrowPointerUp}
      onPointerCancel={onArrowPointerUp}
    >
      {collapsed ? '▲' : '▼'}
    </button>
  );

  if (collapsed) {
    return <div className="dock dock--collapsed">{arrowButton}</div>;
  }

  return (
    <div className="dock" onClick={() => setPicker(null)}>
      <div className="dock__panel">
        {clients.map((client) => (
          <button
            key={client.hwnd}
            type="button"
            className={`dock__avatar${draggingHwnd === client.hwnd ? ' is-dragging' : ''}`}
            title={`${client.label}${client.classLabel ? ` · ${client.classLabel}` : ''} (click: enfocar · click derecho: clase)`}
            style={{ '--avatar-color': client.color }}
            draggable
            onDragStart={(event) => onAvatarDragStart(event, client.hwnd)}
            onDragOver={onAvatarDragOver}
            onDrop={(event) => onAvatarDrop(event, client.hwnd)}
            onDragEnd={() => setDraggingHwnd(null)}
            onClick={(event) => {
              event.stopPropagation();
              onFocus(client.hwnd);
            }}
            onContextMenu={(event) => openClassPicker(event, client)}
          >
            <img
              className="dock__thumb"
              src={client.classIconUrl || './assets/classes/avatar.jpg'}
              alt={client.classLabel || client.label}
              draggable={false}
              onError={(event) => {
                event.currentTarget.src = './assets/classes/avatar.jpg';
              }}
            />
          </button>
        ))}

        <button
          type="button"
          className="dock__avatar dock__avatar--add"
          title="Abrir nuevo cliente"
          onClick={(event) => {
            event.stopPropagation();
            onLaunch();
          }}
        >
          +
        </button>
      </div>

      {arrowButton}

      {picker ? (
        <div
          className="dock__picker"
          style={{ top: picker.y, left: 4 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="dock__picker-title">{picker.name}</div>
          <div className="dock__picker-grid">
            {classOptions.map((option) => (
              <button
                key={option.group}
                type="button"
                className="dock__picker-item"
                title={option.label}
                onClick={() => chooseClass(option.group)}
              >
                <img src={`./assets/classes/${option.file}`} alt={option.label} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
