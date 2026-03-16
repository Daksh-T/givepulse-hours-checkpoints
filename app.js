const SENIOR_PREFERENCE_KEY = "givepulse_senior_bonner_canale";
const SPRING_2026_CHECKPOINTS = [
  { label: "Checkpoint 1", date: "2026-02-13", seniorTarget: 23.4, otherTarget: 26.6 },
  { label: "Checkpoint 2", date: "2026-03-20", seniorTarget: 58.5, otherTarget: 69 },
  { label: "Checkpoint 3", date: "2026-04-17", seniorTarget: 87.75, otherTarget: 103.5 },
  { label: "Checkpoint 4", date: "2026-05-14", seniorTarget: 117, otherTarget: 133 },
].map((checkpoint) => ({
  ...checkpoint,
  date: parseIsoDate(checkpoint.date),
}));

// Semester ranges derived from calendar.ics, anchored from Fall 2025 onward.
const ALL_SEMESTERS = [
  { id: "fall-2025", label: "Fall 2025", academicYear: "2025-26", term: "fall", start: "2025-08-27", end: "2025-12-11" },
  { id: "spring-2026", label: "Spring 2026", academicYear: "2025-26", term: "spring", start: "2026-01-12", end: "2026-04-29" },
  { id: "fall-2026", label: "Fall 2026", academicYear: "2026-27", term: "fall", start: "2026-08-26", end: "2026-12-10" },
  { id: "spring-2027", label: "Spring 2027", academicYear: "2026-27", term: "spring", start: "2027-01-11", end: "2027-04-28" },
  { id: "fall-2027", label: "Fall 2027", academicYear: "2027-28", term: "fall", start: "2027-08-25", end: "2027-12-09" },
  { id: "spring-2028", label: "Spring 2028", academicYear: "2027-28", term: "spring", start: "2028-01-10", end: "2028-04-26" },
].map((semester) => ({
  ...semester,
  start: parseIsoDate(semester.start),
  end: parseIsoDate(semester.end),
}));

const state = {
  allEntries: [],
  filteredEntries: [],
  semesters: [],
  selectedStart: "",
  selectedEnd: "",
  currentMonth: startOfMonth(new Date()),
  currentSemesterId: "",
  currentAcademicYear: "",
  isSeniorBonner: false,
};

const refs = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheRefs();
  bindEvents();
  loadApp();
});

function cacheRefs() {
  refs.mainView = document.querySelector("#mainView");
  refs.statsView = document.querySelector("#statsView");
  refs.csvInput = document.querySelector("#csvInput");
  refs.presetSelect = document.querySelector("#presetSelect");
  refs.startDate = document.querySelector("#startDate");
  refs.endDate = document.querySelector("#endDate");
  refs.currentSemesterButton = document.querySelector("#currentSemesterButton");
  refs.viewStatsButton = document.querySelector("#viewStatsButton");
  refs.backButton = document.querySelector("#backButton");
  refs.infoButton = document.querySelector("#infoButton");
  refs.closeInfoButton = document.querySelector("#closeInfoButton");
  refs.infoModal = document.querySelector("#infoModal");
  refs.sourceLabel = document.querySelector("#sourceLabel");
  refs.sourceMeta = document.querySelector("#sourceMeta");
  refs.totalHours = document.querySelector("#totalHours");
  refs.totalMeta = document.querySelector("#totalMeta");
  refs.checkpointCard = document.querySelector("#checkpointCard");
  refs.checkpointTitle = document.querySelector("#checkpointTitle");
  refs.checkpointBadge = document.querySelector("#checkpointBadge");
  refs.checkpointSummary = document.querySelector("#checkpointSummary");
  refs.checkpointMeta = document.querySelector("#checkpointMeta");
  refs.seniorToggle = document.querySelector("#seniorToggle");
  refs.statsRange = document.querySelector("#statsRange");
  refs.impactCount = document.querySelector("#impactCount");
  refs.weekCount = document.querySelector("#weekCount");
  refs.averageWeek = document.querySelector("#averageWeek");
  refs.siteBreakdown = document.querySelector("#siteBreakdown");
  refs.monthBreakdown = document.querySelector("#monthBreakdown");
  refs.calendarTitle = document.querySelector("#calendarTitle");
  refs.calendarGrid = document.querySelector("#calendarGrid");
  refs.prevMonthButton = document.querySelector("#prevMonthButton");
  refs.nextMonthButton = document.querySelector("#nextMonthButton");
}

