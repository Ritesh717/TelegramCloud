import { Image } from "expo-image";
import { Cloud, Play } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MediaAsset } from "../hooks/useMedia";
import { THEME } from "../theme/theme";

interface GalleryItemProps {
  asset: MediaAsset;
  onPress: (asset: MediaAsset) => void;
  itemWidth: number;
}

export const GalleryItem = React.memo(
  ({ asset, onPress, itemWidth }: GalleryItemProps) => {
    return (
      <Pressable
        onPress={() => onPress(asset)}
        style={[
          styles.container,
          { width: itemWidth, height: itemWidth * 1.05 },
        ]}
      >
        <Image
          source={{ uri: asset.uri }}
          style={styles.image}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={asset.id}
        />

        {asset.isUploaded ? (
          <View style={styles.uploadedBadge}>
            <Cloud
              size={12}
              color={THEME.colors.primary}
              fill={THEME.colors.primary}
            />
          </View>
        ) : null}

        {asset.mediaType === "video" ? (
          <View style={styles.videoBadge}>
            <Play
              size={12}
              color={THEME.colors.white}
              fill={THEME.colors.white}
            />
          </View>
        ) : null}
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  image: {
    flex: 1,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: "transparent",
  },
  uploadedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: THEME.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  videoBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 22,
    height: 22,
    borderRadius: THEME.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(32,33,36,0.62)",
  },
});
