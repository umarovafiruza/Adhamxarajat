/**
 * ========================================================
 * XARAJATLAR NAZORATI - FINTECH MOBILE APP JAVASCRIPT
 * Oila Budjeti, Kirim va Chiqim, Barcha Oylar Tahlili, Donut Grafik
 * Vanilla JS + LocalStorage (Hech qanday tashqi frameworklarsiz)
 * ========================================================
 */

// 1. KATEGORIYALAR BAZASI (CHIQIM VA KIRIM)
const EXPENSE_CATEGORIES = {
  food: { name: 'Oziq-ovqat', icon: 'fa-utensils', color: '#f97316' },
  transport: { name: 'Transport', icon: 'fa-car', color: '#38bdf8' },
  utilities: { name: 'Kommunal', icon: 'fa-bolt', color: '#eab308' },
  entertainment: { name: "O'yin-kulgi", icon: 'fa-gamepad', color: '#a855f7' },
  shopping: { name: 'Xaridlar', icon: 'fa-bag-shopping', color: '#ec4899' },
  health: { name: 'Salomatlik', icon: 'fa-heart-pulse', color: '#ef4444' },
  education: { name: "Ta'lim", icon: 'fa-graduation-cap', color: '#10b981' },
  other: { name: 'Boshqa xarajat', icon: 'fa-box', color: '#818cf8' }
};

const INCOME_CATEGORIES = {
  salary: { name: 'Oylik maosh', icon: 'fa-briefcase', color: '#10b981' },
  freelance: { name: "Qo'shimcha ish", icon: 'fa-laptop-code', color: '#06b6d4' },
  investment: { name: 'Investitsiya', icon: 'fa-arrow-trend-up', color: '#6366f1' },
  gift: { name: "Hadya / Sovg'a", icon: 'fa-gift', color: '#f43f5e' },
  other_income: { name: 'Boshqa kirim', icon: 'fa-hand-holding-dollar', color: '#8b5cf6' }
};

const ALL_CATEGORIES = { ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES };

const MONTH_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", 
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"
];

// 2. GLOBAL STATE (HOLAT)
let expenses = [];
let monthlyBudget = 10000000; // Standart oylik reja: 10,000,000 so'm
let currentModalType = 'expense'; // 'expense' | 'income'
let selectedTypeFilter = 'all'; // 'all' | 'expense' | 'income' (Tarix sahifasida)
let selectedCategory = 'all';
let selectedPeriod = 'this_month'; // 'this_month', 'today', 'all'
let selectedAnalyticsPeriod = 'this_month'; // 'this_month', 'today', 'all'
let searchQuery = '';
let currentTab = 'home'; // 'home', 'history', 'analytics', 'profile'
let userName = 'Atxambek';
let userTag = '@atxambek';
let pendingConfirmAction = null;

// Oylarni boshqarish holati (Sentyabr, Avgust, Iyul...)
const nowInitial = new Date();
let selectedYear = nowInitial.getFullYear();
let selectedMonth = nowInitial.getMonth() + 1; // 1 dan 12 gacha, yoki null (barchasi)
let pickerYear = selectedYear;

// ==========================================
// 2.1 TELEGRAM MINI APP (TMA) INTEGRATSIYASI
// ==========================================
function initTelegramApp() {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    try {
      tg.ready();
      tg.expand();
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      }
      tg.setHeaderColor('#090717');
      tg.setBackgroundColor('#090717');
    } catch (e) {}

    // Telegram foydalanuvchisini avtomatik aniqlash
    if (tg.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ');
      const savedName = localStorage.getItem('personal_expenses_username');
      const savedTag = localStorage.getItem('personal_expenses_usertag');

      if (fullName && (!savedName || savedName === 'Atxambek')) {
        userName = fullName;
        localStorage.setItem('personal_expenses_username', userName);
      }
      if (u.username && (!savedTag || savedTag === '@atxambek')) {
        userTag = `@${u.username}`;
        localStorage.setItem('personal_expenses_usertag', userTag);
      }
      updateUserDisplay();
    }

    // Telegram BackButton boshqaruvi
    if (tg.BackButton) {
      tg.BackButton.onClick(() => {
        if (isAnyModalOpen()) {
          closeAllModals();
        } else if (currentTab !== 'home') {
          switchTab('home');
        }
      });
      updateTelegramBackButton();
    }
  }
}

function triggerHaptic(type = 'light') {
  if (!window.Telegram?.WebApp?.HapticFeedback) return;
  const hf = window.Telegram.WebApp.HapticFeedback;
  try {
    if (type === 'selection') {
      hf.selectionChanged();
    } else if (['success', 'warning', 'error'].includes(type)) {
      hf.notificationOccurred(type);
    } else {
      hf.impactOccurred(type);
    }
  } catch (e) {}
}

