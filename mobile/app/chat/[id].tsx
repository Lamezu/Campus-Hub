import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs } from 'firebase/firestore';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput } from '@/components/MessageInput';
import { colors, spacing } from '@/constants/styles';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { auth, db } from '@/config/firebase';
import type { Message } from '@/types';

const MESSAGES_PER_PAGE = 50;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const lastDocRef = useRef<any>(null);
  
  const channel = MOCK_CHANNELS.find(ch => ch.id === id);
  const channelName = channel?.name || `Channel ${id}`;
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!id) return;

    const messagesRef = collection(db, 'channels', id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGES_PER_PAGE));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messagesData: Message[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            senderId: data.senderId || '',
            senderName: data.senderName || 'Unknown',
            senderPhoto: data.senderPhoto || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            edited: data.edited || false,
            editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
            attachments: data.attachments || null,
            reactions: data.reactions || {}
          };
        }).reverse();

        setMessages(messagesData);
        setLoading(false);
        setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
        
        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        }

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      },
      (error) => {
        console.error('Error loading messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  const loadMoreMessages = async () => {
    if (!id || !hasMore || loadingMore || !lastDocRef.current) return;

    setLoadingMore(true);

    try {
      const messagesRef = collection(db, 'channels', id, 'messages');
      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(MESSAGES_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      
      const olderMessages: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text || '',
          senderId: data.senderId || '',
          senderName: data.senderName || 'Unknown',
          senderPhoto: data.senderPhoto || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          edited: data.edited || false,
          editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
          attachments: data.attachments || null,
          reactions: data.reactions || {}
        };
      }).reverse();

      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }

      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !id || sending) return;

    setSending(true);

    try {
      const messagesRef = collection(db, 'channels', id, 'messages');
      
      await addDoc(messagesRef, {
        text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        senderPhoto: currentUser.photoURL || null,
        createdAt: serverTimestamp(),
        edited: false,
        editedAt: null,
        attachments: null,
        reactions: {}
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: channelName, headerShown: true }} />
        <ThemedView style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>Cargando mensajes...</ThemedText>
        </ThemedView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: channelName, headerShown: true }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ThemedView style={styles.container}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <MessageBubble 
                message={item} 
                isOwnMessage={item.senderId === currentUser?.uid} 
              />
            )}
            contentContainerStyle={styles.messageList}
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              loadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>
                  No hay mensajes aún. ¡Comienza la conversación! 💬
                </ThemedText>
              </View>
            }
            inverted
          />
          <MessageInput onSend={handleSendMessage} disabled={sending} />
        </ThemedView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    padding: spacing.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    opacity: 0.5,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    opacity: 0.6,
  },
  loadingMoreContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});