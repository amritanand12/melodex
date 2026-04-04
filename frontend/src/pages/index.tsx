"use client";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import Header from "@/components/Header";
import UrlInput from "@/components/UrlInput";
import QueueList from "@/components/QueueList";
import DownloadsPage from "@/components/DownloadsPage";

export default function Home() {
  const { activeTab } = useStore();
  useWebSocket();

  return (
    <>
      <Head>
        <title>Melodex — YouTube Music Downloader</title>
        <meta name="description" content="Download YouTube music as MP3/MP4 — fast, free, offline." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-surface-0 dark">
        {/* Grid background */}
        <div
          className="fixed inset-0 pointer-events-none opacity-100"
          style={{
            backgroundImage:
              "linear-gradient(rgba(20,184,166,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(20,184,166,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden
        />
        {/* Glow */}
        <div
          className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(20,184,166,0.15) 0%, transparent 70%)",
          }}
          aria-hidden
        />

        <Header />

        <main className="relative max-w-4xl mx-auto px-4 py-8">
          {/* Hero / Input */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 bg-brand-900/30 border border-brand-800/50 text-brand-300 text-xs font-mono px-3 py-1.5 rounded-full mb-4"
              >
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
                Powered by yt-dlp · Production Ready
              </motion.div>
              <h1 className="font-display font-extrabold text-4xl md:text-5xl text-slate-100 mb-3 tracking-tight">
                Download Music,{" "}
                <span className="text-brand-400">Offline.</span>
              </h1>
              <p className="text-slate-400 text-base max-w-lg mx-auto leading-relaxed">
                Paste YouTube links · Choose quality · Download MP3 or MP4
              </p>
            </div>

            <div className="card">
              <UrlInput />
            </div>
          </motion.section>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            {activeTab === "queue" && (
              <motion.section
                key="queue"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <QueueList />
              </motion.section>
            )}
            {activeTab === "downloads" && (
              <motion.section
                key="downloads"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <DownloadsPage />
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <footer className="border-t border-white/5 mt-16 py-6 text-center">
          <p className="text-xs text-slate-700 font-mono">
            Melodex v1.0 · For personal use only · Respect copyright law
          </p>
        </footer>
      </div>
    </>
  );
}
