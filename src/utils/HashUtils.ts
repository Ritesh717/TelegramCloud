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

    // For large files (>5MB), reading the whole file into JS memory (Base64) 
    // will crash the app. We use a Sample Fingerprint: Start + Middle + End + Size.
    if (fileSize >= SMALL_FILE_THRESHOLD) {
      const sampleSize = 64 * 1024; // 64KB samples
      const middleOffset = Math.max(0, Math.floor(fileSize / 2) - Math.floor(sampleSize / 2));
      const endOffset = Math.max(0, fileSize - sampleSize);

      const [start, middle, end] = await Promise.all([
        FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64, length: sampleSize, position: 0 }),
        FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64, length: sampleSize, position: middleOffset }),
        FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64, length: sampleSize, position: endOffset }),
      ]);

      const fingerprint = `${fileSize}|${start}|${middle}|${end}`;
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fingerprint);
    }

    // For small files (<5MB), read the full content for a perfect hash
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
