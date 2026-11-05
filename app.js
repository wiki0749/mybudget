const STORAGE_KEY = "mybudget-state-v1";

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const appState = loadState();
let balanceChart;
let categoryChart;

const categorySuggestions = [
  "Salary",
  "Freelance",
  "Housing",
  "Food",
  "Utilities",
  "Transport",
  "Travel",
  "Health",
  "Entertainment",
  "Savings",
  "Education",
  "Other",
];

const els = {
  currentBalance: document.querySelector("#current-balance"),
  monthlyIncome: document.querySelector("#monthly-income"),
  monthlyExpense: document.querySelector("#monthly-expense"),
  forecastBalance: document.querySelector("#forecast-balance"),
  balanceTrend: document.querySelector("#balance-trend"),
  transactionForm: document.querySelector("#transaction-form"),
  budgetForm: document.querySelector("#budget-form"),
  goalForm: document.querySelector("#goal-form"),
  budgetList: document.querySelector("#budget-list"),
  goalList: document.querySelector("#goal-list"),
  transactionBody: document.querySelector("#transaction-body"),
  dateStart: document.querySelector("#date-start"),
  dateEnd: document.querySelector("#date-end"),
  exportCsv: document.querySelector("#export-csv"),
  importCsv: document.querySelector("#import-csv"),
  balanceChart: document.querySelector("#balance-chart"),
  categoryChart: document.querySelector("#category-chart"),
  forecastList: document.querySelector("#forecast-list"),
  viewButtons: [...document.querySelectorAll("[data-view]")],
  tableView: document.querySelector("#table-view"),
  chartView: document.querySelector("#chart-view"),
  categorySuggestions: document.querySelector("#category-suggestions"),
};

init();

function init() {
  seedDefaults();
  setDefaultDates();
  populateCategorySuggestions();
  bindEvents();
  render();
}

function seedDefaults() {
  if (!appState.transactions.length || !appState.budgets.length || !appState.goals.length) {
    const defaultData = createDefaultData();
    appState.transactions = defaultData.transactions;
    appState.budgets = defaultData.budgets;
    appState.goals = defaultData.goals;
    persistState();
  }
}

function createDefaultData() {
  const today = new Date();
  const makeDate = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return toDateInputValue(d);
  };

  return {
    transactions: [
      { id: uid(), title: "Salary", amount: 4200, date: makeDate(-2), type: "income", category: "Salary", frequency: "regular", notes: "Primary paycheck" },
      { id: uid(), title: "Bonus", amount: 900, date: makeDate(-8), type: "income", category: "Freelance", frequency: "irregular", notes: "Side project settlement" },
      { id: uid(), title: "Rent", amount: -1650, date: makeDate(-3), type: "expense", category: "Housing", frequency: "regular", notes: "Apartment rent" },
      { id: uid(), title: "Groceries", amount: -420, date: makeDate(-6), type: "expense", category: "Food", frequency: "regular", notes: "Weekly shop" },
      { id: uid(), title: "Utilities", amount: -260, date: makeDate(-11), type: "expense", category: "Utilities", frequency: "regular", notes: "Electricity and water" },
      { id: uid(), title: "Train pass", amount: -140, date: makeDate(-7), type: "expense", category: "Transport", frequency: "regular", notes: "Commuter travel" },
      { id: uid(), title: "Vacation fund", amount: -350, date: makeDate(-1), type: "expense", category: "Savings", frequency: "irregular", notes: "Queued transfer" },
    ],
    budgets: [
      { id: uid(), category: "Housing", limit: 1800, month: toMonthInputValue(today) },
      { id: uid(), category: "Food", limit: 700, month: toMonthInputValue(today) },
      { id: uid(), category: "Utilities", limit: 350, month: toMonthInputValue(today) },
      { id: uid(), category: "Transport", limit: 250, month: toMonthInputValue(today) },
    ],
    goals: [
      { id: uid(), name: "Emergency fund", target: 10000, current: 6400, dueDate: "2027-12-01" },
      { id: uid(), name: "Summer trip", target: 2500, current: 1400, dueDate: "2027-06-15" },
    ],
  };
}

