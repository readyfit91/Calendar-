// ===== State =====
const state = {
  events: JSON.parse(localStorage.getItem('calendarEvents') || '[]'),
  birthdays: JSON.parse(localStorage.getItem('calendarBirthdays') || '[]'),
  completedEvents: JSON.parse(localStorage.getItem('calendarCompleted') || '{}'),
  currentDate: new Date(),
  selectedDate: new Date(),
  view: 'month',
  chatCollapsed: false,
};

// ===== DOM Elements =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  currentDate: $('#currentDate'),
  todayLabel: $('#todayLabel'),
  dailyObjectives: $('#dailyObjectives'),
  monthYear: $('#monthYear'),
  calendarDays: $('#calendarDays'),
  monthView: $('#monthView'),
  weekView: $('#weekView'),
  weekGrid: $('#weekGrid'),
  horizonLabel: $('#horizonLabel'),
  horizonList: $('#horizonList'),
  chatMessages: $('#chatMessages'),
  chatInput: $('#chatInput'),
  chatSend: $('#chatSend'),
  prevBtn: $('#prevBtn'),
  nextBtn: $('#nextBtn'),
  monthTab: $('#monthTab'),
  weekTab: $('#weekTab'),
  modalOverlay: $('#modalOverlay'),
  eventForm: $('#eventForm'),
  eventTitle: $('#eventTitle'),
  eventDate: $('#eventDate'),
  eventTime: $('#eventTime'),
  eventCategory: $('#eventCategory'),
  eventRecurring: $('#eventRecurring'),
  recurringOption: $('#recurringOption'),
  modalCancel: $('#modalCancel'),
  modalTitle: $('#modalTitle'),
  todayBtn: $('#todayBtn'),
  overdueSection: $('#overdueSection'),
  overdueList: $('#overdueList'),
  progressBar: $('#progressBar'),
  progressText: $('#progressText'),
  progressContainer: $('#progressContainer'),
  overdueCount: $('#overdueCount'),
  todayCount: $('#todayCount'),
  doneCount: $('#doneCount'),
  upcomingCount: $('#upcomingCount'),
  statOverdue: $('#statOverdue'),
  chatbox: $('#chatbox'),
  chatToggle: $('#chatToggle'),
  chatBody: $('#chatBody'),
  chatArrow: $('#chatArrow'),
  birthdayUpcoming: $('#birthdayUpcoming'),
  addBirthdayBtn: $('#addBirthdayBtn'),
  birthdayModalOverlay: $('#birthdayModalOverlay'),
  birthdayForm: $('#birthdayForm'),
  birthdayName: $('#birthdayName'),
  birthdayDate: $('#birthdayDate'),
  birthdayType: $('#birthdayType'),
  birthdayCancel: $('#birthdayCancel'),
};

