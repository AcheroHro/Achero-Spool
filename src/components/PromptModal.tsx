import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface PromptModalProps {
  /** Título del modal */
  title: string;
  /** Mensaje opcional debajo del título */
  message?: string;
  /** Valor inicial del campo de texto */
  initialValue?: string;
  /** Placeholder del input */
  placeholder?: string;
  /** Texto del botón de confirmación */
  confirmLabel?: string;
  /** Si es true, muestra solo el mensaje sin input (modal de confirmación) */
  confirmOnly?: boolean;
  /** Callback cuando el usuario confirma */
  onConfirm: (value: string) => void;
  /** Callback cuando el usuario cancela */
  onCancel: () => void;
  /** Validación opcional: devuelve un string de error o null */
  validate?: (value: string) => string | null;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  title,
  message,
  initialValue = '',
  placeholder = '',
  confirmLabel = 'Confirmar',
  confirmOnly = false,
  onConfirm,
  onCancel,
  validate
}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!confirmOnly) {
      // delay to allow animation to start
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [confirmOnly]);

  const handleConfirm = () => {
    if (!confirmOnly && validate) {
      const err = validate(value);
      if (err) { setError(err); return; }
    }
    onConfirm(confirmOnly ? '' : value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative w-full max-w-sm bg-[#1e2024] border border-white/10 rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
      >
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          title="Cerrar"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <h3 className="text-white font-bold text-base pr-6">{title}</h3>

        {/* Message */}
        {message && (
          <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
        )}

        {/* Input */}
        {!confirmOnly && (
          <div className="flex flex-col gap-1">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              placeholder={placeholder}
              className={`w-full bg-[#0f1115] text-white rounded-xl px-4 py-3 text-sm outline-none border transition-colors ${
                error
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-white/10 focus:border-blue-500'
              }`}
            />
            {error && <p className="text-red-400 text-xs px-1">{error}</p>}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors active:scale-95"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Hook helper ──────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean;
  props: Omit<PromptModalProps, 'onConfirm' | 'onCancel'>;
  resolve: ((val: string | null) => void) | null;
}

/**
 * Hook que expone `showPrompt` y `showConfirm` devolviendo Promises,
 * al estilo `window.prompt` / `window.confirm` pero con UI propia.
 *
 * Uso:
 *   const { modal, showPrompt, showConfirm } = useModal();
 *   // En el JSX: {modal}
 *   // En código: const name = await showPrompt({ title: 'Nombre', placeholder: 'Spool...' });
 */
export function useModal() {
  const [state, setState] = useState<ModalState>({
    open: false,
    props: { title: '' },
    resolve: null
  });

  const open = (
    props: Omit<PromptModalProps, 'onConfirm' | 'onCancel'>
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setState({ open: true, props, resolve });
    });
  };

  const close = (value: string | null) => {
    setState((s) => {
      s.resolve?.(value);
      return { ...s, open: false, resolve: null };
    });
  };

  const showPrompt = (props: Omit<PromptModalProps, 'onConfirm' | 'onCancel' | 'confirmOnly'>) =>
    open({ ...props, confirmOnly: false });

  const showConfirm = (props: Omit<PromptModalProps, 'onConfirm' | 'onCancel' | 'confirmOnly'>) =>
    open({ ...props, confirmOnly: true });

  const modal = (
    <AnimatePresence>
      {state.open && (
        <PromptModal
          key="prompt-modal"
          {...state.props}
          onConfirm={(val) => close(val)}
          onCancel={() => close(null)}
        />
      )}
    </AnimatePresence>
  );

  return { modal, showPrompt, showConfirm };
}
