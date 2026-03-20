#!/usr/bin/env bash
set -euo pipefail

REPO="Ritesh717/TelegramCloud"

command -v gh >/dev/null 2>&1 || {
  echo "GitHub CLI (gh) is not installed."
  exit 1
}

create_issue() {
  local title="$1"
  local labels="$2"
  local body_file
  body_file="$(mktemp)"

  cat > "$body_file"

  local cmd=(gh issue create --repo "$REPO" --title "$title" --body-file "$body_file")
  IFS=',' read -ra label_arr <<< "$labels"
  for label in "${label_arr[@]}"; do
    if [[ -n "${label// }" ]]; then
      cmd+=(--label "$label")
    fi
  done

  echo "Creating issue: $title"
  "${cmd[@]}"

  rm -f "$body_file"
  echo
}

create_issue "Define a proper Google Photos-style architecture for TelegramCloud" "architecture,enhancement" <<'EOF'
Problem:
The app needs a clear product architecture before more features are added. Right now the solution should behave like a Google Photos-style media vault backed by Telegram, but there is no clearly enforced separation between UI, sync, indexing, storage, and playback responsibilities.

Why this matters:
Without a defined architecture, every new feature will increase complexity, slow down gallery loading, and make debugging harder. Large media apps fail when indexing and gallery rendering are mixed together.

Recommended solution:
- Split the app into clear layers:
  - UI layer
  - sync layer
  - indexing layer
  - storage/cache layer
  - Telegram adapter layer
- Define a single source of truth for media metadata.
- Avoid scanning Telegram history directly from the UI.
- Make upload, download, search, and gallery rendering consume the same indexed data model.

Acceptance criteria:
- Architecture document added
- Data flow documented
- Clear module boundaries implemented
- No direct Telegram history scan from UI screens
EOF

create_issue "Store Telegram login/session data securely" "security,bug" <<'EOF'
Problem:
Telegram credentials, session files, API ID, and API hash must not be stored insecurely or in plain text.

Why this matters:
Any secret leakage can compromise the Telegram account and the entire cloud storage store.

Recommended solution:
- Encrypt sensitive data at rest.
- Use secure storage on mobile for tokens/session material.
- Never log API secrets or session strings.
- Add expiration and re-authentication handling.

Acceptance criteria:
- Credentials are not stored in plain text
- Logs never contain secrets
- Session handling is encrypted or secured by platform storage
- Re-auth flow exists
EOF

create_issue "Build a local media index database for fast gallery loading" "performance,enhancement" <<'EOF'
Problem:
Gallery screens should not query Telegram repeatedly for every render. A local index is needed for fast search, filtering, and timeline grouping.

Why this matters:
A Google Photos-style app becomes unusable if it has to re-read Telegram messages every time the user opens the gallery.

Recommended solution:
- Add a local database such as SQLite/Realm/WatermelonDB.
- Store:
  - message_id
  - file_id
  - file_name
  - media_type
  - size
  - created_at
  - thumbnail path
  - hash/dedup key
  - caption/tags
- Update the index incrementally during sync.

Acceptance criteria:
- Gallery opens from local DB
- Search and sort use local DB
- Telegram scan is incremental, not full-rescan every time
EOF

create_issue "Remove repeated Telegram history scans" "performance,bug" <<'EOF'
Problem:
Repeatedly scanning Telegram dialogs or message history is expensive and will slow down the app as the media library grows.

Why this matters:
History scanning becomes a major bottleneck once the user stores thousands of photos/videos.

Recommended solution:
- Cache channel and folder identifiers.
- Persist sync checkpoints.
- Fetch only messages newer than the last sync timestamp or message id.
- Avoid re-iterating dialogs on every app launch.

Acceptance criteria:
- Sync resumes from last checkpoint
- Full scan is not repeated unnecessarily
- Startup time improves noticeably
EOF

create_issue "Implement duplicate file detection before upload" "performance,enhancement,bug" <<'EOF'
Problem:
The app needs to prevent uploading the same file multiple times.

Why this matters:
Duplicate uploads waste Telegram storage, increase sync time, and make the gallery messy.

Recommended solution:
- Compute a stable file hash before upload.
- Check the hash against the local index.
- Consider file size + hash + media duration for stronger matching.
- Allow a configurable duplicate policy:
  - block duplicate
  - warn and continue
  - store as separate copy

Acceptance criteria:
- Duplicate uploads are detected
- User gets a clear duplicate warning
- Index stores dedup metadata
EOF

