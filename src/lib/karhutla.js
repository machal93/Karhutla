import L from "leaflet";

// Perbaikan ikon marker default Leaflet agar tampil benar saat di-bundle
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export const emberIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Titik tengah Kalimantan Tengah, untuk posisi awal peta
export const KALTENG_CENTER = [-1.6815, 113.3824];

export const FIREBASE_PROJECT_ID = "monitor-karhutla-db153";
export const FIRESTORE_COLLECTION = "karhutla";
export const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}`;

export function entryToFirestoreFields(e) {
  const koordinat = Array.isArray(e.koordinat) ? e.koordinat : [];
  return {
    tanggal: { stringValue: e.tanggal },
    provinsi: { stringValue: e.provinsi },
    titikApi: { integerValue: String(Math.round(e.titikApi)) },
    luasHa: { doubleValue: Number(e.luasHa) },
    keterangan: { stringValue: e.keterangan || "" },
    koordinat: {
      arrayValue: {
        values: koordinat.map((k) => ({
          mapValue: {
            fields: {
              lat: { doubleValue: Number(k.lat) },
              lng: { doubleValue: Number(k.lng) },
            },
          },
        })),
      },
    },
  };
}

export function firestoreDocToEntry(doc) {
  const f = doc.fields || {};
  const koordinatValues = f.koordinat?.arrayValue?.values || [];
  return {
    id: doc.name.split("/").pop(),
    tanggal: f.tanggal?.stringValue || "",
    provinsi: f.provinsi?.stringValue || "",
    titikApi: Number(f.titikApi?.integerValue ?? f.titikApi?.doubleValue ?? 0),
    luasHa: Number(f.luasHa?.doubleValue ?? f.luasHa?.integerValue ?? 0),
    keterangan: f.keterangan?.stringValue || "",
    koordinat: koordinatValues.map((v) => ({
      lat: Number(v.mapValue?.fields?.lat?.doubleValue ?? v.mapValue?.fields?.lat?.integerValue ?? 0),
      lng: Number(v.mapValue?.fields?.lng?.doubleValue ?? v.mapValue?.fields?.lng?.integerValue ?? 0),
    })),
  };
}

export const PROVINSI_LIST = [
  "Palangka Raya",
  "Barito Selatan",
  "Barito Timur",
  "Barito Utara",
  "Gunung Mas",
  "Kapuas",
  "Katingan",
  "Kotawaringin Barat",
  "Kotawaringin Timur",
  "Lamandau",
  "Murung Raya",
  "Pulang Pisau",
  "Sukamara",
  "Seruyan",
];

export function formatTanggal(iso) {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatNum(n) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export async function fetchAllEntries() {
  let all = [];
  let pageToken;
  do {
    const url = new URL(FIRESTORE_BASE);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`HTTP ${res.status}: ${bodyText}`);
    }
    const data = await res.json();
    if (data.documents) {
      all = all.concat(data.documents.map(firestoreDocToEntry));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  all.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  return all;
}

export const BMKG_FWI_IMAGE_URL = "https://dataweb.bmkg.go.id/cuaca/spartan/36_indonesia_fwi_obs.png";
export const BMKG_FWI_PAGE_URL = "https://www.bmkg.go.id/cuaca/karhutla/fwi";

// --- Kualitas Udara (PM2.5) — ditarik dari BMKG lewat Netlify Function, lalu dicatat ke Firestore ---
export const PM25_FUNCTION_URL = "/.netlify/functions/bmkg-pm25";
export const PM25_COLLECTION = "kualitas_udara";
export const PM25_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${PM25_COLLECTION}`;

export const PM25_KATEGORI_WARNA = {
  "Baik": "#4C9A6B",
  "Sedang": "#DFA43C",
  "Tidak Sehat": "#D6491F",
  "Sangat Tidak Sehat": "#B23A1E",
  "Berbahaya": "#7A1F1F",
};

export function getPm25Warna(kategori) {
  return PM25_KATEGORI_WARNA[kategori] || "#8A9490";
}

