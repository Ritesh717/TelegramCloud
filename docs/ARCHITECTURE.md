# TelegramCloud Architecture

## Layers

1. UI layer
Screens in `app/` render local state only and trigger actions through hooks.

2. Sync and queue layer
Hooks in `src/hooks/` own backup, queueing, retry, cancel, and restore flows.

3. Index layer
`src/api/Database.ts` stores uploaded-file dedup records, the local cloud media index, upload queue state, and sync checkpoints.

4. Telegram adapter layer
`src/api/TelegramClient.ts` talks to the backend, while `backend/src/services/telegram.service.ts` owns MTProto session handling and file transfer.

5. Storage and cache layer
SQLite is the single source of truth for upload history, indexed cloud media, and resumable queue state.

## Data Flow

1. Device media is enumerated with `expo-media-library`.
2. `usePendingUploads` filters candidates against the local SQLite dedup/index tables.
3. `useSyncQueue` persists selected uploads into `upload_queue` before work starts.
4. Each upload computes a stable hash, checks dedup state, and uploads through the backend.
5. Successful uploads write to `uploaded_files` and update the local `media_index`.
6. `useCloudMedia` hydrates the gallery from `media_index` first, then refreshes from Telegram and updates the checkpoint.

## Boundaries

- UI screens should not scan Telegram history directly.
- Duplicate detection should always go through the database layer.
- Retry logic and queue persistence should stay out of screens.
- Backend secrets and session material must come from environment variables or encrypted storage, not committed constants or plaintext files.
