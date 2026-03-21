import { useState, useCallback, useRef, useEffect } from 'react'
import * as MediaLibrary from 'expo-media-library'
import * as FileSystem from 'expo-file-system'

import { dbService } from '../api/Database'
import { computeFileHash } from '../utils/HashUtils'
import { APP_CONSTANTS } from '../constants/AppConstants'

export interface PendingAsset extends MediaLibrary.Asset {
  fileSize: number
}

export interface FetchOptions {
  mediaType?: MediaLibrary.MediaTypeValue[]
  sizeFilter?: 'all' | 'small' | 'large'
  limit?: number
  deepScan?: boolean
}

const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024
const PROGRESS_UPDATE_INTERVAL = 200
const CPU_YIELD_INTERVAL = 100
const MAX_MEMORY_ITEMS = 500
const HASH_CONCURRENCY = 3

export function usePendingUploads() {
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(true)

  const [scanProgress, setScanProgress] = useState<number | undefined>()
  const [scanStatus, setScanStatus] = useState<string>('')

  const [totalPending, setTotalPending] = useState(0)

  const lastCursor = useRef<string | undefined>()
  const loadingRef = useRef(false)
  const cancelRef = useRef(false)

  useEffect(() => {
    return () => {
      cancelRef.current = true
    }
  }, [])

  const safeSetState = (fn: () => void) => {
    if (!cancelRef.current) fn()
  }

  const yieldToUI = async () => {
    await new Promise(res => setTimeout(res, 0))
  }

  const passesSizeFilter = (size: number, filter: FetchOptions['sizeFilter']) => {
    if (filter === 'small') return size < LARGE_FILE_THRESHOLD
    if (filter === 'large') return size >= LARGE_FILE_THRESHOLD
    return true
  }

  const processDeepScanBatch = async (
    assets: MediaLibrary.Asset[],
    processedRef: { value: number },
    total: number
  ) => {
    const ids = assets.map(a => a.id)

    const recordedSet = await dbService.batchCheckUploads(ids)

    const toHash = assets.filter(a => !recordedSet.has(a.id))

    // Use a synchronous queue to avoid race conditions between workers
    const queue: MediaLibrary.Asset[] = [...toHash];
    const results: Array<{ asset: MediaLibrary.Asset; hash: string | null }> = [];

    const worker = async () => {
      while (true) {
        const asset = queue.shift();
        if (!asset) break;

        try {
          const hash = await computeFileHash(asset.uri);
          const exists = await dbService.isFileUploaded(hash);

          if (exists) {
            await dbService.recordUpload(asset.id, hash, 0, 'remapped');
          }
          results.push({ asset, hash });
        } catch {}
      }
    };

    await Promise.all(Array.from({ length: HASH_CONCURRENCY }, () => worker()))

    processedRef.value += assets.length

    if (processedRef.value % PROGRESS_UPDATE_INTERVAL === 0) {
      safeSetState(() => {
        setScanProgress((processedRef.value / total) * 100)
        setScanStatus(`Scanning ${processedRef.value} / ${total}`)
      })
    }
  }

  const performDeepScan = async (mediaType: MediaLibrary.MediaTypeValue[]) => {
    safeSetState(() => {
      setScanProgress(0)
      setScanStatus('Scanning library...')
    })

    const first = await MediaLibrary.getAssetsAsync({ mediaType, first: 1 })
    const total = first.totalCount

    let after: string | undefined
    let hasNext = true

    const processedRef = { value: 0 }

    while (hasNext && !cancelRef.current) {
      const result = await MediaLibrary.getAssetsAsync({
        first: APP_CONSTANTS.SYNC.SCAN_BATCH_SIZE,
        after,
        mediaType
      })

      if (result.assets.length === 0) break

      await processDeepScanBatch(result.assets, processedRef, total)

      after = result.endCursor
      hasNext = result.hasNextPage

      if (processedRef.value % CPU_YIELD_INTERVAL === 0) {
        await yieldToUI()
      }
    }

    safeSetState(() => {
      setScanProgress(undefined)
      setScanStatus('')
    })

    lastCursor.current = undefined
  }

  const fetchPending = useCallback(
    async (options: FetchOptions = {}, reset = false) => {
      if (loadingRef.current) return

      loadingRef.current = true
      safeSetState(() => setLoading(true))

      try {
        const {
          mediaType = [
            MediaLibrary.MediaType.photo,
            MediaLibrary.MediaType.video
          ],
          sizeFilter = 'all',
          limit = APP_CONSTANTS.UI.LISTS.PAGE_SIZE,
          deepScan = false
        } = options

        if (reset) {
          lastCursor.current = undefined
          safeSetState(() => {
            setPendingAssets([])
            setHasNextPage(true)
          })
        }

        if (deepScan) {
          await performDeepScan(mediaType)
        }

        const newPending: PendingAsset[] = []

        let after = lastCursor.current

        while (newPending.length < limit && !cancelRef.current) {
          const result: MediaLibrary.PagedInfo<MediaLibrary.Asset> = await MediaLibrary.getAssetsAsync({
            first: Math.max(limit, APP_CONSTANTS.SYNC.SCAN_BATCH_SIZE || 50),
            after,
            mediaType,
            sortBy: [[MediaLibrary.SortBy.creationTime, false] as any]
          })

          if (result.assets.length === 0) {
            safeSetState(() => setHasNextPage(false))
            break
          }

          const ids = result.assets.map(a => a.id)
          const uploadedSet = await dbService.batchCheckUploads(ids)

          for (const asset of result.assets) {
            if (!uploadedSet.has(asset.id)) {
              // Note: fileSize is usually present on Android, but FileSystem.getInfoAsync is an expensive fallback.
              let size = 0;
              if ((asset as any).fileSize != null) {
                size = (asset as any).fileSize;
              } else {
                const info = await FileSystem.getInfoAsync(asset.uri);
                if (info.exists) size = info.size;
              }

              if (size === 0 || !passesSizeFilter(size, sizeFilter)) continue;

              newPending.push({
                ...asset,
                fileSize: size
              })
            }
          }

          after = result.endCursor

          if (!result.hasNextPage) {
            safeSetState(() => setHasNextPage(false))
            break
          }
        }

        lastCursor.current = after

        safeSetState(() => {
          setPendingAssets(prev => {
            const merged =
              reset || options.deepScan
                ? newPending
                : [...prev, ...newPending]

            return merged.slice(-MAX_MEMORY_ITEMS)
          })
        })

        if (reset || options.deepScan) {
          fetchTotalPending(mediaType)
        }
      } catch (e) {
        console.error('[PendingUploads] fetch error', e)
      } finally {
        loadingRef.current = false
        safeSetState(() => setLoading(false))
      }
    },
    []
  )

  const fetchTotalPending = useCallback(
    async (mediaType: MediaLibrary.MediaTypeValue[]) => {
      try {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType,
          first: 1
        })

        const totalLibrary = result.totalCount
        const synced = await dbService.getSyncedCount()

        safeSetState(() => {
          setTotalPending(Math.max(0, totalLibrary - synced))
        })
      } catch {}
    },
    []
  )

  return {
    pendingAssets,
    loading,
    hasNextPage,
    fetchPending,
    scanProgress,
    scanStatus,
    totalPending
  }
}