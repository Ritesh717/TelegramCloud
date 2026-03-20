import { create } from 'zustand';

interface AppState {
  // Auth
  isAuthenticated: boolean | null;
  setAuthenticated: (status: boolean) => void;

  // Sync Stats
  syncedCount: number;
  successCount: number;
  totalMediaCount: number;
  setSyncStats: (stats: { syncedCount: number; successCount: number; totalMediaCount: number }) => void;

  // Backup State
  isBackingUp: boolean;
  setIsBackingUp: (status: boolean) => void;
  backupProgress: number;
  setBackupProgress: (p: number) => void;
  uploadingId: string | null;
  setUploadingId: (id: string | null) => void;

  // Global Refresh
  refreshTrigger: number;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>((set, _get) => ({
  isAuthenticated: null,
  setAuthenticated: (status: boolean) => set({ isAuthenticated: status }),

  syncedCount: 0,
  successCount: 0,
  totalMediaCount: 0,
  setSyncStats: (stats: { syncedCount: number; successCount: number; totalMediaCount: number }) => set(stats),

  isBackingUp: false,
  setIsBackingUp: (status: boolean) => set({ isBackingUp: status }),
  backupProgress: 0,
  setBackupProgress: (p: number) => set({ backupProgress: p }),
  uploadingId: null,
  setUploadingId: (id: string | null) => set({ uploadingId: id }),

  refreshTrigger: 0,
  triggerRefresh: () => set((state: AppState) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));
