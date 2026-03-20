# Designing an “Unlim”‑Style Telegram Backup App

To build an Android app like Unlim (or the open-source *CloudGallery*【74†L320-L322】) that uses Telegram’s cloud as storage, we must first gather requirements and examine Telegram’s capabilities. We need to support automatic backup of new photos/videos, manual sync of existing files, deduplication, splitting large videos, and rich metadata (captions) for easy search. Below is a deep implementation plan covering API limits, tools, architecture, and steps.

## Feature Requirements & Unlim Overview

- **Core Features:** The app should automatically **upload new photos and videos** from the device (e.g. camera or download folder) to the user’s Telegram “Saved Messages” or a private channel. It should **sync** already-uploaded files so that it doesn’t duplicate effort. When uploading, the app should **detect duplicates** (e.g. same image/video) and skip them. For **very large videos** (over ~2 GB), the app should split them into chunks before upload to stay within Telegram’s limits. It should also **add captions or messages** containing image metadata (filename, resolution, date, tags) to each file so users can search by content easily.

- **Unlim App Inspiration:** The Unlim app advertises “free unlimited cloud storage” using Telegram’s Saved Messages【50†L78-L82】. It backs up photos/videos and even music automatically. The proposed app would extend this: supporting all media types, syncing past uploads, avoiding duplicates, splitting large files, and richer metadata. (An example project, *Chitralaya CloudGallery*, similarly backs up photos to Telegram and emphasizes privacy and unlimited space【74†L320-L322】【74†L382-L390】.)

## Telegram API Capabilities

- **Unlimited Cloud Storage:** Telegram gives each user effectively **unlimited cloud storage**【22†L211-L218】【50†L78-L82】. You can send an *unlimited number* of files (docs, photos, videos) up to 2 GB each (free users)【22†L211-L218】. Premium users can send up to 4 GB per file【17†L123-L127】【61†L184-L190】. There are no account quotas on number of files. Thus the app can leverage “Saved Messages” as a personal cloud.

