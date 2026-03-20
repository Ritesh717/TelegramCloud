import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { useCloudMedia, CloudMedia } from '../../src/hooks/useCloudMedia';
import { THEME } from '../../src/theme/theme';
import { APP_CONSTANTS } from '../../src/constants/AppConstants';
import { formatFileSize } from '../../src/utils/formatters';
import { LucideCloud, LucideDownload, LucidePlayCircle, LucideImage } from 'lucide-react-native';

const COLUMN_COUNT = APP_CONSTANTS.UI.CLOUD.COLUMN_COUNT;

export default function CloudScreen() {
  const { media, loading, refreshing, refresh } = useCloudMedia();

  const renderItem = ({ item }: { item: CloudMedia }) => (
    <TouchableOpacity style={styles.itemContainer} activeOpacity={0.7}>
      <View style={styles.thumbnailContainer}>
        {item.media?.thumbnail ? (
          <Image 
            source={{ uri: item.media.thumbnail }} 
            style={styles.thumbnail} 
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderContainer}>
            {item.media?.type === 'video' ? (
              <LucidePlayCircle size={32} color={THEME.colors.textSecondary} />
            ) : (
              <LucideImage size={32} color={THEME.colors.textSecondary} />
            )}
          </View>
        )}
        
        {item.media?.type === 'video' && (
          <View style={styles.videoBadge}>
            <LucidePlayCircle size={12} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {item.media?.type || 'File'}
        </Text>
        <Text style={styles.fileSize}>
          {formatFileSize(item.media?.size || 0)}
        </Text>
      </View>
      <TouchableOpacity style={styles.downloadButton}>
        <LucideDownload size={16} color={THEME.colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <LucideCloud size={64} color={THEME.colors.border} />
      <Text style={styles.emptyText}>No files found in Telegram Cloud</Text>
      <Text style={styles.emptySubtext}>Files you upload will appear here</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Cloud Storage',
        headerStyle: { backgroundColor: THEME.colors.background },
        headerTintColor: THEME.colors.text,
        headerLargeTitle: true,
      }} />

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Fetching remote files...</Text>
        </View>
      ) : (
        <FlatList
          data={media}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={[
            styles.listContent,
            media.length === 0 && { flex: 1, justifyContent: 'center' }
          ]}
          refreshControl={
            <RefreshControl 
                refreshing={refreshing} 
                onRefresh={refresh} 
                tintColor={THEME.colors.primary}
            />
          }
          ListEmptyComponent={EmptyState}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: THEME.spacing.md,
    color: THEME.colors.textSecondary,
    fontSize: 16,
  },
  listContent: {
    padding: THEME.spacing.xs,
  },
  itemContainer: {
    flex: 1/COLUMN_COUNT,
    aspectRatio: 0.8,
    margin: THEME.spacing.xs,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  thumbnailContainer: {
    flex: 1,
    backgroundColor: THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 2,
  },
  itemInfo: {
    padding: 8,
  },
  fileName: {
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
  },
  downloadButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: THEME.colors.background,
    borderRadius: 12,
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.colors.text,
    marginTop: THEME.spacing.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
    textAlign: 'center',
  },
});
