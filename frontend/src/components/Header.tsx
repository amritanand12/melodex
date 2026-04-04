"use client";
import { useStore } from "@/store/useStore";

export default function Header() {
  const { activeTab, setActiveTab, jobs } = useStore();

  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const activeCount = jobs.filter((j) =>
    ["downloading", "converting", "queued", "fetching_meta"].includes(j.status)
  ).length;

  const tabs = [
    { id: "queue" as const,     label: "Queue",     badge: activeCount > 0 ? activeCount : null },
    { id: "downloads" as const, label: "Downloads", badge: completedCount > 0 ? completedCount : null },
  ];

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-4">
          <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-900/50">
            <svg className="w-5 h-5 text-surface-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight text-slate-100">
            Melodex
          </span>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center glass rounded-xl p-1 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-display font-semibold transition-all duration-200 flex items-center gap-2
                ${activeTab === tab.id
                  ? "bg-surface-300 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
                }`}
            >
              {tab.label}
              {tab.badge !== null && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md
                  ${activeTab === tab.id
                    ? "bg-brand-600/40 text-brand-300"
                    : "bg-surface-300 text-slate-500"
                  }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* yt-dlp badge */}
        <span className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-surface-100 border border-white/5 px-3 py-1.5 rounded-lg">
          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full"></span>
          yt-dlp powered
        </span>
      </div>
    </header>
  );
}
