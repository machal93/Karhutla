// Netlify serverless function — mengambil data kualitas udara PM2.5 stasiun Pangkalanbun
// (Kotawaringin Barat, Kalimantan Tengah) dari halaman publik BMKG.
//
// CATATAN KERAPUHAN: ini scraping HTML, bukan API resmi. Kalau BMKG mengubah struktur
// halamannya, fungsi ini bisa berhenti menemukan datanya (found: false) sampai regex
// di bawah disesuaikan ulang.

exports.handler = async function () {
  const SUMBER_URL = "https://www.bmkg.go.id/kualitas-udara/pm25";

  try {
    const res = await fetch(SUMBER_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MonitorKarhutlaBot/1.0)" },
    });

    if (!res.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ found: false, error: `BMKG merespons status ${res.status}` }),
      };
    }

    const html = await res.text();

    // Ubah HTML jadi teks polos supaya lebih mudah dicari polanya
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const match = text.match(
      /Pangkalanbun\s*(\d{1,2}\.\d{2}\s*WIB)[^0-9A-Za-z]{0,20}PM\s*2\.5\s*[:\-]?\s*(\d+[,.]\d+)\s*(Baik|Sedang|Tidak Sehat|Sangat Tidak Sehat|Berbahaya)/i
    );

    if (!match) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          found: false,
          message: "Data Pangkalanbun tidak ditemukan di halaman BMKG saat ini (kemungkinan struktur halaman berubah).",
        }),
      };
    }

    const [, waktu, nilaiRaw, kategori] = match;
    const nilai = parseFloat(nilaiRaw.replace(",", "."));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
      body: JSON.stringify({
        found: true,
        stasiun: "Pangkalanbun (Kotawaringin Barat)",
        waktu,
        pm25: nilai,
        kategori,
        sumber: SUMBER_URL,
        diambilPada: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ found: false, error: String(err && err.message ? err.message : err) }),
    };
  }
};
