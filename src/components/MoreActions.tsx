import { useEffect, useId, useRef, useState } from 'react';

export function MoreActions({
  onCopy,
  onRestore,
  onClear,
}: {
  onCopy: () => void;
  onRestore: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      setConfirmClear(false);
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <div className="more-menu" ref={root}>
      <button
        type="button"
        className="btn ghost"
        data-testid="more-actions"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        Mais ações
      </button>
      {open ? (
        <div className="more-panel" id={menuId} role="menu" aria-label="Mais ações">
          {confirmClear ? (
            <div className="menu-confirm" role="group" aria-label="Confirmar exclusão">
              <p>Apagar as simulações salvas neste navegador?</p>
              <div className="menu-confirm-actions">
                <button type="button" className="btn ghost" data-testid="clear-storage-cancel" onClick={() => setConfirmClear(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn danger"
                  data-testid="clear-storage-confirm"
                  onClick={() => {
                    onClear();
                    close();
                  }}
                >
                  Apagar
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                data-testid="copy-summary"
                onClick={() => {
                  onCopy();
                  close();
                }}
              >
                Copiar resumo
              </button>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                data-testid="restore-example"
                onClick={() => {
                  onRestore();
                  close();
                }}
              >
                Restaurar exemplo
              </button>
              <button
                type="button"
                className="menu-item danger"
                role="menuitem"
                data-testid="clear-storage"
                onClick={() => setConfirmClear(true)}
              >
                Limpar dados salvos
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