// ===== Helpers =====
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplay(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMonthYear(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatShortDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  return `${hr % 12 || 12}:${m} ${ampm}`;
}

function sameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function getEventsForDate(dateStr) {
  return state.events.filter(e => e.date === dateStr)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

function saveEvents() {
  localStorage.setItem('calendarEvents', JSON.stringify(state.events));
}

function saveBirthdays() {
  localStorage.setItem('calendarBirthdays', JSON.stringify(state.birthdays));
}

function saveCompleted() {
  localStorage.setItem('calendarCompleted', JSON.stringify(state.completedEvents));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function isEventCompleted(eventId) {
  return !!state.completedEvents[eventId];
}

function toggleEventCompleted(eventId) {
  if (state.completedEvents[eventId]) {
    delete state.completedEvents[eventId];
  } else {
    state.completedEvents[eventId] = true;
  }
  saveCompleted();
  render();
}

function getOverdueEvents() {
  const todayStr = formatDate(new Date());
  return state.events.filter(e => e.date < todayStr && !isEventCompleted(e.id));
}

function getBirthdaysForDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return state.birthdays.filter(b => {
    const bd = new Date(b.date + 'T00:00:00');
    return (bd.getMonth() + 1) === month && bd.getDate() === day;
  });
}

function getUpcomingBirthdays(limit) {
  const today = new Date();
  const thisYear = today.getFullYear();

  const withNext = state.birthdays.map(b => {
    const bd = new Date(b.date + 'T00:00:00');
    let next = new Date(thisYear, bd.getMonth(), bd.getDate());
    if (next < today && !sameDay(next, today)) {
      next = new Date(thisYear + 1, bd.getMonth(), bd.getDate());
    }
    const diffMs = next - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { ...b, nextDate: next, daysUntil: diffDays };
  });

  withNext.sort((a, b) => a.daysUntil - b.daysUntil);
  return withNext.slice(0, limit || 5);
}

// ===== Rendering =====
function render() {
  const today = new Date();
  els.currentDate.textContent = formatDisplay(today);
  els.todayLabel.textContent = formatDisplay(today);
  els.monthYear.textContent = formatMonthYear(state.currentDate);

  renderStats(today);
  renderOverdue();
  renderDailyObjectives(today);
  renderHorizon(today);
  renderBirthdays();

  if (state.view === 'month') {
    renderMonthView();
  } else {
    renderWeekView();
  }
}

function renderStats(today) {
  const todayStr = formatDate(today);
  const todayEvents = getEventsForDate(todayStr);
  const overdueEvents = getOverdueEvents();
  const completedToday = todayEvents.filter(e => isEventCompleted(e.id)).length;

  // This week events
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = formatDate(weekStart);
  const weekEndStr = formatDate(weekEnd);
  const weekEvents = state.events.filter(e => e.date >= weekStartStr && e.date <= weekEndStr).length;

  els.todayCount.textContent = todayEvents.length;
  els.doneCount.textContent = completedToday;
  els.upcomingCount.textContent = weekEvents;
  els.overdueCount.textContent = overdueEvents.length;

  if (overdueEvents.length > 0) {
    els.statOverdue.classList.remove('hidden');
  } else {
    els.statOverdue.classList.add('hidden');
  }
}

function renderOverdue() {
  const overdueEvents = getOverdueEvents();

  if (overdueEvents.length === 0) {
    els.overdueSection.classList.add('hidden');
    return;
  }

  els.overdueSection.classList.remove('hidden');

  // Group by date
  const groups = {};
  overdueEvents.forEach(e => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });

  let html = '';
  Object.keys(groups).sort().forEach(dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    groups[dateStr].forEach(e => {
      html += `<li class="cat-${e.category}">
        <input type="checkbox" class="event-checkbox" data-id="${e.id}" ${isEventCompleted(e.id) ? 'checked' : ''}>
        ${e.time ? `<span class="event-item-time">${formatTime(e.time)}</span>` : ''}
        <span class="event-item-title">${escapeHtml(e.title)}</span>
        <span class="overdue-date">${formatShortDate(d)}</span>
        <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
      </li>`;
    });
  });

  els.overdueList.innerHTML = html;
  attachEventListeners(els.overdueList);
}

function renderDailyObjectives(today) {
  const todayStr = formatDate(today);
  const events = getEventsForDate(todayStr);

  // Progress bar
  const total = events.length;
  const completed = events.filter(e => isEventCompleted(e.id)).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  els.progressBar.style.width = pct + '%';
  els.progressText.textContent = total > 0 ? `${completed} / ${total} done` : 'No tasks';
  els.progressContainer.style.display = total > 0 ? '' : 'none';

  // Today's birthdays
  const todayBirthdays = getBirthdaysForDate(todayStr);

  if (events.length === 0 && todayBirthdays.length === 0) {
    els.dailyObjectives.innerHTML = '<li class="empty-state">No objectives for today. Use the chat to add some!</li>';
    return;
  }

  let html = '';

  // Show birthdays first
  todayBirthdays.forEach(b => {
    const bd = new Date(b.date + 'T00:00:00');
    const age = today.getFullYear() - bd.getFullYear();
    const icon = b.type === 'anniversary' ? '💍' : '🎂';
    html += `<li class="cat-birthday">
      <span class="event-item-title">${icon} ${escapeHtml(b.name)}${age > 0 ? ` (${age} ${b.type === 'anniversary' ? 'years' : 'years old'})` : ''}</span>
    </li>`;
  });

  html += events.map(e => {
    const completed = isEventCompleted(e.id);
    return `<li class="cat-${e.category} ${completed ? 'event-item-completed' : ''}">
      <input type="checkbox" class="event-checkbox" data-id="${e.id}" ${completed ? 'checked' : ''}>
      ${e.time ? `<span class="event-item-time">${formatTime(e.time)}</span>` : ''}
      <span class="event-item-title">${escapeHtml(e.title)}</span>
      <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
    </li>`;
  }).join('');

  els.dailyObjectives.innerHTML = html;
  attachEventListeners(els.dailyObjectives);
}

