import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "研学港 Researchopia";
  const subtitle = searchParams.get("subtitle") || "研学并进，智慧共享";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: "60px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
            }}
          >
            📚
          </div>
          <span style={{ fontSize: "28px", opacity: 0.9 }}>Researchopia</span>
        </div>

        <h1
          style={{
            fontSize: "56px",
            fontWeight: 700,
            margin: "0 0 16px 0",
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: "900px",
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: "24px",
            opacity: 0.85,
            margin: 0,
            textAlign: "center",
          }}
        >
          {subtitle}
        </p>

        <div
          style={{
            position: "absolute",
            bottom: "40px",
            fontSize: "16px",
            opacity: 0.6,
          }}
        >
          开放的学术交流与知识共享平台 | Open Academic Exchange & Knowledge Sharing
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
