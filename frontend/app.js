const formatRupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const formatDate = (value) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const today = new Date().toISOString().slice(0, 10);

const form = document.querySelector('#receipt-form');
const formMessage = document.querySelector('#form-message');
const receiptsBody = document.querySelector('#receipts-body');
const nominalInput = form.querySelector('[name="nominal"]');

function formatIntegerInput(value) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('id-ID') : '';
}

async function request(url, options) {
  const response = await fetch(url, options);
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.message || 'Permintaan gagal.');
  return payload;
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
    const [dashboard, receipts] = await Promise.all([request('/api/dashboard'), request('/api/receipts')]);
    renderSummary(dashboard.summary);
    renderReceipts(receipts);
  } catch (error) {
    receiptsBody.innerHTML = `<tr><td colspan="7" class="empty">${error.message} Pastikan backend sudah berjalan.</td></tr>`;
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
    await request('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
    await request(`/api/receipts/${button.dataset.delete}`, { method: 'DELETE' });
    await loadDashboard();
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
  }
});

document.querySelector('#refresh-button').addEventListener('click', loadDashboard);
document.querySelectorAll('[data-scroll]').forEach((button) => button.addEventListener('click', () => document.querySelector(button.dataset.scroll).scrollIntoView({ behavior: 'smooth' })));
loadDashboard();
