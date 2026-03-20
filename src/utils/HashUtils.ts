import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

const SMALL_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB

/**
 * Computes a hash for deduplication.
 * Optimizes memory and CPU by using:
 * 1. Metadata fingerprint for large files (>5MB)
 * 2. Content hashing for small files (<5MB)
 * TODO: Future - implement native chunked hashing if available.
 */
export async function computeFileHash(fileUri: string): Promise<string> {
  let fallbackFingerprint = fileUri;
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri, { size: true });
    
    if (!fileInfo.exists) {
      throw new Error(`File does not exist: ${fileUri}`);
    }

    const fileSize = (fileInfo as any).size || 0;
    fallbackFingerprint = `${fileUri}|${fileSize}|${(fileInfo as any).modificationTime || 0}`;

    // For large files, content hashing is too slow/memory intensive on mobile
    // A metadata fingerprint (URI + size + modTime) is extremely reliable for local deduplication
    if (fileSize >= SMALL_FILE_THRESHOLD) {
        const metaString = `${fileUri}|${fileSize}|${(fileInfo as any).modificationTime || 0}`;
        return await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          metaString
        );
    }

    // For small files, read content (Base64 is unavoidable with current EXPO FS, but small enough here)
    const content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      content
    );
  } catch (error) {
    console.error('[HashUtils] Error computing hash:', error);
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      fallbackFingerprint
    );
  }
}
