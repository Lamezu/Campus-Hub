import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard } from '@/components/PostCard';
import { spacing, typography } from '@/constants/styles';
import type { Post } from '@/types';

export default function ExploreScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Post[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
        } as Post;
      });
      setPosts(data);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to posts:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleDoubleTap = async (postId: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'posts', postId), {
        likes: arrayUnion(currentUser.uid),
        likesCount: increment(1),
      });
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const navigateToPost = (postId: string) => {
    navigate(`/post/${postId}`);
  };

  return (
    <ThemedView style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: spacing.md,
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
      }}>
        <ThemedText style={{ fontSize: typography.sizes.xl, fontWeight: 'bold', color: colors.text }}>
          Explorar
        </ThemedText>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: 40, height: 40,
            border: `3px solid ${colors.backgroundSecondary}`,
            borderTop: `3px solid ${colors.primary}`,
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: spacing.sm,
        }}>
          {posts.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: spacing.xl, textAlign: 'center', height: '100%',
            }}>
              <ThemedText style={{ fontSize: typography.sizes.md, color: colors.textSecondary, lineHeight: '24px' }}>
                No hay posts todavía.<br />¡Sé el primero en publicar!
              </ThemedText>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPress={() => navigateToPost(post.id)}
                onDoubleTap={() => handleDoubleTap(post.id)}
                currentUserId={currentUser?.uid}
              />
            ))
          )}
        </div>
      )}
    </ThemedView>
  );
}
