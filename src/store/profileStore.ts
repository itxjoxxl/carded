import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  loadProfile,
  loadStats,
  saveProfile,
  saveStats,
  recordGameResult,
  type StoredProfile,
  type AllStats,
} from '@/lib/storage';
import {
  getOrCreateProfileId,
  encodeRestoreCode,
  decodeRestoreCode,
} from '@/lib/profile-id';

interface ProfileStore {
  profile: StoredProfile | null;
  stats: AllStats;
  isSetupComplete: boolean;
  // Actions
  initProfile(): void;
  setProfile(profile: StoredProfile): void;
  updateName(name: string): void;
  updateAvatar(avatar: string): void;
  recordResult(gameId: string, result: 'win' | 'loss' | 'draw'): void;
  restoreFromCode(code: string): boolean;
  getRestoreCode(): string;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profile: null,
      stats: {},
      isSetupComplete: false,

      initProfile() {
        const stored = loadProfile();
        const allStats = loadStats();

        if (stored?.name && stored?.avatar) {
          set({ profile: stored, stats: allStats, isSetupComplete: true });
          return;
        }

        // Create/retrieve ID but don't mark setup complete until name+avatar are set
        const id = getOrCreateProfileId();
        const shell: StoredProfile = {
          id,
          name: stored?.name ?? '',
          avatar: stored?.avatar ?? '',
          createdAt: stored?.createdAt ?? new Date().toISOString(),
        };
        set({ profile: shell, stats: allStats, isSetupComplete: false });
      },

      setProfile(profile: StoredProfile) {
        saveProfile(profile);
        set({
          profile,
          isSetupComplete: !!(profile.name && profile.avatar),
        });
      },

      updateName(name: string) {
        const current = get().profile;
        if (!current) return;
        const updated: StoredProfile = { ...current, name };
        saveProfile(updated);
        set({
          profile: updated,
          isSetupComplete: !!(name && updated.avatar),
        });
      },

      updateAvatar(avatar: string) {
        const current = get().profile;
        if (!current) return;
        const updated: StoredProfile = { ...current, avatar };
        saveProfile(updated);
        set({
          profile: updated,
          isSetupComplete: !!(updated.name && avatar),
        });
      },

      recordResult(gameId: string, result: 'win' | 'loss' | 'draw') {
        recordGameResult(gameId, result);
        const updated = loadStats();
        set({ stats: updated });
      },

      restoreFromCode(code: string): boolean {
        const decoded = decodeRestoreCode(code);
        if (!decoded || !decoded.id || !decoded.name) return false;
        saveProfile(decoded);
        set({
          profile: decoded,
          isSetupComplete: !!(decoded.name && decoded.avatar),
        });
        return true;
      },

      getRestoreCode(): string {
        const profile = get().profile;
        if (!profile) return '';
        return encodeRestoreCode(profile);
      },
    }),
    {
      name: 'carded:profile-store',
      // Only persist the profile snapshot and setup flag;
      // raw stats live in their own localStorage key via storage helpers.
      partialize: (state) => ({
        profile: state.profile,
        isSetupComplete: state.isSetupComplete,
      }),
    }
  )
);
