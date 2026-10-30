const SENIOR_PREFERENCE_KEY = "givepulse_senior_bonner_canale";
const CSV_HELP_SEEN_KEY = "givepulse_csv_help_seen";
const CHECKPOINT_TARGETS = [
  { seniorTarget: 30, otherTarget: 35 },
  { seniorTarget: 60, otherTarget: 70 },
  { seniorTarget: 90, otherTarget: 105 },
  { seniorTarget: 118, otherTarget: 140 },
];

const CHECKPOINTS_BY_SEMESTER = {
  "fall-2026": ["2026-09-25", "2026-10-30", "2026-11-20", "2026-12-10"],
  "spring-2027": ["2027-02-12", "2027-03-19", "2027-04-16", "2027-04-28"],
};

Object.entries(CHECKPOINTS_BY_SEMESTER).forEach(([semesterId, dates]) => {
  CHECKPOINTS_BY_SEMESTER[semesterId] = dates.map((date, index) => ({
    label: `Checkpoint ${index + 1}`,
    date: parseIsoDate(date),
    ...CHECKPOINT_TARGETS[index],
  }));
});

// Semester ranges derived from calendar.ics, anchored from Fall 2025 onward.
const ALL_SEMESTERS = [
  { id: "fall-2025", label: "Fall 2025", academicYear: "2025-26", term: "fall", start: "2025-08-27", end: "2025-12-11" },
  { id: "spring-2026", label: "Spring 2026", academicYear: "2025-26", term: "spring", start: "2026-01-12", end: "2026-04-29" },
  { id: "fall-2026", label: "Fall 2026", academicYear: "2026-27", term: "fall", start: "2026-08-16", end: "2026-12-10" },
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
  selectedDay: "",
  currentSemesterId: "",
  currentAcademicYear: "",
  isSeniorBonner: false,
  isCustomRange: false,
  calendarTouchStart: null,
  modalReturnFocus: null,
  modalFocusTimer: 0,
};

const refs = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheRefs();
  bindEvents();
  loadApp();
});

function cacheRefs() {
  refs.appContent = document.querySelector("main.shell");
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
  refs.previousCheckpoint = document.querySelector("#previousCheckpoint");
  refs.seniorToggle = document.querySelector("#seniorToggle");
  refs.statsRange = document.querySelector("#statsRange");
  refs.impactCount = document.querySelector("#impactCount");
  refs.weekCount = document.querySelector("#weekCount");
  refs.averageWeek = document.querySelector("#averageWeek");
  refs.siteBreakdown = document.querySelector("#siteBreakdown");
  refs.monthBreakdown = document.querySelector("#monthBreakdown");
  refs.calendarTitle = document.querySelector("#calendarTitle");
  refs.calendar = document.querySelector(".calendar");
  refs.calendarGrid = document.querySelector("#calendarGrid");
  refs.prevMonthButton = document.querySelector("#prevMonthButton");
  refs.nextMonthButton = document.querySelector("#nextMonthButton");
  refs.dayDetailList = document.querySelector("#dayDetailList");
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
  refs.infoButton.addEventListener("click", showInfoModal);
  refs.closeInfoButton.addEventListener("click", hideInfoModal);
  refs.infoModal.addEventListener("click", (event) => {
    if (event.target === refs.infoModal) {
      hideInfoModal();
    }
  });
  document.addEventListener("keydown", handleModalKeyboard);
  refs.prevMonthButton.addEventListener("click", () => moveCalendarMonth(-1));
  refs.nextMonthButton.addEventListener("click", () => moveCalendarMonth(1));
  refs.calendarGrid.addEventListener("click", handleCalendarDaySelection);
  refs.calendarGrid.addEventListener("keydown", handleCalendarDayKeydown);
  refs.calendar.addEventListener("touchstart", handleCalendarTouchStart, { passive: true });
  refs.calendar.addEventListener("touchend", handleCalendarTouchEnd, { passive: false });
  refs.calendar.addEventListener("touchcancel", clearCalendarTouch);
}

async function loadApp() {
  const today = new Date();
  state.isSeniorBonner = readBooleanPreference(SENIOR_PREFERENCE_KEY);
  refs.seniorToggle.checked = state.isSeniorBonner;
  if (!readBooleanPreference(CSV_HELP_SEEN_KEY)) {
    showInfoModal();
    writeBooleanPreference(CSV_HELP_SEEN_KEY, true);
  }
  const context = getAcademicYearContext(today);
  state.currentAcademicYear = context.academicYear;
  state.semesters = getVisibleSemestersForCurrentAcademicYear(today);
  state.currentSemesterId = getCurrentSemesterPresetId(state.semesters, today);
  renderPresetOptions();
  setControlsEnabled(false);
  renderAll();
}