function renderHorizon(today) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const endOfMonth = new Date(year, month + 1, 0);
  els.horizonLabel.textContent = `Remaining in ${today.toLocaleDateString('en-US', { month: 'long' })}`;

  const todayStr = formatDate(today);
  const upcoming = state.events.filter(e => {
    return e.date > todayStr && e.date <= formatDate(endOfMonth);
  }).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

  if (upcoming.length === 0) {
    els.horizonList.innerHTML = '<li class="empty-state">Nothing upcoming this month.</li>';
    return;
  }

  // Group by date
  const groups = {};
  upcoming.forEach(e => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });

  let html = '';
  Object.keys(groups).sort().forEach(dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    const birthdays = getBirthdaysForDate(dateStr);

    html += `<div class="horizon-date-group"><div class="horizon-date-label">${formatShortDate(d)}</div>`;

    birthdays.forEach(b => {
      const icon = b.type === 'anniversary' ? '💍' : '🎂';
      html += `<li class="cat-birthday">
        <span class="event-item-title">${icon} ${escapeHtml(b.name)}</span>
      </li>`;
    });

    groups[dateStr].forEach(e => {
      const completed = isEventCompleted(e.id);
      html += `<li class="cat-${e.category} ${completed ? 'event-item-completed' : ''}">
        <input type="checkbox" class="event-checkbox" data-id="${e.id}" ${completed ? 'checked' : ''}>
        ${e.time ? `<span class="event-item-time">${formatTime(e.time)}</span>` : ''}
        <span class="event-item-title">${escapeHtml(e.title)}</span>
        <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
      </li>`;
    });
    html += '</div>';
  });

  els.horizonList.innerHTML = html;
  attachEventListeners(els.horizonList);
}

function renderBirthdays() {
  const upcoming = getUpcomingBirthdays(5);

  if (upcoming.length === 0) {
    els.birthdayUpcoming.innerHTML = '<span class="empty-state-inline">No upcoming celebrations</span>';
    return;
  }

  let html = '';
  upcoming.forEach(b => {
    const icon = b.type === 'anniversary' ? '💍' : '🎂';
    const bd = new Date(b.date + 'T00:00:00');
    const dateLabel = b.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let countdown;
    if (b.daysUntil === 0) countdown = 'Today!';
    else if (b.daysUntil === 1) countdown = 'Tomorrow';
    else countdown = `${b.daysUntil} days`;

    html += `<div class="birthday-item">
      <span class="birthday-icon">${icon}</span>
      <div class="birthday-info">
        <div class="birthday-name">${escapeHtml(b.name)}</div>
        <div class="birthday-date-text">${dateLabel}</div>
      </div>
      <span class="birthday-countdown">${countdown}</span>
      <button class="birthday-delete" data-id="${b.id}" title="Delete">&times;</button>
    </div>`;
  });

  els.birthdayUpcoming.innerHTML = html;
  els.birthdayUpcoming.querySelectorAll('.birthday-delete').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteBirthday(btn.dataset.id);
    });
  });
}

function attachEventListeners(container) {
  container.querySelectorAll('.event-checkbox').forEach(cb => {
    cb.addEventListener('change', (ev) => {
      ev.stopPropagation();
      toggleEventCompleted(cb.dataset.id);
    });
  });
  container.querySelectorAll('.event-item-delete').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteEvent(btn.dataset.id);
    });
  });
}

function renderMonthView() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const today = new Date();
  const todayStr = formatDate(today);

  let html = '';

  // Previous month padding
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    const dateStr = formatDate(d);
    const events = getEventsForDate(dateStr);
    html += buildDayCell(d, events, true, sameDay(d, today), todayStr);
  }

  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, month, day);
    const dateStr = formatDate(d);
    const events = getEventsForDate(dateStr);
    html += buildDayCell(d, events, false, sameDay(d, today), todayStr);
  }

  // Next month padding
  const totalCells = startDay + lastDay.getDate();
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    const dateStr = formatDate(d);
    const events = getEventsForDate(dateStr);
    html += buildDayCell(d, events, true, false, todayStr);
  }

  els.calendarDays.innerHTML = html;

  els.calendarDays.querySelectorAll('.calendar-day').forEach(cell => {
    cell.addEventListener('click', () => {
      state.selectedDate = new Date(cell.dataset.date + 'T00:00:00');
      openModal(cell.dataset.date);
    });
  });
}