function bindEvents() {
  els.transactionForm.addEventListener("submit", handleTransactionSubmit);
  els.budgetForm.addEventListener("submit", handleBudgetSubmit);
  els.goalForm.addEventListener("submit", handleGoalSubmit);
  els.dateStart.addEventListener("change", render);
  els.dateEnd.addEventListener("change", render);
  els.exportCsv.addEventListener("click", handleExportCsv);
  els.importCsv.addEventListener("change", handleImportCsv);

  els.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedView = button.dataset.view;
      els.viewButtons.forEach((btn) => {
        const isActive = btn === button;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
      });

      els.tableView.classList.toggle("active", selectedView === "table");
      els.chartView.classList.toggle("active", selectedView === "chart");
    });
  });

  document.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-transaction]");
    if (!deleteButton) {
      return;
    }

    const transactionId = deleteButton.dataset.deleteTransaction;
    appState.transactions = appState.transactions.filter((transaction) => transaction.id !== transactionId);
    persistState();
    render();
  });
}

function handleTransactionSubmit(event) {
  event.preventDefault();

  const formData = new FormData(els.transactionForm);
  const title = String(formData.get("title") || "").trim();
  const amount = Number(formData.get("amount"));
  const type = String(formData.get("transaction-type") || "income");
  const frequency = String(formData.get("frequency") || "regular");
  const category = String(formData.get("category") || "Other").trim() || "Other";
  const notes = String(formData.get("notes") || "").trim();
  const date = String(formData.get("date") || toDateInputValue(new Date()));

  if (!title || Number.isNaN(amount) || amount <= 0) {
    return;
  }

  appState.transactions.push({
    id: uid(),
    title,
    amount: type === "income" ? amount : -Math.abs(amount),
    type,
    category,
    frequency,
    notes,
    date,
  });

  persistState();
  els.transactionForm.reset();
  document.querySelector("#date").value = toDateInputValue(new Date());
  render();
}

function handleBudgetSubmit(event) {
  event.preventDefault();

  const formData = new FormData(els.budgetForm);
  const category = String(formData.get("budget-category") || "").trim() || "Other";
  const limit = Number(formData.get("budget-limit"));
  const month = String(formData.get("budget-month") || toMonthInputValue(new Date()));

  if (Number.isNaN(limit) || limit <= 0) {
    return;
  }

  appState.budgets.push({
    id: uid(),
    category,
    limit,
    month,
  });

  persistState();
  els.budgetForm.reset();
  document.querySelector("#budget-month").value = toMonthInputValue(new Date());
  render();
}

function handleGoalSubmit(event) {
  event.preventDefault();

  const formData = new FormData(els.goalForm);
  const name = String(formData.get("goal-name") || "").trim();
  const target = Number(formData.get("goal-target"));
  const current = Number(formData.get("goal-current"));
  const dueDate = String(formData.get("goal-date") || "");

  if (!name || Number.isNaN(target) || Number.isNaN(current) || target <= 0 || !dueDate) {
    return;
  }

  appState.goals.push({
    id: uid(),
    name,
    target,
    current,
    dueDate,
  });

  persistState();
  els.goalForm.reset();
  render();
}

function render() {
  renderSummaries();
  renderBudgets();
  renderGoals();
  renderTable();
  renderCharts();
  renderForecast();
}

function renderSummaries() {
  const currentMonthKey = toMonthKey(new Date());
  const monthTransactions = getTransactionsForMonth(currentMonthKey);
  const totalBalance = appState.transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const monthIncome = monthTransactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const monthExpense = monthTransactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const sixMonthProjection = projectBalance(6);

  els.currentBalance.textContent = formatCurrency(totalBalance);
  els.monthlyIncome.textContent = formatCurrency(monthIncome);
  els.monthlyExpense.textContent = formatCurrency(monthExpense);
  els.forecastBalance.textContent = formatCurrency(sixMonthProjection);

  const monthlyChange = monthIncome - monthExpense;
  els.balanceTrend.textContent = `Monthly net: ${formatSignedCurrency(monthlyChange)}`;
}