function isAnyModalOpen() {
  const modalIds = ['expenseModal', 'budgetModal', 'monthPickerModal', 'confirmModal', 'editNameModal'];
  return modalIds.some(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
}

function closeAllModals() {
  closeExpenseModal();
  closeBudgetModal();
  closeMonthPickerModal();
  closeConfirmModal();
  closeEditNameModal();
}

function updateTelegramBackButton() {
  const tg = window.Telegram?.WebApp;
  if (!tg?.BackButton) return;
  try {
    if (isAnyModalOpen() || currentTab !== 'home') {
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }
  } catch (e) {}
}

// Dastlabki ishga tushirish
document.addEventListener('DOMContentLoaded', () => {
  initTelegramApp();
  initTheme();
  loadUserData();
  loadBudgetFromStorage();
  loadExpensesFromStorage();
  setDefaultDate();
  setupEventListeners();
  populateCategorySelect('expense');
  updateMonthNavigatorDisplay();
  switchTab('home');
  renderAll();
});

// ==========================================
// 3. SANA FORMATLASH FUNKSIYALARI
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

function setDefaultDate() {
  const dateInput = document.getElementById('dateInput');
  if (dateInput && !dateInput.value) {
    dateInput.value = getTodayString();
  }
}

// ==========================================
// 4. STORAGE VA MA'LUMOTLARNI YUKLASH
// ==========================================
function loadUserData() {
  const savedName = localStorage.getItem('personal_expenses_username');
  const savedTag = localStorage.getItem('personal_expenses_usertag');
  if (savedName) userName = savedName;
  if (savedTag) userTag = savedTag;
  updateUserDisplay();
}

function updateUserDisplay() {
  const headerName = document.getElementById('headerUserName');
  const cardName = document.getElementById('profileCardName');
  const cardTag = document.getElementById('profileCardTag');

  if (headerName) headerName.textContent = userName;
  if (cardName) cardName.textContent = userName;
  if (cardTag) cardTag.textContent = userTag.startsWith('@') ? userTag : `@${userTag}`;
}

function loadBudgetFromStorage() {
  const savedBudget = localStorage.getItem('personal_monthly_budget');
  if (savedBudget) {
    const parsed = parseFloat(savedBudget);
    if (!isNaN(parsed) && parsed > 0) {
      monthlyBudget = parsed;
    }
  }
}

function saveBudget() {
  localStorage.setItem('personal_monthly_budget', monthlyBudget.toString());
}

function loadExpensesFromStorage() {
  const saved = localStorage.getItem('personal_expenses_v2');
  if (saved) {
    try {
      expenses = JSON.parse(saved);
    } catch (e) {
      expenses = [];
    }
  }

  // Mavjud eski amaliyotlarga type biriktirish
  if (Array.isArray(expenses) && expenses.length > 0) {
    expenses = expenses.map(item => {
      if (!item.type) {
        if (['salary', 'freelance', 'investment', 'gift', 'other_income'].includes(item.category)) {
          item.type = 'income';
        } else {
          item.type = 'expense';
        }
      }
      return item;
    });
  }

  // Agar kamida 3 oylik ma'lumot bo'lmasa, namunaviy Sentyabr, Avgust, Iyul ma'lumotlarini to'ldirish
  const hasMultipleMonths = expenses.some(e => e.date && (e.date.startsWith('2026-08') || e.date.startsWith('2026-07')));

  if (!expenses || expenses.length === 0 || !hasMultipleMonths) {
    const sampleData = [
      // Sentyabr 2026 (Joriy oy)
      { id: 'tx_sep_1', amount: 8500000, category: 'salary', type: 'income', date: '2026-09-05', note: 'Oylik maosh (Sentyabr)' },
      { id: 'tx_sep_2', amount: 2000000, category: 'freelance', type: 'income', date: '2026-09-18', note: 'Qo\'shimcha loyiha (Frilans)' },
      { id: 'tx_sep_3', amount: 65000, category: 'food', type: 'expense', date: '2026-09-29', note: 'Tushlik (Kafe)' },
      { id: 'tx_sep_4', amount: 35000, category: 'transport', type: 'expense', date: '2026-09-28', note: 'Taksi xizmati (Yandex)' },
      { id: 'tx_sep_5', amount: 480000, category: 'food', type: 'expense', date: '2026-09-20', note: 'Haftalik oziq-ovqat bozorligi' },
      { id: 'tx_sep_6', amount: 220000, category: 'utilities', type: 'expense', date: '2026-09-12', note: 'Kommunal to\'lovlar (Gaz/Svet)' },
      { id: 'tx_sep_7', amount: 350000, category: 'shopping', type: 'expense', date: '2026-09-15', note: 'Xaridlar (Kiyim va buyumlar)' },
      { id: 'tx_sep_8', amount: 140000, category: 'health', type: 'expense', date: '2026-09-22', note: 'Salomatlik (Dorixona)' },

      // Avgust 2026 (Oldingi oy)
      { id: 'tx_aug_1', amount: 9000000, category: 'salary', type: 'income', date: '2026-08-05', note: 'Oylik maosh (Avgust)' },
      { id: 'tx_aug_2', amount: 1500000, category: 'freelance', type: 'income', date: '2026-08-16', note: 'Mobil ilova dizayni (Frilans)' },
      { id: 'tx_aug_3', amount: 1100000, category: 'food', type: 'expense', date: '2026-08-14', note: 'Oylik oziq-ovqat zaxirasi' },
      { id: 'tx_aug_4', amount: 850000, category: 'shopping', type: 'expense', date: '2026-08-20', note: 'Yozgi kiyim-kechak xaridi' },
      { id: 'tx_aug_5', amount: 320000, category: 'utilities', type: 'expense', date: '2026-08-10', note: 'Konditsioner elektr to\'lovi' },
      { id: 'tx_aug_6', amount: 450000, category: 'entertainment', type: 'expense', date: '2026-08-25', note: 'Dam olish maskani (Hovuz)' },
      { id: 'tx_aug_7', amount: 210000, category: 'transport', type: 'expense', date: '2026-08-18', note: 'Yoqilg\'i / Benzin to\'lovi' },
      { id: 'tx_aug_8', amount: 190000, category: 'health', type: 'expense', date: '2026-08-08', note: 'Vitaminlar va dori-darmon' },

      // Iyul 2026 (Ikki oy oldin)
      { id: 'tx_jul_1', amount: 8500000, category: 'salary', type: 'income', date: '2026-07-05', note: 'Oylik maosh (Iyul)' },
      { id: 'tx_jul_2', amount: 1800000, category: 'investment', type: 'income', date: '2026-07-22', note: 'Investitsiya daromadi' },
      { id: 'tx_jul_3', amount: 2400000, category: 'entertainment', type: 'expense', date: '2026-07-15', note: 'Tog\' sayohati (Chorvoq dam olish)' },
      { id: 'tx_jul_4', amount: 1250000, category: 'food', type: 'expense', date: '2026-07-12', note: 'Oziq-ovqat va bozorlik' },
      { id: 'tx_jul_5', amount: 500000, category: 'education', type: 'expense', date: '2026-07-08', note: 'Ingliz tili kursi to\'lovi' },
      { id: 'tx_jul_6', amount: 280000, category: 'utilities', type: 'expense', date: '2026-07-11', note: 'Kommunal to\'lovlar' },
      { id: 'tx_jul_7', amount: 180000, category: 'transport', type: 'expense', date: '2026-07-28', note: 'Shahar bo\'ylab transport' }
    ];

    if (!expenses || expenses.length === 0) {
      expenses = sampleData;
    } else {
      // Mavjud amaliyotlarga Avgust va Iyulni qo'shish
      const existingIds = new Set(expenses.map(e => e.id));
      sampleData.forEach(s => {
        if (!existingIds.has(s.id)) expenses.push(s);
      });
    }
    saveExpenses();
  }
}

function saveExpenses() {
  localStorage.setItem('personal_expenses_v2', JSON.stringify(expenses));
}

// ==========================================
// 5. OYLARNI BOSHQARISH VA TANLASH (MONTH PICKER)
// ==========================================
function updateMonthNavigatorDisplay() {
  const label = document.getElementById('currentMonthYearLabel');
  const todayJumpBtn = document.getElementById('todayJumpBtn');
  const now = new Date();
  const currentCalendarMonth = now.getMonth() + 1;
  const currentCalendarYear = now.getFullYear();

  if (label) {
    if (selectedMonth === null) {
      label.textContent = "Barcha oylar (Umumiy)";
    } else {
      label.textContent = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    }
  }

  // Joriy oyga qaytish tugmasi
  if (todayJumpBtn) {
    const isCurrent = (selectedMonth === currentCalendarMonth && selectedYear === currentCalendarYear);
    todayJumpBtn.classList.toggle('hidden', isCurrent);
  }

  // Tarix va statistika tablaridagi oy tugmalari nomini yangilash
  const periodMonthBtn = document.getElementById('periodMonthBtn');
  const analyticsPeriodMonthBtn = document.getElementById('analyticsPeriodMonthBtn');
  const monthNameStr = selectedMonth ? MONTH_NAMES[selectedMonth - 1] : "Shu oy";

  if (periodMonthBtn) {
    const span = periodMonthBtn.querySelector('span:first-child');
    if (span) span.textContent = monthNameStr;
  }
  if (analyticsPeriodMonthBtn) {
    analyticsPeriodMonthBtn.textContent = monthNameStr;
  }
}

function changeMonth(delta) {
  triggerHaptic('selection');
  const now = new Date();
  if (selectedMonth === null) {
    selectedMonth = now.getMonth() + 1;
    selectedYear = now.getFullYear();
  } else {
    selectedMonth += delta;
    if (selectedMonth > 12) {
      selectedMonth = 1;
      selectedYear++;
    } else if (selectedMonth < 1) {
      selectedMonth = 12;
      selectedYear--;
    }
  }

  updateMonthNavigatorDisplay();
  renderAll();
}

function jumpToCurrentMonth() {
  triggerHaptic('medium');
  const now = new Date();
  selectedYear = now.getFullYear();
  selectedMonth = now.getMonth() + 1;
  updateMonthNavigatorDisplay();
  renderAll();
  showToast(`${MONTH_NAMES[selectedMonth - 1]} oyiga o'tildi`);
}

function openMonthPickerModal() {
  triggerHaptic('light');
  pickerYear = selectedYear || (new Date().getFullYear());
  renderMonthPicker();
  const modal = document.getElementById('monthPickerModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateTelegramBackButton();
  }
}

function closeMonthPickerModal() {
  triggerHaptic('light');
  const modal = document.getElementById('monthPickerModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    updateTelegramBackButton();
  }
}

function changePickerYear(delta) {
  triggerHaptic('selection');
  pickerYear += delta;
  renderMonthPicker();
}

function selectMonth(monthNum, year) {
  triggerHaptic('selection');
  selectedMonth = monthNum;
  selectedYear = year || pickerYear;
  closeMonthPickerModal();
  updateMonthNavigatorDisplay();
  renderAll();
  showToast(`${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} hisoboti ochildi`);
}

function selectMonthAll() {
  triggerHaptic('selection');
  selectedMonth = null;
  closeMonthPickerModal();
  updateMonthNavigatorDisplay();
  renderAll();
  showToast('Barcha oylar umumiy hisoboti ochildi');
}

function renderMonthPicker() {
  const yearDisplay = document.getElementById('pickerYearDisplay');
  const container = document.getElementById('monthsGridContainer');
  if (yearDisplay) yearDisplay.textContent = pickerYear;
  if (!container) return;
  container.innerHTML = '';

  const now = new Date();
  const realCurrentMonth = now.getMonth() + 1;
  const realCurrentYear = now.getFullYear();

  // Har bir oy uchun xarajat summasi va faollik holati
  for (let m = 1; m <= 12; m++) {
    const prefix = `${pickerYear}-${String(m).padStart(2, '0')}`;
    let monthExpense = 0;
    let txCount = 0;

    expenses.forEach(e => {
      if (e.date && e.date.startsWith(prefix)) {
        txCount++;
        if (e.type === 'expense') monthExpense += e.amount;
      }
    });

    const isSelected = (selectedMonth === m && selectedYear === pickerYear);
    const isCurrent = (realCurrentMonth === m && realCurrentYear === pickerYear);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.onclick = () => selectMonth(m, pickerYear);
    
    let btnClasses = 'touch-btn flex flex-col items-center justify-center p-2.5 rounded-2xl border transition active:scale-95 text-center relative ';
    if (isSelected) {
      btnClasses += 'month-btn-active ';
    } else {
      btnClasses += 'bg-[#181138] border-purple-500/20 hover:bg-purple-900/30 text-white ';
    }
    if (isCurrent) {
      btnClasses += 'month-btn-current ';
    }
    btn.className = btnClasses;

    const shortAmt = monthExpense > 0 ? (monthExpense >= 1000000 ? (monthExpense / 1000000).toFixed(1) + ' mln' : (monthExpense / 1000).toFixed(0) + 'k') : '0';

    btn.innerHTML = `
      <span class="text-xs font-bold leading-tight">${MONTH_NAMES[m - 1]}</span>
      <span class="text-[10px] mt-0.5 ${isSelected ? 'text-purple-100 font-extrabold' : 'text-purple-300/70'}">
        ${txCount > 0 ? shortAmt : '-'}
      </span>
    `;

    container.appendChild(btn);
  }
}

// ==========================================
// 6. SAHIFALARNI ALMASHTIRISH (TAB SWITCHING)
// ==========================================
function switchTab(tabId) {
  triggerHaptic('selection');
  if (currentTab === tabId && document.getElementById(`tab-${tabId}`)?.classList.contains('active')) {
    return;
  }
  currentTab = tabId;
  updateTelegramBackButton();

  // Sakramaslik uchun darhol yuqoriga o'rnatish
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

  // Barcha tab sahifalarini yashirish va faolini ochish
  const tabs = ['home', 'history', 'analytics', 'profile'];
  tabs.forEach(t => {
    const page = document.getElementById(`tab-${t}`);
    if (page) {
      if (t === tabId) {
        page.classList.add('active');
        page.style.display = 'block';
      } else {
        page.classList.remove('active');
        page.style.display = 'none';
      }
    }
  });

  // Pastki navigatsiya tugmalarini yangilash
  tabs.forEach(t => {
    const btn = document.getElementById(`navBtn-${t}`);
    if (!btn) return;

    const iconContainer = btn.querySelector('.nav-icon-container');
    const label = btn.querySelector('.nav-label');

    if (t === tabId) {
      if (iconContainer) {
        iconContainer.className = 'nav-icon-container w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/35 transition-all scale-105';
      }
      if (label) {
        label.className = 'nav-label text-[10px] font-bold text-purple-300 mt-0.5';
      }
    } else {
      if (iconContainer) {
        iconContainer.className = 'nav-icon-container w-9 h-9 rounded-xl text-slate-400 hover:text-white flex items-center justify-center transition-all';
      }
      if (label) {
        label.className = 'nav-label text-[10px] font-medium text-slate-400 mt-0.5';
      }
    }
  });

  if (tabId === 'home') renderHomeTab();
  if (tabId === 'history') renderHistoryTab();
  if (tabId === 'analytics') renderAnalyticsTab();
}

function goToSearch() {
  switchTab('history');
  setTimeout(() => {
    const input = document.getElementById('searchInput');
    if (input) input.focus();
  }, 150);
}

// ==========================================
// 7. TUNGI / KUNDUZGI REJIM (DARK / LIGHT)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('personal_expenses_theme') || 'dark';
  applyTheme(savedTheme === 'dark');
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(!isDark);
  localStorage.setItem('personal_expenses_theme', !isDark ? 'dark' : 'light');
}

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }

  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = isDark ? 'fa-solid fa-moon text-purple-300 text-xs' : 'fa-solid fa-sun text-amber-500 text-xs';
  }

  const knob = document.getElementById('profileThemeKnob');
  if (knob) {
    knob.style.transform = isDark ? 'translateX(20px)' : 'translateX(0px)';
  }
}