function buildDayCell(date, events, otherMonth, isToday, todayStr) {
  const dateStr = formatDate(date);
  const classes = ['calendar-day'];
  if (otherMonth) classes.push('other-month');
  if (isToday) classes.push('today');

  const hasOverdue = !otherMonth && dateStr < todayStr && events.some(e => !isEventCompleted(e.id));
  if (hasOverdue) classes.push('has-overdue');

  const birthdays = getBirthdaysForDate(dateStr);

  let badgeHtml = '';
  if (hasOverdue) {
    badgeHtml += `<span class="day-badge overdue-badge">!</span>`;
  }
  if (birthdays.length > 0) {
    badgeHtml += `<span class="day-badge birthday-badge">🎂</span>`;
  }

  let eventsHtml = '';

  // Show birthday events
  birthdays.forEach(b => {
    const icon = b.type === 'anniversary' ? '💍' : '🎂';
    eventsHtml += `<div class="day-event cat-birthday">${icon} ${escapeHtml(b.name)}</div>`;
  });

  const maxShow = birthdays.length > 0 ? 2 : 3;
  events.slice(0, maxShow).forEach(e => {
    const completed = isEventCompleted(e.id);
    eventsHtml += `<div class="day-event cat-${e.category} ${completed ? 'completed-event' : ''}">${e.time ? formatTime(e.time) + ' ' : ''}${escapeHtml(e.title)}</div>`;
  });
  const totalHidden = events.length - maxShow + (birthdays.length > 0 ? 0 : 0);
  if (events.length > maxShow) {
    eventsHtml += `<div class="day-event-more">+${events.length - maxShow} more</div>`;
  }

  return `<div class="${classes.join(' ')}" data-date="${dateStr}">
    <div class="day-number">${date.getDate()} ${badgeHtml}</div>
    <div class="day-events">${eventsHtml}</div>
  </div>`;
}

function renderWeekView() {
  const today = new Date();
  const todayStr = formatDate(today);
  const curr = new Date(state.currentDate);
  const dayOfWeek = curr.getDay();
  const sunday = new Date(curr);
  sunday.setDate(curr.getDate() - dayOfWeek);

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const dateStr = formatDate(d);
    const events = getEventsForDate(dateStr);
    const birthdays = getBirthdaysForDate(dateStr);
    const isToday = sameDay(d, today);
    const hasOverdue = dateStr < todayStr && events.some(e => !isEventCompleted(e.id));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let rowClass = 'week-day-row';
    if (isToday) rowClass += ' today';
    else if (hasOverdue) rowClass += ' has-overdue';

    let eventsHtml = '';
    birthdays.forEach(b => {
      const icon = b.type === 'anniversary' ? '💍' : '🎂';
      eventsHtml += `<div class="week-event cat-birthday">${icon} ${escapeHtml(b.name)}</div>`;
    });

    eventsHtml += events.map(e => {
      const completed = isEventCompleted(e.id);
      return `<div class="week-event cat-${e.category} ${completed ? 'completed-event' : ''}">
        ${e.time ? `<span class="week-event-time">${formatTime(e.time)}</span>` : ''}
        ${escapeHtml(e.title)}
      </div>`;
    }).join('');

    html += `<div class="${rowClass}" data-date="${dateStr}">
      <div class="week-day-label">
        <span class="week-day-name">${dayNames[i]}</span>
        <span class="week-day-date">${d.getDate()}</span>
      </div>
      <div class="week-day-events">${eventsHtml}</div>
    </div>`;
  }

  els.weekGrid.innerHTML = html;
  els.weekGrid.querySelectorAll('.week-day-row').forEach(row => {
    row.addEventListener('click', () => {
      openModal(row.dataset.date);
    });
  });
}

// ===== Events CRUD =====
function addEvent(event) {
  state.events.push(event);
  saveEvents();
  render();
}

function deleteEvent(id) {
  state.events = state.events.filter(e => e.id !== id);
  delete state.completedEvents[id];
  saveEvents();
  saveCompleted();
  render();
}

function addBirthday(birthday) {
  state.birthdays.push(birthday);
  saveBirthdays();
  render();
}

function deleteBirthday(id) {
  state.birthdays = state.birthdays.filter(b => b.id !== id);
  saveBirthdays();
  render();
}

// ===== Modal =====
function openModal(dateStr) {
  els.eventDate.value = dateStr || formatDate(new Date());
  els.eventTitle.value = '';
  els.eventTime.value = '';
  els.eventCategory.value = 'objective';
  els.recurringOption.classList.add('hidden');
  els.modalTitle.textContent = 'Add Event';
  els.modalOverlay.classList.remove('hidden');
  els.eventTitle.focus();
}

function closeModal() {
  els.modalOverlay.classList.add('hidden');
}