- **File Upload:** Use Telegram’s *user* API (not Bot API) to bypass the 50 MB bot limit. Client libraries like [Telethon](https://docs.telethon.dev) or **TDLib** (Telegram’s official SDK) can send files up to the 2 GB limit【59†L189-L194】 (or 4 GB if Premium【61†L184-L190】). For example, Telethon’s `send_file()` lets you upload large files from the user’s account【59†L189-L194】. TDLib offers methods like `sendMessage` with `InputFile` or `sendMediaGroup`. Behind the scenes, Telegram splits files into 512 KB chunks【64†L97-L106】, but the library abstracts that.

- **Large File Splitting:** Since free accounts cap at ~2 GB per file【22†L211-L218】, the app should detect if a video is too large and split it. The user may upgrade to Premium to allow larger single uploads【61†L184-L190】, but to support free users, implement splitting: e.g. use a media library (or raw file slicing) to break videos into ~1–2 GB parts and upload each sequentially. (Note Telethon alone won’t bypass its 2 GB limit【61†L184-L190】; splitting is needed or Premium.) Each chunk should be sent as a separate file and the app can keep them linked.

- **Deduplication:** To avoid re-uploading duplicates, the app can compute a content hash (e.g. SHA-256) of each local media file and store it in a local database. Before uploading a file, compare its hash to the DB. If it matches an already-uploaded file, skip the upload. The app can also **fetch existing Saved Messages** and record the hashes of already-uploaded media (for example by downloading small thumbnails or metadata). Because Telegram’s API does not directly expose content hashes, maintaining your own index is needed. This ensures “already-uploaded” files aren’t sent again.

- **Captions and Metadata:** Telegram messages can have captions (up to 1024 characters)【71†L111-L119】. The app should add a descriptive caption to each uploaded file with image specs (dimensions, file size, date, tags). For example: `“Vacation photo 2026-03-10 4000×3000, 2.1 MB”`. This makes the files easily searchable by Telegram’s chat search. Similarly, video files can have captions. The app might also send a separate message with additional notes or tags after each upload.

## Existing Tools and Open-Source Examples

- **CloudGallery (Chitralaya):** The [open-source CloudGallery app](https://github.com/AKS-Labs/CloudGallery) does photo backup to Telegram. Its README emphasizes privacy and unlimited backup【74†L320-L322】【74†L382-L390】. We can study its architecture (it uses the Bot API via a channel, I believe) for ideas about scanning device images and background uploading.

- **Telegram CLI/Library Tools:** Telethon (Python) provides utilities like `send_file` and `upload_file` for file transfer【59†L189-L194】. The `telegram-cloud` CLI tool【45†L255-L263】 is a Telethon-based script that supports uploading to Saved Messages and searching by caption. While these are not Android libraries, their logic (handling media types, queues) can inspire the app’s upload workflow.

- **Bot vs User Accounts:** Many backup solutions (including some open-source bots) use **Bot API** (e.g. by uploading to a private channel) because of development simplicity. However, bots have a 50 MB limit and require managing bot tokens. For large media, better to log in with a **user account** via TDLib. This uses the user’s phone number and session.

- **Development Libraries:** On Android, integrating Telegram’s protocol can be done via [TDLib](https://core.telegram.org/tdlib) or a Java/Kotlin MTProto library. TDLib is recommended (it handles networking, auth, JSON). Alternatively, open-source Java libraries (though old) exist. Using TDLib/TDLight simplifies messaging, file upload, and updates.

## Deduplication & Chunking Strategy

- **Hashing Files:** When the app detects a new file, compute its cryptographic hash (SHA-256 or MD5). Store hashes of successfully uploaded files in a local SQLite DB. Before uploading, compare to avoid duplicates. For example, if a photo’s hash exists, skip upload. This is robust even if filenames change.

- **Syncing Existing Media:** To handle files that were previously uploaded (perhaps by another device or before using the app), the app can fetch the “Saved Messages” history via Telegram API and record the unique file IDs or captions. It could download small thumbnails or metadata (TDLib’s `getMessage` with media info) to reconstruct a hash list. Then match that against local media to mark them as already backed up.

- **Splitting Large Videos:** For any video file over ~1.5–2 GB, implement splitting. One approach is to use a native library (like MP4Parser or ffmpeg) to segment the file into ~500–1000 MB parts. Each part is then uploaded sequentially. The app should keep track of parts to allow reassembly offline (for example, provide instructions to the user to concatenate). Another approach: warn the user if a file is too large (prompt to compress or use premium). Telethon’s advice is that only Premium accounts can exceed 2 GB【61†L184-L190】, so splitting is the workaround for free users.

- **Uploading Workflow:** Upload tasks should run in the background (WorkManager or a Service). The app should queue uploads, handle network failures, and throttle requests to avoid Telegram rate limits (e.g. delay between files). Telethon notes adding delays to prevent getting banned【59†L218-L227】. The upload routine will chunk if needed and use TDLib’s `sendMessage` with `InputFile` to “Saved Messages” or a target chat.

## App Architecture & Data Flow

- **Android App with TDLib:** The app will use **TDLib** (Telegram Database Library) for all Telegram interactions. On first run, prompt the user to log in (enter phone number, receive code). TDLib manages the connection. Store the TDLib session (encrypted) securely on-device.

- **Media Scanner:** Use Android’s `MediaStore` or a FileObserver to detect new images/videos in common folders (DCIM, Downloads, WhatsApp, etc.). On initial sync and periodically (or via BroadcastReceiver for new captures), gather a list of candidate files.

- **Local Database:** Maintain a SQLite DB (or Room) with a table of files: columns include local URI, hash, Telegram file ID (if uploaded), and timestamp. Also store a list of known “remote” file IDs for existing Saved Messages entries.

- **Upload Service:** Implement a background **sync service** (e.g. using WorkManager) that runs periodically or on demand. It compares the media scanner results to the DB: new entries without a matching hash go to upload. For each, the service:
  1. **Compute hash** (if not done already) and check DB.
  2. If duplicate, mark as synced; **skip** upload.
  3. If new and >2 GB, **split** into parts; for each part, call `client.sendMessage` with `InputFile` (TDLib API for sending media).
  4. Once uploaded, record the Telegram message ID or file reference in DB.
  5. Add a caption (or a separate message) including metadata (e.g. “[Filename] [resolution] [size]”)【74†L320-L322】【71†L111-L119】.
  
- **Sync Existing (One-Time):** Provide a “Sync” action that pulls recent messages from the Saved Messages chat (TDLib method `getChatHistory`). For each message with media, record its file ID or content hash (if easier, download thumbnail and hash). This marks those media as already backed up. This ensures the app doesn’t re-upload older files already in Telegram.

- **User Interface:** A simple UI with status: e.g. “Last sync: date”, “Next auto-sync in X hours”, and options to start sync or browse backed-up files (maybe link to Telegram). Also options to adjust settings: which folders to backup, chunk size, etc.

- **Error Handling:** The app should catch upload errors (e.g. network lost, Telegram error) and retry. If a chunk upload fails, retry it. Use TDLib’s results to confirm success. If Telegram returns a checksum error【75†L192-L200】, re-upload the part.

## Security & Privacy

- **Data Encryption:** The app only stores the TDLib session (which is AES-encrypted by TDLib) and file hashes locally; actual media stay on Telegram’s cloud. TDLib handles encryption in transit. As CloudGallery notes, Telegram encryption is “in transit, but not end-to-end”【74†L382-L390】 – the app developer should inform users of this trade-off. Optionally, users could encrypt files themselves before backup for maximum privacy.

- **Credentials:** Do not store the user’s raw password/SMS code. Rely on TDLib’s secure storage of credentials. If a user logs out or removes the app, clear the local DB to protect metadata.

- **Content Policies:** Remind users Telegram may scan uploaded content (for malware or illegal material) – it’s a trade-off similar to any cloud. The app should conform to Telegram’s terms. No personal data is shared with third parties (the privacy policy of Unlim clarifies it only uses Telegram API【57†L4-L12】).

- **Account Safety:** Advise setting the “keep account if away” timeout to a high value (the default 6 months【31†L79-L88】) so inactivity doesn’t delete account. Two-factor auth (Passcode) is recommended. Allow users to link a secondary Telegram account to the backup channel as a fail-safe.

## Implementation Roadmap

1. **Setup TDLib Integration:** Create a new Android project. Integrate TDLib (via Gradle or prebuilt libraries). Follow the official [TDLib guide](https://core.telegram.org/tdlib)【71†L20-L28】 to initialize and authorize the user account.
2. **Auth Flow:** Implement Telegram login (phone number, code, optional password). Verify in-app that login works and you can send a test message to Saved Messages.
3. **Media Scanning Module:** Build a component using `MediaStore` to query images/videos. On first run, scan all relevant media; on subsequent runs, watch for additions.
4. **Local Database:** Define tables (e.g. `Files(id, localUri, hash, uploadedMessageId)`). Write utility to compute SHA-256 hash of a given media file.
5. **Upload Logic:** Use a background worker to iterate new media: compute hash, check DB, and upload with TDLib’s `sendMessage` + `InputFile`. If a file is >1.5–2GB, split it (e.g. using a file channel to slice into 1GB segments) and upload each part in order. After each file upload, update DB and send a metadata caption【71†L111-L119】.
6. **Deduplication Logic:** Before upload, if hash exists in DB or in a fetched Telegram file list, skip the file. Implement a “Sync” operation that uses `getChatHistory` on Saved Messages to fetch recent file messages and insert their hashes/IDs into the DB.
7. **User Interface:** Create a simple UI with a “Sync Now” button, status text, and settings (folders to include, chunk size, etc.). Show progress for ongoing uploads (number of files left).
8. **Testing:** Test with various file types/sizes. Specifically, upload small images, large videos, and exactly 2+GB files. Verify that splitting works and all parts appear in Telegram. Check that restarting the app or retry does not re-upload duplicates. Test on network loss/restore. Monitor Telegram rate limits (add delays if needed).
9. **Polish & Deployment:** Ensure compliance with Play Store (if published) – e.g. explain use of SMS permission for login. Provide user instructions about storage limits. Optionally publish on F-Droid for open-source users.

By following this plan, one can build an Android app that automatically backs up media to Telegram’s cloud, avoids duplicate uploads, handles large files, and makes backups searchable via captions – effectively replicating and extending Unlim’s functionality. 

**Sources:** Official Telegram API docs (upload limits)【22†L211-L218】【17†L123-L127】; Python Telethon examples (large file uploads)【59†L189-L194】【61†L184-L190】; Unlim/CloudGallery app info and open-source projects【50†L78-L82】【74†L320-L322】【74†L382-L390】.