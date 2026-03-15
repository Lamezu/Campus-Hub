import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, typography } from '../constants/styles';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label?: string;
}

function parse(v: string) {
  if (!v) return { h: '', m: '' };
  const p = v.split(':');
  return {
    h: (p[0] ?? '').replace(/[^0-9]/g, '').slice(0, 2),
    m: (p[1] ?? '').replace(/[^0-9]/g, '').slice(0, 2),
  };
}

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const { colors } = useTheme();
  const mmRef = useRef<TextInput>(null);

  const [hh, setHh] = useState(() => parse(value).h);
  const [mm, setMm] = useState(() => parse(value).m);

  const emittedRef = useRef(value);

  const emit = (v: string) => {
    emittedRef.current = v;
    onChange(v);
  };

  useEffect(() => {
    if (value !== emittedRef.current) {
      emittedRef.current = value;
      const { h, m } = parse(value);
      setHh(h);
      setMm(m);
    }
  }, [value]);

  const handleHHChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
    setHh(digits);
    if (digits.length === 2) {
      const clamped = String(Math.min(parseInt(digits), 23)).padStart(2, '0');
      setHh(clamped);
      const finalMm = mm.padStart(2, '0') || '00';
      setMm(finalMm);
      emit(`${clamped}:${finalMm}`);
      mmRef.current?.focus();
    }
  };

  const handleHHBlur = () => {
    if (!hh) { if (!mm) emit(''); return; }
    const padded = hh.padStart(2, '0');
    const finalMm = mm ? mm.padStart(2, '0') : '00';
    setHh(padded);
    setMm(finalMm);
    emit(`${padded}:${finalMm}`);
  };

  const handleMMChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
    setMm(digits);
    if (digits.length === 2) {
      const clamped = String(Math.min(parseInt(digits), 59)).padStart(2, '0');
      setMm(clamped);
      emit(`${hh.padStart(2, '0') || '00'}:${clamped}`);
    }
  };

  const handleMMBlur = () => {
    if (!mm) return;
    const padded = mm.padStart(2, '0');
    setMm(padded);
    emit(`${hh.padStart(2, '0') || '00'}:${padded}`);
  };

  const clear = () => { setHh(''); setMm(''); emit(''); };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
      {label && <ThemedText style={[styles.label, { color: colors.textSecondary }]}>{label}</ThemedText>}
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={hh}
          onChangeText={handleHHChange}
          onBlur={handleHHBlur}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="HH"
          placeholderTextColor={colors.textSecondary}
          textAlign="center"
          returnKeyType="next"
          selectTextOnFocus
          onSubmitEditing={() => mmRef.current?.focus()}
        />
        <ThemedText style={[styles.colon, { color: (hh || mm) ? colors.text : colors.textSecondary }]}>:</ThemedText>
        <TextInput
          ref={mmRef}
          style={[styles.input, { color: colors.text }]}
          value={mm}
          onChangeText={handleMMChange}
          onBlur={handleMMBlur}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="MM"
          placeholderTextColor={colors.textSecondary}
          textAlign="center"
          selectTextOnFocus
        />
        {!!(hh || mm) && (
          <TouchableOpacity onPress={clear} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <ThemedText style={[styles.clear, { color: colors.textSecondary }]}>✕</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    alignItems: 'center',
    minWidth: 96,
  },
  label: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  input: { fontSize: typography.sizes.md, fontWeight: '700', width: 28 },
  colon: { fontSize: typography.sizes.md, fontWeight: '700', marginBottom: 1 },
  clear: { fontSize: 11, marginLeft: 4 },
});
