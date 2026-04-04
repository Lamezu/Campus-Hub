import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Image, Animated } from 'react-native';
import { Phone, PhoneOff, Video } from 'lucide-react-native';
import { avatarColor } from '@/utils/avatarColor';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import type { ActiveCall } from '@/types';
import { spacing } from '@/constants/styles';

interface IncomingCallModalProps {
    visible: boolean;
    call: ActiveCall | null;
    onAccept: () => void;
    onReject: () => void;
}

export function IncomingCallModal({ visible, call, onAccept, onReject }: IncomingCallModalProps) {
    const { colors } = useTheme();
    const [pulse] = useState(new Animated.Value(1));

    useEffect(() => {
        if (visible) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulse, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulse.setValue(1);
        }
    }, [visible]);

    if (!call) return null;

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
                <View style={styles.content}>
                    <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulse }] }]}>
                        {call.callerPhoto ? (
                            <Image source={{ uri: call.callerPhoto }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarFallback, { backgroundColor: avatarColor(call.callerId) }]}>
                                <ThemedText style={styles.avatarText}>{call.callerName[0].toUpperCase()}</ThemedText>
                            </View>
                        )}
                    </Animated.View>

                    <ThemedText style={styles.callerName}>{call.callerName}</ThemedText>
                    <ThemedText style={styles.callType}>
                        {call.type === 'video' ? 'Videollamada entrante' : 'Llamada de audio entrante'}
                    </ThemedText>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: colors.danger }]}
                            onPress={onReject}
                        >
                            <PhoneOff size={32} color="#fff" />
                            <ThemedText style={styles.btnLabel}>Rechazar</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: colors.success }]}
                            onPress={onAccept}
                        >
                            {call.type === 'video' ? (
                                <Video size={32} color="#fff" />
                            ) : (
                                <Phone size={32} color="#fff" />
                            )}
                            <ThemedText style={styles.btnLabel}>Aceptar</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { width: '100%', alignItems: 'center', padding: spacing.xl },
    avatarContainer: { marginBottom: spacing.lg },
    avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#fff' },
    avatarFallback: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff' },
    avatarText: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
    callerName: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: spacing.xs },
    callType: { fontSize: 18, color: 'rgba(255,255,255,0.7)', marginBottom: spacing.xl * 2 },
    actions: { flexDirection: 'row', gap: 60, marginTop: 40 },
    btn: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
    btnLabel: { color: '#fff', fontSize: 14, marginTop: 8, fontWeight: '600' }
});
