import axios from "axios";

const api = axios.create({
  baseURL: "",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor – log in dev
api.interceptors.request.use((config) => {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

// Response interceptor – normalize errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(", ")
        : err.message || "Unknown error";
    return Promise.reject(new Error(message));
  }
);

// ── API methods ──────────────────────────────────────────────────────────────

export const melodexApi = {
  /** Fetch metadata/preview for a URL before queuing */
  async fetchMetadata(url: string) {
    const { data } = await api.post("/api/v1/metadata", { url });
    return data;
  },

  /** Submit URLs to download queue */
  async submitUrls(payload: {
    urls: string[];
    format: string;
    quality: string;
    session_id: string;
  }) {
    const { data } = await api.post("/api/v1/queue/submit", payload);
    return data;
  },

  /** Get all jobs for a session */
  async getQueue(sessionId: string) {
    const { data } = await api.get(`/api/v1/queue/${sessionId}`);
    return data;
  },

  /** Get queue stats */
  async getQueueStats(sessionId: string) {
    const { data } = await api.get(`/api/v1/queue/${sessionId}/stats`);
    return data;
  },

  /** Cancel a job */
  async cancelJob(sessionId: string, jobId: string) {
    await api.delete(`/api/v1/queue/${sessionId}/${jobId}`);
  },

  /** Get completed downloads */
  async getDownloads(sessionId: string) {
    const { data } = await api.get(`/api/v1/downloads/${sessionId}`);
    return data;
  },

  /** Get single job */
  async getJob(jobId: string) {
    const { data } = await api.get(`/api/v1/jobs/${jobId}`);
    return data;
  },

  /** Download file URL */
  getFileUrl(jobId: string) {
    return `/api/v1/downloads/${jobId}/file`;
  },

  getZipUrl(sessionId: string) {
    return `/api/v1/downloads/${sessionId}/zip`;
  },
};

export default api;
