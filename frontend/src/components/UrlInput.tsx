"use client";
import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useStore } from "@/store/useStore";
import { melodexApi } from "@/utils/api";

const YT_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=|shorts\/)|youtu\.be\/).+/;

function validateUrl(url: string): boolean {
  return YT_REGEX.test(url.trim());
}

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

export default function UrlInput() {
  const { sessionId, addJobs, defaultFormat, defaultQuality, setActiveTab } = useStore();
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<"mp3" | "mp4">(defaultFormat);
  const [quality, setQuality] = useState<"128" | "192" | "320">(defaultQuality);
  const [loading, setLoading] = useState(false);
  const [urlErrors, setUrlErrors] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const urls = parseUrls(input);
  const validUrls = urls.filter(validateUrl);
  const invalidUrls = urls.filter((u) => !validateUrl(u));

  const handleSubmit = useCallback(async () => {
    if (validUrls.length === 0) {
      toast.error("Please enter at least one valid YouTube URL");
      return;
    }
    if (validUrls.length > 50) {
      toast.error("Maximum 50 URLs per submission");
      return;
    }

    setLoading(true);
    try {
      const response = await melodexApi.submitUrls({
        urls: validUrls,
        format,
        quality,
        session_id: sessionId,
      });
      addJobs(response.jobs);
      setInput("");
      setUrlErrors([]);
      toast.success(`${response.jobs.length} track${response.jobs.length !== 1 ? "s" : ""} added to queue`);
      setActiveTab("queue");
    } catch (err: any) {
      toast.error(err.message || "Failed to add to queue");
    } finally {
      setLoading(false);
    }
  }, [validUrls, format, quality, sessionId, addJobs, setActiveTab]);

  // Drag-and-drop text files with URL lists
  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInput((prev) => (prev ? prev + "\n" + text : text));
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/plain": [".txt"] },
    noClick: true,
    multiple: false,
  });

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Auto-submit if pasting a single clean URL
    const text = e.clipboardData.getData("text").trim();
    if (validateUrl(text) && input.trim() === "") {
      // Will be set by normal paste, then we can auto-validate
    }
  }, [input]);

  return (
    <div className="w-full space-y-4">
      {/* ── Textarea ─────────────────────────────────────────────────────── */}
      <div
        {...getRootProps()}
        className={`relative transition-all duration-300 rounded-2xl
          ${isDragActive ? "ring-2 ring-brand-400 ring-offset-2 ring-offset-surface-0" : ""}`}
      >
        <input {...getInputProps()} />

        {isDragActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-surface-100/90 backdrop-blur-sm border-2 border-dashed border-brand-400">
            <div className="text-center">
              <div className="text-3xl mb-2">📄</div>
              <p className="text-brand-300 font-display font-semibold">Drop your URL list file</p>
            </div>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
            }}
            placeholder={`Paste YouTube URLs here — one per line\nhttps://youtube.com/watch?v=...\nhttps://youtube.com/playlist?list=...\n\nTip: Ctrl+Enter to submit`}
            rows={5}
            className="input-field w-full resize-none font-mono text-sm leading-relaxed"
            spellCheck={false}
            disabled={loading}
          />

          {/* Character count / URL count */}
          {input.trim() && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs font-mono">
              {invalidUrls.length > 0 && (
                <span className="text-red-400">{invalidUrls.length} invalid</span>
              )}
              {validUrls.length > 0 && (
                <span className="text-brand-400">{validUrls.length} valid</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Invalid URL warnings ──────────────────────────────────────────── */}
      <AnimatePresence>
        {invalidUrls.length > 0 && input.trim() && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-3 text-xs font-mono text-red-300">
              <p className="font-semibold mb-1 text-red-200">⚠ Invalid URLs (will be skipped):</p>
              {invalidUrls.slice(0, 3).map((u, i) => (
                <p key={i} className="truncate opacity-70">{u}</p>
              ))}
              {invalidUrls.length > 3 && (
                <p className="opacity-50">...and {invalidUrls.length - 3} more</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Options Row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Format toggle */}
        <div className="flex items-center glass rounded-xl p-1 gap-1">
          {(["mp3", "mp4"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-display font-semibold transition-all duration-200 uppercase tracking-wide
                ${format === f
                  ? "bg-brand-500 text-surface-0 shadow-lg shadow-brand-900/50"
                  : "text-slate-400 hover:text-slate-200"
                }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Quality selector (mp3 only) */}
        <AnimatePresence>
          {format === "mp3" && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex items-center glass rounded-xl p-1 gap-1"
            >
              {(["128", "192", "320"] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-200
                    ${quality === q
                      ? "bg-surface-300 text-brand-300"
                      : "text-slate-500 hover:text-slate-300"
                    }`}
                >
                  {q}k
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* Submit */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={loading || validUrls.length === 0}
          className="btn-primary flex items-center gap-2 min-w-[160px] justify-center"
        >
          {loading ? (
            <>
              <Spinner />
              <span>Adding...</span>
            </>
          ) : (
            <>
              <span>Add to Queue</span>
              {validUrls.length > 0 && (
                <span className="bg-surface-0/30 rounded-lg px-1.5 py-0.5 text-xs font-mono">
                  {validUrls.length}
                </span>
              )}
            </>
          )}
        </motion.button>
      </div>

      {/* ── Drag hint ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-slate-600 text-center">
        Drag &amp; drop a .txt file with URLs · Supports videos, playlists, and Shorts
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
