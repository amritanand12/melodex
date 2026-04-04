import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

export type JobStatus =
  | "pending"
  | "fetching_meta"
  | "queued"
  | "downloading"
  | "converting"
  | "tagging"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface DownloadJob {
  id: string;
  url: string;
  video_id?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  thumbnail_url?: string;
  format: "mp3" | "mp4";
  quality: "128" | "192" | "320";
  status: JobStatus;
  progress: number;
  error_message?: string;
  file_size?: number;
  download_url?: string;
  created_at?: string;
  completed_at?: string;
}

interface MelodexStore {
  sessionId: string;
  jobs: DownloadJob[];
  addJobs: (jobs: DownloadJob[]) => void;
  updateJob: (id: string, patch: Partial<DownloadJob>) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  activeTab: "queue" | "downloads";
  setActiveTab: (tab: "queue" | "downloads") => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  defaultFormat: "mp3" | "mp4";
  defaultQuality: "128" | "192" | "320";
  setDefaultFormat: (f: "mp3" | "mp4") => void;
  setDefaultQuality: (q: "128" | "192" | "320") => void;
}

export const useStore = create<MelodexStore>()(
  persist(
    (set) => ({
      sessionId: uuidv4(),
      jobs: [],
      addJobs: (newJobs) =>
        set((s) => ({
          jobs: [
            ...newJobs
              .filter((j) => !s.jobs.find((e) => e.id === j.id))
              .map((j) => ({ ...j, progress: j.progress ?? 0 })),
            ...s.jobs,
          ],
        })),
      updateJob: (id, patch) =>
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        })),
      removeJob: (id) =>
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
      clearCompleted: () =>
        set((s) => ({
          jobs: s.jobs.filter((j) => j.status !== "completed"),
        })),
      activeTab: "queue",
      setActiveTab: (tab) => set({ activeTab: tab }),
      darkMode: true,
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      defaultFormat: "mp3",
      defaultQuality: "320",
      setDefaultFormat: (f) => set({ defaultFormat: f }),
      setDefaultQuality: (q) => set({ defaultQuality: q }),
    }),
    {
      name: "melodex-store",
      partialize: (s) => ({
        sessionId: s.sessionId,
        darkMode: s.darkMode,
        defaultFormat: s.defaultFormat,
        defaultQuality: s.defaultQuality,
        jobs: s.jobs.filter((j) =>
          ["completed", "failed"].includes(j.status)
        ),
      }),
    }
  )
);
