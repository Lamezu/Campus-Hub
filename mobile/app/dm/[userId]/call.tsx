import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, Alert, StatusBar, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Mic, MicOff, Volume2, VolumeX, Video, VideoOff, MonitorUp, PhoneOff, Camera } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/contexts/ThemeContext';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import type { CallStatus, CallType, ActiveCall } from '@/types';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  RTCView,
  MediaStream,
  webRTCAvailable,
} from '@/utils/webrtc';
import * as callService from '@/services/callService';
import { avatarColor } from '@/utils/avatarColor';
import { Audio } from 'expo-av';

const SOUNDS = {
  DIALING: 'https://raw.githubusercontent.com/Lamezu/Campus-Hub/main/mobile/assets/sounds/dialing.mp3',
  RINGTONE: 'https://raw.githubusercontent.com/Lamezu/Campus-Hub/main/mobile/assets/sounds/ringtone.mp3'
};

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface ControlBtnProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
}

function ControlBtn({ icon, label, onPress, active }: ControlBtnProps) {
  return (
    <TouchableOpacity style={styles.controlWrapper} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.controlCircle, active && styles.controlCircleActive]}>
        {icon}
      </View>
      <ThemedText style={styles.controlLabel}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

export default function CallScreen() {
  const { t } = useTranslation();

  if (!webRTCAvailable) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={[styles.safeArea, { justifyContent: 'center' }]}>
          <View style={{ alignItems: 'center', gap: 32, paddingHorizontal: 32 }}>
            <View style={styles.unavailIconRing}>
              <PhoneOff size={36} color="#FF6B6B" strokeWidth={2} />
            </View>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <ThemedText style={styles.unavailTitle}>
                {t('dm.call.not_available_title') || 'Not Available Title'}
              </ThemedText>
              <ThemedText style={styles.unavailDesc}>
                {t('dm.call.build_required') || 'Build Required'}
              </ThemedText>
            </View>
            <TouchableOpacity onPress={() => router.back()} style={styles.unavailBackBtn} activeOpacity={0.8}>
              <ThemedText style={styles.unavailBackText}>{t('common.back') || 'Back'}</ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }
  return <CallScreenInner />;
}

