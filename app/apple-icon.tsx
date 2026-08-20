import { ImageResponse } from "next/og";

/**
 * The icon iOS uses for a home-screen bookmark, and one of the images
 * WhatsApp reaches for. Without it iOS screenshots the page and scales that
 * down, which at 180px is an unreadable grey smear.
 *
 * Latin-only by design — a single letterform needs no font subset, so this
 * route has no network dependency and cannot fail the way the OG card can.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a1020",
          backgroundImage: "radial-gradient(140px 140px at 30% 18%, rgba(34,97,221,0.55), rgba(10,16,32,0) 72%)",
          color: "#7fa8f7",
          fontSize: 108,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        F
      </div>
    ),
    size,
  );
}