function bindEvents() {
  refs.csvInput.addEventListener("change", handleCsvUpload);
  refs.presetSelect.addEventListener("change", handlePresetChange);
  refs.startDate.addEventListener("change", handleManualRangeChange);
  refs.endDate.addEventListener("change", handleManualRangeChange);
  refs.currentSemesterButton.addEventListener("click", applyCurrentSemesterRange);
  refs.viewStatsButton.addEventListener("click", showStatsView);
  refs.backButton.addEventListener("click", showMainView);
  refs.seniorToggle.addEventListener("change", (event) => {
    state.isSeniorBonner = event.target.checked;
    writeBooleanPreference(SENIOR_PREFERENCE_KEY, state.isSeniorBonner);
    renderCheckpointStatus();
  });
  refs.infoButton.addEventListener("click", () => refs.infoModal.classList.remove("is-hidden"));
  refs.closeInfoButton.addEventListener("click", () => refs.infoModal.classList.add("is-hidden"));
  refs.infoModal.addEventListener("click", (event) => {
    if (event.target === refs.infoModal) {
      refs.infoModal.classList.add("is-hidden");
    }
  });
  refs.prevMonthButton.addEventListener("click", () => {
    state.currentMonth = addMonths(state.currentMonth, -1);
    renderCalendar();
  });
  refs.nextMonthButton.addEventListener("click", () => {
    state.currentMonth = addMonths(state.currentMonth, 1);
    renderCalendar();
  });
}

async function loadApp() {
  const today = new Date();
  state.isSeniorBonner = readBooleanPreference(SENIOR_PREFERENCE_KEY);
  refs.seniorToggle.checked = state.isSeniorBonner;
  const context = getAcademicYearContext(today);
  state.currentAcademicYear = context.academicYear;
  state.semesters = getVisibleSemestersForCurrentAcademicYear(today);
  state.currentSemesterId = getCurrentSemesterPresetId(state.semesters, today);
  renderPresetOptions();
  setControlsEnabled(false);
  renderAll();
}

async function handleCsvUpload(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const text = await file.text();
  const entries = normalizeCsvRows(parseCsv(text));
  setEntries(entries, file.name, `${entries.length} impacts loaded.`);
}

function setEntries(entries, label, meta) {
  state.allEntries = entries.sort((a, b) => a.date - b.date);
  refs.sourceLabel.textContent = label;
  refs.sourceMeta.textContent = meta;
  setControlsEnabled(state.allEntries.length > 0);
  applyCurrentSemesterRange();
}

function applyCurrentSemesterRange() {
  const currentPreset = getPresetById(state.semesters, state.currentSemesterId);
  if (currentPreset) {
    applyRange(currentPreset.start, currentPreset.end, currentPreset.id);
    return;
  }

  const span = getEntrySpan(state.allEntries);
  if (span) {
    applyRange(span.start, span.end, "");
    return;
  }

  renderAll();
}

function applyRange(start, end, presetId = "") {
  state.selectedStart = formatIsoDate(start);
  state.selectedEnd = formatIsoDate(end);
  refs.startDate.value = state.selectedStart;
  refs.endDate.value = state.selectedEnd;
  state.currentMonth = startOfMonth(start);
  syncPresetSelection(presetId);
  renderAll();
}

function handlePresetChange(event) {
  const preset = getPresetById(state.semesters, event.target.value);
  if (!preset) {
    syncPresetSelection("");
    renderAll();
    return;
  }

  applyRange(preset.start, preset.end, preset.id);
}

function handleManualRangeChange() {
  if (!refs.startDate.value || !refs.endDate.value) {
    return;
  }

  const start = parseIsoDate(refs.startDate.value);
  const end = parseIsoDate(refs.endDate.value);

  if (start > end) {
    return;
  }

  state.selectedStart = refs.startDate.value;
  state.selectedEnd = refs.endDate.value;
  state.currentMonth = startOfMonth(start);
  syncPresetSelection("");
  renderAll();
}

function syncPresetSelection(preferredPresetId = "") {
  const exactMatch =
    getPresetById(state.semesters, preferredPresetId) ||
    state.semesters.find(
      (semester) =>
        formatIsoDate(semester.start) === state.selectedStart &&
        formatIsoDate(semester.end) === state.selectedEnd
    );

  refs.presetSelect.value = exactMatch ? exactMatch.id : "";
}