function renderBudgets() {
  const monthKey = toMonthKey(new Date());
  const items = appState.budgets.map((budget) => {
    const spent = appState.transactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          transaction.category === budget.category &&
          toMonthKey(new Date(transaction.date)) === budget.month
      )
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);

    const percent = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
    const barClass = percent >= 100 ? "danger" : percent >= 80 ? "warning" : "";
    const remaining = budget.limit - spent;
    return { ...budget, spent, percent, remaining, barClass };
  });

  els.budgetList.innerHTML = items.length
    ? items
        .map(
          (budget) => `
            <li class="budget-item ${budget.percent >= 100 ? "over" : budget.percent >= 80 ? "warning" : ""}">
              <div class="budget-header">
                <strong>${escapeHtml(budget.category)}</strong>
                <span>${formatCurrency(budget.spent)} / ${formatCurrency(budget.limit)}</span>
              </div>
              <div class="progress-track">
                <span class="progress-bar ${budget.barClass}" style="width: ${Math.min(100, budget.percent)}%"></span>
              </div>
              <p class="budget-status">
                ${budget.remaining >= 0 ? `${formatCurrency(budget.remaining)} remaining` : `${formatCurrency(Math.abs(budget.remaining))} over budget`}
              </p>
            </li>
          `
        )
        .join("")
    : '<li class="empty-state">No budgets yet.</li>';
}

function renderGoals() {
  els.goalList.innerHTML = appState.goals.length
    ? appState.goals
        .map((goal) => {
          const progress = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
          const remaining = Math.max(goal.target - goal.current, 0);
          const status = goal.current >= goal.target ? "Goal reached" : `${formatCurrency(remaining)} left`;

          return `
            <li class="goal-item">
              <div class="goal-header">
                <span class="goal-title">${escapeHtml(goal.name)}</span>
                <span>${formatCurrency(goal.current)} / ${formatCurrency(goal.target)}</span>
              </div>
              <div class="progress-track">
                <span class="progress-bar" style="width: ${progress}%"></span>
              </div>
              <div class="goal-progress">
                <span>${Math.round(progress)}%</span>
                <span>Due ${formatDate(goal.dueDate)}</span>
              </div>
              <p class="goal-status">${status}</p>
            </li>
          `;
        })
        .join("")
    : '<li class="empty-state">No savings goals yet.</li>';
}

function renderTable() {
  const filteredTransactions = getFilteredTransactions().sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!filteredTransactions.length) {
    els.transactionBody.innerHTML = '<tr><td colspan="8" class="empty-state">No transactions in the selected range.</td></tr>';
    return;
  }

  els.transactionBody.innerHTML = filteredTransactions
    .map(
      (transaction) => `
        <tr>
          <td>${formatDate(transaction.date)}</td>
          <td>${escapeHtml(transaction.title)}</td>
          <td>${transaction.type === "income" ? "Income" : "Expense"}</td>
          <td>${escapeHtml(transaction.category)}</td>
          <td>${transaction.frequency === "regular" ? "Regular" : "Irregular"}</td>
          <td class="${transaction.type === "income" ? "amount-income" : "amount-expense"}">${formatSignedCurrency(transaction.amount)}</td>
          <td>${escapeHtml(transaction.notes || "—")}</td>
          <td><button type="button" class="row-delete" data-delete-transaction="${transaction.id}" aria-label="Delete ${escapeHtml(transaction.title)}">Delete</button></td>
        </tr>
      `
    )
    .join("");
}

