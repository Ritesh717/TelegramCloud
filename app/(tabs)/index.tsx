import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, RefreshControl, StatusBar, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GalleryItem } from '../../src/components/GalleryItem';
import { DateHeader } from '../../src/components/DateHeader';
import { useMedia, MediaAsset } from '../../src/hooks/useMedia';
import { MediaViewer } from '../../src/components/MediaViewer';
import { THEME } from '../../src/theme/theme';
import { APP_CONSTANTS } from '../../src/constants/AppConstants';
import { UserCircle2, LayoutGrid } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { sections, loading, refresh } = useMedia();
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [columnCount, setColumnCount] = useState(APP_CONSTANTS.UI.GALLERY.DEFAULT_COLUMN_COUNT);

  const itemWidth = width / columnCount;

  // Flatten sections for FlashList
  const flattenedData = useMemo(() => {
    const data: (string | MediaAsset)[] = [];
    sections.forEach((section) => {
      data.push(section.title);
      data.push(...section.data);
    });
    return data;
  }, [sections]);

  const handleAssetPress = (asset: MediaAsset) => {
    setSelectedAsset(asset);
    setIsViewerVisible(true);
  };

  const handleDateSelect = (date: string) => {
    Alert.alert('Selection', `Select all items from ${date}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Select', onPress: () => console.log('Selected section:', date) }
    ]);
  };

  const toggleGrid = () => {
    setColumnCount(prev => 
      prev === APP_CONSTANTS.UI.GALLERY.DEFAULT_COLUMN_COUNT 
        ? APP_CONSTANTS.UI.GALLERY.MAX_COLUMN_COUNT 
        : APP_CONSTANTS.UI.GALLERY.DEFAULT_COLUMN_COUNT
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Telegram Cloud Style Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>
            <Text style={{color: THEME.colors.primary}}>Telegram</Text>
            <Text style={{color: THEME.colors.text}}> Cloud</Text>
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={toggleGrid}>
            <LayoutGrid size={22} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileButton}>
            <UserCircle2 size={28} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlashList
        data={flattenedData}
        keyExtractor={(item, index) => (typeof item === 'string' ? item : (item as MediaAsset).id) + index}
        renderItem={({ item }) => {
          if (typeof item === 'string') {
            return <DateHeader title={item} onSelect={() => handleDateSelect(item)} />;
          }
          return <GalleryItem asset={item as MediaAsset} onPress={handleAssetPress} itemWidth={itemWidth} />;
        }}
        getItemType={(item) => (typeof item === 'string' ? 'sectionHeader' : 'row')}
        estimatedItemSize={itemWidth}
        numColumns={columnCount}
        key={columnCount} // Force re-render on column change
        overrideItemLayout={(layout, item) => {
          if (typeof item === 'string') {
            layout.span = columnCount;
          }
        }}
        extraData={flattenedData}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={refresh} 
            tintColor={THEME.colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        stickyHeaderIndices={flattenedData.reduce((acc, current, index) => {
          if (typeof current === 'string') acc.push(index);
          return acc;
        }, [] as number[])}
      />

      <MediaViewer
        isVisible={isViewerVisible}
        asset={selectedAsset}
        onClose={() => setIsViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginRight: THEME.spacing.md,
  },
  profileButton: {
    padding: 2,
  },
  listContent: {
    paddingBottom: 100,
  },
});
