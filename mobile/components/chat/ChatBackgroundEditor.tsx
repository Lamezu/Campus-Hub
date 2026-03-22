import React, { useState, useRef } from 'react';
import {
    View, StyleSheet, Modal, Animated, PanResponder, Dimensions, TouchableOpacity, Image
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';
import { X, Check, Search } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

interface ChatBackgroundEditorProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
    onSave: (themeId: string, offsetX: number, offsetY: number, scale: number) => void;
}

export function ChatBackgroundEditor({ visible, imageUri, onClose, onSave }: ChatBackgroundEditorProps) {
    const { colors } = useTheme();
    const { t } = useTranslation();

    // Estados para animación y persistencia
    const scale = useRef(new Animated.Value(1)).current;
    const pan = useRef(new Animated.ValueXY()).current;

    const [currentScale, setCurrentScale] = useState(1);
    const [currentOffset, setCurrentOffset] = useState({ x: 0, y: 0 });

    const initialDist = useRef<number | null>(null);

    const calcDistance = (x1: number, y1: number, x2: number, y2: number) => {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e) => {
                const { touches } = e.nativeEvent;
                // Si es un inicio de 2 dedos, guardamos distancia para zoom
                if (touches.length === 2) {
                    initialDist.current = calcDistance(
                        touches[0].pageX, touches[0].pageY,
                        touches[1].pageX, touches[1].pageY
                    );
                }
                // Siempre permitir Pan
                pan.setOffset({ x: currentOffset.x, y: currentOffset.y });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: (e, gesture) => {
                const { touches } = e.nativeEvent;

                // 1. Manejo de Pinch-to-Zoom (SOLO si hay 2 dedos)
                if (touches.length === 2 && initialDist.current) {
                    const currentDist = calcDistance(
                        touches[0].pageX, touches[0].pageY,
                        touches[1].pageX, touches[1].pageY
                    );
                    const ratio = currentDist / initialDist.current;
                    const nextScale = Math.max(1, Math.min(currentScale * ratio, 4));
                    scale.setValue(nextScale);
                }
                // 2. Manejo de Pan (Movimiento libre)
                // Se permite siempre, incluso con pinch, pero lo optimizamos para 1 dedo según pide el usuario
                else if (touches.length === 1) {
                    pan.x.setValue(gesture.dx);
                    pan.y.setValue(gesture.dy);
                }
            },
            onPanResponderRelease: (e, gesture) => {
                pan.flattenOffset();
                initialDist.current = null;

                // Sincronizar estados finales de escala y offset
                // Usamos una pequeña pausa o verificación para asegurar que capturamos el valor final de la animación
                const finalScale = (scale as any)._value || currentScale;
                const finalX = gesture.dx + currentOffset.x;
                const finalY = gesture.dy + currentOffset.y;

                setCurrentScale(finalScale);
                setCurrentOffset({ x: finalX, y: finalY });
            },
        })
    ).current;

    const handleZoomIn = () => {
        const nextScale = Math.min(currentScale + 0.5, 4);
        Animated.spring(scale, { toValue: nextScale, useNativeDriver: true }).start();
        setCurrentScale(nextScale);
    };

    const handleZoomOut = () => {
        const nextScale = Math.max(currentScale - 0.5, 1);
        Animated.spring(scale, { toValue: nextScale, useNativeDriver: true }).start();
        setCurrentScale(nextScale);
    };

    const handleSave = () => {
        const themeId = `custom_${Date.now()}`;
        // Guardamos las coordenadas finales
        onSave(themeId, currentOffset.x, currentOffset.y, currentScale);
    };

    if (!imageUri) return null;

    return (
        <Modal visible={visible} animationType="fade" transparent={false}>
            <View style={[styles.container, { backgroundColor: '#000' }]}>
                {/* Fondo ajustable */}
                <Animated.View
                    {...panResponder.panHandlers}
                    style={[
                        styles.backgroundContainer,
                        {
                            transform: [
                                { translateX: pan.x },
                                { translateY: pan.y },
                                { scale: scale },
                            ]
                        }
                    ]}
                >
                    <Image source={{ uri: imageUri }} style={styles.backgroundImage} resizeMode="cover" />
                </Animated.View>

                {/* Superposición de Previsualización */}
                <View style={styles.previewOverlay} pointerEvents="none">
                    <View style={styles.headerSpacer} />
                    <View style={[styles.bubble, styles.bubbleOther, { backgroundColor: colors.backgroundSecondary + 'CC' }]}>
                        <ThemedText style={{ fontSize: 14 }}>{t('dm.write_placeholder')}</ThemedText>
                    </View>
                    <View style={[styles.bubble, styles.bubbleOwn, { backgroundColor: colors.primary + 'CC' }]}>
                        <ThemedText style={{ color: '#FFF', fontSize: 14 }}>{t('common.done')}</ThemedText>
                    </View>
                </View>

                {/* Controles de Zoom Flotantes */}
                <View style={styles.zoomControls}>
                    <TouchableOpacity style={[styles.zoomButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={handleZoomIn}>
                        <Search color="#FFF" size={20} />
                        <ThemedText style={styles.zoomText}>+</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.zoomButton, { backgroundColor: 'rgba(255,255,255,0.2)', marginTop: spacing.md }]} onPress={handleZoomOut}>
                        <Search color="#FFF" size={20} />
                        <ThemedText style={styles.zoomText}>-</ThemedText>
                    </TouchableOpacity>
                </View>

                {/* Controles Inferiores */}
                <View style={styles.controls}>
                    <View style={styles.controlsHeader}>
                        <ThemedText style={styles.title}>{t('dm.settings.edit_bg')}</ThemedText>
                        <ThemedText style={styles.subtitle}>{t('dm.settings.edit_bg_desc')}</ThemedText>
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                            onPress={onClose}
                        >
                            <X color="#FFF" size={24} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.primary }]}
                            onPress={handleSave}
                        >
                            <Check color="#FFF" size={24} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    backgroundContainer: {
        width: width,
        height: height,
        position: 'absolute',
    },
    backgroundImage: { width: '100%', height: '100%' },
    previewOverlay: {
        ...StyleSheet.absoluteFillObject,
        padding: spacing.lg,
        justifyContent: 'center',
    },
    headerSpacer: { height: 100 },
    bubble: {
        padding: spacing.md,
        borderRadius: 20,
        marginBottom: spacing.md,
        maxWidth: '80%',
    },
    bubbleOwn: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bubbleOther: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
    zoomControls: {
        position: 'absolute',
        right: spacing.lg,
        top: height * 0.3,
        zIndex: 10,
    },
    zoomButton: {
        width: 44,
        height: 60,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 4,
    },
    zoomText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
    controls: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        padding: spacing.xl,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    controlsHeader: { marginBottom: spacing.xl },
    title: { color: '#FFF', fontSize: typography.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
    subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 4 },
    actions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    actionButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