function showStatsView() {
  if (!state.allEntries.length) {
    return;
  }
  const latestEntry = state.filteredEntries[state.filteredEntries.length - 1];
  if (latestEntry) {
    state.currentMonth = startOfMonth(latestEntry.date);
  } else if (state.selectedEnd) {
    state.currentMonth = startOfMonth(parseIsoDate(state.selectedEnd));
  }
  renderCalendar();
  refs.mainView.classList.add("is-hidden");
  refs.statsView.classList.remove("is-hidden");
}

function showMainView() {
  refs.statsView.classList.add("is-hidden");
  refs.mainView.classList.remove("is-hidden");
}

function renderPresetOptions() {
  refs.presetSelect.innerHTML = [
    '<option value="">Custom dates</option>',
    ...state.semesters.map(
      (semester) => `<option value="${semester.id}">${escapeHtml(semester.label)}</option>`
    ),
  ].join("");
}

function setControlsEnabled(enabled) {
  refs.presetSelect.disabled = !enabled;
  refs.startDate.disabled = !enabled;
  refs.endDate.disabled = !enabled;
  refs.currentSemesterButton.disabled = !enabled;
  refs.viewStatsButton.disabled = !enabled;
  refs.presetSelect.closest(".field")?.classList.toggle("is-disabled", !enabled);
  refs.startDate.closest(".field")?.classList.toggle("is-disabled", !enabled);
  refs.endDate.closest(".field")?.classList.toggle("is-disabled", !enabled);
  refs.currentSemesterButton.classList.toggle("is-disabled", !enabled);
  refs.viewStatsButton.classList.toggle("is-disabled", !enabled);
}

function renderAll() {
  state.filteredEntries = filterEntriesByRange(state.allEntries, state.selectedStart, state.selectedEnd);
  renderMainResult();
  renderCheckpointStatus();
  renderStats();
  renderCalendar();
}

function renderMainResult() {
  const summary = summarizeEntries(state.filteredEntries);
  refs.totalHours.textContent = formatHours(summary.totalHours);

  if (!state.selectedStart || !state.selectedEnd) {
    refs.totalMeta.textContent = "Choose a range to calculate your total hours.";
    return;
  }

  const rangeText = `${formatLongDate(parseIsoDate(state.selectedStart))} to ${formatLongDate(
    parseIsoDate(state.selectedEnd)
  )}`;
  refs.totalMeta.textContent = `${rangeText} · ${summary.impactCount} impact${
    summary.impactCount === 1 ? "" : "s"
  }`;
}

function renderStats() {
  const summary = summarizeEntries(state.filteredEntries);
  refs.statsRange.textContent =
    state.selectedStart && state.selectedEnd
      ? `${formatLongDate(parseIsoDate(state.selectedStart))} to ${formatLongDate(
          parseIsoDate(state.selectedEnd)
        )}`
      : "Selected range";
  refs.impactCount.textContent = String(summary.impactCount);
  refs.weekCount.textContent = String(summary.activeWeeks);
  refs.averageWeek.textContent = formatHours(summary.averagePerWeek);

  const breakdowns = buildBreakdowns(state.filteredEntries);
  renderList(refs.siteBreakdown, breakdowns.bySite, "impacts");
  renderList(refs.monthBreakdown, breakdowns.byMonth, "impacts");
}

function renderCheckpointStatus() {
  const activePreset = getPresetById(state.semesters, refs.presetSelect.value);
  const currentPreset = getPresetById(state.semesters, state.currentSemesterId);
  const isCurrentSemesterView =
    activePreset &&
    currentPreset &&
    activePreset.id === currentPreset.id &&
    formatIsoDate(currentPreset.start) === state.selectedStart &&
    formatIsoDate(currentPreset.end) === state.selectedEnd;

  if (!isCurrentSemesterView || currentPreset.id !== "spring-2026") {
    refs.checkpointCard.classList.add("is-hidden");
    return;
  }

  const checkpoint = getCurrentCheckpoint(new Date());
  if (!checkpoint) {
    refs.checkpointCard.classList.add("is-hidden");
    return;
  }

  const hours = summarizeEntries(state.filteredEntries).totalHours;
  const target = state.isSeniorBonner ? checkpoint.seniorTarget : checkpoint.otherTarget;
  const status = getCheckpointStatus(hours, target);

  refs.checkpointCard.classList.remove("is-hidden");
  refs.checkpointTitle.textContent = `${checkpoint.label} · due ${formatShortMonthDay(checkpoint.date)}`;
  refs.checkpointBadge.textContent = capitalize(status.zone);
  refs.checkpointBadge.className = `checkpoint-badge ${status.zone}`;
  refs.checkpointSummary.textContent = status.summary;
  refs.checkpointMeta.textContent = `You have ${formatHours(hours)}. Target for this checkpoint is ${formatHours(
    target
  )}.`;
}

