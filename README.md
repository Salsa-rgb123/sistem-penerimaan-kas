# Sistem Penerimaan Kas

Web app sederhana untuk mencatat penerimaan kas dengan frontend HTML/CSS/JavaScript, backend Express, dan database Supabase PostgreSQL.

## Struktur

- `database/schema.sql` - ERD dan skema tiga entitas: `pelanggan`, `akun_kas`, `penerimaan_kas`
- `backend/app.js` - REST API dan static file server
- `frontend/` - dashboard aplikasi

## Menjalankan

1. Buat project di Supabase, buka SQL Editor, lalu jalankan isi `database/schema.sql`. SQL tersebut berisi policy demo agar publishable key dapat digunakan.
2. Di folder project, install dependency tanpa membuat `package.json`:

   `npm install --no-save express cors @supabase/supabase-js`

3. Atur environment variable pada terminal:

   PowerShell:
   `$env:SUPABASE_URL="https://project-id.supabase.co"`
   `$env:SUPABASE_KEY="publishable-or-service-role-key"`

4. Jalankan:

   `node backend/app.js`

5. Buka `http://localhost:3000`.

Pada form transaksi, nama pelanggan dan nama akun kas dapat langsung diketik. Jika belum ada di database, backend akan membuat data baru secara otomatis sebelum menyimpan penerimaan kas.

Publishable key dapat digunakan untuk pengembangan jika policy RLS Supabase mengizinkannya. Untuk backend produksi, gunakan secret `service_role` key hanya di backend dan jangan memasukkannya ke frontend atau repository.
