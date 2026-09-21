const formatRupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const formatDate = (value) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const today = new Date().toISOString().slice(0, 10);
const supabaseUrl = 'https://icaamgkcfglauklhdsqj.supabase.co';
const supabaseKey = 'sb_publishable_T-ukaA5tFGKDJuknjPta9A_yOmFJw7L';

const form = document.querySelector('#receipt-form');
const formMessage = document.querySelector('#form-message');
const receiptsBody = document.querySelector('#receipts-body');
const nominalInput = form.querySelector('[name="nominal"]');

function formatIntegerInput(value) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('id-ID') : '';
}

async function request(url, options) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${url}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.message || payload?.details || 'Permintaan Supabase gagal.');
  return payload;
}

async function getRows(table, query) {
  return request(`${table}?${query || ''}`);
}

async function findOrCreateCustomer(name) {
  const normalizedName = name.trim();
  const existing = await getRows('pelanggan', `select=id&nama=eq.${encodeURIComponent(normalizedName)}&limit=1`);
  if (existing[0]) return existing[0].id;
  const customers = await getRows('pelanggan', 'select=id');
  const created = await request('pelanggan', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ kode: `PLG-${String(customers.length + 1).padStart(3, '0')}`, nama: normalizedName }) });
  return created[0].id;
}

async function findOrCreateAccount(name) {
  const normalizedName = name.trim();
  const existing = await getRows('akun_kas', `select=id&nama=eq.${encodeURIComponent(normalizedName)}&aktif=eq.true&limit=1`);
  if (existing[0]) return existing[0].id;
  const accounts = await getRows('akun_kas', 'select=id');
  const created = await request('akun_kas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ kode: `KAS-${String(accounts.length + 1).padStart(3, '0')}`, nama: normalizedName, saldo_awal: 0 }) });
  return created[0].id;
}

function renderSummary(summary) {
  document.querySelector('[data-summary="totalReceipt"]').textContent = formatRupiah(summary.totalReceipt);
  document.querySelector('[data-summary="currentBalance"]').textContent = formatRupiah(summary.currentBalance);
  document.querySelector('[data-summary="todayReceipt"]').textContent = formatRupiah(summary.todayReceipt);
  document.querySelector('[data-summary="transactionCount"]').textContent = summary.transactionCount;
}

function renderReceipts(receipts) {
  if (!receipts.length) {
    receiptsBody.innerHTML = '<tr><td colspan="7" class="empty">Belum ada transaksi penerimaan.</td></tr>';
    return;
  }
  receiptsBody.innerHTML = receipts.map((receipt) => `<tr><td><strong>${receipt.nomor}</strong></td><td>${formatDate(receipt.tanggal)}</td><td>${receipt.pelanggan?.nama || '-'}</td><td>${receipt.akun?.nama || '-'}</td><td><span class="method">${receipt.metode}</span></td><td class="align-right"><strong>${formatRupiah(receipt.nominal)}</strong></td><td><button class="delete-button" data-delete="${receipt.id}" title="Hapus transaksi">×</button></td></tr>`).join('');
}

async function loadDashboard() {
  try {
    const [receipts, accounts] = await Promise.all([
      getRows('penerimaan_kas', 'select=id,nomor,nominal,tanggal,metode,created_at,pelanggan:pelanggan_id(nama),akun:akun_kas_id(nama)&order=tanggal.desc,created_at.desc&limit=100'),
      getRows('akun_kas', 'select=saldo_awal')
    ]);
    const totalReceipt = receipts.reduce((sum, item) => sum + Number(item.nominal), 0);
    const openingBalance = accounts.reduce((sum, item) => sum + Number(item.saldo_awal), 0);
    const todayReceipt = receipts.filter((item) => item.tanggal === today).reduce((sum, item) => sum + Number(item.nominal), 0);
    renderSummary({ totalReceipt, currentBalance: openingBalance + totalReceipt, todayReceipt, transactionCount: receipts.length });
    renderReceipts(receipts);
  } catch (error) {
    receiptsBody.innerHTML = `<tr><td colspan="7" class="empty">${error.message} Pastikan tabel Supabase dan policy sudah dibuat.</td></tr>`;
  }
}

form.tanggal.value = today;
nominalInput.addEventListener('input', () => {
  nominalInput.value = formatIntegerInput(nominalInput.value);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan...';
  formMessage.textContent = '';
  try {
    const payload = Object.fromEntries(new FormData(form));
    payload.nominal = payload.nominal.replace(/\D/g, '');
    const pelanggan_id = await findOrCreateCustomer(payload.pelanggan_nama);
    const akun_kas_id = await findOrCreateAccount(payload.akun_kas_nama);
    const existingReceipts = await getRows('penerimaan_kas', `select=id&tanggal=eq.${payload.tanggal}`);
    const nomor = `KM-${payload.tanggal.replaceAll('-', '')}-${String(existingReceipts.length + 1).padStart(3, '0')}`;
    await request('penerimaan_kas', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ nomor, tanggal: payload.tanggal, pelanggan_id, akun_kas_id, nominal: payload.nominal, metode: payload.metode, keterangan: payload.keterangan || null }) });
    form.reset();
    form.tanggal.value = today;
    formMessage.textContent = 'Transaksi berhasil disimpan.';
    formMessage.className = 'form-message success';
    await loadDashboard();
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.className = 'form-message error';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Simpan transaksi <span>→</span>';
  }
});

receiptsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button || !window.confirm('Hapus transaksi ini?')) return;
  button.disabled = true;
  try {
    await request(`penerimaan_kas?id=eq.${button.dataset.delete}`, { method: 'DELETE' });
    await loadDashboard();
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
  }
});

document.querySelector('#refresh-button').addEventListener('click', loadDashboard);
document.querySelectorAll('[data-scroll]').forEach((button) => button.addEventListener('click', () => document.querySelector(button.dataset.scroll).scrollIntoView({ behavior: 'smooth' })));
loadDashboard();
