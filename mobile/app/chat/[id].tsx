import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity, Modal, ScrollView, StatusBar, ImageBackground, Image } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs, doc, getDoc } from 'firebase/firestore';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput } from '@/components/MessageInput';
import { spacing, chatThemes, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { auth, db } from '@/config/firebase';
import type { Message } from '@/types';
import { IconSymbol } from '@/components/ui/icon-symbol';

const MESSAGES_PER_PAGE = 50;

export default function ChatScreen() {
  const { colors, theme, chatSettings, setChatSettings } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const insets = useSafeAreaInsets();
  const [userProfile, setUserProfile] = useState<any>(null);

  const flatListRef = useRef<FlatList>(null);
  const lastDocRef = useRef<any>(null);

  const channel = MOCK_CHANNELS.find(ch => ch.id === id);
  const channelName = channel?.name || `Canal ${id}`;
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }
    const loadProfile = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadProfile();
  }, [currentUser]);

  useEffect(() => {
    if (!id) return;
    const messagesRef = collection(db, 'channels', id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGES_PER_PAGE));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text || '',
          senderId: data.senderId || '',
          senderName: data.senderName || 'Desconocido',
          senderPhoto: data.senderPhoto || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          edited: data.edited || false,
          editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
          attachments: data.attachments || null,
          reactions: data.reactions || {}
        };
      });
      setMessages(messagesData);
      setLoading(false);
      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  const loadMoreMessages = async () => {
    if (!id || !hasMore || loadingMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const messagesRef = collection(db, 'channels', id, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'), startAfter(lastDocRef.current), limit(MESSAGES_PER_PAGE));
      const snapshot = await getDocs(q);
      const olderMessages: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text || '',
          senderId: data.senderId || '',
          senderName: data.senderName || 'Desconocido',
          senderPhoto: data.senderPhoto || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          edited: data.edited || false,
          editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
          attachments: data.attachments || null,
          reactions: data.reactions || {}
        };
      });
      if (olderMessages.length > 0) {
        setMessages(prev => [...prev, ...olderMessages]);
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    try {
      const messagesRef = collection(db, 'channels', id, 'messages');
      const finalSenderName = userProfile?.displayName || currentUser.displayName || 'Usuario';
      await addDoc(messagesRef, {
        text,
        senderId: currentUser.uid,
        senderName: finalSenderName,
        senderPhoto: userProfile?.photoURL || currentUser.photoURL || null,
        createdAt: serverTimestamp(),
        edited: false,
        editedAt: null,
        attachments: null,
        reactions: {}
      });
    } catch (error) {
      console.error(error);
      alert('Error al enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const headerHeight = useHeaderHeight();

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: channelName, headerShown: true }} />
        <ThemedView style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>Cargando mensajes...</ThemedText>
        </ThemedView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />
      <Stack.Screen options={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        headerBackVisible: false,
        headerTitle: () => (
          <View style={{ paddingTop: Platform.OS === 'android' ? 30 : 0 }}>
            <ThemedText style={{ fontSize: typography.sizes.md, fontWeight: 'bold' }}>{channelName}</ThemedText>
          </View>
        ),
        headerLeft: () => (
          <View style={{ paddingTop: Platform.OS === 'android' ? 30 : 4, paddingLeft: spacing.xs }}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <IconSymbol name="chevron.left" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        ),
        headerRight: () => (
          <View style={{ paddingTop: Platform.OS === 'android' ? 30 : 4, paddingRight: spacing.xs }}>
            <TouchableOpacity onPress={() => setShowSettings(true)} style={{ padding: 4 }}>
              <IconSymbol name="gear" size={25} color={colors.text} />
            </TouchableOpacity>
          </View>
        )
      }} />

      <View style={[styles.container, { backgroundColor: colors.chat.background }]}>
        {colors.chat.backgroundImage && (
          <Image
            source={{ uri: colors.chat.backgroundImage }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        )}
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView
            style={styles.container}
            behavior="padding"
            keyboardVerticalOffset={headerHeight}
          >
            <View style={[styles.container, colors.chat.backgroundImage && { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <MessageBubble message={item} isOwnMessage={item.senderId === currentUser?.uid} />}
                contentContainerStyle={[styles.messageList, { paddingBottom: spacing.md }]}
                onEndReached={loadMoreMessages}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={loadingMore ? <View style={styles.loadingMoreContainer}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
                ListEmptyComponent={<View style={styles.emptyContainer}><ThemedText style={styles.emptyText}>No hay mensajes aún.</ThemedText></View>}
                inverted
              />
              <MessageInput onSend={handleSendMessage} disabled={sending} />
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.container, colors.chat.backgroundImage && { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <MessageBubble message={item} isOwnMessage={item.senderId === currentUser?.uid} />}
              contentContainerStyle={[styles.messageList, { paddingBottom: spacing.md }]}
              onEndReached={loadMoreMessages}
              onEndReachedThreshold={0.5}
              ListHeaderComponent={loadingMore ? <View style={styles.loadingMoreContainer}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
              ListEmptyComponent={<View style={styles.emptyContainer}><ThemedText style={styles.emptyText}>No hay mensajes aún.</ThemedText></View>}
              inverted
            />
            <MessageInput onSend={handleSendMessage} disabled={sending} />
          </View>
        )}
      </View>

      <Modal visible={showSettings} animationType="slide" transparent={true} onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <ThemedText style={styles.modalTitle}>Personalizar Chat</ThemedText>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>Hecho</ThemedText>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.settingsSection}>
                <ThemedText style={styles.settingsLabel}>Temas del Chat</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScrollContent}>
                  {Object.values(chatThemes).map((t) => (
                    <TouchableOpacity key={t.id} style={[styles.themeItem, { borderColor: chatSettings.themeId === t.id ? colors.primary : colors.border }]} onPress={() => setChatSettings({ themeId: t.id })}>
                      <View style={[styles.themePreview, { backgroundColor: t.background === 'transparent' ? colors.background : t.background, overflow: 'hidden' }]}>
                        {t.backgroundImage && <Image source={{ uri: t.backgroundImage }} style={StyleSheet.absoluteFill} />}
                        <View style={[styles.bubblePreview, { backgroundColor: t.bubbleOwn, alignSelf: 'flex-end', opacity: 0.9 }]} />
                        <View style={[styles.bubblePreview, { backgroundColor: t.bubbleOther, alignSelf: 'flex-start', opacity: 0.9 }]} />
                      </View>
                      <ThemedText style={[styles.themeName, chatSettings.themeId === t.id && { color: colors.primary }]}>{t.name}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.settingsSection}>
                <ThemedText style={styles.settingsLabel}>Tamaño de Letra ({chatSettings.fontSize}px)</ThemedText>
                <View style={styles.row}>
                  {[12, 14, 16, 18, 20].map(size => (
                    <TouchableOpacity key={size} style={[styles.sizeButton, { borderColor: colors.border }, chatSettings.fontSize === size && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setChatSettings({ fontSize: size })}>
                      <ThemedText style={{ color: chatSettings.fontSize === size ? '#FFF' : colors.text }}>{size}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.settingsSection}>
                <ThemedText style={styles.settingsLabel}>Estilo de Letra</ThemedText>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.styleButton, { borderColor: colors.border }, chatSettings.fontWeight === 'bold' && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setChatSettings({ fontWeight: chatSettings.fontWeight === 'bold' ? '400' : 'bold' })}>
                    <ThemedText style={[chatSettings.fontWeight === 'bold' && { color: '#FFF' }]}>Negrita</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.styleButton, { borderColor: colors.border, marginLeft: spacing.sm }, chatSettings.fontStyle === 'italic' && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setChatSettings({ fontStyle: chatSettings.fontStyle === 'italic' ? 'normal' : 'italic' })}>
                    <ThemedText style={[chatSettings.fontStyle === 'italic' && { color: '#FFF' }]}>Cursiva</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  messageList: { padding: spacing.md, flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyText: { opacity: 0.5, textAlign: 'center' },
  loadingText: { marginTop: spacing.md, opacity: 0.6 },
  loadingMoreContainer: { paddingVertical: spacing.md, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1 },
  modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  modalBody: { marginTop: spacing.lg },
  settingsSection: { marginBottom: spacing.xl },
  settingsLabel: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, marginBottom: spacing.md },
  themeScrollContent: { paddingRight: spacing.xl, gap: spacing.md },
  themeItem: { width: 100, padding: spacing.sm, borderRadius: 16, borderWidth: 2, alignItems: 'center' },
  themePreview: { width: '100%', height: 80, borderRadius: 12, padding: 8, justifyContent: 'center', gap: 6, marginBottom: 8 },
  bubblePreview: { width: '80%', height: 14, borderRadius: 7 },
  themeName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  sizeButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  styleButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 18, borderWidth: 1 }
});
