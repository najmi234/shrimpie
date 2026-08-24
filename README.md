# 🦐 Shrimpie — Smart Shrimp Pond Management & RAG AI Knowledge System

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20pgvector-emerald?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

**Shrimpie** adalah platform manajemen tambak udang cerdas (*Smart Aquaculture*) yang dilengkapi dengan sistem **RAG (Retrieval-Augmented Generation)** tingkat produksi, pelacakan **WebGIS interaktif**, dan **analitik riwayat pertumbuhan udang**.

---

## ✨ Fitur Utama

### 🤖 1. Shrimpie AI Advisor (Agent RAG Ingestion & Chat)
- **Hybrid Retrieval & Reranking**: Menggabungkan Pencarian Vektor (*Dense Cosine Similarity*) dan *Full-Text Search (FTS)* menggunakan algoritma **Reciprocal Rank Fusion (RRF)**.
- **Reranker Presisi Tinggi**: Mendukung reranking bawaan Cohere Rerank API (`rerank-v3.5`) dengan *fallback* otomatis ke *Lexical Alignment Density Reranker* lokal.
- **Sitasi Presisi Inline**: Respon AI dilengkapi dengan referensi sumber dokumen yang akurat dalam bentuk teks bersih: `(Sumber: nama_file.pdf, Hal. X)`.
- **Ingestion Bebas Duplikasi**: Penggunaan *SHA-256 Checksum Idempotency* untuk mencegah *re-indexing* dokumen yang sama.
- **Antarmuka Chat Responsif**: Didukung *streaming response*, penanganan *timezone* yang tepat, dan pencegahan *race-condition* saat inisiasi sesi percakapan baru.

### 🗺️ 2. WebGIS Device & Pond Tracking
- **Peta Interaktif Leaflet**: Visualisasi lokasi kolam tambak dan perangkat pemantau (*device status monitor*).
- **Penanganan Koordinat Pintar**: Autodeteksi format koordinat (Latitude vs Longitude) yang adaptif untuk mencegah error *out-of-bounds*.
- **Status Real-time & Overlay Metrik**: Indikator status perangkat aktif/offline serta tampilan metrik pertumbuhan udang terbaru langsung dari peta.

### 📊 3. Analitik Riwayat & Grafik Pertumbuhan
- **Grafik Tren Interaktif**: Pemantauan rata-rata panjang tubuh (cm), berat tubuh (gram), dan tingkat aktivitas udang (px/s).
- **Perhitungan DOC (Days of Cultivation)**: Otomatisasi perhitungan umur tebar udang berdasarkan *stocking date* kolam.
- **Navigasi Langsung ke WebGIS**: Tombol lokasi pada setiap titik data riwayat untuk melakukan *fly-to animation* langsung pada peta WebGIS.

### ⚙️ 4. Dashboard Admin & Management Basis Pengetahuan
- **Knowledge Base Versioning**: Manajemen dokumen sumber (`knowledge_bases` ➔ `source_documents` ➔ `document_chunks`).
- **Pengaturan Konfigurasi Dinamis**: Administrator dapat menyesuaikan *LLM Model*, *Embedding Model*, *Provider URL*, dan *RAG Similarity Threshold* langsung dari antarmuka antarmuka web (`/settings`).

---

## 🏗️ Arsitektur Data RAG Ingestion

```text
[Dokumen SOP / Panduan]
          │
          ▼
 [PDF Page-aware Parsing] ──► Metadata (Halaman, SOP No, Konten)
          │
          ▼
   [Content-Aware Chunking]
          │
          ▼
   [SHA-256 Checksum Check] ──► Cek Idempotensi (Cegah Duplikasi)
          │
          ▼
   [Vector Embedding (768d)] ──► text-embedding-3-small
          │
          ▼
  [Database Supabase] ──► (knowledge_bases ➔ source_documents ➔ document_chunks)
```

---

## 🚀 Teknologi yang Digunakan

- **Frontend & Framework**: [Next.js 15](https://nextjs.org/), React 19, TypeScript.
- **Styling & UI**: Tailwind CSS, Shadcn UI / Radix Primitives, Lucide Icons, Framer Motion.
- **Database & Vector Store**: [Supabase](https://supabase.com/) (PostgreSQL dengan ekstensi `pgvector`, HNSW Index, & Full-Text Search GIN Index).
- **RAG & AI**: LangChain, OpenAI / OpenRouter Embeddings (`text-embedding-3-small` - 768 Dimensi), Cohere Rerank API.
- **Pemetaan & Grafik**: Leaflet, React-Leaflet, Recharts.

---

## 🛠️ Panduan Instalasi & Pengoperasian Lokal

### 1. Prasyarat
- Node.js versi 18.x atau lebih baru.
- Akun dan proyek [Supabase](https://supabase.com/) aktif.

### 2. Kloning Repositori & Instalasi Dependensi
```bash
git clone https://github.com/najmi234/shrimpie.git
cd shrimpie
npm install
```

### 3. Konfigurasi Variabel Lingkungan
Salin file `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Isi variabel lingkungan pada `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://proyek-anda.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```
> *Catatan: Konfigurasi API Key LLM, Model Name, Provider URL, dan Threshold RAG dikelola secara dinamis melalui database pada menu Admin Pengaturan (`/settings`).*

### 4. Eksekusi Migrasi Database Supabase
Jalankan urutan file SQL yang ada pada folder `supabase/migrations/` ke instance database Supabase Anda:
1. `001_enable_pgvector.sql`
2. `20260429_chat_history.sql`
3. `20260527_enable_hnsw_index.sql`
4. `20260717_create_system_settings.sql`
5. `20260717_langchain_match_documents.sql`
6. `20260824_enable_hybrid_search_and_reranking.sql`
7. `20260824_knowledge_base_versioning.sql`
8. `20260824_sync_vector_768_schema.sql`

### 5. Jalankan Server Pengembang
```bash
npm run dev
```
Buka browser dan akses [http://localhost:3000](http://localhost:3000).

---

## 🧪 Script Evaluasi & Utility RAG

- **Ingest Dokumen Massal**:
  ```bash
  npx ts-node scripts/ingest-docs.ts
  ```
- **Evaluasi Performa RAG**:
  ```bash
  npx ts-node scripts/eval-rag.ts
  ```
- **Benchmark Retrieval RAG**:
  ```bash
  npx ts-node scripts/benchmark-rag.ts
  ```

---

## 📜 Lisensi & Kontribusi

Dipelihara oleh tim **Shrimpie Aquaculture**. Hak Cipta © 2026. All rights reserved.
