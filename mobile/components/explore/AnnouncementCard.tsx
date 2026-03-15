import React from 'react';
import { View, TouchableOpacity, Alert, StyleSheet, Image } from 'react-native';
import { imageOffsetStyle } from '../ImagePanPicker';
import { MoreVertical, Pin, CalendarDays } from 'lucide-react-native';
import { ThemedText } from '../themed-text';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, typography } from '../../constants/styles';
import { getCategoryConfig } from '../../constants/announcementCategories';
import type { Post } from '../../types';

interface AnnouncementCardProps {
  post: Post;
  onPress: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  onPublishSocial?: () => void;
  highlighted?: boolean;
}

function getDateLabel(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AnnouncementCard({
  post, onPress, onEdit, onPin, onDelete, onPublishSocial, highlighted,
}: AnnouncementCardProps) {
  const { colors } = useTheme();
  const hasOptions = !!(onEdit || onPin || onDelete);
  const category = getCategoryConfig(post.category);

  const handleOptions = (e: any) => {
    e.stopPropagation();
    const options: any[] = [];
    if (onEdit) options.push({ text: 'Editar anuncio', onPress: onEdit });
    if (onPin) options.push({ text: post.pinned ? 'Desfijar' : 'Fijar en el tablón', onPress: onPin });
    if (onPublishSocial && !post.socialId) options.push({ text: 'Publicar como post', onPress: onPublishSocial });
    if (onDelete) options.push({ text: 'Eliminar anuncio', style: 'destructive', onPress: onDelete });
    options.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Opciones', undefined, options);
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: highlighted ? colors.primary : colors.border },
        highlighted && { borderWidth: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {post.imageUrl ? (
        <View style={styles.headerImage}>
          <Image source={{ uri: post.imageUrl }} style={imageOffsetStyle(post.imageOffsetY, 160)} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.headerPlaceholder, { backgroundColor: category.color + '18' }]}>
          <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.categoryChip, { backgroundColor: category.color + '18' }]}>
            <ThemedText style={[styles.categoryChipText, { color: category.color }]}>
              {category.label.toUpperCase()}
            </ThemedText>
          </View>
          <View style={styles.topRowRight}>
            {post.pinned && (
              <Pin size={13} color={colors.primary} strokeWidth={2} />
            )}
            {post.linkedEventId && (
              <CalendarDays size={13} color={colors.textSecondary} strokeWidth={2} />
            )}
            {hasOptions && (
              <TouchableOpacity onPress={handleOptions} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MoreVertical size={17} color={colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {post.title}
        </ThemedText>

        <ThemedText style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
          {post.content}
        </ThemedText>

        <View style={styles.footer}>
          <ThemedText style={[styles.date, { color: colors.textSecondary }]}>
            {getDateLabel(post.createdAt)}
          </ThemedText>
          <ThemedText style={[styles.author, { color: colors.textSecondary }]}>
            {post.authorName}
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  headerImage: {
    width: '100%',
    height: 160,
    overflow: 'hidden',
  },
  headerPlaceholder: {
    width: '100%',
    height: 6,
  },
  categoryDot: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  body: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  topRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    lineHeight: 22,
  },
  preview: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  date: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
  author: {
    fontSize: typography.sizes.xs,
  },
});
