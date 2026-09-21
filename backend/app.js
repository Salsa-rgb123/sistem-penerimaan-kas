const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL dan SUPABASE_KEY belum diatur.');
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

function sendError(res, error, status = 500) {
  console.error(error);
  res.status(status).json({ message: error.message || 'Terjadi kesalahan pada server.' });
}

app.get('/api/options', async (_req, res) => {
  const [customers, accounts] = await Promise.all([
    supabase.from('pelanggan').select('id, kode, nama').order('nama'),
    supabase.from('akun_kas').select('id, kode, nama, saldo_awal').eq('aktif', true).order('nama')
  ]);

  if (customers.error) return sendError(res, customers.error);
  if (accounts.error) return sendError(res, accounts.error);
  res.json({ customers: customers.data, accounts: accounts.data });
});

app.get('/api/dashboard', async (_req, res) => {
  const [receipts, accounts] = await Promise.all([
    supabase.from('penerimaan_kas').select('nominal, tanggal, metode, pelanggan:pelanggan_id(nama), akun:akun_kas_id(nama)').order('tanggal', { ascending: false }),
    supabase.from('akun_kas').select('saldo_awal')
  ]);

  if (receipts.error) return sendError(res, receipts.error);
  if (accounts.error) return sendError(res, accounts.error);

  const totalReceipt = receipts.data.reduce((sum, item) => sum + Number(item.nominal), 0);
  const openingBalance = accounts.data.reduce((sum, item) => sum + Number(item.saldo_awal), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayReceipt = receipts.data
    .filter((item) => item.tanggal === today)
    .reduce((sum, item) => sum + Number(item.nominal), 0);

  res.json({
    summary: {
      totalReceipt,
      openingBalance,
      currentBalance: openingBalance + totalReceipt,
      todayReceipt,
      transactionCount: receipts.data.length
    },
    recent: receipts.data.slice(0, 8)
  });
});

app.get('/api/receipts', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const { data, error } = await supabase
    .from('penerimaan_kas')
    .select('id, nomor, tanggal, nominal, metode, keterangan, pelanggan:pelanggan_id(kode, nama), akun:akun_kas_id(kode, nama)')
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return sendError(res, error);
  res.json(data);
});

async function findOrCreateCustomer(name) {
  const normalizedName = name.trim();
  const existing = await supabase.from('pelanggan').select('id').eq('nama', normalizedName).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const { count, error: countError } = await supabase.from('pelanggan').select('id', { count: 'exact', head: true });
  if (countError) throw countError;
  const created = await supabase.from('pelanggan').insert({ kode: `PLG-${String((count || 0) + 1).padStart(3, '0')}`, nama: normalizedName }).select('id').single();
  if (created.error) throw created.error;
  return created.data.id;
}

async function findOrCreateAccount(name) {
  const normalizedName = name.trim();
  const existing = await supabase.from('akun_kas').select('id').eq('nama', normalizedName).eq('aktif', true).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const { count, error: countError } = await supabase.from('akun_kas').select('id', { count: 'exact', head: true });
  if (countError) throw countError;
  const created = await supabase.from('akun_kas').insert({ kode: `KAS-${String((count || 0) + 1).padStart(3, '0')}`, nama: normalizedName, saldo_awal: 0 }).select('id').single();
  if (created.error) throw created.error;
  return created.data.id;
}

app.post('/api/receipts', async (req, res) => {
  const { tanggal, pelanggan_nama, akun_kas_nama, nominal, metode, keterangan } = req.body;
  const normalizedNominal = String(nominal ?? '').replace(/\D/g, '');
  const amount = Number(normalizedNominal);

  if (!tanggal || !pelanggan_nama?.trim() || !akun_kas_nama?.trim() || !Number.isFinite(amount) || amount <= 0 || !metode) {
    return res.status(400).json({ message: 'Tanggal, pelanggan, akun kas, nominal, dan metode wajib diisi.' });
  }

  try {
    const pelanggan_id = await findOrCreateCustomer(pelanggan_nama);
    const akun_kas_id = await findOrCreateAccount(akun_kas_nama);
    const datePart = tanggal.replaceAll('-', '');
    const { count, error: countError } = await supabase.from('penerimaan_kas').select('id', { count: 'exact', head: true }).eq('tanggal', tanggal);
    if (countError) throw countError;

    const nomor = `KM-${datePart}-${String((count || 0) + 1).padStart(3, '0')}`;
    const { data, error } = await supabase.from('penerimaan_kas').insert({ nomor, tanggal, pelanggan_id, akun_kas_id, nominal: amount, metode, keterangan: keterangan || null }).select('id, nomor, tanggal, nominal, metode, keterangan, pelanggan:pelanggan_id(kode, nama), akun:akun_kas_id(kode, nama)').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    sendError(res, error, error.code === '23505' ? 409 : 500);
  }
});

app.delete('/api/receipts/:id', async (req, res) => {
  const { error } = await supabase.from('penerimaan_kas').delete().eq('id', req.params.id);
  if (error) return sendError(res, error);
  res.status(204).end();
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(port, () => console.log(`Sistem Penerimaan Kas berjalan di http://localhost:${port}`));