function openBirthdayModal() {
  els.birthdayName.value = '';
  els.birthdayDate.value = '';
  els.birthdayType.value = 'birthday';
  els.birthdayModalOverlay.classList.remove('hidden');
  els.birthdayName.focus();
}

function closeBirthdayModal() {
  els.birthdayModalOverlay.classList.add('hidden');
}

// ===== Chat Parser =====
function parseChat(text) {
  const result = { title: '', date: null, time: null, category: 'objective', isBirthday: false, birthdayType: 'birthday' };
  const lower = text.toLowerCase();

  // Detect birthday/anniversary
  if (lower.includes('birthday') || lower.includes('bday') || lower.includes('anniversary')) {
    result.isBirthday = true;
    result.birthdayType = lower.includes('anniversary') ? 'anniversary' : 'birthday';
  }

  // Detect category
  if (!result.isBirthday) {
    if (lower.includes('meeting') || lower.includes('meet with') || lower.includes('call with'))
      result.category = 'meeting';
    else if (lower.includes('deadline') || lower.includes('due') || lower.includes('finish') || lower.includes('submit'))
      result.category = 'deadline';
    else if (lower.includes('remind') || lower.includes('remember') || lower.includes("don't forget"))
      result.category = 'reminder';
    else if (lower.includes('gym') || lower.includes('workout') || lower.includes('dinner') ||
             lower.includes('lunch') || lower.includes('party') ||
             lower.includes('doctor') || lower.includes('dentist') || lower.includes('haircut'))
      result.category = 'personal';
  } else {
    result.category = 'birthday';
  }

  // Parse time
  const timePatterns = [
    /\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)/i,
    /\bat\s+(\d{1,2})\s*(am|pm)/i,
    /\b(\d{1,2}):(\d{2})\s*(am|pm)/i,
    /\b(\d{1,2})\s*(am|pm)\b/i,
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] && !isNaN(parseInt(match[2])) && match[2].length <= 2 && parseInt(match[2]) < 60
        ? match[2] : '00';
      const ampm = (match[3] || match[2] || '').toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      result.time = `${String(hours).padStart(2, '0')}:${String(parseInt(minutes)).padStart(2, '0')}`;
      break;
    }
  }

  // Parse date
  const today = new Date();
  const todayStr = formatDate(today);

  if (lower.includes('today')) {
    result.date = todayStr;
  } else if (lower.includes('tomorrow')) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    result.date = formatDate(d);
  } else {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = lower.match(new RegExp(`\\b(next\\s+)?(${dayNames.join('|')})\\b`));
    if (dayMatch) {
      const targetDay = dayNames.indexOf(dayMatch[2]);
      const isNext = !!dayMatch[1];
      const d = new Date(today);
      let diff = targetDay - d.getDay();
      if (diff <= 0 || isNext) diff += 7;
      d.setDate(d.getDate() + diff);
      result.date = formatDate(d);
    }
  }

  // Explicit dates
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  const monthPattern = new RegExp(`\\b(${monthNames.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?`, 'i');
  const monthMatch = text.match(monthPattern);
  if (monthMatch) {
    const m = monthNames.indexOf(monthMatch[1].toLowerCase());
    const d = parseInt(monthMatch[2]);
    const y = monthMatch[3] ? parseInt(monthMatch[3]) : today.getFullYear();
    result.date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Numeric date
  const numDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numDateMatch && !result.date) {
    const m = parseInt(numDateMatch[1]);
    const d = parseInt(numDateMatch[2]);
    let y = numDateMatch[3] ? parseInt(numDateMatch[3]) : today.getFullYear();
    if (y < 100) y += 2000;
    result.date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  if (!result.date) {
    result.date = todayStr;
  }

  // Clean title
  let title = text;
  title = title.replace(/\b(birthday|bday|anniversary)\s*[:;]?\s*/gi, '');
  title = title.replace(/\b(on|at|by|for|next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/gi, '');
  title = title.replace(/\b(today|tomorrow)\b/gi, '');
  title = title.replace(monthPattern, '');
  title = title.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, '');
  title = title.replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '');
  title = title.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '');
  title = title.replace(/\s{2,}/g, ' ').trim();

  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  result.title = title || text;
  return result;
}

