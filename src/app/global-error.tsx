"use client";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: "#f3faf7", color: "#0f1f1a" }}>
        <title>Something went wrong | Ovelia</title>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 440 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#56665f", marginBottom: 20 }}>
            We hit an unexpected problem. Please try again{error.digest ? ` (reference ${error.digest})` : ""}.
          </p>
          <button
            onClick={() => retry()}
            style={{ background: "#0b4d3b", color: "#fff", border: 0, borderRadius: 999, padding: "10px 22px", fontSize: 15, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