create_issue "Add resumable upload queue with retry and backoff" "performance,enhancement,architecture" <<'EOF'
Problem:
Uploads should not fail permanently because of one network hiccup or temporary Telegram error.

Why this matters:
Large photos and videos are common. Users expect uploads to continue reliably.

Recommended solution:
- Add a queue-based uploader.
- Persist queue state locally.
- Retry transient failures with exponential backoff.
- Resume partially completed work when possible.
- Expose upload state in UI.

Acceptance criteria:
- Uploads survive app restart
- Failed items retry automatically
- Queue state is visible to the user
EOF

create_issue "Show upload and download progress with cancel controls" "ui,ux,enhancement" <<'EOF'
Problem:
The app needs clear progress feedback for long-running media transfers.

Why this matters:
Users cannot trust the app if they do not know whether upload or download is active.

Recommended solution:
- Add percent progress
- Add speed and ETA display
- Add cancel and retry actions
- Show per-file and batch progress
- Preserve progress state after app refresh

Acceptance criteria:
- Progress is visible during transfer
- User can cancel and retry
- Batch transfers are understandable
EOF

create_issue "Support background camera backup" "feature,enhancement,architecture" <<'EOF'
Problem:
A Google Photos-style app should automatically back up new images and videos from device storage.

Why this matters:
Manual uploads will not scale for daily use.

Recommended solution:
- Watch camera folders
- Detect new media after capture/download
- Queue uploads in background
- Respect battery and network preferences
- Provide pause/resume for sync

Acceptance criteria:
- New media can be backed up automatically
- Background sync has user controls
- Duplicate backups are avoided
EOF

create_issue "Plan and implement large file upload support" "feature,performance,telegram-api" <<'EOF'
Problem:
Large videos need special handling. Uploading them with a naive single-path approach can fail or become too slow.

Why this matters:
The app is meant to act like cloud storage, so large video support is a core requirement.

Recommended solution:
- Detect large files early.
- Show upload strategy based on size.
- Use Telegram-compatible large file handling.
- Avoid blocking the UI while processing.
- Support resume/retry semantics.

Acceptance criteria:
- Large file uploads are handled reliably
- User sees clear size limits and progress
- App does not freeze during large uploads
EOF

create_issue "Generate and cache thumbnails for gallery items" "performance,ui,enhancement" <<'EOF'
Problem:
The gallery should not render full-size images or video frames in list views.

Why this matters:
Without thumbnails, scrolling becomes slow and memory usage spikes.

Recommended solution:
- Create thumbnails during upload or sync.
- Store them locally.
- Use thumbnails in list/grid views.
- Generate video poster frames.
- Invalidate cache when media changes.

Acceptance criteria:
- Gallery uses thumbnails
- Memory usage is reduced
- Scrolling is smoother
EOF

create_issue "Virtualize the gallery list/grid rendering" "performance,ui,bug" <<'EOF'
Problem:
Rendering all media items at once will hurt performance and may crash the app for large libraries.

Why this matters:
A photo library can easily reach thousands of items.

Recommended solution:
- Use list virtualization.
- Render only visible items.
- Prefer optimized list components for long feeds.
- Avoid heavy work in render functions.

Acceptance criteria:
- Large libraries still scroll smoothly
- Only visible rows are rendered
- Memory footprint is reduced
EOF

create_issue "Implement timeline grouping by date" "feature,ui,ux" <<'EOF'
Problem:
The gallery should be organized like Google Photos with meaningful date grouping.

Why this matters:
A flat grid makes it hard to browse large libraries.

Recommended solution:
- Group media by day/month/year.
- Support sticky date headers.
- Sort by creation time, upload time, or file modified time.
- Make grouping configurable.

Acceptance criteria:
- Timeline groups exist
- Sorting works consistently
- Headers remain readable while scrolling
EOF

create_issue "Add search by filename, caption, date, and tags" "feature,performance,ux" <<'EOF'
Problem:
Users need fast search over their stored media.

Why this matters:
A cloud photo app becomes useless if content cannot be found quickly.

Recommended solution:
- Search indexed metadata locally.
- Support text search on file name and caption.
- Add date-based filters.
- Add tag filtering.
- Add search debounce and result caching.

Acceptance criteria:
- Search is fast
- Search works without remote scanning
- Filters can be combined
EOF

create_issue "Extract and store media metadata during upload" "enhancement,performance" <<'EOF'
Problem:
The app should extract useful metadata from images/videos rather than treating all files as plain blobs.

Why this matters:
Metadata enables search, sorting, and Google Photos-style organization.

