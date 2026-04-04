"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import toast from "react-hot-toast";
import { DownloadJob, useStore } from "@/store/useStore";
import { melodexApi } from "@/utils/api";

function formatDuration(seconds?: number): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS_CONFIG: Record<
  DownloadJob["status"],
  { label: string; color: string; bg: string; icon: string }
> = {
  pending:      { label: "Pending",     color: "text-slate-400",  bg: "bg-slate-800",   icon: "⏳" },
  fetching_meta:{ label: "Fetching…",   color: "text-blue-400",   bg: "bg-blue-900/40", icon: "🔍" },
  queued:       { label: "Queued",      color: "text-indigo-400", bg: "bg-indigo-900/30",icon: "📋" },
  downloading:  { label: "Downloading", color: "text-brand-400",  bg: "bg-brand-900/30",icon: "⬇" },
  converting:   { label: "Converting",  color: "text-amber-400",  bg: "bg-amber-900/30",icon: "🔄" },
  tagging:      { label: "Tagging",     color: "text-purple-400", bg: "bg-purple-900/30",icon: "🏷" },
  completed:    { label: "Done",        color: "text-emerald-400",bg: "bg-emerald-900/30",icon: "✓" },
  failed:       { label: "Failed",      color: "text-red-400",    bg: "bg-red-900/30",   icon: "✕" },
  cancelled:    { label: "Cancelled",   color: "text-slate-500",  bg: "bg-slate-800",    icon: "—" },
  expired:      { label: "Expired",     color: "text-slate-600",  bg: "bg-slate-800",    icon: "⌛" },
};

interface Props {
  job: DownloadJob;
  index: number;
}

export default function JobCard({ job, index }: Props) {
  const { sessionId, removeJob, updateJob } = useStore();
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
  const isActive = ["downloading", "converting", "fetching_meta", "queued"].includes(job.status);

  const handleCancel = async () => {
    try {
      await melodexApi.cancelJob(sessionId, job.id);
      updateJob(job.id, { status: "cancelled" });
      toast("Job cancelled", { icon: "✕" });
    } catch {
      toast.error("Could not cancel job");
    }
  };

  const handleDownload = () => {
    const url = melodexApi.getFileUrl(job.id);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.title || "download"}.${job.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRemove = () => removeJob(job.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className={`card group relative overflow-hidden transition-all duration-300
        ${job.status === "completed" ? "border-emerald-900/30" : ""}
        ${job.status === "failed" ? "border-red-900/30" : ""}
      `}
    >
      {/* Active glow */}
      {isActive && (
        <div className="absolute inset-0 bg-brand-900/10 animate-pulse-slow pointer-events-none rounded-2xl" />
      )}

      <div className="flex gap-4 relative">
        {/* ── Thumbnail ─────────────────────────────────────────────────── */}
        <div className="flex-shrink-0">
          <div className="w-20 h-14 rounded-xl overflow-hidden bg-surface-300 relative">
            {job.thumbnail_url ? (
              <img
                src={job.thumbnail_url}
                alt={job.title || "thumbnail"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MusicIcon status={job.status} />
              </div>
            )}
            {/* Format badge */}
            <div className="absolute bottom-1 right-1 bg-surface-0/80 backdrop-blur-sm rounded px-1 py-0.5 text-[10px] font-mono text-brand-400 uppercase">
              {job.format}
            </div>
          </div>
        </div>

        {/* ── Info ──────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h3 className="font-display font-semibold text-sm text-slate-100 truncate leading-snug">
                {job.title || (
                  <span className="text-slate-500 font-mono text-xs truncate">{job.url}</span>
                )}
              </h3>
              {job.artist && (
                <p className="text-xs text-slate-500 truncate">{job.artist}</p>
              )}
            </div>

            {/* Status badge */}
            <div className={`status-badge flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
            {job.duration && <span>{formatDuration(job.duration)}</span>}
            {job.quality && job.format === "mp3" && <span>{job.quality}kbps</span>}
            {job.file_size && <span>{formatBytes(job.file_size)}</span>}
          </div>

          {/* ── Progress bar ─────────────────────────────────────────────── */}
          {isActive && (
            <div className="space-y-1">
              <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="progress-fill h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full"
                  style={{ width: `${job.progress ?? 0}%` }}
                />
              </div>
              <p className="text-xs font-mono text-slate-600">
                {(job.progress ?? 0).toFixed(0)}%
              </p>
            </div>
          )}

          {/* Error message */}
          {job.status === "failed" && job.error_message && (
            <p className="text-xs text-red-400 mt-1 leading-snug">{job.error_message}</p>
          )}
        </div>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex flex-col items-end justify-between flex-shrink-0 gap-2">
          {/* Download button */}
          {job.status === "completed" && (
            <button
              onClick={handleDownload}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
              title="Download file"
            >
              <DownloadIcon />
              <span>Save</span>
            </button>
          )}

          {/* Cancel button */}
          {isActive && (
            <button
              onClick={handleCancel}
              className="btn-ghost text-xs px-3 py-1.5"
              title="Cancel"
            >
              Cancel
            </button>
          )}

          {/* Remove */}
          {["completed", "failed", "cancelled", "expired"].includes(job.status) && (
            <button
              onClick={handleRemove}
              className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-surface-300"
              title="Remove from list"
            >
              <RemoveIcon />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function MusicIcon({ status }: { status: DownloadJob["status"] }) {
  if (["downloading", "converting"].includes(status)) {
    return (
      <div className="flex items-end gap-0.5 h-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="wave-bar w-1 bg-brand-400 rounded-full origin-bottom"
            style={{ height: "100%", animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    );
  }
  return (
    <svg className="w-6 h-6 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
