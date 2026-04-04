"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";
import { melodexApi } from "@/utils/api";
import { DownloadJob } from "@/store/useStore";
import toast from "react-hot-toast";

function formatBytes(bytes?: number): string {
  if (!bytes) return "–";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(s?: number) {
  if (!s) return "–";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function DownloadsPage() {
  const { sessionId, jobs, addJobs } = useStore();
  const [loading, setLoading] = useState(false);

  const completed = jobs.filter((j) => j.status === "completed");

  // Sync completed jobs from server on mount
  useEffect(() => {
    setLoading(true);
    melodexApi
      .getDownloads(sessionId)
      .then((data) => addJobs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleDownload = (job: DownloadJob) => {
    const url = melodexApi.getFileUrl(job.id);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.title || "download"}.${job.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAll = () => {
    if (completed.length === 0) return;
    const url = melodexApi.getZipUrl(sessionId);
    const a = document.createElement("a");
    a.href = url;
    a.download = "melodex_downloads.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Preparing ZIP…");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-brand-400 animate-pulse font-display">Loading downloads…</div>
      </div>
    );
  }

  if (completed.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <div className="text-6xl mb-6 opacity-30">📭</div>
        <h3 className="font-display font-bold text-xl text-slate-400 mb-2">No completed downloads</h3>
        <p className="text-slate-600 text-sm">Completed downloads will appear here</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 font-mono">
          {completed.length} file{completed.length !== 1 ? "s" : ""} ready
        </p>
        <button
          onClick={handleDownloadAll}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download All as ZIP
        </button>
      </div>

      {/* Grid */}
      <div className="grid gap-3">
        <AnimatePresence>
          {completed.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card glass-hover flex items-center gap-4"
            >
              {/* Thumbnail */}
              <div className="w-16 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-surface-300">
                {job.thumbnail_url ? (
                  <img src={job.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xl">🎵</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-slate-100 truncate">
                  {job.title || "Unknown Title"}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                  {job.artist && <span>{job.artist}</span>}
                  {job.duration && <span>{formatDuration(job.duration)}</span>}
                  <span className="uppercase text-brand-600">{job.format}</span>
                  {job.format === "mp3" && job.quality && <span>{job.quality}kbps</span>}
                  {job.file_size && <span>{formatBytes(job.file_size)}</span>}
                </div>
              </div>

              {/* Download button */}
              <button
                onClick={() => handleDownload(job)}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Save
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Expiry notice */}
      <p className="text-xs text-slate-600 text-center pt-2">
        Files are available for 24 hours after download completion
      </p>
    </div>
  );
}
