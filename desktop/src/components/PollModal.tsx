import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from './themed-text';
import { spacing } from '@/constants/styles';

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (poll: { question: string; options: string[]; multipleAnswers: boolean }) => void;
}

export const PollModal: React.FC<PollModalProps> = ({ isOpen, onClose, onSend }) => {
  const { colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multipleAnswers, setMultipleAnswers] = useState(false);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (text: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const handleSend = () => {
    const filledOptions = options.filter(opt => opt.trim() !== '');
    if (!question.trim() || filledOptions.length < 2) return;

    onSend({
      question: question.trim(),
      options: filledOptions,
      multipleAnswers
    });
    setQuestion('');
    setOptions(['', '']);
    setMultipleAnswers(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        backgroundColor: colors.card,
        width: 400,
        borderRadius: 24,
        padding: 24,
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <ThemedText style={{ fontSize: 20, fontWeight: '800' }}>Crear Encuesta</ThemedText>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <ThemedText style={{ fontSize: 13, fontWeight: '700', opacity: 0.6, marginBottom: 8, display: 'block' }}>PREGUNTA</ThemedText>
          <textarea
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="¿Qué quieres preguntar?"
            style={{
              width: '100%',
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              border: 'none',
              borderRadius: 12,
              padding: 12,
              fontSize: 15,
              resize: 'none',
              minHeight: 60,
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '700', opacity: 0.6 }}>OPCIONES</ThemedText>
            <ThemedText style={{ fontSize: 11, opacity: 0.5 }}>Mínimo 2 opciones</ThemedText>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
            {options.map((opt, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  value={opt}
                  onChange={(e) => handleOptionChange(e.target.value, index)}
                  placeholder={`Opción ${index + 1}`}
                  style={{
                    flex: 1,
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
                {options.length > 2 && (
                  <button onClick={() => handleRemoveOption(index)} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: colors.danger }}>
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <button
              onClick={handleAddOption}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
                background: 'none',
                border: 'none',
                color: colors.primary,
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              <Plus size={18} /> Añadir opción
            </button>
          )}
        </div>

        <div
          onClick={() => setMultipleAnswers(!multipleAnswers)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: `${colors.primary}11`,
            borderRadius: 14,
            cursor: 'pointer',
            marginBottom: 24
          }}
        >
          <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>Permitir selección múltiple</ThemedText>
          {multipleAnswers ? <CheckCircle2 size={22} color={colors.primary} /> : <Circle size={22} color={colors.textSecondary} />}
        </div>

        <button
          onClick={handleSend}
          disabled={!question.trim() || options.filter(o => o.trim() !== '').length < 2}
          style={{
            width: '100%',
            backgroundColor: colors.primary,
            color: '#FFF',
            border: 'none',
            borderRadius: 14,
            padding: '14px',
            fontWeight: '700',
            fontSize: 16,
            cursor: 'pointer',
            opacity: (!question.trim() || options.filter(o => o.trim() !== '').length < 2) ? 0.5 : 1,
            transition: 'opacity 0.2s'
          }}
        >
          Crear Encuesta
        </button>
      </div>
    </div>
  );
};