Recommended solution:
- Extract EXIF data
- Store dimensions, duration, orientation, date taken, location, camera info where available
- Normalize metadata into the local DB
- Use metadata to power UI grouping

Acceptance criteria:
- Metadata is persisted
- Metadata powers search and sorting
- Missing metadata is handled gracefully
EOF

create_issue "Add offline cache for recently viewed media" "feature,performance,ux" <<'EOF'
Problem:
Users should still be able to view recently opened items when network access is poor.

Why this matters:
Cloud-first apps need a sensible offline experience.

Recommended solution:
- Cache recent thumbnails and full media when user opens items
- Provide a clear offline indicator
- Let users control cache size
- Evict old data using LRU policy

Acceptance criteria:
- Recently viewed items open offline if cached
- Cache size is configurable
- Old cache is evicted automatically
EOF

create_issue "Improve loading, empty, and error states across the app" "ui,ux,bug" <<'EOF'
Problem:
Screens should not appear blank or confusing while data loads or when errors happen.

Why this matters:
The user experience feels incomplete if the app shows no feedback.

Recommended solution:
- Add skeleton loaders
- Add empty states with clear action prompts
- Add descriptive error views
- Add retry buttons
- Avoid silent failures

Acceptance criteria:
- Every major screen has loading/empty/error states
- Errors are understandable
- Retry flows exist
EOF

create_issue "Clean up navigation and information architecture" "ux,architecture,enhancement" <<'EOF'
Problem:
The app should have a clear navigation model for gallery, upload, search, settings, and storage management.

Why this matters:
Confusing navigation hurts discoverability and makes the app feel unfinished.

Recommended solution:
- Define the main app sections clearly
- Reduce deep nesting where possible
- Separate content browsing from settings and sync controls
- Make the active section obvious

Acceptance criteria:
- Navigation is consistent
- Key features are reachable in few taps
- Screen roles are clear
EOF

create_issue "Add a full settings screen for sync, data, and quality controls" "feature,ui,ux" <<'EOF'
Problem:
Users need control over backup behavior, network usage, media quality, and cache settings.

Why this matters:
A storage app without controls creates trust and cost issues.

Recommended solution:
- Add settings for:
  - auto backup
  - Wi-Fi only sync
  - video upload quality
  - cache size
  - duplicate handling
  - download over mobile data
  - background sync

Acceptance criteria:
- Settings screen exists
- Important sync options are editable
- Settings persist correctly
EOF

create_issue "Add multi-select actions for share, delete, move, and download" "feature,ui,ux" <<'EOF'
Problem:
A media library needs batch actions, not just single-item interactions.

Why this matters:
Users will manage large groups of photos and videos.

Recommended solution:
- Add multi-select mode
- Provide bulk actions
- Show selected count
- Support select all / clear selection
- Confirm destructive actions

Acceptance criteria:
- Batch actions work
- Selection state is obvious
- Destructive actions are confirmed
EOF

create_issue "Add a dedicated media detail screen" "feature,ui,ux" <<'EOF'
Problem:
The app needs a detailed view for each photo/video instead of only a grid or list.

Why this matters:
Users should be able to inspect metadata, preview, and manage one item at a time.

Recommended solution:
- Show preview
- Show metadata
- Show upload date
- Show file size
- Show caption/tags
- Show actions like download, share, delete, open location

Acceptance criteria:
- Media detail screen exists
- Metadata is visible
- Actions are available
EOF

create_issue "Handle Telegram rate limits and FloodWait errors gracefully" "bug,telegram-api,performance" <<'EOF'
Problem:
Telegram will rate-limit aggressive operations if requests are too frequent.

Why this matters:
Ignoring rate limits leads to broken sync and failed uploads.

Recommended solution:
- Catch Telegram flood wait style errors
- Delay and retry with backoff
- Show user-friendly wait messages
- Avoid parallel request bursts without control

Acceptance criteria:
- Rate-limit errors do not crash the app
- Retry strategy is implemented
- UI explains delays clearly
EOF

create_issue "Add proper logging and crash diagnostics" "bug,architecture,enhancement" <<'EOF'
Problem:
The app needs meaningful logs for debugging sync, upload, and gallery issues.

Why this matters:
Without structured logging, production issues are hard to diagnose.

Recommended solution:
- Add log levels
- Include context like file id, message id, screen name, and sync checkpoint
- Avoid logging secrets
- Add crash/error capture for unrecoverable failures

Acceptance criteria:
- Logs are structured
- Sensitive information is excluded
- Errors can be traced to a feature and file
EOF