// ==========================================
// 8. EVENT LISTENERS VA MODALLARNI BOSHQARISH
// ==========================================
function setupEventListeners() {
  const modals = [
    { id: 'expenseModal', closeFn: closeExpenseModal },
    { id: 'budgetModal', closeFn: closeBudgetModal },
    { id: 'monthPickerModal', closeFn: closeMonthPickerModal },
    { id: 'confirmModal', closeFn: closeConfirmModal },
    { id: 'editNameModal', closeFn: closeEditNameModal }
  ];

  modals.forEach(({ id, closeFn }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target.id === id) closeFn();
      });
    }
  });

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

function populateCategorySelect(type) {
  const select = document.getElementById('categorySelect');
  if (!select) return;
  select.innerHTML = '';

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  Object.entries(categories).forEach(([key, val]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = val.name;
    select.appendChild(option);
  });
}

function setModalType(type) {
  currentModalType = type;
  const btnExpense = document.getElementById('modalTypeExpenseBtn');
  const btnIncome = document.getElementById('modalTypeIncomeBtn');
  const title = document.getElementById('modalTitle');
  const icon = document.getElementById('modalHeaderIcon');
  const iconBox = document.getElementById('modalHeaderIconBox');
  const submitText = document.getElementById('submitExpenseBtnText');

  const activeExpense = 'touch-btn h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center gap-1.5 shadow-md transition active:scale-95';
  const inactiveExpense = 'touch-btn h-10 rounded-xl text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition active:scale-95';

  const activeIncome = 'touch-btn h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center gap-1.5 shadow-md transition active:scale-95';
  const inactiveIncome = 'touch-btn h-10 rounded-xl text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition active:scale-95';

  if (type === 'income') {
    if (btnIncome) btnIncome.className = activeIncome;
    if (btnExpense) btnExpense.className = inactiveExpense;
    if (title) title.textContent = "Qo'shimcha kirim kiritish";
    if (icon) icon.className = "fa-solid fa-arrow-trend-up text-emerald-400";
    if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm";
    if (submitText) submitText.textContent = "Kirimni Saqlash";
  } else {
    if (btnExpense) btnExpense.className = activeExpense;
    if (btnIncome) btnIncome.className = inactiveIncome;
    if (title) title.textContent = "Yangi chiqim kiritish";
    if (icon) icon.className = "fa-solid fa-arrow-trend-down text-rose-400";
    if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-sm";
    if (submitText) submitText.textContent = "Xarajatni Saqlash";
  }

  populateCategorySelect(type);
}

function openExpenseModal(type = 'expense') {
  triggerHaptic('medium');
  setModalType(type);
  const modal = document.getElementById('expenseModal');
  if (modal) {
    setDefaultDate();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateTelegramBackButton();
    setTimeout(() => {
      const amountInput = document.getElementById('amountInput');
      if (amountInput) amountInput.focus();
    }, 150);
  }
}