function renderCharts() {
  const range = getDateRange();
  const monthlyBreakdown = buildMonthlyBalanceSeries(range.start, range.end);
  const expenseByCategory = buildCategorySeries(range.start, range.end);

  if (balanceChart) {
    balanceChart.destroy();
  }

  if (categoryChart) {
    categoryChart.destroy();
  }

  balanceChart = new Chart(els.balanceChart, {
    type: "line",
    data: {
      labels: monthlyBreakdown.labels,
      datasets: [
        {
          label: "Balance",
          data: monthlyBreakdown.values,
          borderColor: "#14532d",
          backgroundColor: "rgba(20, 83, 45, 0.12)",
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => formatCompactCurrency(value),
          },
        },
      },
    },
  });

  categoryChart = new Chart(els.categoryChart, {
    type: "doughnut",
    data: {
      labels: expenseByCategory.labels,
      datasets: [
        {
          data: expenseByCategory.values,
          backgroundColor: [
            "#14532d",
            "#8d6ae6",
            "#86c995",
            "#b8dfc0",
            "#c9bbff",
            "#5caa70",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            usePointStyle: true,
          },
        },
      },
    },
  });
}

function renderForecast() {
  const forecast = buildForecastSeries();
  els.forecastList.innerHTML = forecast
    .map(
      (item) => `
        <li class="forecast-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${formatCurrency(item.balance)}</strong>
        </li>
      `
    )
    .join("");
}

function buildForecastSeries() {
  const startingBalance = appState.transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const regularMonthlyNet = appState.transactions
    .filter((transaction) => transaction.frequency === "regular")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  const forecast = [];
  let runningBalance = startingBalance;

  for (let monthIndex = 1; monthIndex <= 6; monthIndex += 1) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthIndex);
    runningBalance += regularMonthlyNet;
    forecast.push({ label: monthFormat.format(date), balance: runningBalance });
  }

  return forecast;
}

function buildMonthlyBalanceSeries(start, end) {
  const months = getMonthRange(start, end);
  const totals = {};

  appState.transactions.forEach((transaction) => {
    const monthKey = toMonthKey(new Date(transaction.date));
    if (monthKey >= toMonthKey(new Date(start)) && monthKey <= toMonthKey(new Date(end))) {
      totals[monthKey] = (totals[monthKey] || 0) + Number(transaction.amount || 0);
    }
  });

  let runningTotal = 0;
  const values = [];
  const labels = [];

  months.forEach((month) => {
    const monthKey = month.value;
    runningTotal += totals[monthKey] || 0;
    values.push(runningTotal);
    labels.push(month.label);
  });

  return { labels, values };
}

function buildCategorySeries(start, end) {
  const totals = {};

  appState.transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      const date = new Date(transaction.date);
      const inRange = date >= new Date(start) && date <= new Date(end);
      if (!inRange) {
        return;
      }
      const category = transaction.category || "Other";
      totals[category] = (totals[category] || 0) + Math.abs(Number(transaction.amount || 0));
    });

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return {
    labels: sorted.map(([label]) => label),
    values: sorted.map(([, value]) => value),
  };
}

function getFilteredTransactions() {
  const range = getDateRange();
  const start = new Date(range.start);
  const end = new Date(range.end);

  return appState.transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return date >= start && date <= end;
  });
}

function getDateRange() {
  const startValue = els.dateStart.value || toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1));
  const endValue = els.dateEnd.value || toDateInputValue(new Date());
  return { start: startValue, end: endValue };
}

function getTransactionsForMonth(monthKey) {
  return appState.transactions.filter((transaction) => toMonthKey(new Date(transaction.date)) === monthKey);
}

function projectBalance(monthsAhead) {
  const startingBalance = appState.transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const regularMonthlyNet = appState.transactions
    .filter((transaction) => transaction.frequency === "regular")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  return startingBalance + regularMonthlyNet * monthsAhead;
}

function setDefaultDates() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  els.dateStart.value = toDateInputValue(start);
  els.dateEnd.value = toDateInputValue(today);
  document.querySelector("#date").value = toDateInputValue(today);
  document.querySelector("#budget-month").value = toMonthInputValue(today);
  document.querySelector("#goal-date").value = toDateInputValue(new Date(today.getFullYear() + 1, today.getMonth(), 1));
}

