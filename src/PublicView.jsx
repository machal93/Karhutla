import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Flame, MapPin, Calendar, AlertTriangle, FileDown, Map as MapIcon } from "lucide-react";
import {
  emberIcon,
  KALTENG_CENTER,
  PROVINSI_LIST,
  formatTanggal,
  formatNum,
  fetchAllEntries,
  KARHUTLA_STYLES,
  KARHUTLA_THEME_VARS,
} from "./lib/karhutla";
import { StatusPeringatanCard } from "./StatusPeringatan";
import { KualitasUdaraSection } from "./KualitasUdara";

export default function PublicView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterProvinsi, setFilterProvinsi] = useState("Semua");
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exportMsg, setExportMsg] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const all = await fetchAllEntries();
        setEntries(all);
      } catch (e) {
        const detail = e && e.message ? e.message : "permintaan gagal sebelum sampai ke server";
        setError(`Gagal memuat data. Detail: ${detail}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (filterProvinsi === "Semua") return entries;
    return entries.filter((e) => e.provinsi === filterProvinsi);
  }, [entries, filterProvinsi]);

  const chartData = useMemo(() => {
    const byDate = {};
    filtered.forEach((e) => {
      if (!byDate[e.tanggal]) {
        byDate[e.tanggal] = { tanggal: e.tanggal, titikApi: 0, luasHa: 0 };
      }
      byDate[e.tanggal].titikApi += e.titikApi;
      byDate[e.tanggal].luasHa += e.luasHa;
    });
    return Object.values(byDate)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      .map((d) => ({ ...d, label: formatTanggal(d.tanggal) }));
  }, [filtered]);

  const mapPoints = useMemo(() => {
    const points = [];
    filtered.forEach((e) => {
      (e.koordinat || []).forEach((k, idx) => {
        if (Number.isFinite(k.lat) && Number.isFinite(k.lng)) {
          points.push({
            key: `${e.id}-${idx}`,
            lat: k.lat,
            lng: k.lng,
            tanggal: e.tanggal,
            provinsi: e.provinsi,
            keterangan: e.keterangan,
          });
        }
      });
    });
    return points;
  }, [filtered]);

  const hotspotChartData = useMemo(() => {
    const byDate = {};
    filtered.forEach((e) => {
      const jumlah = Array.isArray(e.koordinat) ? e.koordinat.length : 0;
      if (!byDate[e.tanggal]) byDate[e.tanggal] = { tanggal: e.tanggal, titikHotspot: 0 };
      byDate[e.tanggal].titikHotspot += jumlah;
    });
    return Object.values(byDate)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      .map((d) => ({ ...d, label: formatTanggal(d.tanggal) }));
  }, [filtered]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, e) => {
        acc.titikApi += e.titikApi;
        acc.luasHa += e.luasHa;
        return acc;
      },
      { titikApi: 0, luasHa: 0 }
    );
  }, [filtered]);

  const provinsiTerdampak = useMemo(() => {
    return new Set(filtered.map((e) => e.provinsi)).size;
  }, [filtered]);

  const rangeData = useMemo(() => {
    if (!exportStart || !exportEnd) return [];
    return entries
      .filter((e) => e.tanggal >= exportStart && e.tanggal <= exportEnd)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [entries, exportStart, exportEnd]);

  const rangeTotals = useMemo(() => {
    return rangeData.reduce(
      (acc, e) => {
        acc.titikApi += e.titikApi;
        acc.luasHa += e.luasHa;
        return acc;
      },
      { titikApi: 0, luasHa: 0 }
    );
  }, [rangeData]);

  function handleExportExcel() {
    setExportMsg("");
    if (!exportStart || !exportEnd) {
      setExportMsg("Pilih tanggal awal dan tanggal akhir terlebih dahulu.");
      return;
    }
    if (rangeData.length === 0) {
      setExportMsg("Tidak ada data pada rentang tanggal tersebut.");
      return;
    }

    const judul = "LAPORAN KARHUTLA \u2014 KALIMANTAN TENGAH";
    const periode = `Periode: ${formatTanggal(exportStart)} - ${formatTanggal(exportEnd)}`;
    const dibuat = `Dibuat: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`;

    const perWilayah = {};
    rangeData.forEach((e) => {
      if (!perWilayah[e.provinsi]) {
        perWilayah[e.provinsi] = { wilayah: e.provinsi, entri: 0, titikApi: 0, luasHa: 0 };
      }
      perWilayah[e.provinsi].entri += 1;
      perWilayah[e.provinsi].titikApi += e.titikApi;
      perWilayah[e.provinsi].luasHa += e.luasHa;
    });
    const wilayahRows = Object.values(perWilayah).sort((a, b) => b.titikApi - a.titikApi);

    const ringkasanAoa = [
      [judul],
      [periode],
      [dibuat],
      [],
      ["Ringkasan Per Kabupaten/Kota"],
      ["Kabupaten/Kota", "Jumlah Entri", "Total Titik Api", "Total Luas Terbakar (ha)"],
      ...wilayahRows.map((w) => [w.wilayah, w.entri, w.titikApi, w.luasHa]),
      [],
      ["TOTAL KESELURUHAN", rangeData.length, rangeTotals.titikApi, rangeTotals.luasHa],
    ];
    const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanAoa);
    wsRingkasan["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 22 }];
    wsRingkasan["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 3 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsRingkasan, "Ringkasan");
    XLSX.writeFile(wb, `laporan-karhutla_${exportStart}_${exportEnd}.xlsx`);
    setExportMsg(`Berhasil mengekspor ringkasan ${rangeData.length} entri.`);
  }

  return (
    <div
      style={{
        ...KARHUTLA_THEME_VARS,
        fontFamily: "'Inter', -apple-system, sans-serif",
        background:
          "radial-gradient(ellipse 120% 80% at 50% -10%, #2A1D12 0%, var(--bg) 55%)",
        color: "var(--ash)",
        minHeight: "100%",
        padding: "0",
      }}
    >
      <style>{KARHUTLA_STYLES}</style>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "36px 24px 60px" }} className="karhutla-root">
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--ember)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            <Flame size={14} strokeWidth={2.5} />
            Pemantauan Titik Panas
          </div>
          <h1
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 4vw, 40px)",
              margin: 0,
              letterSpacing: "-0.01em",
              lineHeight: 1.05,
            }}
          >
            Monitor Karhutla
          </h1>
          <p style={{ color: "var(--ash-dim)", fontSize: 14.5, marginTop: 10, maxWidth: 560, lineHeight: 1.6 }}>
            Data kebakaran hutan dan lahan di Kalimantan Tengah — jumlah titik api dan luas area
            terbakar, diperbarui langsung dari lapangan.
          </p>
          <div className="ember-rule" style={{ marginTop: 20 }} />
        </div>

        <StatusPeringatanCard />
        <KualitasUdaraSection />

        {error && (
          <div
            style={{
              background: "#D6491F18",
              border: "1px solid var(--ember)",
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 24,
              fontSize: 13.5,
              color: "var(--ash)",
            }}
          >
            {error}
          </div>
        )}

        {/* Ringkasan */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            { label: "Total Titik Api", value: formatNum(totals.titikApi), icon: Flame, color: "var(--ember)" },
            { label: "Total Luas Terbakar", value: `${formatNum(totals.luasHa)} ha`, icon: AlertTriangle, color: "var(--amber)" },
            { label: "Kab/Kota Terdampak", value: provinsiTerdampak, icon: MapPin, color: "var(--smoke)" },
            { label: "Total Titik Hotspot", value: mapPoints.length, icon: MapIcon, color: "var(--ember)" },
            { label: "Jumlah Entri", value: filtered.length, icon: Calendar, color: "var(--ash-dim)" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "16px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <s.icon size={13} color={s.color} strokeWidth={2.5} />
                <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ash-dim)", fontWeight: 600 }}>
                  {s.label}
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: "var(--ash)" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        {entries.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span className="karhutla-label" style={{ marginBottom: 0 }}>Filter Kabupaten/Kota</span>
            <select
              className="karhutla-input"
              style={{ width: "auto", minWidth: 180 }}
              value={filterProvinsi}
              onChange={(e) => setFilterProvinsi(e.target.value)}
            >
              <option value="Semua">Semua Kabupaten/Kota</option>
              {[...new Set(entries.map((e) => e.provinsi))].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        {/* Grafik */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "20px 12px 12px",
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, margin: "0 0 4px 12px" }}>
            Tren Karhutla
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--ash-dim)", margin: "0 0 12px 12px" }}>
            Jumlah titik api dan luas lahan terbakar (ha) per tanggal
          </p>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ash-dim)", fontSize: 13.5 }}>
              Memuat data...
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ash-dim)", fontSize: 13.5 }}>
              Belum ada data untuk ditampilkan.
            </div>
          ) : (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke="#382F24" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#B7AE9F", fontSize: 11 }} stroke="#382F24" />
                  <YAxis yAxisId="left" tick={{ fill: "#B7AE9F", fontSize: 11 }} stroke="#382F24" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#B7AE9F", fontSize: 11 }} stroke="#382F24" />
                  <Tooltip
                    contentStyle={{
                      background: "#1F1A14",
                      border: "1px solid #382F24",
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: "#EEE7DA",
                    }}
                    labelStyle={{ color: "#EEE7DA", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12.5, color: "#B7AE9F" }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="titikApi"
                    name="Titik Api"
                    stroke="#D6491F"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#D6491F" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="luasHa"
                    name="Luas (ha)"
                    stroke="#DFA43C"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#DFA43C" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Grafik tren titik hotspot */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "20px 12px 12px",
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, margin: "0 0 4px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <MapIcon size={16} color="var(--smoke)" />
            Tren Titik Hotspot
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--ash-dim)", margin: "0 0 12px 12px" }}>
            Jumlah koordinat titik hotspot yang tercatat per tanggal
          </p>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ash-dim)", fontSize: 13.5 }}>
              Memuat data...
            </div>
          ) : hotspotChartData.every((d) => d.titikHotspot === 0) ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ash-dim)", fontSize: 13.5 }}>
              Belum ada koordinat titik hotspot yang tersedia.
            </div>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hotspotChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke="#382F24" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#B7AE9F", fontSize: 11 }} stroke="#382F24" />
                  <YAxis tick={{ fill: "#B7AE9F", fontSize: 11 }} stroke="#382F24" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#1F1A14",
                      border: "1px solid #382F24",
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: "#EEE7DA",
                    }}
                    labelStyle={{ color: "#EEE7DA", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12.5, color: "#B7AE9F" }} />
                  <Line
                    type="monotone"
                    dataKey="titikHotspot"
                    name="Titik Hotspot"
                    stroke="#8A9490"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#8A9490" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Peta */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "20px 20px 12px",
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <MapIcon size={16} color="var(--ember)" />
            Peta Sebaran Titik Hotspot
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--ash-dim)", margin: "0 0 14px" }}>
            {mapPoints.length > 0
              ? `Menampilkan ${mapPoints.length} titik koordinat hotspot`
              : "Belum ada titik koordinat yang tersedia."}
          </p>
          <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
            <MapContainer
              center={mapPoints.length > 0 ? [mapPoints[0].lat, mapPoints[0].lng] : KALTENG_CENTER}
              zoom={mapPoints.length > 0 ? 8 : 7}
              style={{ height: 380, width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapPoints.map((p) => (
                <Marker key={p.key} position={[p.lat, p.lng]} icon={emberIcon}>
                  <Popup>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <strong>{formatTanggal(p.tanggal)}</strong>
                      <br />
                      {p.provinsi}
                      <br />
                      {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                      {p.keterangan ? (
                        <>
                          <br />
                          <em>{p.keterangan}</em>
                        </>
                      ) : null}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Kompilasi & Ekspor */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 22,
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, margin: "0 0 4px", letterSpacing: "0.01em" }}>
            Kompilasi & Ekspor Laporan
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--ash-dim)", margin: "0 0 16px" }}>
            Pilih rentang tanggal untuk mengunduh ringkasan laporan dalam format Excel.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
            <div>
              <label className="karhutla-label">Dari Tanggal</label>
              <input
                type="date"
                className="karhutla-input"
                value={exportStart}
                onChange={(e) => setExportStart(e.target.value)}
              />
            </div>
            <div>
              <label className="karhutla-label">Sampai Tanggal</label>
              <input
                type="date"
                className="karhutla-input"
                value={exportEnd}
                onChange={(e) => setExportEnd(e.target.value)}
              />
            </div>
          </div>

          {exportStart && exportEnd && (
            <div style={{ fontSize: 13, color: "var(--ash-dim)", marginBottom: 16 }}>
              {rangeData.length > 0 ? (
                <>
                  <strong style={{ color: "var(--ash)" }}>{rangeData.length} entri</strong> ditemukan &middot;{" "}
                  Total titik api: <strong style={{ color: "var(--ember)" }}>{formatNum(rangeTotals.titikApi)}</strong> &middot;{" "}
                  Total luas: <strong style={{ color: "var(--amber)" }}>{formatNum(rangeTotals.luasHa)} ha</strong>
                </>
              ) : (
                "Tidak ada data pada rentang tanggal ini."
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="export-btn" onClick={handleExportExcel}>
              <FileDown size={15} />
              Ekspor ke Excel
            </button>
          </div>
          {exportMsg && (
            <div style={{ fontSize: 12.5, color: "var(--amber)", marginTop: 12 }}>{exportMsg}</div>
          )}
        </div>

        {/* Tabel data */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, margin: 0, padding: "18px 16px 12px" }}>
            Riwayat Data
          </h2>
          {filtered.length === 0 ? (
            <div style={{ padding: "0 16px 24px", color: "var(--ash-dim)", fontSize: 13.5 }}>
              Tidak ada data untuk ditampilkan.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="karhutla-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Kabupaten/Kota</th>
                    <th>Titik Api</th>
                    <th>Luas (ha)</th>
                    <th>Koordinat</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered]
                    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
                    .map((e) => (
                      <tr key={e.id}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--ash-dim)" }}>
                          {formatTanggal(e.tanggal)}
                        </td>
                        <td>{e.provinsi}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--ember)" }}>
                          {formatNum(e.titikApi)}
                        </td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--amber)" }}>
                          {formatNum(e.luasHa)}
                        </td>
                        <td style={{ color: "var(--ash-dim)", fontSize: 12.5 }}>
                          {e.koordinat && e.koordinat.length > 0 ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <MapIcon size={12} color="var(--smoke)" />
                              {e.koordinat.length} titik
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ color: "var(--ash-dim)" }}>{e.keterangan || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: "var(--ash-dim)", marginTop: 20, textAlign: "center" }}>
          Data diperbarui langsung dari tim lapangan. Halaman ini bersifat tampilan saja.
        </p>
      </div>
    </div>
  );
}
