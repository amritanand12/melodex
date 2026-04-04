import type { AppProps } from "next/app";
import { Toaster } from "react-hot-toast";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1c2826",
            color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
          },
          success: { iconTheme: { primary: "#14b8a6", secondary: "#042f2e" } },
          error:   { iconTheme: { primary: "#f87171", secondary: "#1c0a0a" } },
        }}
      />
    </>
  );
}
