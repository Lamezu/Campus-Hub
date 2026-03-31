import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import type { PollData } from '../../types';

interface PollModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (poll: Omit<PollData, 'votes'>) => void;
}

export function PollModal({ visible, onClose, onSend }: PollModalProps) {
  const { colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multipleAnswers, setMultipleAnswers] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) {
      setQuestion('');
      setOptions(['', '']);
      setMultipleAnswers(false);
    }
  }, [visible]);

  if (!visible) return null;

  const addOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  };

  const updateOption = (text: string, i: number) => {
    const next = [...options];
    next[i] = text;
    setOptions(next);
  };

  const validOptions = options.filter(o => o.trim().length > 0);
  const canSend = question.trim().length > 0 && validOptions.length >= 2;

  const handleSend = () => {
    if (!canSend) return;
    onSend({ question: question.trim(), options: validOptions, multipleAnswers });
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div style={{ width: '100%', maxWidth: 540, backgroundColor: colors.background, borderRadius: '20px 20px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: colors.primary, fontWeight: 500 }}>Cancelar</button>
          <span style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>Crear encuesta</span>
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{ background: 'none', border: 'none', cursor: canSend ? 'pointer' : 'default', fontSize: 14, fontWeight: 700, color: colors.primary, opacity: canSend ? 1 : 0.4 }}
          >
            Enviar
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary }}>Pregunta</span>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Escribe tu pregunta..."
              rows={2}
              style={{ backgroundColor: colors.backgroundSecondary, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, color: colors.text, resize: 'none', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary }}>Opciones</span>
            {options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={opt}
                  onChange={e => updateOption(e.target.value, i)}
                  placeholder={`Opción ${i + 1}`}
                  style={{ flex: 1, backgroundColor: colors.backgroundSecondary, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: colors.text, outline: 'none', fontFamily: 'inherit' }}
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <Trash2 size={18} color="#FF3B30" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <button
                onClick={addOption}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', fontSize: 14, color: colors.primary, fontWeight: 600 }}
              >
                <Plus size={18} color={colors.primary} />
                Añadir opción
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: '14px 16px', border: `1px solid ${colors.border}` }}>
            <span style={{ fontSize: 15, color: colors.text, fontWeight: 500 }}>Permitir varias respuestas</span>
            <div
              onClick={() => setMultipleAnswers(v => !v)}
              style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: multipleAnswers ? colors.primary : colors.border, cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: 3, left: multipleAnswers ? 21 : 3, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
