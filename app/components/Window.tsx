"use client";

import React from "react";

interface WindowProps {
  title?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Window({ title, children, className, style }: WindowProps) {
  return (
    <div
      className={className}
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 12,
        background: "#ffffff",
        boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
        maxWidth: "100%",
        ...style,
      }}
    >
      {title && (
        <div style={{ fontWeight: 600, marginBottom: 8, color: "#0f172a" }}>{title}</div>
      )}
      <div>{children}</div>
    </div>
  );
}
