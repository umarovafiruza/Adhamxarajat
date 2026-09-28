/**
 * ========================================================
 * XARAJATLAR NAZORATI - JAVASCRIPT BOSHQARUV LOGIKASI
 * Vanilla JS + LocalStorage (Hech qanday tashqi frameworklarsiz)
 * ========================================================
 */

// Kategoriyalar bazasi (Ranglar, Ikonkalar va Nomlar)
const CATEGORIES = {
  food: { name: 'Oziq-ovqat', icon: 'fa-utensils', color: '#f97316' },
  transport: { name: 'Transport', icon: 'fa-car', color: '#3b82f6' },
  utilities: { name: 'Kommunal', icon: 'fa-bolt', color: '#eab308' },
  entertainment: { name: 'O\'yin-kulgi', icon: 'fa-gamepad', color: '#8b5cf6' },
  shopping: { name: 'Xaridlar', icon: 'fa-bag-shopping', color: '#ec4899' },
  health: { name: 'Salomatlik', icon: 'fa-heart-pulse', color: '#ef4444' },
  education: { name: 'Ta\'lim', icon: 'fa-graduation-cap', color: '#10b981' },
  other: { name: 'Boshqa', icon: 'fa-box', color: '#64748b' }
};

// Global State (Ilova holati)
let expenses = [];
let selectedCategory = 'all';
let selectedPeriod = 'all'; // 'all', 'today', 'this_month'
let searchQuery = '';
let pendingConfirmAction = null;

// Sahifa to'liq yuklanganda dastlabki ishga tushirish
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadExpensesFromStorage();
  setDefaultDate();
  setupEventListeners();
  renderAll();
});

// ==========================================
// 1. SANA FORMATLASH FUNKSIYALARI
// ==========================================
function formatDateToString(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayString() {
  return formatDateToString(new Date());
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateToString(d);
}

function getLastMonthString() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return formatDateToString(d);
}

function setDefaultDate() {
  const dateInput = document.getElementById('dateInput');
  if (dateInput) {
    dateInput.value = getTodayString();
  }
}

// ==========================================
// 2. LOCALSTORAGE BILAN ISHLASH
// ==========================================
function loadExpensesFromStorage() {
  const saved = localStorage.getItem('personal_expenses_v2');
  if (saved) {
    try {
      expenses = JSON.parse(saved);
    } catch (e) {
      expenses = [];
    }
  }

  // Agar bo'sh bo'lsa, turli sanalardagi namunalar bilan to'ldirish
  if (!expenses || expenses.length === 0) {
    const today = getTodayString();
    const yesterday = getYesterdayString();
    const lastMonth = getLastMonthString();

    expenses = [
      { id: 'exp_1', amount: 45000, category: 'food', date: today, note: 'Tushlik (Bugun)' },
      { id: 'exp_2', amount: 20000, category: 'transport', date: today, note: 'Taksi xizmati (Bugun)' },
      { id: 'exp_3', amount: 350000, category: 'food', date: yesterday, note: 'Bozorlik (Shu oy)' },
      { id: 'exp_4', amount: 180000, category: 'utilities', date: yesterday, note: 'Elektr energiyasi to\'lovi (Shu oy)' },
      { id: 'exp_5', amount: 250000, category: 'shopping', date: lastMonth, note: 'Kiyim xaridi (O\'tgan oy)' }
    ];
    saveExpenses();
  }
}

function saveExpenses() {
  localStorage.setItem('personal_expenses_v2', JSON.stringify(expenses));
}

// ==========================================
// 3. TUNGI / KUNDUZGI REJIM (DARK / LIGHT)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('personal_expenses_theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    updateThemeIcon(true);
  } else {
    document.documentElement.classList.remove('dark');
    updateThemeIcon(false);
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('personal_expenses_theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = isDark ? 'fa-solid fa-sun text-amber-400 text-xs sm:text-sm' : 'fa-solid fa-moon text-slate-600 text-xs sm:text-sm';
  }
}

