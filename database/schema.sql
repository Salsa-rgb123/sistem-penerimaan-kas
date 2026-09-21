-- Sistem Penerimaan Kas
-- ERD: pelanggan 1..n penerimaan_kas n..1 akun_kas

create extension if not exists pgcrypto;

create table if not exists public.pelanggan (
  id uuid primary key default gen_random_uuid(),
  kode varchar(20) not null unique,
  nama varchar(120) not null,
  email varchar(150),
  telepon varchar(30),
  created_at timestamptz not null default now()
);

create table if not exists public.akun_kas (
  id uuid primary key default gen_random_uuid(),
  kode varchar(20) not null unique,
  nama varchar(100) not null,
  saldo_awal numeric(15, 2) not null default 0 check (saldo_awal >= 0),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.penerimaan_kas (
  id uuid primary key default gen_random_uuid(),
  nomor varchar(30) not null unique,
  tanggal date not null default current_date,
  pelanggan_id uuid not null references public.pelanggan(id) on update cascade on delete restrict,
  akun_kas_id uuid not null references public.akun_kas(id) on update cascade on delete restrict,
  nominal numeric(15, 2) not null check (nominal > 0),
  metode varchar(20) not null default 'Transfer' check (metode in ('Tunai', 'Transfer', 'QRIS', 'Debit')),
  keterangan varchar(255),
  created_at timestamptz not null default now()
);

create index if not exists idx_penerimaan_kas_tanggal on public.penerimaan_kas(tanggal desc);
create index if not exists idx_penerimaan_kas_pelanggan on public.penerimaan_kas(pelanggan_id);
create index if not exists idx_penerimaan_kas_akun on public.penerimaan_kas(akun_kas_id);

alter table public.pelanggan enable row level security;
alter table public.akun_kas enable row level security;
alter table public.penerimaan_kas enable row level security;

-- Policy demo: publishable key dapat membaca dan mengelola data aplikasi.
-- Untuk produksi, ganti policy ini dengan policy berbasis user/authenticated.
drop policy if exists "public pelanggan access" on public.pelanggan;
create policy "public pelanggan access" on public.pelanggan for all to anon, authenticated using (true) with check (true);
drop policy if exists "public akun kas access" on public.akun_kas;
create policy "public akun kas access" on public.akun_kas for all to anon, authenticated using (true) with check (true);
drop policy if exists "public penerimaan kas access" on public.penerimaan_kas;
create policy "public penerimaan kas access" on public.penerimaan_kas for all to anon, authenticated using (true) with check (true);

-- API backend menggunakan publishable key dan policy demo di atas.
-- Seed awal untuk langsung mencoba dashboard.
insert into public.pelanggan (kode, nama, email, telepon)
values
  ('PLG-001', 'PT Nusantara Jaya', 'finance@nusantarajaya.id', '021-555-0123'),
  ('PLG-002', 'CV Sinar Pagi', 'admin@sinarpagi.id', '0812-9000-1122'),
  ('PLG-003', 'Toko Berkah Mandiri', 'toko@berkahmandiri.id', '0821-3000-4455')
on conflict (kode) do nothing;

insert into public.akun_kas (kode, nama, saldo_awal)
values
  ('KAS-001', 'Kas Utama', 2500000),
  ('KAS-002', 'Bank Operasional', 10000000)
on conflict (kode) do nothing;
