"use client";
/**
 * PersonalizedQR — QR code z ikoną drinka na środku (jak WhatsApp QR).
 * Generuje prawdziwy QR code z linkiem do /order/[id].
 * Na środku: kolorowa ikona drinka (emoji lub kolko z kolorem).
 */
import React, { useEffect, useState, useRef } from "react";

// Dynamiczny import qrcode (ESM)
let QRCodeLib: any = null;

export function PersonalizedQR({ 
  url, 
  color = "#E8927C", 
  size = 200,
  icon = "🍸",
}: { 
  url: string; 
  color?: string; 
  size?: number;
  icon?: string;
}) {
  const [svgData, setSvgData] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Generuj QR jako data URL (canvas)
    const generate = async () => {
      if (!QRCodeLib) {
        QRCodeLib = await import("qrcode");
      }
      try {
        const dataUrl = await QRCodeLib.toDataURL(url, {
          width: size,
          margin: 2,
          color: { dark: "#1A3D52", light: "#FFFFFF" },
          errorCorrectionLevel: "H", // wysoki — pozwala na logo na środku
        });
        setSvgData(dataUrl);
      } catch (e) {
        console.error("QR generation error:", e);
      }
    };
    generate();
  }, [url, size]);

  if (!svgData) {
    return (
      <div style={{ width: size, height: size, background: "#fff", borderRadius: 16, display: "grid", placeItems: "center" }}>
        <span style={{ fontSize: 32, opacity: 0.3 }}>⏳</span>
      </div>
    );
  }

  return (
    <div className="pqr-wrap" style={{ position: "relative", width: size, height: size }}>
      {/* QR code */}
      <img src={svgData} alt="QR Code" style={{ width: "100%", height: "100%", borderRadius: 16 }} />
      
      {/* Ikona na środku — kolorowe kółko z emoji */}
      <div className="pqr-center" style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: size * 0.22, height: size * 0.22,
        borderRadius: "50%",
        background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 4px 16px ${color}66`,
        border: "3px solid #fff",
      }}>
        <span style={{ fontSize: size * 0.1, lineHeight: 1 }}>{icon}</span>
      </div>

      <style>{`
        .pqr-wrap { flex-shrink: 0; }
      `}</style>
    </div>
  );
}

export default PersonalizedQR;