function showInfoModal() {
  const activeElement = document.activeElement;
  state.modalReturnFocus =
    activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : refs.infoButton;
  refs.appContent.inert = true;
  refs.appContent.setAttribute("aria-hidden", "true");
  refs.infoModal.classList.remove("is-hidden");
  refs.infoModal.setAttribute("aria-hidden", "false");
  window.clearTimeout(state.modalFocusTimer);
  state.modalFocusTimer = window.setTimeout(() => {
    if (!refs.infoModal.classList.contains("is-hidden")) {
      refs.closeInfoButton.focus({ preventScroll: true });
    }
  }, 100);
}

function hideInfoModal() {
  if (refs.infoModal.classList.contains("is-hidden")) {
    return;
  }

  window.clearTimeout(state.modalFocusTimer);
  refs.infoModal.classList.add("is-hidden");
  refs.infoModal.setAttribute("aria-hidden", "true");
  refs.appContent.inert = false;
  refs.appContent.removeAttribute("aria-hidden");

  const returnFocus = state.modalReturnFocus;
  state.modalReturnFocus = null;
  if (returnFocus?.isConnected) {
    returnFocus.focus({ preventScroll: true });
  } else {
    refs.infoButton.focus({ preventScroll: true });
  }
}

function handleModalKeyboard(event) {
  if (refs.infoModal.classList.contains("is-hidden")) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    hideInfoModal();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getModalFocusableElements();
  if (!focusableElements.length) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey && (activeElement === firstElement || !refs.infoModal.contains(activeElement))) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && (activeElement === lastElement || !refs.infoModal.contains(activeElement))) {
    event.preventDefault();
    firstElement.focus();
  }
}

function getModalFocusableElements() {
  return Array.from(
    refs.infoModal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.getClientRects().length > 0);
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
  state.isCustomRange = !presetId;
  syncPresetSelection(presetId);
  renderAll();
}

