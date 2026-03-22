import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, Alert, StatusBar, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Mic, MicOff, Volume2, VolumeX, Video, VideoOff, MonitorUp, PhoneOff, Camera } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/hooks/useTranslation';
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
  if (!webRTCAvailable) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PhoneOff size={48} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
        <ThemedText style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
          Llamadas no disponibles
        </ThemedText>
        <ThemedText style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Esta función requiere un Development Build. No es compatible con Expo Go.
        </ThemedText>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>
          <ThemedText style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Volver</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }
  return <CallScreenInner />;
}

function CallScreenInner() {
  const { t } = useTranslation();
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
        // Mantener el mensaje de error unos segundos antes de volver
        setTimeout(() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/messages');
          }
        }, 3500);
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

      {callType === 'video' && (
        <View style={styles.videoArea}>
          {remoteStream && (remoteStream as any).toURL ? (
            <RTCView streamURL={(remoteStream as any).toURL()} style={styles.remoteVideo} objectFit="cover" />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Camera size={56} color="rgba(255,255,255,0.25)" strokeWidth={1.5} />
              <ThemedText style={styles.videoPlaceholderText}>{t('dm.call.waiting_video') || 'Esperando video remoto...'}</ThemedText>
            </View>
          )}

          {localStream && (localStream as any).toURL && !isVideoOff && (
            <View style={styles.localVideoContainer}>
              <RTCView streamURL={(localStream as any).toURL()} style={styles.localVideo} objectFit="cover" zOrder={1} />
            </View>
          )}
        </View>
      )}

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topSection}>
          <View style={styles.avatarWrapper}>
            <Animated.View style={[styles.pulseBg, { transform: [{ scale: pulseAnim }], opacity: pulseOpacity }]} />
            {participantPhoto ? (
              <Image source={{ uri: participantPhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={styles.participantName}>{participantName}</ThemedText>
          <ThemedText style={styles.statusText}>
            {callStatus === 'error' ? (t('dm.call.not_available_desc') || 'Las llamadas no están disponibles en móvil.') :
              callStatus === 'ringing' ? (isIncoming ? (t('dm.call.incoming') || 'Llamada entrante...') : (t('dm.call.calling') || 'Llamando...')) : formatDuration(duration)}
          </ThemedText>
        </View>

        <View style={styles.bottomSection}>
          {callStatus === 'active' && (
            <View style={styles.controlsGrid}>
              <ControlBtn
                icon={isMuted ? <MicOff size={24} color="#fff" strokeWidth={2} /> : <Mic size={24} color="#fff" strokeWidth={2} />}
                label={isMuted ? (t('dm.call.unmute') || 'Activar mic') : (t('dm.call.mute') || 'Silenciar')}
                onPress={toggleMute}
                active={isMuted}
              />
              <ControlBtn
                icon={isDeaf ? <VolumeX size={24} color="#fff" strokeWidth={2} /> : <Volume2 size={24} color="#fff" strokeWidth={2} />}
                label={isDeaf ? (t('dm.call.listen') || 'Escuchar') : (t('dm.call.deafen') || 'Ensordecer')}
                onPress={() => setIsDeaf(v => !v)}
                active={isDeaf}
              />
              {callType === 'video' && (
                <ControlBtn
                  icon={isVideoOff ? <VideoOff size={24} color="#fff" strokeWidth={2} /> : <Video size={24} color="#fff" strokeWidth={2} />}
                  label={isVideoOff ? (t('dm.call.video_on') || 'Activar cám.') : (t('dm.call.video_off') || 'Cámara')}
                  onPress={toggleVideo}
                  active={isVideoOff}
                />
              )}
              <ControlBtn
                icon={<MonitorUp size={24} color="#fff" strokeWidth={2} />}
                label={t('dm.call.screen_share') || "Pantalla"}
                onPress={() => Alert.alert(t('common.coming_soon') || 'Próximamente', t('dm.call.screen_share_soon') || 'Compartir pantalla estará disponible próximamente.')}
              />
            </View>
          )}

          <View style={styles.hangUpWrapper}>
            <TouchableOpacity style={styles.hangUpBtn} onPress={() => handleHangUp()} activeOpacity={0.85}>
              <PhoneOff size={28} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <ThemedText style={styles.hangUpLabel}>
              {callStatus === 'ringing' ? (t('common.cancel') || 'Cancelar') : (t('dm.call.hang_up') || 'Colgar')}
            </ThemedText>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a1a' },
  videoArea: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  remoteVideo: { flex: 1 },
  localVideoContainer: { position: 'absolute', top: 50, right: 20, width: 120, height: 160, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  localVideo: { flex: 1 },
  videoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  videoPlaceholderText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  topSection: { alignItems: 'center', gap: 14 },
  avatarWrapper: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  pulseBg: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#fff' },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarFallback: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#0A84FF', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarInitials: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  participantName: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center' },
  statusText: { fontSize: 16, color: 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'] },
  bottomSection: { gap: 40, alignItems: 'center' },
  controlsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24, width: '100%' },
  controlWrapper: { alignItems: 'center', gap: 10, width: 72 },
  controlCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  controlCircleActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  controlLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  hangUpWrapper: { alignItems: 'center', gap: 10 },
  hangUpBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 },
  hangUpLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
});