function CallScreenInner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId, type, callId: initialCallId, isReceiver } = useLocalSearchParams<{
    userId: string;
    type: string;
    callId: string;
    isReceiver: string;
  }>();

  const soundRef = useRef<Audio.Sound | null>(null);

  const loadAndPlaySound = async (uri: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { isLooping: true, shouldPlay: true }
      );
      soundRef.current = sound;
    } catch (e) {
      console.warn('Failed to load call sound:', e);
    }
  };

  const stopSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (e) { }
    }
  };

  const currentUser = auth.currentUser;
  const isIncoming = isReceiver === 'true';
  const callType = (type === 'video' ? 'video' : 'audio') as CallType;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);

  const [currentCallId, setCurrentCallId] = useState<string | null>(initialCallId || null);
  const [participantName, setParticipantName] = useState('Usuario');
  const [participantPhoto, setParticipantPhoto] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeaf, setIsDeaf] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.25)).current;

  const stopTracks = () => {
    if (localStream) {
      localStream.getTracks().forEach((track: any) => track.stop());
    }
  };

  const handleHangUp = (notify = true) => {
    if (notify && currentCallId) {
      const convId = [currentUser!.uid, (userId as string)].sort().join('_');
      if (callStatus === 'ringing') {
        if (isIncoming) callService.rechazarLlamada(currentCallId);
        else {
          callService.registrarLlamadaPerdida(currentCallId, convId, currentUser!.uid, currentUser!.displayName || 'Usuario', currentUser!.photoURL);
        }
      } else {
        callService.terminarLlamada(currentCallId, duration, convId, currentUser!.uid, currentUser!.displayName ?? undefined, currentUser!.photoURL);
      }
    }
    stopTracks();
    if (timerRef.current) clearInterval(timerRef.current);
    router.back();
  };

  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) {
        const u = snap.data();
        setParticipantName(u.displayName ?? 'Usuario');
        setParticipantPhoto(u.photoURL ?? null);
      }
    });
  }, [userId]);

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video' ? {
            facingMode: 'user',
            width: 640,
            height: 480,
            frameRate: 30
          } : false
        });
        setLocalStream(stream);

        const peer = new RTCPeerConnection(configuration);
        pc.current = peer;

        stream.getTracks().forEach((track: any) => {
          peer.addTrack(track, stream);
        });

        (peer as any).onicecandidate = (event: any) => {
          if (event.candidate && currentCallId) {
            callService.agregarCandidatoICE(currentCallId, event.candidate.toJSON(), currentUser!.uid);
          }
        };

        (peer as any).ontrack = (event: any) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          }
        };

        (peer as any).onconnectionstatechange = () => {
          if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
            handleHangUp();
          }
        };

        if (isIncoming && initialCallId) {
          const callSnap = await getDoc(doc(db, 'calls', initialCallId));
          if (callSnap.exists()) {
            const callData = callSnap.data() as ActiveCall;
            await peer.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await callService.aceptarLlamada(initialCallId, answer);
          }
        } else {
          const offer = await peer.createOffer({});
          await peer.setLocalDescription(offer);

          const convId = [currentUser!.uid, (userId as string)].sort().join('_');

          const newCallId = await callService.iniciarLlamada(
            convId,
            currentUser!.uid,
            currentUser!.displayName || 'Usuario',
            currentUser!.photoURL,
            (userId as string),
            callType,
            offer
          );
          setCurrentCallId(newCallId);
        }
      } catch (err) {
        console.warn('Call initialization failed (Expected on mobile):', err);
        setCallStatus('error');
      }
    };

    init();

    return () => {
      stopTracks();
      if (pc.current && typeof pc.current.close === 'function') {
        try {
          pc.current.close();
        } catch (e) { }
      }
    };
  }, []);

  useEffect(() => {
    if (!currentCallId) return;

    const unsubStatus = callService.suscribirEstadoLlamada(currentCallId, (call) => {
      setCallStatus(call.status);

      if (call.status === 'active' && !isIncoming) {
        if (call.answer && pc.current && !pc.current.remoteDescription) {
          pc.current.setRemoteDescription(new RTCSessionDescription(call.answer));
        }
      }

      if (call.status === 'ended' || call.status === 'rejected' || call.status === 'missed') {
        handleHangUp(false);
      }
    });

    const unsubIce = callService.suscribirCandidatosICE(currentCallId, (candidates) => {
      candidates.forEach(async (c) => {
        if (c.senderId !== currentUser!.uid && pc.current) {
          try {
            await pc.current.addIceCandidate(new RTCIceCandidate(c));
          } catch (e) { }
        }
      });
    });

    return () => {
      unsubStatus();
      unsubIce();
    };
  }, [currentCallId]);

  useEffect(() => {
    if (callStatus === 'ringing' || callStatus === 'active') {
      const anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.25, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, { toValue: 0.05, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
          ]),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [callStatus]);

  useEffect(() => {
    if (callStatus === 'ringing') {
      loadAndPlaySound(isIncoming ? SOUNDS.RINGTONE : SOUNDS.DIALING);
    } else {
      stopSound();
    }
    return () => { stopSound(); };
  }, [callStatus]);

  useEffect(() => {
    if (callStatus !== 'active') return;
    timerRef.current = setInterval(() => setDuration((prev: number) => prev + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  useEffect(() => {
    if (callStatus === 'ringing' && !isIncoming && currentCallId) {
      const timeout = setTimeout(() => {
        const convId = [currentUser!.uid, (userId as string)].sort().join('_');
        callService.registrarLlamadaPerdida(currentCallId, convId, currentUser!.uid, currentUser!.displayName || 'Usuario', currentUser!.photoURL);
        handleHangUp();
      }, 45000);
      return () => clearTimeout(timeout);
    }
  }, [callStatus, currentCallId]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      localStream.getVideoTracks().forEach((track: any) => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const initials = participantName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Stack.Screen options={{ headerShown: false }} />

      {callType === 'video' && callStatus !== 'error' && (
        <View style={styles.videoArea}>
          {remoteStream && (remoteStream as any).toURL ? (
            <RTCView streamURL={(remoteStream as any).toURL()} style={styles.remoteVideo} objectFit="cover" />
          ) : null}
          {localStream && (localStream as any).toURL && !isVideoOff && (
            <View style={styles.localVideoContainer}>
              <RTCView streamURL={(localStream as any).toURL()} style={styles.localVideo} objectFit="cover" zOrder={1} />
            </View>
          )}
        </View>
      )}

      {participantPhoto && (
        <Image source={{ uri: participantPhoto }} style={styles.bgPhoto} blurRadius={50} />
      )}
      <View style={styles.bgOverlay} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topSection}>
          <View style={styles.avatarWrapper}>
            <Animated.View style={[styles.pulseBg, { transform: [{ scale: pulseAnim }], opacity: pulseOpacity }]} />
            {participantPhoto ? (
              <Image source={{ uri: participantPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: avatarColor(userId as string) }]}>
                <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={styles.participantName}>{participantName}</ThemedText>
          {callStatus !== 'error' && (
            <ThemedText style={styles.statusText}>
              {callStatus === 'ringing'
                ? (isIncoming ? (t('dm.call.incoming') || 'Incoming') : (t('dm.call.calling') || 'Calling'))
                : formatDuration(duration)}
            </ThemedText>
          )}
        </View>

        {callStatus === 'error' && (
          <View style={styles.errorCard}>
            <View style={styles.errorIconRing}>
              <PhoneOff size={26} color="#FF6B6B" strokeWidth={2} />
            </View>
            <ThemedText style={styles.errorCardTitle}>
              {t('dm.call.not_available_title') || 'Not Available Title'}
            </ThemedText>
            <ThemedText style={styles.errorCardDesc}>
              {t('dm.call.not_available_desc') || 'Not Available Desc'}
            </ThemedText>
            <View style={styles.platformRow}>
              <View style={styles.platformBadge}>
                <ThemedText style={styles.platformBadgeText}>🌐 Web</ThemedText>
              </View>
              <View style={styles.platformBadge}>
                <ThemedText style={styles.platformBadgeText}>🖥 Desktop</ThemedText>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bottomSection}>
          {callStatus === 'active' && (
            <View style={styles.controlsGrid}>
              <ControlBtn
                icon={isMuted ? <MicOff size={24} color="#fff" strokeWidth={2} /> : <Mic size={24} color="#fff" strokeWidth={2} />}
                label={isMuted ? (t('dm.call.unmute') || 'Unmute') : (t('dm.call.mute') || 'Mute')}
                onPress={toggleMute}
                active={isMuted}
              />
              <ControlBtn
                icon={isDeaf ? <VolumeX size={24} color="#fff" strokeWidth={2} /> : <Volume2 size={24} color="#fff" strokeWidth={2} />}
                label={isDeaf ? (t('dm.call.listen') || 'Listen') : (t('dm.call.deafen') || 'Deafen')}
                onPress={() => setIsDeaf(v => !v)}
                active={isDeaf}
              />
              {callType === 'video' && (
                <ControlBtn
                  icon={isVideoOff ? <VideoOff size={24} color="#fff" strokeWidth={2} /> : <Video size={24} color="#fff" strokeWidth={2} />}
                  label={isVideoOff ? (t('dm.call.video_on') || 'Video On') : (t('dm.call.video_off') || 'Video Off')}
                  onPress={toggleVideo}
                  active={isVideoOff}
                />
              )}
              <ControlBtn
                icon={<MonitorUp size={24} color="#fff" strokeWidth={2} />}
                label={t('dm.call.screen_share') || 'Screen Share'}
                onPress={() => Alert.alert(t('common.coming_soon') || 'Coming Soon', t('dm.call.screen_share_soon') || 'Screen Share Soon')}
              />
            </View>
          )}

          <View style={styles.hangUpWrapper}>
            <TouchableOpacity style={[styles.hangUpBtn, { backgroundColor: colors.danger, shadowColor: colors.danger }]} onPress={() => handleHangUp()} activeOpacity={0.85}>
              <PhoneOff size={28} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <ThemedText style={styles.hangUpLabel}>
              {callStatus === 'error'
                ? (t('common.back') || 'Back')
                : callStatus === 'ringing'
                  ? (t('common.cancel') || 'Cancel')
                  : (t('dm.call.hang_up') || 'Hang Up')}
            </ThemedText>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a1a' },
  bgPhoto: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.3 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0a0a1e', opacity: 0.75 },
  videoArea: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  remoteVideo: { flex: 1 },
  localVideoContainer: { position: 'absolute', top: 50, right: 20, width: 120, height: 160, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  localVideo: { flex: 1 },
  videoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  videoPlaceholderText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },
  topSection: { alignItems: 'center', gap: 14 },
  avatarWrapper: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  pulseBg: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#fff' },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarFallback: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  avatarInitials: { fontSize: 36, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 44 },
  participantName: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center' },
  statusText: { fontSize: 16, color: 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'] },
  errorCard: {
    marginHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  errorIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorCardTitle: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  errorCardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22 },
  platformRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  platformBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  platformBadgeText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  unavailIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unavailTitle: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center' },
  unavailDesc: { fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 24 },
  unavailBackBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  unavailBackText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  bottomSection: { gap: 40, alignItems: 'center' },
  controlsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24, width: '100%' },
  controlWrapper: { alignItems: 'center', gap: 10, width: 72 },
  controlCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  controlCircleActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  controlLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  hangUpWrapper: { alignItems: 'center', gap: 10 },
  hangUpBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 },
  hangUpLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
});