// ==========================================
// 4. EVENT LISTENERS & MODALLAR
// ==========================================
function setupEventListeners() {
  // Modal tashqarisiga bosilganda yopish
  const expenseModal = document.getElementById('expenseModal');
  if (expenseModal) {
    expenseModal.addEventListener('click', (e) => {
      if (e.target.id === 'expenseModal') closeExpenseModal();
    });
  }

  const confirmModal = document.getElementById('confirmModal');
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target.id === 'confirmModal') closeConfirmModal();
    });
  }

  const confirmActionBtn = document.getElementById('confirmActionBtn');
  if (confirmActionBtn) {
    confirmActionBtn.addEventListener('click', () => {
      if (typeof pendingConfirmAction === 'function') {
        pendingConfirmAction();
      }
      closeConfirmModal();
    });
  }
}

function openExpenseModal() {
  const modal = document.getElementById('expenseModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const amountInput = document.getElementById('amountInput');
      if (amountInput) amountInput.focus();
    }, 120);
  }
}

function closeExpenseModal() {
  const modal = document.getElementById('expenseModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Maxsus markaziy tasdiqlash oynasi
function openCustomConfirm({ title, desc, icon, actionText, actionClass, onConfirm }) {
  document.getElementById('confirmModalTitle').textContent = title || "Tasdiqlang";
  document.getElementById('confirmModalDesc').textContent = desc || "Ushbu amalni tasdiqlaysizmi?";
  if (icon) {
    document.getElementById('confirmModalIcon').className = `fa-solid ${icon}`;
  }
  const actionBtn = document.getElementById('confirmActionBtn');
  actionBtn.textContent = actionText || "Ha, o'chirish";
  if (actionClass) {
    actionBtn.className = actionClass;
  }
  pendingConfirmAction = onConfirm;

  const modal = document.getElementById('confirmModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  pendingConfirmAction = null;
}

// ==========================================
// 5. XARAJAT QO'SHISH VA O'CHIRISH
// ==========================================
function addQuickAmount(val) {
  const input = document.getElementById('amountInput');
  const current = parseFloat(input.value) || 0;
  input.value = current + val;
  input.focus();
}

function handleExpenseSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('amountInput').value);
  const category = document.getElementById('categorySelect').value;
  const date = document.getElementById('dateInput').value || getTodayString();
  const note = document.getElementById('noteInput').value.trim();

  if (!amount || amount <= 0) return;

  expenses.unshift({
    id: 'exp_' + Date.now(),
    amount: amount,
    category: category,
    date: date,
    note: note || (CATEGORIES[category] ? CATEGORIES[category].name : 'Xarajat')
  });

  saveExpenses();
  document.getElementById('amountInput').value = '';
  document.getElementById('noteInput').value = '';
  setDefaultDate();
  closeExpenseModal();
  renderAll();
  showToast('Xarajat muvaffaqiyatli saqlandi!');
}

function deleteExpense(id) {
  const item = expenses.find(i => i.id === id);
  const noteName = item ? `"${item.note}" (${formatCurrency(item.amount)})` : "Ushbu xarajatni";

  openCustomConfirm({
    title: "Xarajatni o'chirish",
    desc: `${noteName} xarajatini o'chirib tashlamoqchimisiz? Ushbu amal qaytarilmaydi.`,
    icon: "fa-trash-can",
    actionText: "Ha, o'chirish",
    actionClass: "py-2.5 px-4 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-md shadow-rose-600/25 transition",
    onConfirm: () => {
      expenses = expenses.filter(i => i.id !== id);
      saveExpenses();
      renderAll();
      showToast('Xarajat o\'chirildi', 'info');
    }
  });
}

function confirmResetData() {
  openCustomConfirm({
    title: "Barcha xarajatlarni tozalash",
    desc: "Barcha qayd etilgan xarajatlar tarixi to'liq o'chirib tashlanadi. Ushbu amalni ortga qaytarib bo'lmaydi!",
    icon: "fa-triangle-exclamation",
    actionText: "Ha, tozalash",
    actionClass: "py-2.5 px-4 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-md shadow-rose-600/25 transition",
    onConfirm: () => {
      expenses = [];
      saveExpenses();
      renderAll();
      showToast('Barcha ma\'lumotlar tozalandi', 'info');
    }
  });
}

// ==========================================
// 6. FILTRLAR VA QIDIRUV
// ==========================================
function setDatePeriodFilter(p) {
  selectedPeriod = p;

  const activeClasses = 'px-3 py-1.5 rounded-lg bg-indigo-600 text-white shadow-sm transition active:scale-95 flex items-center gap-1.5';
  const inactiveClasses = 'px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition active:scale-95 flex items-center gap-1.5';

  document.getElementById('periodAllBtn').className = (p === 'all') ? activeClasses : inactiveClasses;
  document.getElementById('periodTodayBtn').className = (p === 'today') ? activeClasses : inactiveClasses;
  document.getElementById('periodMonthBtn').className = (p === 'this_month') ? activeClasses : inactiveClasses;

  const labelMap = {
    all: 'Barchasi',
    today: 'Bugun',
    this_month: 'Shu oy'
  };
  document.getElementById('currentFilterLabel').textContent = labelMap[p] || 'Barchasi';

  renderExpensesList();
}

function setCategoryFilter(catId) {
  selectedCategory = catId;
  const dropdown = document.getElementById('filterCategoryDropdown');
  if (dropdown) dropdown.value = catId;
  renderAll();
}

function handleSearch(val) {
  searchQuery = val.toLowerCase().trim();
  renderExpensesList();
}

// ==========================================
// 7. RENDER (CHIZISH) FUNKSIYALARI
// ==========================================
function renderAll() {
  renderHeroStats();
  renderCategoryCarousel();
  updateFilterBadges();
  renderExpensesList();
}

function renderHeroStats() {
  let total = 0, monthTotal = 0;
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const catTotals = {};

  expenses.forEach(e => {
    total += e.amount;

    if (e.date) {
      const parts = e.date.split('-').map(Number);
      if (parts[0] === curYear && parts[1] === curMonth) {
        monthTotal += e.amount;
      }
    }
    catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
  });

  document.getElementById('totalExpenseHero').textContent = formatCurrency(total);
  document.getElementById('heroTxCount').textContent = expenses.length + ' ta';
  document.getElementById('heroMonthExpense').textContent = formatCurrency(monthTotal);

  const monthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
  document.getElementById('currentMonthName').textContent = monthNames[curMonth - 1];

  let topCat = '-', topAmt = 0;
  for (const [k, v] of Object.entries(catTotals)) {
    if (v > topAmt) {
      topAmt = v;
      topCat = CATEGORIES[k] ? CATEGORIES[k].name : k;
    }
  }
  document.getElementById('heroTopCategory').textContent = topCat;
}

function renderCategoryCarousel() {
  const container = document.getElementById('categoryCardsGrid');
  if (!container) return;
  container.innerHTML = '';
  
  let grandTotal = 0;
  const catSums = {}, catCounts = {};

  Object.keys(CATEGORIES).forEach(k => { catSums[k] = 0; catCounts[k] = 0; });
  expenses.forEach(e => {
    grandTotal += e.amount;
    if (catSums[e.category] !== undefined) {
      catSums[e.category] += e.amount;
      catCounts[e.category]++;
    }
  });

  Object.keys(CATEGORIES).forEach(catId => {
    const cat = CATEGORIES[catId];
    const sum = catSums[catId] || 0;
    const count = catCounts[catId] || 0;
    const pct = grandTotal > 0 ? ((sum / grandTotal) * 100).toFixed(0) : 0;
    const isSel = selectedCategory === catId;

    const card = document.createElement('div');
    card.onclick = () => setCategoryFilter(isSel ? 'all' : catId);

    card.className = `shrink-0 min-w-[124px] sm:min-w-0 p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer select-none backdrop-blur-sm ${
      isSel 
        ? 'bg-indigo-50/95 dark:bg-indigo-950/80 border-indigo-500 shadow-md ring-2 ring-indigo-500/25' 
        : 'bg-white/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800/80 shadow-2xs hover:border-slate-300'
    }`;

    card.innerHTML = `
      <div class="flex items-center justify-between gap-1 mb-1.5">
        <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-white text-[11px] shadow-2xs" style="background-color: ${cat.color}">
          <i class="fa-solid ${cat.icon}"></i>
        </div>
        <span class="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">${pct}%</span>
      </div>
      <h4 class="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate leading-tight">${cat.name}</h4>
      <div class="text-xs font-black text-slate-900 dark:text-white mt-0.5 truncate">${formatCurrency(sum)}</div>
      <div class="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
        <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${cat.color}"></div>
      </div>
    `;
    container.appendChild(card);
  });

  const resetBtn = document.getElementById('resetCategoryFilterBtn');
  if (resetBtn) resetBtn.classList.toggle('hidden', selectedCategory === 'all');
}

function updateFilterBadges() {
  const todayStr = getTodayString();
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  let countToday = 0;
  let countMonth = 0;

  expenses.forEach(e => {
    if (e.date === todayStr) countToday++;
    if (e.date) {
      const parts = e.date.split('-').map(Number);
      if (parts[0] === curYear && parts[1] === curMonth) {
        countMonth++;
      }
    }
  });

  const badgeAll = document.getElementById('badgeCountAll');
  const badgeToday = document.getElementById('badgeCountToday');
  const badgeMonth = document.getElementById('badgeCountMonth');

  if (badgeAll) badgeAll.textContent = expenses.length;
  if (badgeToday) badgeToday.textContent = countToday;
  if (badgeMonth) badgeMonth.textContent = countMonth;
}

function renderExpensesList() {
  const container = document.getElementById('expensesList');
  const empty = document.getElementById('emptyState');
  const badge = document.getElementById('filteredCountBadge');
  if (!container) return;
  container.innerHTML = '';

  const now = new Date();
  const todayStr = getTodayString();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const filtered = expenses.filter(i => {
    if (selectedCategory !== 'all' && i.category !== selectedCategory) return false;

    if (selectedPeriod === 'today') {
      if (i.date !== todayStr) return false;
    } else if (selectedPeriod === 'this_month') {
      if (!i.date) return false;
      const parts = i.date.split('-').map(Number);
      if (parts[0] !== curYear || parts[1] !== curMonth) return false;
    }

    if (searchQuery) {
      const cat = CATEGORIES[i.category] || { name: '' };
      const noteMatch = (i.note || '').toLowerCase().includes(searchQuery);
      const catMatch = cat.name.toLowerCase().includes(searchQuery);
      const amountMatch = i.amount.toString().includes(searchQuery);
      return noteMatch || catMatch || amountMatch;
    }

    return true;
  });

  if (badge) badge.textContent = filtered.length + ' ta xarajat';

  if (filtered.length === 0) {
    if (empty) {
      empty.classList.remove('hidden');
      empty.classList.add('flex');
    }
    return;
  }
  if (empty) {
    empty.classList.add('hidden');
    empty.classList.remove('flex');
  }

  filtered.forEach(item => {
    const cat = CATEGORIES[item.category] || { name: 'Boshqa', icon: 'fa-box', color: '#64748b' };
    const row = document.createElement('div');
    row.className = 'py-2.5 px-3 sm:py-3 sm:px-4 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition animate-fade-in';

    row.innerHTML = `
      <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-xs shadow-2xs" style="background-color: ${cat.color}">
          <i class="fa-solid ${cat.icon}"></i>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">${escapeHtml(item.note)}</h4>
          </div>
          <p class="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
            <span class="font-medium text-slate-600 dark:text-slate-300">${escapeHtml(cat.name)}</span>
            <span>&bull;</span>
            <span class="${item.date === todayStr ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}">${item.date === todayStr ? 'Bugun' : item.date}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
          -${formatCurrency(item.amount)}
        </span>
        <button onclick="deleteExpense('${item.id}')" class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-90" title="O'chirish">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      </div>
    `;
    container.appendChild(row);
  });
}

// ==========================================
// 8. YORDAMCHI FORMATLASH FUNKSIYALARI
// ==========================================
function formatCurrency(n) {
  return (Math.round(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
  const box = document.getElementById('toastBox');
  const text = document.getElementById('toastMsg');
  if (!box || !text) return;

  text.textContent = msg;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 2400);
}
