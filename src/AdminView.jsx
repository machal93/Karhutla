import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { Flame, MapPin, Calendar, Trash2, Plus, AlertTriangle, Pencil, X, FileDown, Map as MapIcon, Eye } from "lucide-react";
import {
  emberIcon,
  KALTENG_CENTER,
  FIRESTORE_BASE,
  entryToFirestoreFields,
  firestoreDocToEntry,
  PROVINSI_LIST,
  formatTanggal,
  formatNum,
  fetchAllEntries,
  KARHUTLA_STYLES,
  KARHUTLA_THEME_VARS,
} from "./lib/karhutla";

// Komponen kecil untuk menangkap event klik di peta dan meneruskan koordinatnya
function MapClickCatcher({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AdminView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterProvinsi, setFilterProvinsi] = useState("Semua");
  const [editingId, setEditingId] = useState(null);
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exportMsg, setExportMsg] = useState("");

  const [form, setForm] = useState({
    tanggal: new Date().toISOString().slice(0, 10),
    provinsi: PROVINSI_LIST[0],
    titikApi: "",
    luasHa: "",
    keterangan: "",
    koordinat: [],
  });
  const formRef = useRef(null);

  function pickKoordinat(lat, lng) {
    setForm((f) => ({ ...f, koordinat: [...f.koordinat, { lat, lng }] }));
  }

  function moveKoordinatRow(idx, lat, lng) {
    setForm((f) => ({
      ...f,
      koordinat: f.koordinat.map((k, i) => (i === idx ? { lat, lng } : k)),
    }));
  }

  function removeKoordinatRow(idx) {
    setForm((f) => ({ ...f, koordinat: f.koordinat.filter((_, i) => i !== idx) }));
  }

  async function loadFromFirestore() {
    setLoading(true);
    setError("");
    try {
      const all = await fetchAllEntries();
      setEntries(all);
    } catch (e) {
      const detail = e && e.message ? e.message : "permintaan diblokir sebelum sampai ke server (kemungkinan CORS/jaringan)";
      setError(`Gagal terhubung ke Firestore. Detail: ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFromFirestore();
  }, []);

  async function handleSubmit() {
    if (!form.tanggal || form.titikApi === "" || form.luasHa === "") {
      setError("Isi tanggal, jumlah titik api, dan luas lahan terlebih dahulu.");
      return;
    }

    const validKoordinat = form.koordinat.filter(
      (k) => Number.isFinite(k.lat) && Number.isFinite(k.lng)
    );

    const koordinatDiLuarWilayah = validKoordinat.filter(
      (k) => k.lat < -11 || k.lat > 6 || k.lng < 95 || k.lng > 141
    );
    if (koordinatDiLuarWilayah.length > 0) {
      setError(
        `Ada ${koordinatDiLuarWilayah.length} koordinat yang tampak di luar wilayah Indonesia (lat sekitar -1 s/d -3, lng sekitar 111 s/d 115 untuk Kalimantan Tengah). Periksa lagi urutan Latitude/Longitude-nya, mungkin tertukar atau salah ketik.`
      );
      return;
    }

    const payload = {
      tanggal: form.tanggal,
      provinsi: form.provinsi,
      titikApi: Number(form.titikApi),
      luasHa: Number(form.luasHa),
      keterangan: form.keterangan.trim(),
      koordinat: validKoordinat,
    };

    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const fields = entryToFirestoreFields(payload);
        const maskParams = Object.keys(fields)
          .map((k) => `updateMask.fieldPaths=${k}`)
          .join("&");
        const res = await fetch(`${FIRESTORE_BASE}/${editingId}?${maskParams}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });
        if (!res.ok) {
          const bodyText = await res.text();
          throw new Error(`HTTP ${res.status}: ${bodyText}`);
        }
        setEntries((prev) =>
          prev
            .map((e) => (e.id === editingId ? { ...payload, id: editingId } : e))
            .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
        );
        setEditingId(null);
      } else {
        const res = await fetch(FIRESTORE_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: entryToFirestoreFields(payload) }),
        });
        if (!res.ok) {
          const bodyText = await res.text();
          throw new Error(`HTTP ${res.status}: ${bodyText}`);
        }
        const data = await res.json();
        const created = firestoreDocToEntry(data);
        setEntries((prev) => [...prev, created].sort((a, b) => a.tanggal.localeCompare(b.tanggal)));
      }
      setForm((f) => ({ ...f, titikApi: "", luasHa: "", keterangan: "", koordinat: [] }));
    } catch (e) {
      const detail = e && e.message ? e.message : "permintaan gagal sebelum sampai ke server";
      setError(`Gagal menyimpan ke Firestore. Detail: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setError("");
    setForm({
      tanggal: entry.tanggal,
      provinsi: entry.provinsi,
      titikApi: String(entry.titikApi),
      luasHa: String(entry.luasHa),
      keterangan: entry.keterangan || "",
      koordinat: Array.isArray(entry.koordinat)
        ? entry.koordinat.map((k) => ({ lat: Number(k.lat), lng: Number(k.lng) }))
        : [],
    });
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleCancelEdit() {
    setEditingId(null);
    setError("");
    setForm({
      tanggal: new Date().toISOString().slice(0, 10),
      provinsi: PROVINSI_LIST[0],
      titikApi: "",
      luasHa: "",
      keterangan: "",
      koordinat: [],
    });
  }

  async function handleDelete(id) {
    setError("");
    try {
      const res = await fetch(`${FIRESTORE_BASE}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(`HTTP ${res.status}: ${bodyText}`);
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) handleCancelEdit();
    } catch (e) {
      const detail = e && e.message ? e.message : "permintaan gagal sebelum sampai ke server";
      setError(`Gagal menghapus data di Firestore. Detail: ${detail}`);
    }
  }

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

    // ---- Sheet 1: Ringkasan per Kabupaten/Kota ----
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
    const headerRow = 5; // baris header tabel (0-indexed)
    const lastDataRow = headerRow + wilayahRows.length; // baris terakhir data wilayah
    const totalRow = lastDataRow + 2; // baris TOTAL KESELURUHAN
    for (let r = headerRow + 1; r <= lastDataRow; r++) {
      const cellApi = wsRingkasan[XLSX.utils.encode_cell({ r, c: 2 })];
      const cellLuas = wsRingkasan[XLSX.utils.encode_cell({ r, c: 3 })];
      if (cellApi) cellApi.z = "#,##0";
      if (cellLuas) cellLuas.z = "#,##0.0";
    }
    const totalApiCell = wsRingkasan[XLSX.utils.encode_cell({ r: totalRow, c: 2 })];
    const totalLuasCell = wsRingkasan[XLSX.utils.encode_cell({ r: totalRow, c: 3 })];
    if (totalApiCell) totalApiCell.z = "#,##0";
    if (totalLuasCell) totalLuasCell.z = "#,##0.0";

    // ---- Sheet 2: Data Rinci ----
    const dataAoa = [
      [judul],
      [periode],
      [],
      ["Tanggal", "Kabupaten/Kota", "Titik Api", "Luas Terbakar (ha)", "Keterangan"],
      ...rangeData.map((e) => [
        formatTanggal(e.tanggal),
        e.provinsi,
        e.titikApi,
        e.luasHa,
        e.keterangan || "-",
      ]),
      [],
      ["TOTAL", `${rangeData.length} entri`, rangeTotals.titikApi, rangeTotals.luasHa, ""],
    ];
    const wsData = XLSX.utils.aoa_to_sheet(dataAoa);
    wsData["!cols"] = [{ wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 34 }];
    wsData["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];
    const dataHeaderRow = 3;
    const dataLastRow = dataHeaderRow + rangeData.length;
    const dataTotalRow = dataLastRow + 2;
    for (let r = dataHeaderRow + 1; r <= dataLastRow; r++) {
      const cellApi = wsData[XLSX.utils.encode_cell({ r, c: 2 })];
      const cellLuas = wsData[XLSX.utils.encode_cell({ r, c: 3 })];
      if (cellApi) cellApi.z = "#,##0";
      if (cellLuas) cellLuas.z = "#,##0.0";
    }
    const dTotalApi = wsData[XLSX.utils.encode_cell({ r: dataTotalRow, c: 2 })];
    const dTotalLuas = wsData[XLSX.utils.encode_cell({ r: dataTotalRow, c: 3 })];
    if (dTotalApi) dTotalApi.z = "#,##0";
    if (dTotalLuas) dTotalLuas.z = "#,##0.0";
    wsData["!autofilter"] = {
      ref: XLSX.utils.encode_range(
        { r: dataHeaderRow, c: 0 },
        { r: dataLastRow, c: 4 }
      ),
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsRingkasan, "Ringkasan");
    XLSX.utils.book_append_sheet(wb, wsData, "Data Rinci");
    XLSX.writeFile(wb, `laporan-karhutla_${exportStart}_${exportEnd}.xlsx`);
    setExportMsg(`Berhasil mengekspor ${rangeData.length} entri (2 sheet: Ringkasan & Data Rinci).`);
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
            <span
              style={{
                marginLeft: 4,
                fontSize: 10.5,
                background: "#DFA43C22",
                color: "var(--amber)",
                padding: "3px 8px",
                borderRadius: 999,
                letterSpacing: "0.04em",
              }}
            >
              Mode Admin
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
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
            <Link
              to="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: "var(--ash-dim)",
                textDecoration: "none",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              <Eye size={13} />
              Lihat halaman publik
            </Link>
          </div>
          <p style={{ color: "var(--ash-dim)", fontSize: 14.5, marginTop: 10, maxWidth: 560, lineHeight: 1.6 }}>
            Catat data kebakaran hutan dan lahan harian — jumlah titik api dan luas area terbakar —
            lalu pantau trennya dalam grafik.
          </p>
          <div className="ember-rule" style={{ marginTop: 20 }} />
        </div>

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

        {/* Form input */}
        <div
          ref={formRef}
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 22,
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, margin: "0 0 16px", letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: 10 }}>
            {editingId ? "Edit Data" : "Tambah Data Baru"}
            {editingId && (
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 600, color: "var(--amber)", background: "#DFA43C22", padding: "3px 9px", borderRadius: 999, textTransform: "none", letterSpacing: 0 }}>
                Sedang mengedit
              </span>
            )}
          </h2>
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 14 }}>
              <div>
                <label className="karhutla-label">Tanggal</label>
                <input
                  type="date"
                  className="karhutla-input"
                  value={form.tanggal}
                  onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
                />
              </div>
              <div>
                <label className="karhutla-label">Kabupaten/Kota</label>
                <select
                  className="karhutla-input"
                  value={form.provinsi}
                  onChange={(e) => setForm((f) => ({ ...f, provinsi: e.target.value }))}
                >
                  {PROVINSI_LIST.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="karhutla-label">Jumlah Titik Api</label>
                <input
                  type="number"
                  min="0"
                  className="karhutla-input"
                  placeholder="mis. 24"
                  value={form.titikApi}
                  onChange={(e) => setForm((f) => ({ ...f, titikApi: e.target.value }))}
                />
              </div>
              <div>
                <label className="karhutla-label">Luas Terbakar (ha)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="karhutla-input"
                  placeholder="mis. 12.5"
                  value={form.luasHa}
                  onChange={(e) => setForm((f) => ({ ...f, luasHa: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="karhutla-label">Keterangan (opsional)</label>
              <input
                type="text"
                className="karhutla-input"
                placeholder="mis. lahan gambut, dekat pemukiman, dll."
                value={form.keterangan}
                onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label className="karhutla-label" style={{ marginBottom: 0 }}>
                  Koordinat Titik Hotspot (opsional)
                </label>
                {form.koordinat.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, koordinat: [] }))}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--ash-dim)",
                      fontSize: 12,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Hapus semua
                  </button>
                )}
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ash-dim)", margin: "0 0 10px" }}>
                Klik di peta untuk menandai titik hotspot. Geser marker untuk menyesuaikan posisi, klik marker untuk menghapusnya.
              </p>
              <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
                <MapContainer
                  center={form.koordinat.length > 0 ? [form.koordinat[0].lat, form.koordinat[0].lng] : KALTENG_CENTER}
                  zoom={form.koordinat.length > 0 ? 9 : 7}
                  style={{ height: 300, width: "100%", cursor: "crosshair" }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapClickCatcher onPick={pickKoordinat} />
                  {form.koordinat.map((k, idx) => (
                    <Marker
                      key={idx}
                      position={[k.lat, k.lng]}
                      icon={emberIcon}
                      draggable
                      eventHandlers={{
                        dragend: (e) => {
                          const pos = e.target.getLatLng();
                          moveKoordinatRow(idx, pos.lat, pos.lng);
                        },
                        click: () => removeKoordinatRow(idx),
                      }}
                    >
                      <Popup>
                        <div style={{ fontSize: 12.5 }}>
                          Titik #{idx + 1}
                          <br />
                          {k.lat.toFixed(5)}, {k.lng.toFixed(5)}
                          <br />
                          <span style={{ color: "#888" }}>Klik marker untuk hapus</span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              {form.koordinat.length > 0 && (
                <p style={{ fontSize: 12, color: "var(--ash-dim)", margin: "8px 0 0" }}>
                  {form.koordinat.length} titik ditandai.
                </p>
              )}
            </div>

            {error && (
              <div style={{ color: "var(--ember)", fontSize: 13, marginBottom: 14 }}>{error}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="karhutla-btn" disabled={saving} onClick={handleSubmit}>
                {editingId ? <Pencil size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
                {saving ? "Menyimpan..." : editingId ? "Update Data" : "Simpan Data"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--line)",
                    color: "var(--ash-dim)",
                    borderRadius: 6,
                    padding: "11px 18px",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <X size={16} strokeWidth={2.5} />
                  Batal
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter */}
        {entries.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
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
            Pilih rentang tanggal untuk menggabungkan data menjadi satu laporan Excel, lengkap dengan ringkasan per kabupaten/kota.
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
              Belum ada data. Tambahkan entri pertama di atas.
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
              Belum ada koordinat titik hotspot yang diinput.
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

        {/* Peta sebaran titik hotspot */}
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
              : "Belum ada titik koordinat yang diinput. Tambahkan koordinat lewat form di atas."}
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
                    <th></th>
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
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="del-btn" onClick={() => handleEdit(e)} title="Edit entri">
                              <Pencil size={14} />
                            </button>
                            <button className="del-btn" onClick={() => handleDelete(e.id)} title="Hapus entri">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: "var(--ash-dim)", marginTop: 20, textAlign: "center" }}>
          Data disimpan otomatis di perangkat ini dan tetap ada saat Anda membuka kembali situs ini.
        </p>
      </div>
    </div>
  );
}