// Panggil Netlify Function untuk mengambil bacaan PM2.5 terbaru dari BMKG.
// Catatan: hanya berfungsi di deploy yang mendukung Netlify Functions (git-based/CLI deploy),
// tidak akan berfungsi di drag & drop deploy biasa.
export async function fetchPm25FromBmkg() {
  const res = await fetch(PM25_FUNCTION_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Simpan satu bacaan PM2.5 ke Firestore sebagai riwayat (supaya bisa dibuat grafik tren)
export async function logPm25Reading(reading) {
  const body = {
    fields: {
      stasiun: { stringValue: reading.stasiun },
      waktu: { stringValue: reading.waktu },
      pm25: { doubleValue: Number(reading.pm25) },
      kategori: { stringValue: reading.kategori },
      diambilPada: { stringValue: reading.diambilPada },
    },
  };
  const res = await fetch(PM25_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Ambil seluruh riwayat bacaan PM2.5 yang tersimpan di Firestore, terurut berdasarkan waktu ambil
export async function fetchPm25History() {
  let all = [];
  let pageToken;
  do {
    const url = new URL(PM25_BASE);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (data.documents) {
      all = all.concat(
        data.documents.map((doc) => {
          const f = doc.fields || {};
          return {
            id: doc.name.split("/").pop(),
            stasiun: f.stasiun?.stringValue || "",
            waktu: f.waktu?.stringValue || "",
            pm25: Number(f.pm25?.doubleValue ?? f.pm25?.integerValue ?? 0),
            kategori: f.kategori?.stringValue || "",
            diambilPada: f.diambilPada?.stringValue || "",
          };
        })
      );
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  all.sort((a, b) => (a.diambilPada || "").localeCompare(b.diambilPada || ""));
  return all;
}

export const KARHUTLA_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
  .karhutla-root * { box-sizing: border-box; }
  .karhutla-input {
    background: var(--panel-2);
    border: 1px solid var(--line);
    color: var(--ash);
    border-radius: 6px;
    padding: 10px 12px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    width: 100%;
    outline: none;
    transition: border-color 0.15s ease;
  }
  .karhutla-input:focus {
    border-color: var(--ember);
  }
  .karhutla-input::placeholder { color: var(--ash-dim); }
  .karhutla-label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ash-dim);
    font-weight: 600;
    margin-bottom: 6px;
    display: block;
  }
  .karhutla-btn {
    background: var(--ember);
    color: #1A0D06;
    border: none;
    border-radius: 6px;
    padding: 11px 20px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: filter 0.15s ease, transform 0.1s ease;
  }
  .karhutla-btn:hover { filter: brightness(1.12); }
  .karhutla-btn:active { transform: scale(0.98); }
  .karhutla-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ember-rule {
    height: 3px;
    width: 100%;
    background: linear-gradient(90deg, var(--ember) 0%, var(--amber) 35%, transparent 70%);
    border-radius: 2px;
  }
  .karhutla-table th {
    text-align: left;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ash-dim);
    font-weight: 600;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  .karhutla-table td {
    padding: 11px 12px;
    font-size: 13.5px;
    border-bottom: 1px solid var(--line);
  }
  .karhutla-table tr:hover td { background: #241D15; }
  .del-btn {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--ash-dim);
    border-radius: 5px;
    padding: 6px;
    cursor: pointer;
    display: inline-flex;
    transition: all 0.15s ease;
  }
  .del-btn:hover {
    border-color: var(--ember);
    color: var(--ember);
  }
  select.karhutla-input {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23B7AE9F'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }
  .export-btn {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--ash);
    border-radius: 6px;
    padding: 11px 18px;
    font-weight: 600;
    font-size: 13.5px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.15s ease;
  }
  .export-btn:hover { border-color: var(--amber); color: var(--amber); }
  .export-btn:disabled { opacity: 0.55; cursor: not-allowed; }
`;

export const KARHUTLA_THEME_VARS = {
  "--bg": "#15120E",
  "--panel": "#1F1A14",
  "--panel-2": "#241E17",
  "--ember": "#D6491F",
  "--ember-soft": "#D6491F33",
  "--amber": "#DFA43C",
  "--smoke": "#8A9490",
  "--ash": "#EEE7DA",
  "--ash-dim": "#B7AE9F",
  "--line": "#382F24",
};
