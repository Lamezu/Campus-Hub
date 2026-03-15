import React, { useRef } from 'react';
import { View, Image, PanResponder, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ArrowUpDown } from 'lucide-react-native';

const EXTRA = 120;

interface ImagePanPickerProps {
  uri: string;
  offsetY: number;
  onOffsetChange: (v: number) => void;
  containerHeight?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function ImagePanPicker({ uri, offsetY, onOffsetChange, containerHeight = 140, onDragStart, onDragEnd }: ImagePanPickerProps) {
  const startOffsetRef = useRef(offsetY);
  const liveOffsetRef = useRef(offsetY);
  liveOffsetRef.current = offsetY;
  const cbRefs = useRef({ onDragStart, onDragEnd });
  cbRefs.current = { onDragStart, onDragEnd };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => {
      startOffsetRef.current = liveOffsetRef.current;
      cbRefs.current.onDragStart?.();
    },
    onPanResponderMove: (_, gs) => {
      const next = Math.max(0, Math.min(100,
        startOffsetRef.current - (gs.dy / (2 * EXTRA)) * 100
      ));
      onOffsetChange(next);
    },
    onPanResponderRelease: () => cbRefs.current.onDragEnd?.(),
    onPanResponderTerminate: () => cbRefs.current.onDragEnd?.(),
  })).current;

  const imageTop = -(offsetY / 100) * 2 * EXTRA;

  return (
    <View style={[styles.container, { height: containerHeight }]} {...panResponder.panHandlers}>
      <Image
        source={{ uri }}
        style={[styles.image, { height: containerHeight + 2 * EXTRA, top: imageTop }]}
        resizeMode="cover"
      />
      <View style={styles.hint}>
        <ArrowUpDown size={12} color="#fff" strokeWidth={2.5} />
        <ThemedText style={styles.hintText}>Arrastra para ajustar</ThemedText>
      </View>
    </View>
  );
}

export function imageOffsetStyle(offsetY: number | null | undefined, containerHeight: number) {
  const off = offsetY ?? 50;
  return {
    position: 'absolute' as const,
    left: 0, right: 0,
    height: containerHeight + 2 * EXTRA,
    top: -(off / 100) * 2 * EXTRA,
  };
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: 12 },
  image: { position: 'absolute', left: 0, right: 0 },
  hint: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  hintText: {
    color: '#fff', fontSize: 11, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