function handlePresetChange(event) {
  const preset = getPresetById(state.semesters, event.target.value);
  if (!preset) {
    state.isCustomRange = true;
    refs.presetSelect.value = "";
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
  state.isCustomRange = true;
  syncPresetSelection("");
  renderAll();
}

function syncPresetSelection(preferredPresetId = "") {
  if (state.isCustomRange) {
    refs.presetSelect.value = "";
    return;
  }

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
  syncSelectedDay();
  renderCalendar();
  renderDayDetails();
  transitionViews(refs.mainView, refs.statsView);
}

function showMainView() {
  transitionViews(refs.statsView, refs.mainView);
}

function transitionViews(fromView, toView) {
  const swapViews = () => {
    fromView.classList.add("is-hidden");
    toView.classList.remove("is-hidden");
  };

  if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(swapViews);
    return;
  }

  swapViews();
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
  syncSelectedDay();
  renderMainResult();
  renderCheckpointStatus();
  renderStats();
  renderCalendar();
  renderDayDetails();
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

  const semesterCheckpoints = currentPreset && CHECKPOINTS_BY_SEMESTER[currentPreset.id];
  if (!isCurrentSemesterView || !semesterCheckpoints) {
    refs.checkpointCard.classList.add("is-hidden");
    return;
  }

  const now = new Date();
  const checkpoint = getCurrentCheckpoint(semesterCheckpoints, now);
  if (!checkpoint) {
    refs.checkpointCard.classList.add("is-hidden");
    return;
  }

  const hours = summarizeEntries(state.filteredEntries).totalHours;
  const target = state.isSeniorBonner ? checkpoint.seniorTarget : checkpoint.otherTarget;
  const status = getCheckpointStatus(hours, target);

  refs.checkpointCard.classList.remove("is-hidden");
  refs.checkpointTitle.textContent = `${checkpoint.label} · ${sameDate(now, checkpoint.date) ? "due today" : formatShortMonthDay(checkpoint.date)}`;
  refs.checkpointBadge.textContent = capitalize(status.zone);
  refs.checkpointBadge.className = `checkpoint-badge ${status.zone}`;
  const progressText = (goal) => hours === goal
    ? "Target met"
    : hours > goal
      ? `${formatHours(hours - goal)} above target`
      : `${formatHours(goal - hours)} to reach target`;
  refs.checkpointSummary.textContent = progressText(target);
  refs.checkpointMeta.innerHTML = `<strong>${target}</strong><span>hours required</span>`;

  const previous = semesterCheckpoints[semesterCheckpoints.indexOf(checkpoint) - 1];
  refs.previousCheckpoint.classList.toggle("is-hidden", !previous);
  refs.previousCheckpoint.textContent = "";
  if (previous) {
    const previousTarget = state.isSeniorBonner ? previous.seniorTarget : previous.otherTarget;
    const previousStatus = getCheckpointStatus(hours, previousTarget);
    refs.previousCheckpoint.innerHTML = `
      <p class="checkpoint-eyebrow">Previous checkpoint</p>
      <div class="checkpoint-row">
        <h3>${previous.label} · ${formatShortMonthDay(previous.date)}</h3>
        <span class="checkpoint-badge ${previousStatus.zone}">${capitalize(previousStatus.zone)}</span>
      </div>
      <p class="checkpoint-target"><strong>${previousTarget}</strong><span>hours required</span></p>
      <p class="checkpoint-caption">${progressText(previousTarget)}</p>`;
  }
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
      const dayIso = formatIsoDate(day);
      const hours = hoursByDate.get(formatIsoDate(day)) || 0;
      const className = [
        "day",
        day.getMonth() !== month.getMonth() ? "other" : "",
        rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd ? "in-range" : "",
        hours > 0 ? "has-hours" : "",
        state.selectedDay === dayIso ? "selected" : "",
        (rangeStart && sameDate(day, rangeStart)) || (rangeEnd && sameDate(day, rangeEnd)) ? "boundary" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <button
          class="${className}"
          type="button"
          data-date="${dayIso}"
          aria-pressed="${state.selectedDay === dayIso ? "true" : "false"}"
          aria-label="${buildCalendarDayAriaLabel(day, hours)}"
        >
          <span class="day-number">${day.getDate()}</span>
          <span class="day-hours">${hours > 0 ? formatCalendarHours(hours) : ""}</span>
        </button>
      `;
    })
    .join("");
}

function renderDayDetails() {
  const entries = getEntriesForSelectedDay();
  const selectedDate = state.selectedDay ? parseIsoDate(state.selectedDay) : null;

  if (!selectedDate) {
    refs.dayDetailList.className = "list empty";
    refs.dayDetailList.textContent = "No day selected yet.";
    return;
  }

  if (!entries.length) {
    refs.dayDetailList.className = "list empty";
    refs.dayDetailList.textContent = "No logged impacts on this day.";
    return;
  }

  refs.dayDetailList.className = "list";
  refs.dayDetailList.innerHTML = entries
    .map(
      (entry) => `
        <article class="row day-entry">
          <div class="row-top">
            <span class="row-title">${escapeHtml(entry.site)}</span>
            <strong>${formatHours(entry.hours)}</strong>
          </div>
          <span class="row-meta">${escapeHtml(formatEntryTime(entry))}</span>
        </article>
      `
    )
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
      record[column.replace(/^\uFEFF/, "").trim()] = cells[columnIndex] ?? "";
    });
    return record;
  });
}

function normalizeCsvRows(rows) {
  return rows
    .map((row, index) => {
      const date = parseEntryDate(row);
      if (!date) {
        return null;
      }

      return {
        id: row["Impact ID"] || row.ID || `row-${index + 1}`,
        date,
        hours: parseHours(row),
        site:
          cleanText(row.Group) ||
          cleanText(row.Organization) ||
          cleanText(row.Organizer) ||
          firstAddressChunk(cleanText(row["Event Address"])) ||
          "No site listed",
        startTime:
          getTimeField(row, [
            "Start Time",
            "Impact Start Time",
            "Service Start Time",
            "Shift Start Time",
            "Check In Time",
          ]) || getEmbeddedTime(row.Date),
        endTime: getTimeField(row, [
          "End Time",
          "Impact End Time",
          "Service End Time",
          "Shift End Time",
          "Check Out Time",
        ]),
      };
    })
    .filter(Boolean);
}

function parseHours(row) {
  const direct = Number.parseFloat(cleanText(row["Hours Served"]));
  if (Number.isFinite(direct)) {
    return direct;
  }

  const category = cleanText(row.Category).toLowerCase();
  if (category === "time" || category === "training") {
    const value = Number.parseFloat(cleanText(row.Value));
    if (Number.isFinite(value)) {
      return value;
    }
  }

  const otherOutcome = cleanText(row["Other Outcome"] || row.Value).toLowerCase();
  const match = otherOutcome.match(/(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)/);
  if (match) {
    const amount = Number.parseFloat(match[1]);
    return match[2].startsWith("m") ? amount / 60 : amount;
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

function getEntriesForSelectedDay() {
  if (!state.selectedDay) {
    return [];
  }

  return state.filteredEntries
    .filter((entry) => formatIsoDate(entry.date) === state.selectedDay)
    .slice()
    .sort(compareEntriesByTime);
}

function syncSelectedDay() {
  if (state.selectedDay) {
    const selectedDate = parseIsoDate(state.selectedDay);
    const isInCurrentMonth =
      selectedDate.getFullYear() === state.currentMonth.getFullYear() &&
      selectedDate.getMonth() === state.currentMonth.getMonth();
    const stillVisible = state.filteredEntries.some((entry) => formatIsoDate(entry.date) === state.selectedDay);
    if (stillVisible && isInCurrentMonth) {
      return;
    }
  }

  const monthKey = `${state.currentMonth.getFullYear()}-${state.currentMonth.getMonth()}`;
  const firstInMonth = state.filteredEntries.find((entry) => {
    const entryMonth = `${entry.date.getFullYear()}-${entry.date.getMonth()}`;
    return entryMonth === monthKey;
  });

  state.selectedDay = firstInMonth ? formatIsoDate(firstInMonth.date) : "";
}

function handleCalendarDaySelection(event) {
  const dayButton = event.target.closest("[data-date]");
  if (!dayButton) {
    return;
  }

  state.selectedDay = dayButton.dataset.date || "";
  renderCalendar();
  renderDayDetails();
}

function handleCalendarDayKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const dayButton = event.target.closest("[data-date]");
  if (!dayButton) {
    return;
  }

  event.preventDefault();
  state.selectedDay = dayButton.dataset.date || "";
  renderCalendar();
  renderDayDetails();
}

function moveCalendarMonth(amount) {
  state.currentMonth = addMonths(state.currentMonth, amount);
  syncSelectedDay();
  renderCalendar();
  renderDayDetails();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  refs.calendarGrid.classList.remove("month-enter-next", "month-enter-previous");
  void refs.calendarGrid.offsetWidth;
  refs.calendarGrid.classList.add(amount > 0 ? "month-enter-next" : "month-enter-previous");
}

function handleCalendarTouchStart(event) {
  if (event.touches.length !== 1) {
    clearCalendarTouch();
    return;
  }

  const touch = event.touches[0];
  state.calendarTouchStart = { x: touch.clientX, y: touch.clientY };
}

function handleCalendarTouchEnd(event) {
  const start = state.calendarTouchStart;
  clearCalendarTouch();
  if (!start || event.changedTouches.length !== 1) {
    return;
  }

  const touch = event.changedTouches[0];
  const horizontalDistance = touch.clientX - start.x;
  const verticalDistance = touch.clientY - start.y;
  const isHorizontalSwipe = Math.abs(horizontalDistance) >= 48 && Math.abs(horizontalDistance) > Math.abs(verticalDistance);

  if (!isHorizontalSwipe) {
    return;
  }

  event.preventDefault();
  moveCalendarMonth(horizontalDistance < 0 ? 1 : -1);
}

function clearCalendarTouch() {
  state.calendarTouchStart = null;
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
  const anchor = getSemesterAnchor(now);
  const exact = semesters.find((semester) => semester.id === anchor?.id);
  if (exact) {
    return exact.id;
  }

  return semesters[0]?.id || "";
}

function getAcademicYearContext(now) {
  const semester = getSemesterAnchor(now);

  if (semester) {
    return {
      term: semester.term,
      academicYear: semester.academicYear,
    };
  }

  const year = now.getFullYear();
  return {
    term: "spring",
    academicYear: `${year - 1}-${String(year).slice(-2)}`,
  };
}

function getSemesterAnchor(now) {
  const activeSemester = ALL_SEMESTERS.find(
    (semester) => now >= semester.start && now <= semester.end
  );
  if (activeSemester) {
    return activeSemester;
  }

  return (
    ALL_SEMESTERS.find((semester) => now < semester.start) ||
    ALL_SEMESTERS[ALL_SEMESTERS.length - 1] ||
    null
  );
}

function getPresetById(semesters, presetId) {
  if (!presetId) {
    return null;
  }

  return semesters.find((semester) => semester.id === presetId) || null;
}

function getCurrentCheckpoint(checkpoints, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const current = checkpoints.find((checkpoint) => today <= checkpoint.date);
  return current || checkpoints[checkpoints.length - 1];
}

function getCheckpointStatus(hours, target) {
  if (hours >= target) {
    return {
      zone: "green",
      summary: "You are in the green for this checkpoint!",
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
  const firstVisible = addDays(first, -((first.getDay() + 1) % 7));
  return Array.from({ length: 42 }, (_, index) => addDays(firstVisible, index));
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date) {
  const cloned = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = cloned.getDay();
  const distance = -((day + 1) % 7);
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

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function parseIsoDateValue(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function parseEntryDate(row) {
  const startDate = cleanText(row["Start Date"]);
  const isoDate = parseIsoDateValue(startDate);
  if (isoDate) {
    return isoDate;
  }

  const slashDate = parseSlashDate(startDate);
  if (slashDate) {
    return slashDate;
  }

  const match = cleanText(row.Date).match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) {
    return null;
  }

  const monthIndex = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].indexOf(match[1].slice(0, 3).toLowerCase());
  if (monthIndex < 0) {
    return null;
  }

  const date = new Date(Number(match[3]), monthIndex, Number(match[2]));
  return date.getMonth() === monthIndex ? date : null;
}

function getEmbeddedTime(value) {
  const match = cleanText(value).match(/,\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
  return match ? match[1] : "";
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

function formatLongWeekdayDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
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

  return `${formatted} hours`;
}

function formatCalendarHours(value) {
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

  return `${formatted}h`;
}

function getTimeField(row, keys) {
  for (const key of keys) {
    const value = cleanText(row[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function buildCalendarDayAriaLabel(day, hours) {
  const segments = [formatLongWeekdayDate(day)];

  if (hours > 0) {
    segments.push(`${formatHours(hours)} logged`);
  } else {
    segments.push("No hours logged");
  }

  return segments.join(". ");
}

function compareEntriesByTime(a, b) {
  const first = getComparableTimeValue(a.startTime) ?? getComparableTimeValue(a.endTime) ?? Number.MAX_SAFE_INTEGER;
  const second = getComparableTimeValue(b.startTime) ?? getComparableTimeValue(b.endTime) ?? Number.MAX_SAFE_INTEGER;

  return first - second || b.hours - a.hours || a.site.localeCompare(b.site);
}

function getComparableTimeValue(value) {
  if (!value) {
    return null;
  }

  const parsed = parseClockValue(value);
  return parsed ? parsed.hours * 60 + parsed.minutes : null;
}

function formatEntryTime(entry) {
  const start = formatClockValue(entry.startTime);
  const end = formatClockValue(entry.endTime);

  if (start && end) {
    return `${start} to ${end}`;
  }

  if (start) {
    const calculatedEnd = calculateEndTime(entry.startTime, entry.hours);
    if (calculatedEnd) {
      return `${start} to ${calculatedEnd}`;
    }
    return `Started at ${start}`;
  }

  if (end) {
    return `Ended at ${end}`;
  }

  return "Time not listed";
}

function calculateEndTime(startTime, durationHours) {
  const parsed = parseClockValue(startTime);
  if (!parsed || !Number.isFinite(durationHours) || durationHours <= 0) {
    return "";
  }

  const date = new Date(2000, 0, 1, parsed.hours, parsed.minutes);
  date.setMinutes(date.getMinutes() + Math.round(durationHours * 60));
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClockValue(value) {
  const parsed = parseClockValue(value);
  if (!parsed) {
    return cleanText(value);
  }

  const date = new Date(2000, 0, 1, parsed.hours, parsed.minutes);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseClockValue(value) {
  const cleaned = cleanText(value).toLowerCase();
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];

  if (minutes > 59 || hours > 24) {
    return null;
  }

  if (meridiem) {
    if (hours === 12) {
      hours = 0;
    }
    if (meridiem === "pm") {
      hours += 12;
    }
  }

  if (hours === 24) {
    hours = 0;
  }

  return { hours, minutes };
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