function handleChat(text) {
  if (!text.trim()) return;

  addChatMessage(text, 'user');
  const parsed = parseChat(text);

  if (parsed.isBirthday) {
    const birthday = {
      id: generateId(),
      name: parsed.title,
      date: parsed.date,
      type: parsed.birthdayType,
    };
    addBirthday(birthday);

    const dateObj = new Date(birthday.date + 'T00:00:00');
    const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const response = `Added "${birthday.name}" as a ${birthday.type} on ${dateDisplay}. I'll remind you every year!`;
    addChatMessage(response, 'bot');
  } else {
    const event = {
      id: generateId(),
      title: parsed.title,
      date: parsed.date,
      time: parsed.time,
      category: parsed.category,
    };

    addEvent(event);

    const dateObj = new Date(event.date + 'T00:00:00');
    const dateDisplay = formatDisplay(dateObj);
    const timeDisplay = event.time ? ` at ${formatTime(event.time)}` : '';
    const categoryLabels = {
      objective: 'objective', meeting: 'meeting', deadline: 'deadline',
      reminder: 'reminder', personal: 'personal event'
    };

    const response = `Added "${event.title}" as a ${categoryLabels[event.category]} on ${dateDisplay}${timeDisplay}.`;
    addChatMessage(response, 'bot');
  }

  els.chatInput.value = '';
}

function addChatMessage(text, type) {
  const div = document.createElement('div');
  div.className = `chat-message ${type}`;
  div.innerHTML = `<span>${escapeHtml(text)}</span>`;
  els.chatMessages.appendChild(div);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Event Listeners =====
els.prevBtn.addEventListener('click', () => {
  if (state.view === 'month') {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
  } else {
    state.currentDate.setDate(state.currentDate.getDate() - 7);
  }
  render();
});

els.nextBtn.addEventListener('click', () => {
  if (state.view === 'month') {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
  } else {
    state.currentDate.setDate(state.currentDate.getDate() + 7);
  }
  render();
});

els.monthTab.addEventListener('click', () => {
  state.view = 'month';
  els.monthTab.classList.add('active');
  els.weekTab.classList.remove('active');
  els.monthView.classList.remove('hidden');
  els.weekView.classList.add('hidden');
  render();
});

els.weekTab.addEventListener('click', () => {
  state.view = 'week';
  els.weekTab.classList.add('active');
  els.monthTab.classList.remove('active');
  els.weekView.classList.remove('hidden');
  els.monthView.classList.add('hidden');
  render();
});

// Today button
els.todayBtn.addEventListener('click', () => {
  state.currentDate = new Date();
  render();
});

// Chat toggle
els.chatToggle.addEventListener('click', () => {
  state.chatCollapsed = !state.chatCollapsed;
  els.chatbox.classList.toggle('collapsed', state.chatCollapsed);
});

// Chat
els.chatSend.addEventListener('click', () => handleChat(els.chatInput.value));
els.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleChat(els.chatInput.value);
});

// Event form
els.eventCategory.addEventListener('change', () => {
  if (els.eventCategory.value === 'birthday') {
    els.recurringOption.classList.remove('hidden');
  } else {
    els.recurringOption.classList.add('hidden');
  }
});

els.eventForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const category = els.eventCategory.value;

  if (category === 'birthday') {
    const birthday = {
      id: generateId(),
      name: els.eventTitle.value.trim(),
      date: els.eventDate.value,
      type: 'birthday',
    };
    if (birthday.name) {
      addBirthday(birthday);
      closeModal();
    }
  } else {
    const event = {
      id: generateId(),
      title: els.eventTitle.value.trim(),
      date: els.eventDate.value,
      time: els.eventTime.value || null,
      category: category,
    };
    if (event.title) {
      addEvent(event);
      closeModal();
    }
  }
});

els.modalCancel.addEventListener('click', closeModal);
els.modalOverlay.addEventListener('click', (e) => {
  if (e.target === els.modalOverlay) closeModal();
});

// Birthday modal
els.addBirthdayBtn.addEventListener('click', openBirthdayModal);

els.birthdayForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const birthday = {
    id: generateId(),
    name: els.birthdayName.value.trim(),
    date: els.birthdayDate.value,
    type: els.birthdayType.value,
  };
  if (birthday.name && birthday.date) {
    addBirthday(birthday);
    closeBirthdayModal();
  }
});

els.birthdayCancel.addEventListener('click', closeBirthdayModal);
els.birthdayModalOverlay.addEventListener('click', (e) => {
  if (e.target === els.birthdayModalOverlay) closeBirthdayModal();
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeBirthdayModal();
  }
});

// ===== Live Clock Update =====
function updateClock() {
  els.currentDate.textContent = formatDisplay(new Date());
}
setInterval(updateClock, 60000);

// ===== Initial Render =====
render();
