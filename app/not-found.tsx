import Link from "next/link";

/**
 * The root 404 — for URLs with no locale segment at all (/nonsense,
 * /favicon-that-moved.png). It cannot use next-intl, because there is no locale
 * in the path to translate against, so it says both languages at once. That is
 * honest for a page whose whole situation is "we do not know who you are or
 * where you were going".
 *
 * Locale-prefixed misses are handled by app/[locale]/not-found.tsx, which is
 * fully translated.
 */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b0d13",
          color: "#f0f2f4",
          fontFamily: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "#6fa2ff",
            }}
          >
            404
          </p>
          <h1 style={{ margin: "1rem 0 0", fontSize: 24, fontWeight: 600 }}>
            这一页找不到。
          </h1>
          <p style={{ margin: "0.5rem 0 0", fontSize: 15, color: "#a0a5af" }}>
            This page does not exist.
          </p>
          <p style={{ margin: "2rem 0 0", display: "flex", gap: 12, justifyContent: "center" }}>
            <Link
              href="/zh"
              style={{
                background: "#6fa2ff",
                color: "#0b0d13",
                padding: "0.65rem 1.1rem",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              中文
            </Link>
            <Link
              href="/en"
              style={{
                border: "1px solid #2c303a",
                color: "#f0f2f4",
                padding: "0.65rem 1.1rem",
                borderRadius: 8,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              English
            </Link>
          </p>
        </div>
      </body>
    </html>
  );
}
