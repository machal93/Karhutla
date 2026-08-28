import React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { BMKG_FWI_IMAGE_URL, BMKG_FWI_PAGE_URL } from "./lib/karhutla";

// Kartu Status Peringatan Dini — menampilkan peta Fire Weather Index (FWI) resmi dari BMKG.
// Gambar diperbarui otomatis oleh BMKG sendiri, jadi tidak perlu input manual di sisi kita.
export function StatusPeringatanCard() {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: 20,
        marginBottom: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <AlertTriangle size={17} color="var(--ember)" strokeWidth={2.2} />
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, margin: 0 }}>
          Status Peringatan Dini
        </h2>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ash-dim)", margin: "0 0 14px" }}>
        Peta Fire Weather Index (FWI) — indeks intensitas api jika terjadi kebakaran, wilayah Indonesia. Diperbarui otomatis oleh BMKG.
      </p>

      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)", background: "#0000001a" }}>
        <img
          src={BMKG_FWI_IMAGE_URL}
          alt="Peta Fire Weather Index (FWI) Indonesia — sumber BMKG"
          style={{ width: "100%", height: "auto", display: "block" }}
          loading="lazy"
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 10,
        }}
      >
        <span style={{ fontSize: 11.5, color: "var(--ash-dim)" }}>
          Sumber &amp; hak cipta gambar: Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)
        </span>
        <a
          href={BMKG_FWI_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--ash)",
            textDecoration: "none",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "8px 12px",
            flexShrink: 0,
          }}
        >
          Lihat di BMKG
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
