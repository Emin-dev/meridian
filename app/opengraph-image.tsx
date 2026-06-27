import { ImageResponse } from "next/og";

// Open Graph / Twitter card image — brand 'M' mark on the cool-charcoal canvas.
export const runtime = "edge";
export const alt = "Meridian — AI sales & automation CRM";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "96px",
          background:
            "radial-gradient(120% 120% at 0% 0%, #1c1f27 0%, #0a0b0f 55%)",
          color: "#f2f4f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "112px",
              height: "112px",
              borderRadius: "28px",
              background: "#6d5cf5",
              color: "#ffffff",
              fontSize: "72px",
              fontWeight: 700,
            }}
          >
            M
          </div>
          <span style={{ fontSize: "64px", fontWeight: 600, letterSpacing: "-0.02em" }}>
            Meridian
          </span>
        </div>
        <span
          style={{
            marginTop: "40px",
            maxWidth: "880px",
            fontSize: "40px",
            lineHeight: 1.25,
            color: "#9ba2b1",
          }}
        >
          AI sales &amp; automation CRM
        </span>
      </div>
    ),
    { ...size }
  );
}
