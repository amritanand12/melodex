"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { useStore } from "@/store/useStore";
import { melodexApi } from "@/utils/api";
import JobCard from "./JobCard";

type Filter = "all" | "active" | "completed" | "failed";

export default function QueueList() {
  const { jobs, sessionId, clearCompleted } = useStore();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    switch (filter) {
      case "active":
        return jobs.filter((j) =>
          ["pending","fetching_meta","queued","downloading","converting","tagging"].includes(j.status)
        );
      case "completed":
        return jobs.filter((j) => j.status === "completed");
      case "failed":
        return jobs.filter((j) => j.status === "failed");
      default:
        return jobs;
    }
  }, [jobs, filter]);

  const stats = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter((j) =>
      ["pending","fetching_meta","queued","downloading","converting"].includes(j.status)
    ).length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  }), [jobs]);

  const handleDownloadAll = () => {
    const url = melodexApi.getZipUrl(sessionId);
    const a = document.createElement("a");
    a.href = url;
    a.download = "melodex_downloads.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Preparing ZIP download…");
  };

  if (jobs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <div className="text-6xl mb-6 opacity-30">🎵</div>
        <h3 className="font-display font-bold text-xl text-slate-400 mb-2">Queue is empty</h3>
        <p className="text-slate-600 text-sm">Paste YouTube URLs above to get started</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats + Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center glass rounded-xl p-1 gap-0.5">
          {(["all", "active", "completed", "failed"] as Filter[]).map((f) => {
            const count = f === "all" ? stats.total : f === "active" ? stats.active
              : f === "completed" ? stats.completed : stats.failed;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 capitalize flex items-center gap-1.5
                  ${filter === f ? "bg-surface-300 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
              >
                {f}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono
                    ${filter === f ? "bg-brand-600/30 text-brand-300" : "bg-surface-300 text-slate-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        {stats.completed > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadAll} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
              ⬇ Download All ZIP
            </button>
            <button onClick={clearCompleted} className="btn-ghost text-xs px-3 py-1.5 text-slate-500">
              Clear Done
            </button>
          </div>
        )}
      </div>

      {/* Active progress summary */}
      {stats.active > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass border-brand-900/30 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <div className="flex items-end gap-0.5 h-5">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="wave-bar w-1 bg-brand-400 rounded-full origin-bottom"
                style={{ height: "100%", animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <p className="text-sm text-brand-300 font-semibold">
            {stats.active} track{stats.active !== 1 ? "s" : ""} processing
          </p>
          <div className="flex-1" />
          <span className="text-xs font-mono text-slate-500">
            {stats?.completed ?? 0}/{stats?.total ?? 0} done
          </span>
        </motion.div>
      )}

      {/* Job cards */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center text-sm text-slate-600 py-8">
            No {filter === "all" ? "" : filter} items
          </motion.p>
        ) : (
          filtered.map((job, i) => <JobCard key={job.id} job={job} index={i} />)
        )}
      </AnimatePresence>
    </div>
  );
}
