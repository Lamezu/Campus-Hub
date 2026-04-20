import React from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar, SafeAreaView } from 'react-native';
import { Stack, router } from 'expo-router';
import { PhoneOff } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/hooks/useTranslation';

export default function GroupCallScreen() {
    const { t } = useTranslation();

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    <View style={styles.iconRing}>
                        <PhoneOff size={36} color="#FF6B6B" strokeWidth={2} />
                    </View>
                    <View style={styles.textBlock}>
                        <ThemedText style={styles.title}>
                            {t('dm.call.not_available_title')}
                        </ThemedText>
                        <ThemedText style={styles.desc}>
                            {t('dm.call.not_available_desc')}
                        </ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
                        <ThemedText style={styles.backText}>{t('common.back')}</ThemedText>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    safeArea: {
        flex: 1,
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        gap: 32,
        paddingHorizontal: 32,
    },
    iconRing: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: 'rgba(255,107,107,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,107,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textBlock: {
        alignItems: 'center',
        gap: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    desc: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        lineHeight: 24,
    },
    backBtn: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    backText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});