function closeExpenseModal() {
  triggerHaptic('light');
  const modal = document.getElementById('expenseModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    updateTelegramBackButton();
  }
}

function openBudgetModal() {
  triggerHaptic('medium');
  const modal = document.getElementById('budgetModal');
  const input = document.getElementById('budgetInput');
  if (input) {
    input.value = formatAmountOnly(monthlyBudget);
  }
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateTelegramBackButton();
    setTimeout(() => {
      if (input) input.focus();
    }, 150);
  }
}

function closeBudgetModal() {
  triggerHaptic('light');
  const modal = document.getElementById('budgetModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    updateTelegramBackButton();
  }
}

function setQuickBudget(amt) {
  triggerHaptic('light');
  const input = document.getElementById('budgetInput');
  if (input) {
    input.value = formatAmountOnly(amt);
    input.focus();
  }
}

function handleBudgetSubmit(e) {
  e.preventDefault();
  const raw = document.getElementById('budgetInput').value.replace(/\D/g, '');
  const val = parseFloat(raw);
  if (!isNaN(val) && val > 0) {
    triggerHaptic('success');
    monthlyBudget = val;
    saveBudget();
    closeBudgetModal();
    renderAll();
    showToast('Oylik oila budjeti muvaffaqiyatli saqlandi!');
  } else {
    triggerHaptic('warning');
    showToast('Iltimos, haqiqiy summa kiriting', 'info');
  }
}

function openCustomConfirm({ title, desc, icon, actionText, actionClass, onConfirm }) {
  triggerHaptic('warning');
  document.getElementById('confirmModalTitle').textContent = title || "Tasdiqlang";
  document.getElementById('confirmModalDesc').textContent = desc || "Ushbu amalni tasdiqlaysizmi?";
  if (icon) {
    document.getElementById('confirmModalIcon').className = `fa-solid ${icon}`;
  }
  const actionBtn = document.getElementById('confirmActionBtn');
  actionBtn.textContent = actionText || "Ha, tasdiqlayman";
  if (actionClass) {
    actionBtn.className = actionClass;
  }
  pendingConfirmAction = onConfirm;

  const modal = document.getElementById('confirmModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  updateTelegramBackButton();
}

function closeConfirmModal() {
  triggerHaptic('light');
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    updateTelegramBackButton();
  }
  pendingConfirmAction = null;
}

function openEditNameModal() {
  triggerHaptic('light');
  const modal = document.getElementById('editNameModal');
  const nameInput = document.getElementById('editNameInput');
  const tagInput = document.getElementById('editTagInput');
  if (nameInput) nameInput.value = userName;
  if (tagInput) tagInput.value = userTag.replace('@', '');
  if (modal) {
    modal.classList.remove('hidden');
    updateTelegramBackButton();
  }
}

function closeEditNameModal() {
  triggerHaptic('light');
  const modal = document.getElementById('editNameModal');
  if (modal) {
    modal.classList.add('hidden');
    updateTelegramBackButton();
  }
}

function saveUserName() {
  const nameInput = document.getElementById('editNameInput');
  const tagInput = document.getElementById('editTagInput');
  const newName = nameInput ? nameInput.value.trim() : '';
  const newTag = tagInput ? tagInput.value.trim() : '';

  if (newName) {
    triggerHaptic('success');
    userName = newName;
    userTag = newTag ? (newTag.startsWith('@') ? newTag : `@${newTag}`) : `@${newName.toLowerCase().replace(/\s+/g, '')}`;
    localStorage.setItem('personal_expenses_username', userName);
    localStorage.setItem('personal_expenses_usertag', userTag);
    updateUserDisplay();
    closeEditNameModal();
    showToast('Profil ma\'lumotlari yangilandi!');
  }
}