function renderList(container, rows, noun) {
  if (!rows.length) {
    container.className = "list empty";
    container.textContent = "No data for this range.";
    return;
  }

  container.className = "list";
  container.innerHTML = rows
    .slice(0, 8)
    .map(
      (row) => `
        <article class="row">
          <div class="row-top">
            <span class="row-title">${escapeHtml(row.label)}</span>
            <strong>${formatHours(row.hours)}</strong>
          </div>
          <span class="row-meta">${row.count} ${noun}</span>
        </article>
      `
    )
    .join("");
}

function renderCalendar() {
  const month = state.currentMonth;
  refs.calendarTitle.textContent = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const days = buildCalendarDays(month);
  const hoursByDate = aggregateHoursByDate(state.filteredEntries);
  const rangeStart = state.selectedStart ? parseIsoDate(state.selectedStart) : null;
  const rangeEnd = state.selectedEnd ? parseIsoDate(state.selectedEnd) : null;

  refs.calendarGrid.innerHTML = days
    .map((day) => {
      const hours = hoursByDate.get(formatIsoDate(day)) || 0;
      const className = [
        "day",
        day.getMonth() !== month.getMonth() ? "other" : "",
        rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd ? "in-range" : "",
        hours > 0 ? "has-hours" : "",
        (rangeStart && sameDate(day, rangeStart)) || (rangeEnd && sameDate(day, rangeEnd)) ? "boundary" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <article class="${className}">
          <span class="day-number">${day.getDate()}</span>
          <span class="day-hours">${hours > 0 ? formatHours(hours) : ""}</span>
        </article>
      `;
    })
    .join("");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  if (!rows.length) {
    return [];
  }

  const [header, ...dataRows] = rows;
  return dataRows.map((cells) => {
    const record = {};
    header.forEach((column, columnIndex) => {
      record[column] = cells[columnIndex] ?? "";
    });
    return record;
  });
}

function normalizeCsvRows(rows) {
  return rows
    .map((row, index) => {
      const date = parseSlashDate(row["Start Date"]);
      if (!date) {
        return null;
      }

      return {
        id: row["Impact ID"] || `row-${index + 1}`,
        date,
        hours: parseHours(row),
        site: cleanText(row.Group) || cleanText(row.Organizer) || firstAddressChunk(cleanText(row["Event Address"])) || "No site listed",
      };
    })
    .filter(Boolean);
}

function parseHours(row) {
  const direct = Number.parseFloat(cleanText(row["Hours Served"]));
  if (Number.isFinite(direct)) {
    return direct;
  }

  const otherOutcome = cleanText(row["Other Outcome"]).toLowerCase();
  const match = otherOutcome.match(/(\d+(?:\.\d+)?)\s*(minute|minutes|hour|hours)/);
  if (match) {
    const amount = Number.parseFloat(match[1]);
    return match[2].startsWith("minute") ? amount / 60 : amount;
  }

  return 0;
}

function summarizeEntries(entries) {
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const weekKeys = new Set(entries.map((entry) => formatIsoDate(startOfWeek(entry.date))));
  return {
    totalHours,
    impactCount: entries.length,
    activeWeeks: weekKeys.size,
    averagePerWeek: weekKeys.size ? totalHours / weekKeys.size : 0,
  };
}

function buildBreakdowns(entries) {
  return {
    bySite: aggregateBy(entries, (entry) => entry.site),
    byMonth: aggregateBy(entries, (entry) => formatMonthLabel(entry.date), (entry) =>
      startOfMonth(entry.date).getTime()
    ),
  };
}

function aggregateBy(entries, getLabel, getSortValue = null) {
  const map = new Map();

  entries.forEach((entry) => {
    const label = getLabel(entry);
    const current = map.get(label) || {
      label,
      hours: 0,
      count: 0,
      sortValue: getSortValue ? getSortValue(entry) : null,
    };
    current.hours += entry.hours;
    current.count += 1;
    map.set(label, current);
  });

  const rows = [...map.values()];
  if (getSortValue) {
    return rows.sort((a, b) => a.sortValue - b.sortValue);
  }

  return rows.sort((a, b) => b.hours - a.hours || b.count - a.count);
}

function aggregateHoursByDate(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    const key = formatIsoDate(entry.date);
    map.set(key, (map.get(key) || 0) + entry.hours);
  });
  return map;
}

function filterEntriesByRange(entries, startIso, endIso) {
  if (!startIso || !endIso) {
    return entries;
  }

  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  return entries.filter((entry) => entry.date >= start && entry.date <= end);
}

function getEntrySpan(entries) {
  if (!entries.length) {
    return null;
  }

  return {
    start: entries[0].date,
    end: entries[entries.length - 1].date,
  };
}

function getVisibleSemestersForCurrentAcademicYear(now) {
  const context = getAcademicYearContext(now);
  const matches = ALL_SEMESTERS.filter((semester) => semester.academicYear === context.academicYear);

  if (!matches.length) {
    return ALL_SEMESTERS.slice(0, 2);
  }

  return context.term === "fall" ? matches.filter((semester) => semester.term === "fall") : matches;
}

function getCurrentSemesterPresetId(semesters, now) {
  const context = getAcademicYearContext(now);
  const exact = semesters.find((semester) => semester.term === context.term);
  if (exact) {
    return exact.id;
  }

  return semesters[0]?.id || "";
}

function getAcademicYearContext(now) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (month >= 8) {
    return {
      term: "fall",
      academicYear: `${year}-${String(year + 1).slice(-2)}`,
    };
  }

  return {
    term: "spring",
    academicYear: `${year - 1}-${String(year).slice(-2)}`,
  };
}

function getPresetById(semesters, presetId) {
  if (!presetId) {
    return null;
  }

  return semesters.find((semester) => semester.id === presetId) || null;
}

function getCurrentCheckpoint(now) {
  const current = SPRING_2026_CHECKPOINTS.find((checkpoint) => now <= checkpoint.date);
  return current || SPRING_2026_CHECKPOINTS[SPRING_2026_CHECKPOINTS.length - 1];
}

function getCheckpointStatus(hours, target) {
  if (hours >= target) {
    return {
      zone: "green",
      summary: "You are in the green for this checkpoint.",
    };
  }

  if (hours >= target * 0.75) {
    return {
      zone: "yellow",
      summary: "You are in the yellow and close to the checkpoint target.",
    };
  }

  return {
    zone: "red",
    summary: "You are in the red for this checkpoint right now.",
  };
}

function buildCalendarDays(monthDate) {
  const first = startOfMonth(monthDate);
  const firstVisible = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(firstVisible, index));
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date) {
  const cloned = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = cloned.getDay();
  const distance = day === 0 ? -6 : 1 - day;
  cloned.setDate(cloned.getDate() + distance);
  return cloned;
}

function addDays(date, amount) {
  const cloned = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  cloned.setDate(cloned.getDate() + amount);
  return cloned;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function parseSlashDate(value) {
  if (!value) {
    return null;
  }

  const [month, day, rawYear] = value.split("/").map(Number);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  if (!month || !day || !year) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function parseIsoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatShortMonthDay(date) {
  return date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
  });
}

function formatHours(value) {
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

  return `${formatted} hrs`;
}

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function firstAddressChunk(address) {
  return cleanText(address.split(",")[0] || "");
}

function sameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function readBooleanPreference(name) {
  try {
    const stored = window.localStorage.getItem(name);
    if (stored !== null) {
      return stored === "true";
    }
  } catch {}

  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(encodedName));
  if (!match) {
    return false;
  }

  return decodeURIComponent(match.slice(encodedName.length)) === "true";
}

function writeBooleanPreference(name, value) {
  try {
    window.localStorage.setItem(name, value ? "true" : "false");
  } catch {}

  const expires = new Date(Date.now() + 365 * 86400000).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value ? "true" : "false"
  )}; expires=${expires}; path=/; SameSite=Lax`;
}
