import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Wind } from "lucide-react";
import {
  fetchPm25FromBmkg,
  logPm25Reading,
  fetchPm25History,
  getPm25Warna,
} from "./lib/karhutla";

// Kartu + grafik Kualitas Udara (PM2.5) — data ditarik dari BMKG lewat Netlify Function,
// dicatat ke Firestore setiap kali ada pengunjung supaya riwayatnya terkumpul jadi grafik.
export function KualitasUdaraSection() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ok | unavailable | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const reading = await fetchPm25FromBmkg();
        if (reading.found) {
          setCurrent(reading);
          setStatus("ok");
          // Catat ke Firestore untuk riwayat (tidak menghentikan alur kalau gagal)
          logPm25Reading(reading).catch(() => {});
        } else {
          setStatus("unavailable");
        }
      } catch (e) {
        setStatus("error");
        setErrorMsg(e && e.message ? e.message : "Gagal memuat data kualitas udara.");
      }

      try {
        const h = await fetchPm25History();
        setHistory(
          h.map((d) => ({
            ...d,
            label: new Date(d.diambilPada).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          }))
        );
      } catch (e) {
        // riwayat gagal dimuat tidak menghentikan tampilan kartu utama
      }
    })();
  }, []);

  const warna = current ? getPm25Warna(current.kategori) : "var(--ash-dim)";

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
        <Wind size={17} color="var(--smoke)" strokeWidth={2.2} />
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, margin: 0 }}>
          Kualitas Udara (PM2.5)
        </h2>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ash-dim)", margin: "0 0 16px" }}>
        Stasiun Pangkalanbun, Kotawaringin Barat — data ditarik langsung dari BMKG.
      </p>

      {status === "loading" && (
        <div style={{ fontSize: 13.5, color: "var(--ash-dim)" }}>Memuat data...</div>
      )}

      {status === "error" && (
        <div style={{ fontSize: 13, color: "var(--ember)" }}>
          Gagal memuat data kualitas udara. Detail: {errorMsg}
        </div>
      )}

      {status === "unavailable" && (
        <div style={{ fontSize: 13, color: "var(--ash-dim)" }}>
          Data Pangkalanbun sedang tidak tersedia dari BMKG saat ini.
        </div>
      )}

      {status === "ok" && current && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: `${warna}22`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: warna }}>
              {current.pm25}
            </span>
            <span style={{ fontSize: 9, color: "var(--ash-dim)" }}>µg/m³</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: warna }}>
              {current.kategori}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ash-dim)" }}>
              Pembaruan {current.waktu} &middot; {current.stasiun}
            </div>
          </div>
        </div>
      )}

      {history.length > 1 && (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="#382F24" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#B7AE9F", fontSize: 10 }} stroke="#382F24" />
              <YAxis tick={{ fill: "#B7AE9F", fontSize: 10 }} stroke="#382F24" />
              <Tooltip
                contentStyle={{
                  background: "#1F1A14",
                  border: "1px solid #382F24",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#EEE7DA",
                }}
                labelStyle={{ color: "#EEE7DA", fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="pm25"
                name="PM2.5 (µg/m³)"
                stroke="#8A9490"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: "#8A9490" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {history.length <= 1 && status === "ok" && (
        <p style={{ fontSize: 12, color: "var(--ash-dim)", margin: 0 }}>
          Grafik tren akan muncul setelah ada beberapa kali pembacaan tercatat (setiap pengunjung yang membuka halaman ini menambah satu titik data).
        </p>
      )}

      <p style={{ fontSize: 11, color: "var(--ash-dim)", marginTop: 14 }}>
        Sumber data: BMKG (bmkg.go.id/kualitas-udara/pm25)
      </p>
    </div>
  );
}