// ==========================================
// 9. AMALIYOT QO'SHISH VA O'CHIRISH
// ==========================================
function formatAmountInput(input) {
  let raw = input.value.replace(/\D/g, '');
  if (!raw) {
    input.value = '';
    return;
  }
  raw = raw.replace(/^0+/, '') || '0';
  input.value = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function addQuickAmount(val) {
  triggerHaptic('light');
  const input = document.getElementById('amountInput');
  const rawCurrent = input.value.replace(/\D/g, '');
  const current = parseFloat(rawCurrent) || 0;
  const newTotal = current + val;
  input.value = newTotal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  input.focus();
}

function handleExpenseSubmit(e) {
  e.preventDefault();
  const rawAmount = document.getElementById('amountInput').value.replace(/\D/g, '');
  const amount = parseFloat(rawAmount);
  const category = document.getElementById('categorySelect').value;
  const date = document.getElementById('dateInput').value || getTodayString();
  const note = document.getElementById('noteInput').value.trim();

  if (!amount || amount <= 0) return;

  triggerHaptic('success');
  const catMap = currentModalType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const fallbackNote = catMap[category] ? catMap[category].name : (currentModalType === 'income' ? 'Kirim' : 'Chiqim');

  expenses.unshift({
    id: 'tx_' + Date.now(),
    amount: amount,
    category: category,
    type: currentModalType,
    date: date,
    note: note || fallbackNote
  });

  saveExpenses();
  document.getElementById('amountInput').value = '';
  document.getElementById('noteInput').value = '';
  setDefaultDate();
  closeExpenseModal();
  renderAll();

  const successMsg = currentModalType === 'income' ? 'Kirim muvaffaqiyatli qo\'shildi!' : 'Xarajat muvaffaqiyatli saqlandi!';
  showToast(successMsg);
}

function deleteExpense(id) {
  const item = expenses.find(i => i.id === id);
  const isIncome = item && item.type === 'income';
  const typeText = isIncome ? 'Kirim' : 'Xarajat';
  const noteName = item ? `"${item.note}" (${formatCurrency(item.amount)})` : `Ushbu ${typeText.toLowerCase()}ni`;

  openCustomConfirm({
    title: `${typeText}ni o'chirish`,
    desc: `${noteName} o'chirib tashlansinmi? Bu amalni qaytarib bo'lmaydi.`,
    icon: "fa-trash-can",
    actionText: "Ha, o'chirish",
    actionClass: "touch-btn h-11 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white shadow-md shadow-rose-600/30 transition",
    onConfirm: () => {
      expenses = expenses.filter(i => i.id !== id);
      saveExpenses();
      renderAll();
      showToast(`${typeText} o'chirildi`, 'info');
    }
  });
}

function confirmResetData() {
  openCustomConfirm({
    title: "Barcha ma'lumotlarni tozalash",
    desc: "Barcha qayd etilgan kirim va chiqimlar butunlay o'chirib tashlanadi. Ushbu amalni ortga qaytarib bo'lmaydi!",
    icon: "fa-triangle-exclamation",
    actionText: "Ha, tozalash",
    actionClass: "touch-btn h-11 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white shadow-md shadow-rose-600/30 transition",
    onConfirm: () => {
      expenses = [];
      saveExpenses();
      renderAll();
      showToast('Barcha ma\'lumotlar tozalandi', 'info');
    }
  });
}

// ==========================================
// 10. FILTRLAR VA QIDIRUV (TARIX SAHIFASI)
// ==========================================
function setTransactionTypeFilter(type) {
  triggerHaptic('selection');
  selectedTypeFilter = type; // 'all', 'expense', 'income'

  const activeClass = 'touch-btn h-9 rounded-xl bg-purple-600 text-white transition active:scale-95 text-center shadow-sm';
  const inactiveClass = 'touch-btn h-9 rounded-xl text-slate-400 hover:text-white transition active:scale-95 text-center';

  const btnAll = document.getElementById('typeFilterAllBtn');
  const btnExp = document.getElementById('typeFilterExpenseBtn');
  const btnInc = document.getElementById('typeFilterIncomeBtn');

  if (btnAll) btnAll.className = (type === 'all') ? activeClass : inactiveClass;
  if (btnExp) btnExp.className = (type === 'expense') ? activeClass : inactiveClass;
  if (btnInc) btnInc.className = (type === 'income') ? activeClass : inactiveClass;

  renderExpensesList();
}

function setDatePeriodFilter(p) {
  triggerHaptic('selection');
  selectedPeriod = p;

  const activeClasses = 'px-2.5 py-1.5 rounded-lg bg-purple-600 text-white shadow-sm transition active:scale-95 flex items-center gap-1.5 text-[11px] font-bold';
  const inactiveClasses = 'px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition active:scale-95 flex items-center gap-1.5 text-[11px] font-medium';

  const btnAll = document.getElementById('periodAllBtn');
  const btnToday = document.getElementById('periodTodayBtn');
  const btnMonth = document.getElementById('periodMonthBtn');

  if (btnAll) btnAll.className = (p === 'all') ? activeClasses : inactiveClasses;
  if (btnToday) btnToday.className = (p === 'today') ? activeClasses : inactiveClasses;
  if (btnMonth) btnMonth.className = (p === 'this_month') ? activeClasses : inactiveClasses;

  const currentMonthName = selectedMonth ? MONTH_NAMES[selectedMonth - 1] : "Shu oy";
  const labelMap = { all: 'Barchasi', today: 'Bugun', this_month: `${currentMonthName} oyi` };
  const filterLabel = document.getElementById('currentFilterLabel');
  if (filterLabel) filterLabel.textContent = labelMap[p] || 'Barchasi';

  renderExpensesList();
}

function setCategoryFilter(catId) {
  triggerHaptic('selection');
  selectedCategory = catId;
  const dropdown = document.getElementById('filterCategoryDropdown');
  if (dropdown) dropdown.value = catId;

  const resetBtn = document.getElementById('resetCategoryFilterBtn');
  if (resetBtn) resetBtn.classList.toggle('hidden', catId === 'all');

  renderExpensesList();
}

function handleSearch(val) {
  searchQuery = val.toLowerCase().trim();
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.classList.toggle('hidden', searchQuery === '');
  renderExpensesList();
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  searchQuery = '';
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.classList.add('hidden');
  renderExpensesList();
}

// ==========================================
// 11. STATISTIKA DAVRINI TANLASH
// ==========================================
function setAnalyticsPeriod(period) {
  triggerHaptic('selection');
  selectedAnalyticsPeriod = period; // 'this_month', 'today', 'all'

  const activeClass = 'touch-btn flex-1 h-9 rounded-xl bg-purple-600 text-white shadow-sm transition active:scale-95 text-center text-xs font-bold';
  const inactiveClass = 'touch-btn flex-1 h-9 rounded-xl text-slate-400 hover:text-white transition active:scale-95 text-center text-xs font-medium';

  const btnMonth = document.getElementById('analyticsPeriodMonthBtn');
  const btnToday = document.getElementById('analyticsPeriodTodayBtn');
  const btnAll = document.getElementById('analyticsPeriodAllBtn');
  const badge = document.getElementById('analyticsChartPeriodBadge');

  if (btnMonth) btnMonth.className = (period === 'this_month') ? activeClass : inactiveClass;
  if (btnToday) btnToday.className = (period === 'today') ? activeClass : inactiveClass;
  if (btnAll) btnAll.className = (period === 'all') ? activeClass : inactiveClass;

  const currentMonthName = selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : "Barcha oylar";
  const badgeLabels = { this_month: currentMonthName, today: 'Bugun', all: 'Barchasi' };
  if (badge) badge.textContent = badgeLabels[period] || currentMonthName;

  renderAnalyticsTab();
}

// ==========================================
// 12. ASOSIY RENDER FUNKSIYALARI
// ==========================================
function renderAll() {
  updateMonthNavigatorDisplay();
  renderHomeTab();
  renderHistoryTab();
  renderAnalyticsTab();
}

// A. ASOSIY (HOME) TABINI CHIZISH
function renderHomeTab() {
  let monthIncome = 0;
  let monthExpense = 0;
  let todayExpense = 0;
  const monthCatTotals = {};

  const todayStr = getTodayString();
  const isAllMonths = (selectedMonth === null);
  const targetPrefix = isAllMonths ? '' : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Amaliyotlarni tanlangan oy bo'yicha hisoblash
  expenses.forEach(e => {
    const isIncome = e.type === 'income';
    const amt = e.amount;
    const matchesMonth = isAllMonths || (e.date && e.date.startsWith(targetPrefix));

    if (matchesMonth) {
      if (isIncome) {
        monthIncome += amt;
      } else {
        monthExpense += amt;
        monthCatTotals[e.category] = (monthCatTotals[e.category] || 0) + amt;
      }
    }

    if (!isIncome && e.date === todayStr) {
      todayExpense += amt;
    }
  });

  // Sof Balans = Kirim - Chiqim
  const netBalance = monthIncome - monthExpense;
  const heroBal = document.getElementById('totalBalanceHero');
  const heroBalStatus = document.getElementById('heroBalanceStatus');
  const heroIncome = document.getElementById('heroIncomeTotal');
  const heroExpense = document.getElementById('heroExpenseTotal');

  if (heroBal) {
    heroBal.textContent = (netBalance < 0 ? '-' : '') + formatCurrency(Math.abs(netBalance));
  }

  if (heroBalStatus) {
    if (netBalance >= 0) {
      heroBalStatus.textContent = 'Ijobiy';
      heroBalStatus.className = 'text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/25';
    } else {
      heroBalStatus.textContent = 'Kamomad';
      heroBalStatus.className = 'text-[10px] font-black text-rose-400 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-400/25';
    }
  }

  if (heroIncome) heroIncome.textContent = '+' + formatCurrency(monthIncome);
  if (heroExpense) heroExpense.textContent = '-' + formatCurrency(monthExpense);

  // Oylik Budjet ko'rsatkichi
  const budgetLimitText = document.getElementById('heroBudgetLimitText');
  const budgetPercentText = document.getElementById('heroBudgetPercent');
  const budgetProgressBar = document.getElementById('heroBudgetProgressBar');

  if (budgetLimitText) budgetLimitText.textContent = formatCurrency(monthlyBudget);

  const budgetPct = monthlyBudget > 0 ? Math.min(100, Math.round((monthExpense / monthlyBudget) * 100)) : 0;
  if (budgetPercentText) {
    budgetPercentText.textContent = `${budgetPct}% ishlatildi`;
    if (budgetPct >= 90) {
      budgetPercentText.className = 'text-rose-400 font-extrabold';
    } else if (budgetPct >= 70) {
      budgetPercentText.className = 'text-amber-400 font-extrabold';
    } else {
      budgetPercentText.className = 'text-purple-300 font-extrabold';
    }
  }

  if (budgetProgressBar) {
    budgetProgressBar.style.width = `${budgetPct}%`;
  }

  // Umumiy ko'rsatkichlar kartalari
  const monthNameEl = document.getElementById('homeCurrentMonthName');
  if (monthNameEl) {
    monthNameEl.textContent = isAllMonths ? 'Barcha oylar' : MONTH_NAMES[selectedMonth - 1];
  }

  const monthExpEl = document.getElementById('homeMonthExpense');
  if (monthExpEl) monthExpEl.textContent = formatCurrency(monthExpense);

  const todayExpEl = document.getElementById('homeTodayExpense');
  if (todayExpEl) todayExpEl.textContent = formatCurrency(todayExpense);

  // Top xarajat sohasi
  let topCatName = '-', topAmt = 0;
  for (const [k, v] of Object.entries(monthCatTotals)) {
    if (v > topAmt) {
      topAmt = v;
      topCatName = ALL_CATEGORIES[k] ? ALL_CATEGORIES[k].name : k;
    }
  }
  const topCatEl = document.getElementById('homeTopCategory');
  if (topCatEl) topCatEl.textContent = topCatName;

  // Tanlangan oydagi so'nggi amaliyotlar
  renderRecentTransactions();
}

function renderRecentTransactions() {
  const container = document.getElementById('recentTransactionsList');
  if (!container) return;
  container.innerHTML = '';

  const isAllMonths = (selectedMonth === null);
  const targetPrefix = isAllMonths ? '' : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Tanlangan oy bo'yicha saralangan amaliyotlar
  const monthItems = expenses.filter(e => isAllMonths || (e.date && e.date.startsWith(targetPrefix)));
  const recent = monthItems.slice(0, 4);

  if (recent.length === 0) {
    const monthTitle = selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]}` : 'ushbu davr';
    container.innerHTML = `
      <div class="py-6 text-center text-slate-400">
        <i class="fa-regular fa-folder-open text-2xl text-purple-400/60 mb-1.5 block"></i>
        <p class="text-xs">${monthTitle}da amaliyotlar qayd etilmagan</p>
      </div>
    `;
    return;
  }

  const todayStr = getTodayString();

  recent.forEach(item => {
    const isIncome = item.type === 'income';
    const cat = ALL_CATEGORIES[item.category] || { name: 'Boshqa', icon: 'fa-box', color: '#818cf8' };
    const row = document.createElement('div');
    row.className = 'p-2.5 rounded-2xl bg-purple-900/15 hover:bg-purple-900/25 border border-purple-500/15 flex items-center justify-between gap-2.5 transition';

    const sign = isIncome ? '+' : '-';
    const amountColor = isIncome ? 'text-emerald-400' : 'text-rose-400';
    const iconColor = isIncome ? '#10b981' : cat.color;

    row.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white text-xs shadow-xs" style="background-color: ${iconColor}">
          <i class="fa-solid ${cat.icon}"></i>
        </div>
        <div class="min-w-0">
          <h4 class="text-xs font-bold text-white truncate leading-tight">${escapeHtml(item.note)}</h4>
          <span class="text-[10px] text-purple-300/70 block mt-0.5">${item.date === todayStr ? 'Bugun' : item.date} &bull; ${cat.name}</span>
        </div>
      </div>
      <span class="text-xs sm:text-sm font-black ${amountColor} shrink-0">
        ${sign}${formatCurrency(item.amount)}
      </span>
    `;
    container.appendChild(row);
  });
}

