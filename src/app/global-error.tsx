"use client";

/**
 * Last-resort boundary: this replaces the root layout entirely, so it cannot
 * use any of the app shell and has to ship its own html and body.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          margin: 0,
          background: "#fdfcf7",
          color: "#0c0a09",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Something broke</h1>
          <p style={{ color: "#57534e", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Your saved work is stored in this browser and has not been touched. Reloading is safe.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#0f766e",
              color: "#ffffff",
              border: 0,
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Reload the app
          </button>
        </main>
      </body>
    </html>
  );
}