create_issue "Add automated tests for upload, sync, and gallery flows" "testing,enhancement" <<'EOF'
Problem:
Core flows need test coverage to prevent regressions.

Why this matters:
Media apps often break in subtle ways when sync, render, or upload logic changes.

Recommended solution:
- Add unit tests for indexing and dedup logic
- Add integration tests for upload and gallery state
- Add regression tests for known bugs
- Mock Telegram API responses

Acceptance criteria:
- Core logic has tests
- New regressions are easier to catch
- Test suite runs in CI
EOF

create_issue "Optimize bundle size by removing unused dependencies" "build,performance,build-size" <<'EOF'
Problem:
Unused dependencies increase install size, build time, and runtime memory usage.

Why this matters:
The app should stay lightweight, especially on mobile devices.

Recommended solution:
- Audit package.json
- Remove unused libraries
- Replace heavy packages with lighter alternatives where possible
- Split dependencies between dev and runtime accurately

Acceptance criteria:
- Bundle size decreases
- Unused packages removed
- Build output is smaller
EOF

create_issue "Enable release build optimizations for Android" "build,build-size,performance" <<'EOF'
Problem:
Release builds should be optimized for startup time, memory, and APK size.

Why this matters:
A media app will often be installed on lower and mid-range devices.

Recommended solution:
- Enable Hermes where applicable
- Minify JavaScript
- Enable resource shrinking
- Strip debug code
- Use production build variants only

Acceptance criteria:
- Release APK/AAB is smaller
- Startup is faster
- Debug artifacts are excluded
EOF

create_issue "Defer heavy work and use lazy imports for non-critical features" "performance,build,architecture" <<'EOF'
Problem:
Heavy modules and expensive initialization should not block app startup.

Why this matters:
First paint and first interaction should be quick.

Recommended solution:
- Lazy-load screens and modules
- Initialize non-critical services after startup
- Avoid importing heavy logic into the root entry unnecessarily
- Split optional features into on-demand chunks

Acceptance criteria:
- Startup is faster
- Initial JS bundle is smaller
- Heavy modules load only when needed
EOF

create_issue "Improve image and video memory management" "performance,bug" <<'EOF'
Problem:
Media apps can consume a lot of memory if previews are not handled carefully.

Why this matters:
Memory spikes can cause crashes or app termination.

Recommended solution:
- Load images at display size
- Release references when screens unmount
- Avoid keeping large arrays of image objects in memory
- Use optimized media components
- Cache decoded assets carefully

Acceptance criteria:
- Memory usage is stable while scrolling
- App does not crash on large galleries
EOF

create_issue "Add download-to-device and export controls" "feature,ux" <<'EOF'
Problem:
Users need a simple way to save media back to the device.

Why this matters:
A cloud storage app should support retrieval, not only upload.

Recommended solution:
- Add single-item and batch download
- Show target path or save destination
- Handle permission flows cleanly
- Support share/export actions

Acceptance criteria:
- Media can be downloaded to device storage
- Permission flow is clear
- Batch export works
EOF

create_issue "Add media filtering by type, size, and upload source" "feature,ux,performance" <<'EOF'
Problem:
Users need better ways to narrow down large media collections.

Why this matters:
Filtering reduces search time and improves usability for large libraries.

Recommended solution:
- Filter by images, videos, screenshots, documents
- Filter by file size
- Filter by upload source or album/channel
- Combine filters with search and timeline

Acceptance criteria:
- Filters can be applied together
- Filtered results update quickly
- UI shows active filters clearly
EOF

create_issue "Improve accessibility and text scaling support" "ux,ui,enhancement" <<'EOF'
Problem:
The app should be usable with larger font sizes, screen readers, and better contrast.

Why this matters:
Accessibility is part of a polished production app.

Recommended solution:
- Support dynamic text sizing
- Add accessibility labels
- Ensure tap targets are large enough
- Check contrast and focus states

Acceptance criteria:
- Core screens work with larger text
- Interactive controls have labels
- Navigation remains usable with accessibility tools
EOF

create_issue "Add storage quota, usage, and cleanup controls" "feature,ux,performance" <<'EOF'
Problem:
Users need to understand how much local cache and Telegram-backed storage they are using.

Why this matters:
Storage apps need transparent capacity management.

Recommended solution:
- Show local cache usage
- Show indexed media count
- Show last sync status
- Add cache cleanup options
- Add size-based cleanup suggestions

Acceptance criteria:
- Storage usage is visible
- User can clean local cache
- Large items are easy to identify
EOF

echo "Done creating issue backlog for $REPO"