// B. TARIX TABINI CHIZISH
function renderHistoryTab() {
  updateFilterBadges();
  renderExpensesList();
}

function updateFilterBadges() {
  const todayStr = getTodayString();
  const isAllMonths = (selectedMonth === null);
  const targetPrefix = isAllMonths ? '' : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  let countToday = 0;
  let countMonth = 0;

  expenses.forEach(e => {
    if (e.date === todayStr) countToday++;
    if (isAllMonths || (e.date && e.date.startsWith(targetPrefix))) {
      countMonth++;
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

  const todayStr = getTodayString();
  const isAllMonths = (selectedMonth === null);
  const targetPrefix = isAllMonths ? '' : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const filtered = expenses.filter(i => {
    // 1. Amaliyot turi bo'yicha filter (all, expense, income)
    if (selectedTypeFilter !== 'all' && i.type !== selectedTypeFilter) return false;

    // 2. Kategoriya bo'yicha filter
    if (selectedCategory !== 'all' && i.category !== selectedCategory) return false;

    // 3. Vaqt davri bo'yicha filter
    if (selectedPeriod === 'today') {
      if (i.date !== todayStr) return false;
    } else if (selectedPeriod === 'this_month') {
      if (!isAllMonths && (!i.date || !i.date.startsWith(targetPrefix))) return false;
    }

    // 4. Qidiruv bo'yicha filter
    if (searchQuery) {
      const cat = ALL_CATEGORIES[i.category] || { name: '' };
      const noteMatch = (i.note || '').toLowerCase().includes(searchQuery);
      const catMatch = cat.name.toLowerCase().includes(searchQuery);
      const rawAmt = i.amount.toString();
      const commaAmt = rawAmt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const cleanQuery = searchQuery.replace(/,/g, '');
      const amountMatch = rawAmt.includes(cleanQuery) || commaAmt.includes(searchQuery);
      return noteMatch || catMatch || amountMatch;
    }

    return true;
  });

  if (badge) badge.textContent = `${filtered.length} ta amaliyot`;

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
    const isIncome = item.type === 'income';
    const cat = ALL_CATEGORIES[item.category] || { name: 'Boshqa', icon: 'fa-box', color: '#818cf8' };
    const row = document.createElement('div');
    row.className = 'glass-card p-3 rounded-2xl flex items-center justify-between gap-2.5 hover:border-purple-500/40 transition animate-fade-in';

    const sign = isIncome ? '+' : '-';
    const amountColor = isIncome ? 'text-emerald-400' : 'text-rose-400';
    const iconColor = isIncome ? '#10b981' : cat.color;

    row.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white text-xs shadow-md" style="background-color: ${iconColor}">
          <i class="fa-solid ${cat.icon}"></i>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded ${isIncome ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">
              ${isIncome ? 'Kirim' : 'Chiqim'}
            </span>
            <h4 class="text-xs sm:text-sm font-extrabold text-white truncate leading-tight">${escapeHtml(item.note)}</h4>
          </div>
          <p class="text-[10px] text-purple-300/70 mt-0.5 flex items-center gap-1.5">
            <span class="font-bold text-purple-200">${escapeHtml(cat.name)}</span>
            <span>&bull;</span>
            <span class="${item.date === todayStr ? 'text-emerald-400 font-extrabold' : ''}">${item.date === todayStr ? 'Bugun' : item.date}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs sm:text-sm font-black ${amountColor}">
          ${sign}${formatCurrency(item.amount)}
        </span>
        <button onclick="deleteExpense('${item.id}')" class="touch-btn w-8 h-8 rounded-xl bg-purple-900/15 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 flex items-center justify-center transition active:scale-90" title="O'chirish">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      </div>
    `;
    container.appendChild(row);
  });
}

// C. TAHLIL VA AYLANA GRAFIK (ANALYTICS TABINI CHIZISH)
function renderAnalyticsTab() {
  const todayStr = getTodayString();
  const isAllMonths = (selectedMonth === null);
  const targetPrefix = isAllMonths ? '' : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Tanlangan davrga ko'ra amaliyotlarni filtrlash
  const periodItems = expenses.filter(e => {
    if (selectedAnalyticsPeriod === 'today') {
      return e.date === todayStr;
    } else if (selectedAnalyticsPeriod === 'this_month') {
      return isAllMonths || (e.date && e.date.startsWith(targetPrefix));
    }
    return true; // 'all'
  });

  let periodIncome = 0;
  let periodExpense = 0;
  const categorySums = {};

  periodItems.forEach(item => {
    if (item.type === 'income') {
      periodIncome += item.amount;
    } else {
      periodExpense += item.amount;
      categorySums[item.category] = (categorySums[item.category] || 0) + item.amount;
    }
  });

  const periodSavings = periodIncome - periodExpense;
  const savingsRate = periodIncome > 0 ? Math.max(0, Math.round((periodSavings / periodIncome) * 100)) : 0;

  // 3 ta asosiy ko'rsatkichni yangilash
  const incomeEl = document.getElementById('analyticsIncomeVal');
  const expenseEl = document.getElementById('analyticsExpenseVal');
  const savingsEl = document.getElementById('analyticsSavingsVal');
  const savingsRateEl = document.getElementById('analyticsSavingsRate');

  if (incomeEl) incomeEl.textContent = '+' + formatCurrency(periodIncome);
  if (expenseEl) expenseEl.textContent = '-' + formatCurrency(periodExpense);
  if (savingsEl) savingsEl.textContent = (periodSavings < 0 ? '-' : '') + formatCurrency(Math.abs(periodSavings));
  if (savingsRateEl) {
    if (periodIncome > 0 && periodSavings >= 0) {
      savingsRateEl.textContent = `${savingsRate}% tejandi`;
      savingsRateEl.className = 'text-[10px] font-extrabold text-emerald-400 block truncate';
    } else if (periodSavings < 0) {
      savingsRateEl.textContent = 'Kamomad';
      savingsRateEl.className = 'text-[10px] font-extrabold text-rose-400 block truncate';
    } else {
      savingsRateEl.textContent = '0% tejandi';
      savingsRateEl.className = 'text-[10px] font-extrabold text-slate-400 block truncate';
    }
  }

  // Aylana Grafik (Pure SVG Donut Chart) chizish
  renderDonutChart(categorySums, periodExpense);

  // Oylik Budjet holati va Kunlik me'yor
  renderBudgetAnalytics();

  // Sohalar bo'yicha batafsil ro'yxatni chizish
  renderCategoryBreakdown(categorySums, periodExpense);

  // Barcha oylar bo'yicha tarixiy taqqoslash ro'yxatini chizish
  renderMonthlyComparison();
}

// AYLANA GRAFIKNI CHIZISH (PURE SVG DONUT CHART)
function renderDonutChart(categorySums, totalExpense) {
  const svg = document.getElementById('donutSvg');
  const centerAmount = document.getElementById('donutCenterAmount');
  const centerCategory = document.getElementById('donutCenterCategory');
  const legendGrid = document.getElementById('donutLegendGrid');

  if (!svg) return;
  svg.innerHTML = '';

  const radius = 58;
  const circumference = 2 * Math.PI * radius; // ~364.42px

  if (totalExpense <= 0) {
    svg.innerHTML = `
      <circle cx="80" cy="80" r="${radius}" fill="transparent" stroke="rgba(168, 85, 247, 0.2)" stroke-width="16" />
    `;
    if (centerAmount) centerAmount.textContent = "0 so'm";
    if (centerCategory) centerCategory.textContent = "Xarajat yo'q";
    if (legendGrid) {
      legendGrid.innerHTML = `
        <div class="col-span-2 text-center py-2 text-[11px] text-slate-400">
          Ushbu davrda xarajatlar qayd etilmagan
        </div>
      `;
    }
    return;
  }

  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', '80');
  bgCircle.setAttribute('cy', '80');
  bgCircle.setAttribute('r', radius);
  bgCircle.setAttribute('fill', 'transparent');
  bgCircle.setAttribute('stroke', 'rgba(255, 255, 255, 0.05)');
  bgCircle.setAttribute('stroke-width', '16');
  svg.appendChild(bgCircle);

  const sortedCategories = Object.entries(categorySums)
    .filter(([_, amt]) => amt > 0)
    .sort((a, b) => b[1] - a[1]);

  let cumulativeOffset = 0;
  const topCatKey = sortedCategories[0] ? sortedCategories[0][0] : null;
  const topCat = topCatKey ? ALL_CATEGORIES[topCatKey] : null;

  if (centerAmount) centerAmount.textContent = formatCurrency(totalExpense);
  if (centerCategory) centerCategory.textContent = topCat ? `${topCat.name}` : '-';

  // Har bir kategoriya uchun SVG segment chizish
  sortedCategories.forEach(([catKey, amt]) => {
    const cat = ALL_CATEGORIES[catKey] || { name: 'Boshqa', color: '#a855f7' };
    const fraction = amt / totalExpense;
    const dashLength = fraction * circumference;

    const segment = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    segment.setAttribute('cx', '80');
    segment.setAttribute('cy', '80');
    segment.setAttribute('r', radius);
    segment.setAttribute('fill', 'transparent');
    segment.setAttribute('stroke', cat.color);
    segment.setAttribute('stroke-width', '16');
    segment.setAttribute('stroke-dasharray', `${dashLength} ${circumference}`);
    segment.setAttribute('stroke-dashoffset', `${-cumulativeOffset}`);
    segment.setAttribute('class', 'donut-segment');

    // Interaktivlik: Hover va Mobil Touch/Tap hodisalari
    const percentStr = Math.round(fraction * 100);
    const showDetail = () => {
      if (centerAmount) centerAmount.textContent = formatCurrency(amt);
      if (centerCategory) centerCategory.textContent = `${cat.name} (${percentStr}%)`;
    };
    const resetDetail = () => {
      if (centerAmount) centerAmount.textContent = formatCurrency(totalExpense);
      if (centerCategory) centerCategory.textContent = topCat ? `${topCat.name}` : '-';
    };

    segment.addEventListener('mouseenter', showDetail);
    segment.addEventListener('mouseleave', resetDetail);
    segment.addEventListener('click', showDetail);

    svg.appendChild(segment);
    cumulativeOffset += dashLength;
  });

  // Afsona (Legend Grid) to'ldirish
  if (legendGrid) {
    legendGrid.innerHTML = '';
    sortedCategories.slice(0, 4).forEach(([catKey, amt]) => {
      const cat = ALL_CATEGORIES[catKey] || { name: 'Boshqa', color: '#a855f7' };
      const pct = Math.round((amt / totalExpense) * 100);

      const itemEl = document.createElement('div');
      itemEl.className = 'touch-btn h-10 px-2.5 rounded-xl bg-purple-900/15 border border-purple-500/15 cursor-pointer hover:bg-purple-900/25 transition flex items-center justify-between';
      itemEl.onclick = () => {
        setCategoryFilter(catKey);
        switchTab('history');
      };
      itemEl.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-3 h-3 rounded-full shrink-0 shadow-sm" style="background-color: ${cat.color}"></span>
          <span class="text-xs font-bold text-white truncate">${cat.name}</span>
        </div>
        <span class="text-[11px] font-extrabold text-purple-300 ml-1 shrink-0">${pct}%</span>
      `;
      legendGrid.appendChild(itemEl);
    });
  }
}

// Oila Budjeti va Kunlik me'yorni hisoblash
function renderBudgetAnalytics() {
  const isAllMonths = (selectedMonth === null);
  const targetPrefix = isAllMonths ? '' : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  let targetExpense = 0;
  expenses.forEach(e => {
    if (e.type === 'expense' && e.date) {
      if (isAllMonths || e.date.startsWith(targetPrefix)) {
        targetExpense += e.amount;
      }
    }
  });

  const remaining = Math.max(0, monthlyBudget - targetExpense);
  const pct = monthlyBudget > 0 ? Math.min(100, Math.round((targetExpense / monthlyBudget) * 100)) : 0;

  const remainingText = document.getElementById('analyticsBudgetRemainingText');
  const percentText = document.getElementById('analyticsBudgetPercentText');
  const progressBar = document.getElementById('analyticsBudgetProgressBar');
  const dailySafeLimit = document.getElementById('analyticsDailySafeLimit');

  if (remainingText) {
    if (monthlyBudget >= targetExpense) {
      remainingText.textContent = `Qoldi: ${formatCurrency(remaining)}`;
      remainingText.className = 'text-emerald-400';
    } else {
      remainingText.textContent = `Budjetdan oshdi: -${formatCurrency(targetExpense - monthlyBudget)}`;
      remainingText.className = 'text-rose-400';
    }
  }

  if (percentText) percentText.textContent = `${pct}% sarflandi`;
  if (progressBar) progressBar.style.width = `${pct}%`;

  // Kunlik me'yor (Joriy oyda qolgan kunlar, o'tgan oylarda esa umumiy natija)
  const now = new Date();
  const isCurrentCalendarMonth = (selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear());

  if (dailySafeLimit) {
    if (isCurrentCalendarMonth) {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
      const dailySafe = Math.round(remaining / daysLeft);
      dailySafeLimit.textContent = `Kuniga ~${formatCurrency(dailySafe)} (${daysLeft} kun qoldi)`;
    } else if (isAllMonths) {
      dailySafeLimit.textContent = `O'rtacha oylik sarf: ~${formatCurrency(targetExpense / Math.max(1, 3))}`;
    } else {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const avgDay = Math.round(targetExpense / daysInMonth);
      dailySafeLimit.textContent = `Oy yakunlandi. Kunlik o'rtacha sarf: ~${formatCurrency(avgDay)}`;
    }
  }
}

// Sohalar bo'yicha batafsil ro'yxatni chizish
function renderCategoryBreakdown(categorySums, totalExpense) {
  const grid = document.getElementById('categoryAnalyticsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const activeCategories = Object.entries(categorySums)
    .filter(([_, amt]) => amt > 0)
    .sort((a, b) => b[1] - a[1]);

  if (activeCategories.length === 0) {
    grid.innerHTML = `
      <div class="py-6 text-center text-slate-400 glass-card rounded-2xl">
        <p class="text-xs">Ushbu davrda sarflar mavjud emas</p>
      </div>
    `;
    return;
  }

  const isAllMonths = (selectedMonth === null);
  const targetPrefix = isAllMonths ? '' : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  activeCategories.forEach(([catKey, amt]) => {
    const cat = ALL_CATEGORIES[catKey] || { name: 'Boshqa', icon: 'fa-box', color: '#818cf8' };
    const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0;

    const count = expenses.filter(e => {
      const matchesMonth = isAllMonths || (e.date && e.date.startsWith(targetPrefix));
      return matchesMonth && e.category === catKey && e.type === 'expense';
    }).length;

    const card = document.createElement('div');
    card.onclick = () => {
      setCategoryFilter(catKey);
      switchTab('history');
    };
    card.className = 'glass-card p-3 rounded-2xl space-y-2 cursor-pointer hover:border-purple-500/40 active:scale-[0.99] transition';

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs shadow-xs" style="background-color: ${cat.color}">
            <i class="fa-solid ${cat.icon}"></i>
          </div>
          <div>
            <h4 class="text-xs font-bold text-white">${cat.name}</h4>
            <span class="text-[11px] text-purple-300/70">${count} ta xarajat</span>
          </div>
        </div>

        <div class="text-right">
          <div class="text-xs font-black text-white">${formatCurrency(amt)}</div>
          <span class="text-[11px] font-extrabold text-purple-300">${pct}%</span>
        </div>
      </div>

      <div class="w-full bg-[#1e173e] h-2 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700" style="width: ${pct}%; background-color: ${cat.color}"></div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// BARCHA OYLAR BO'YICHA TAQQOSLASH (MONTHLY HISTORICAL COMPARISON)
function renderMonthlyComparison() {
  const container = document.getElementById('monthlyHistoryComparisonList');
  if (!container) return;
  container.innerHTML = '';

  // Barcha mavjud oylarni ajratib olish
  const monthMap = {};
  expenses.forEach(e => {
    if (e.date && e.date.length >= 7) {
      const ym = e.date.substring(0, 7); // '2026-09'
      if (!monthMap[ym]) {
        monthMap[ym] = { income: 0, expense: 0, count: 0 };
      }
      monthMap[ym].count++;
      if (e.type === 'income') {
        monthMap[ym].income += e.amount;
      } else {
        monthMap[ym].expense += e.amount;
      }
    }
  });

  // Oylarni teskari tartibda (eng yangisi yuqorida) saralash
  const sortedYms = Object.keys(monthMap).sort().reverse();

  if (sortedYms.length === 0) {
    container.innerHTML = `
      <div class="py-4 text-center text-slate-400 text-xs glass-card rounded-2xl">
        Tahlil uchun oylar tarixi mavjud emas
      </div>
    `;
    return;
  }

  sortedYms.forEach(ym => {
    const [yStr, mStr] = ym.split('-');
    const yNum = parseInt(yStr, 10);
    const mNum = parseInt(mStr, 10);
    const data = monthMap[ym];
    const monthName = MONTH_NAMES[mNum - 1];
    const net = data.income - data.expense;
    const isSelected = (selectedMonth === mNum && selectedYear === yNum);

    const card = document.createElement('div');
    card.onclick = () => {
      selectMonth(mNum, yNum);
      // Statistika yuqorisiga qaytarish
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    card.className = `glass-card p-3.5 rounded-2xl space-y-2 cursor-pointer transition active:scale-[0.99] border ${
      isSelected ? 'border-purple-500 bg-purple-900/30 shadow-lg shadow-purple-600/20' : 'hover:border-purple-500/30'
    }`;

    // Budjet foizi
    const budgetPct = monthlyBudget > 0 ? Math.min(100, Math.round((data.expense / monthlyBudget) * 100)) : 0;

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl ${isSelected ? 'bg-purple-600 text-white' : 'bg-purple-900/25 text-purple-300'} flex items-center justify-center text-xs font-black shadow-sm">
            ${mNum}
          </div>
          <div>
            <h4 class="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
              <span>${monthName} ${yNum}</span>
              ${isSelected ? '<span class="text-[9px] font-black bg-purple-500/30 text-purple-200 px-2 py-0.2 rounded-full border border-purple-400/30">Tanlangan</span>' : ''}
            </h4>
            <span class="text-[10px] text-slate-400">${data.count} ta amaliyot</span>
          </div>
        </div>

        <div class="text-right">
          <div class="text-xs font-black ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            ${net >= 0 ? '+' : ''}${formatCurrency(net)}
          </div>
          <span class="text-[10px] font-bold text-slate-400">Sof qoldiq</span>
        </div>
      </div>

      <!-- Kirim va Chiqim 2 ko'rsatkichi -->
      <div class="grid grid-cols-2 gap-2 pt-1">
        <div class="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-center">
          <span class="text-[9px] font-bold text-emerald-400 block">Kirim</span>
          <span class="text-xs font-black text-emerald-300 truncate block">+${formatCurrency(data.income)}</span>
        </div>
        <div class="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/15 text-center">
          <span class="text-[9px] font-bold text-rose-400 block">Chiqim</span>
          <span class="text-xs font-black text-rose-300 truncate block">-${formatCurrency(data.expense)}</span>
        </div>
      </div>

      <!-- Oylik Budjet bajarilish chizig'i -->
      <div class="space-y-1 pt-0.5">
        <div class="flex items-center justify-between text-[10px] font-bold text-purple-300/80">
          <span>Budjet sarfi: ${budgetPct}%</span>
          <span>${formatCurrency(data.expense)} / ${formatCurrency(monthlyBudget)}</span>
        </div>
        <div class="w-full bg-[#181136] h-1.5 rounded-full overflow-hidden">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" style="width: ${budgetPct}%"></div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// ==========================================
// 13. EKSPORT VA IMPORT (JSON)
// ==========================================
function exportDataJSON() {
  const exportPayload = {
    budget: monthlyBudget,
    transactions: expenses
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `moliya_nazorati_${getTodayString()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Zaxira nusxa yuklab olindi!');
}

function importDataJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (Array.isArray(parsed)) {
        expenses = parsed;
        saveExpenses();
        renderAll();
        showToast('Ma\'lumotlar muvaffaqiyatli tiklandi!');
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.budget) {
          monthlyBudget = Number(parsed.budget) || monthlyBudget;
          saveBudget();
        }
        if (Array.isArray(parsed.transactions)) {
          expenses = parsed.transactions;
          saveExpenses();
        }
        renderAll();
        showToast('Ma\'lumotlar va budjet tiklandi!');
      } else {
        alert('Noto\'g\'ri fayl formati!');
      }
    } catch (err) {
      alert('Faylni o\'qishda xatolik yuz berdi!');
    }
  };
  reader.readAsText(file);
}

// ==========================================
// 14. YORDAMCHI FORMATLASH VA TOAST FUNKSIYALARI
// ==========================================
function formatCurrency(n) {
  return (Math.round(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + " so'm";
}

function formatAmountOnly(n) {
  return (Math.round(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
  const box = document.getElementById('toastBox');
  const text = document.getElementById('toastMsg');
  const icon = document.getElementById('toastIcon');
  if (!box || !text) return;

  text.textContent = msg;
  if (icon) {
    icon.className = type === 'info' ? 'fa-solid fa-circle-info text-blue-400 text-sm' : 'fa-solid fa-circle-check text-purple-400 text-sm';
  }

  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 2500);
}