function populateCategorySuggestions() {
  const optionMarkup = categorySuggestions
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");
  els.categorySuggestions.innerHTML = optionMarkup;
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (error) {
    console.warn("Unable to save state:", error);
  }
}

function loadState() {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    if (!rawState) {
      return { transactions: [], budgets: [], goals: [] };
    }

    const parsed = JSON.parse(rawState);
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    };
  } catch (error) {
    console.warn("Unable to read cached state:", error);
    return { transactions: [], budgets: [], goals: [] };
  }
}

function handleExportCsv() {
  const rows = [
    ["section", "title", "amount", "date", "type", "category", "frequency", "notes", "target", "current", "limit", "month", "dueDate"],
    ...appState.transactions.map((transaction) => [
      "transactions",
      transaction.title,
      transaction.amount,
      transaction.date,
      transaction.type,
      transaction.category,
      transaction.frequency,
      transaction.notes || "",
      "",
      "",
      "",
      "",
      "",
    ]),
    ...appState.budgets.map((budget) => [
      "budgets",
      "",
      "",
      "",
      "",
      budget.category,
      "",
      "",
      "",
      "",
      budget.limit,
      budget.month,
      "",
    ]),
    ...appState.goals.map((goal) => [
      "goals",
      goal.name,
      "",
      "",
      "",
      "",
      "",
      "",
      goal.target,
      goal.current,
      "",
      "",
      goal.dueDate,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mybudget-export.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function handleImportCsv(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    const rows = parseCsvRows(text);

    if (!rows.length) {
      return;
    }

    const headings = rows[0].map((cell) => cell.trim().toLowerCase());
    const importedTransactions = [];
    const importedBudgets = [];
    const importedGoals = [];

    rows.slice(1).forEach((values) => {
      const record = Object.fromEntries(headings.map((heading, index) => [heading, values[index] || ""]));
      const section = (record.section || "").trim().toLowerCase();

      if (section === "transactions") {
        const amount = Number(record.amount || 0);
        const date = record.date || toDateInputValue(new Date());
        if (record.title && !Number.isNaN(amount)) {
          importedTransactions.push({
            id: uid(),
            title: record.title,
            amount: record.type === "income" ? Math.abs(amount) : -Math.abs(amount),
            date,
            type: record.type === "expense" ? "expense" : "income",
            category: record.category || "Other",
            frequency: record.frequency === "irregular" ? "irregular" : "regular",
            notes: record.notes || "",
          });
        }
      }

      if (section === "budgets") {
        const limit = Number(record.limit || 0);
        if (record.category && !Number.isNaN(limit)) {
          importedBudgets.push({
            id: uid(),
            category: record.category,
            limit,
            month: record.month || toMonthInputValue(new Date()),
          });
        }
      }

      if (section === "goals") {
        const target = Number(record.target || 0);
        const current = Number(record.current || 0);
        if (record.title && !Number.isNaN(target) && !Number.isNaN(current)) {
          importedGoals.push({
            id: uid(),
            name: record.title,
            target,
            current,
            dueDate: record.dueDate || toDateInputValue(new Date()),
          });
        }
      }
    });

    if (importedTransactions.length) {
      appState.transactions = importedTransactions;
    }

    if (importedBudgets.length) {
      appState.budgets = importedBudgets;
    }

    if (importedGoals.length) {
      appState.goals = importedGoals;
    }

    persistState();
    render();
  };

  reader.readAsText(file);
}

function parseCsvRows(text) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => String(cell).trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => String(cell).trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function formatCurrency(value) {
  return currencyFormat.format(Number(value || 0));
}

function formatSignedCurrency(value) {
  const number = Number(value || 0);
  const absValue = Math.abs(number);
  return number >= 0 ? `+${currencyFormat.format(absValue)}` : `-${currencyFormat.format(absValue)}`;
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getMonthRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const months = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (cursor <= endDate) {
    months.push({
      value: toMonthKey(cursor),
      label: monthFormat.format(cursor),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uid() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
