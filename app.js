// ===== Supabase Setup =====
const SUPABASE_URL = 'https://llvujuehggjckxrtoool.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsdnVqdWVoZ2dqY2t4cnRvb29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTQ4MDcsImV4cCI6MjA4OTI5MDgwN30.irXnI7_h-Z_RGPRcvhOyC0nF_atAFDXaRHv2m5iCRd0';
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== State =====
const state = {
  events: [],
  currentDate: new Date(),
  selectedDate: new Date(),
  view: 'month',
  focusMode: false,
  draggedEvent: null,
  streaks: { current: 0, best: 0, lastCompletedDate: null },
  user: null,
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
  eventPriority: $('#eventPriority'),
  eventRecurrence: $('#eventRecurrence'),
  eventRecurrenceEnd: $('#eventRecurrenceEnd'),
  recurrenceEndRow: $('#recurrenceEndRow'),
  birthdayList: $('#birthdayList'),
  conflictOverlay: $('#conflictOverlay'),
  conflictMessage: $('#conflictMessage'),
  conflictExisting: $('#conflictExisting'),
  conflictCancel: $('#conflictCancel'),
  conflictReplace: $('#conflictReplace'),
  conflictKeepBoth: $('#conflictKeepBoth'),
  modalCancel: $('#modalCancel'),
  modalTitle: $('#modalTitle'),
  progressBar: $('#progressBar'),
  progressText: $('#progressText'),
  progressFill: $('#progressFill'),
  streakCurrent: $('#streakCurrent'),
  streakBest: $('#streakBest'),
  focusToggle: $('#focusToggle'),
  focusOverlay: $('#focusOverlay'),
  focusList: $('#focusList'),
  focusProgress: $('#focusProgress'),
  focusProgressFill: $('#focusProgressFill'),
  focusProgressText: $('#focusProgressText'),
  focusClose: $('#focusClose'),
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
  const results = [];
  const targetDate = new Date(dateStr + 'T00:00:00');

  state.events.forEach(e => {
    if (e.recurrence === 'none' || !e.recurrence) {
      // Non-recurring: simple match
      if (e.date === dateStr) results.push(e);
    } else {
      // Recurring: check if this date matches the pattern
      if (doesRecurrenceMatch(e, dateStr, targetDate)) {
        // Create a virtual instance for this date
        results.push({
          ...e,
          _virtualDate: dateStr,
          _isRecurringInstance: true,
          completed: (e.completedDates || []).includes(dateStr),
        });
      }
    }
  });

  return results.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

function doesRecurrenceMatch(event, dateStr, targetDate) {
  const startDate = new Date(event.date + 'T00:00:00');
  // Don't show instances before the start date
  if (dateStr < event.date) return false;
  // Don't show instances after the end date
  if (event.recurrenceEnd && dateStr > event.recurrenceEnd) return false;
  // Original date always matches
  if (dateStr === event.date) return true;

  const diffTime = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  switch (event.recurrence) {
    case 'daily':
      return diffDays >= 0;
    case 'weekly':
      return diffDays >= 0 && targetDate.getDay() === startDate.getDay();
    case 'monthly':
      return diffDays >= 0 && targetDate.getDate() === startDate.getDate();
    case 'yearly':
      return diffDays >= 0 && targetDate.getMonth() === startDate.getMonth() && targetDate.getDate() === startDate.getDate();
    default:
      return false;
  }
}

function getRecurrenceIcon(recurrence, recurrenceEnd) {
  if (!recurrence || recurrence === 'none') return '';
  const labels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
  const endLabel = recurrenceEnd ? ` until ${formatShortDate(new Date(recurrenceEnd + 'T00:00:00'))}` : '';
  return `<span class="recurrence-badge" title="Repeats ${labels[recurrence]}${endLabel}">&#x21BB; ${labels[recurrence]}</span>`;
}

async function saveEvents() {
  // Also keep localStorage as offline fallback
  localStorage.setItem('calendarEvents', JSON.stringify(state.events));
}

async function saveStreaks() {
  localStorage.setItem('calendarStreaks', JSON.stringify(state.streaks));
  if (state.user) {
    await db.from('calendar_streaks').upsert({
      user_id: state.user.id,
      current_streak: state.streaks.current,
      best_streak: state.streaks.best,
      last_completed_date: state.streaks.lastCompletedDate,
    });
  }
}

// Convert event object to DB row format
function eventToRow(event) {
  return {
    id: event.id,
    user_id: state.user.id,
    title: event.title,
    date: event.date,
    time: event.time || null,
    category: event.category || 'objective',
    priority: event.priority || 'medium',
    recurrence: event.recurrence || 'none',
    recurrence_end: event.recurrenceEnd || null,
    completed: event.completed || false,
    completed_dates: event.completedDates || [],
  };
}

// Convert DB row to event object
function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time,
    category: row.category,
    priority: row.priority,
    recurrence: row.recurrence,
    recurrenceEnd: row.recurrence_end,
    completed: row.completed,
    completedDates: row.completed_dates || [],
  };
}

async function syncEventToSupabase(event) {
  if (!state.user) return;
  await db.from('calendar_events').upsert(eventToRow(event));
}

async function deleteEventFromSupabase(id) {
  if (!state.user) return;
  await db.from('calendar_events').delete().eq('id', id);
}

async function loadFromSupabase() {
  if (!state.user) return;

  // Load events
  const { data: events } = await db
    .from('calendar_events')
    .select('*')
    .eq('user_id', state.user.id);

  if (events) {
    state.events = events.map(rowToEvent);
    localStorage.setItem('calendarEvents', JSON.stringify(state.events));
  }

  // Load streaks
  const { data: streaks } = await db
    .from('calendar_streaks')
    .select('*')
    .eq('user_id', state.user.id)
    .single();

  if (streaks) {
    state.streaks = {
      current: streaks.current_streak,
      best: streaks.best_streak,
      lastCompletedDate: streaks.last_completed_date,
    };
    localStorage.setItem('calendarStreaks', JSON.stringify(state.streaks));
  }
}

// Migrate localStorage data to Supabase for first-time users
async function migrateLocalToSupabase() {
  if (!state.user) return;

  const { data: existing } = await db
    .from('calendar_events')
    .select('id')
    .eq('user_id', state.user.id)
    .limit(1);

  // Only migrate if user has no events in Supabase yet
  if (existing && existing.length > 0) return;

  const localEvents = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
  if (localEvents.length === 0) return;

  const rows = localEvents.map(e => eventToRow({
    ...e,
    completed: e.completed || false,
    priority: e.priority || 'medium',
    recurrence: e.recurrence || 'none',
    recurrenceEnd: e.recurrenceEnd || null,
    completedDates: e.completedDates || [],
  }));

  await db.from('calendar_events').upsert(rows);

  const localStreaks = JSON.parse(localStorage.getItem('calendarStreaks') || '{}');
  if (localStreaks.current || localStreaks.best) {
    await db.from('calendar_streaks').upsert({
      user_id: state.user.id,
      current_streak: localStreaks.current || 0,
      best_streak: localStreaks.best || 0,
      last_completed_date: localStreaks.lastCompletedDate || null,
    });
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getPriorityIcon(priority) {
  switch (priority) {
    case 'high': return '<span class="priority-icon priority-high" title="High priority">!!!</span>';
    case 'medium': return '<span class="priority-icon priority-medium" title="Medium priority">!!</span>';
    case 'low': return '<span class="priority-icon priority-low" title="Low priority">!</span>';
    default: return '';
  }
}

function getPriorityOrder(priority) {
  return { high: 0, medium: 1, low: 2 }[priority] || 1;
}

// ===== Progress Tracking =====
function getProgressForDate(dateStr) {
  const events = getEventsForDate(dateStr);
  if (events.length === 0) return { total: 0, completed: 0, percent: 0 };
  const completed = events.filter(e => e.completed).length;
  return { total: events.length, completed, percent: Math.round((completed / events.length) * 100) };
}

function updateProgress() {
  const today = formatDate(new Date());
  const { total, completed, percent } = getProgressForDate(today);

  if (els.progressFill && els.progressText) {
    els.progressFill.style.width = `${percent}%`;
    els.progressText.textContent = total > 0 ? `${completed}/${total} tasks (${percent}%)` : 'No tasks today';
    els.progressFill.className = 'progress-fill' + (percent === 100 ? ' complete' : '');
  }
}

// ===== Streak Tracking =====
function updateStreaks() {
  const today = formatDate(new Date());
  const { total, completed } = getProgressForDate(today);
  const allDone = total > 0 && completed === total;

  if (allDone && state.streaks.lastCompletedDate !== today) {
    // Check if yesterday was completed to continue streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    if (state.streaks.lastCompletedDate === yesterdayStr) {
      state.streaks.current += 1;
    } else if (state.streaks.lastCompletedDate !== today) {
      state.streaks.current = 1;
    }

    state.streaks.lastCompletedDate = today;
    if (state.streaks.current > state.streaks.best) {
      state.streaks.best = state.streaks.current;
    }
    saveStreaks();
  } else if (!allDone && state.streaks.lastCompletedDate === today) {
    // Un-completing a task today: revert
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);
    state.streaks.lastCompletedDate = yesterdayStr;
    state.streaks.current = Math.max(0, state.streaks.current - 1);
    saveStreaks();
  }

  if (els.streakCurrent) els.streakCurrent.textContent = state.streaks.current;
  if (els.streakBest) els.streakBest.textContent = state.streaks.best;
}

// ===== Toggle Event Completion =====
function toggleEventComplete(id, dateStr) {
  const event = state.events.find(e => e.id === id);
  if (!event) return;

  if (event.recurrence && event.recurrence !== 'none') {
    // For recurring events, track completion per-date
    const targetDate = dateStr || formatDate(new Date());
    if (!event.completedDates) event.completedDates = [];
    const idx = event.completedDates.indexOf(targetDate);
    if (idx >= 0) {
      event.completedDates.splice(idx, 1);
    } else {
      event.completedDates.push(targetDate);
    }
  } else {
    event.completed = !event.completed;
  }

  saveEvents();
  syncEventToSupabase(event);
  updateProgress();
  updateStreaks();
  render();
  if (state.focusMode) renderFocusMode();
}

// ===== Rendering =====
function render() {
  const today = new Date();
  els.currentDate.textContent = formatDisplay(today);
  els.todayLabel.textContent = formatDisplay(today);
  els.monthYear.textContent = formatMonthYear(state.currentDate);

  renderDailyObjectives(today);
  renderHorizon(today);
  renderBirthdayCountdown(today);

  if (state.view === 'month') {
    renderMonthView();
  } else {
    renderWeekView();
  }

  updateProgress();
  updateStreaks();
}

function renderDailyObjectives(today) {
  const todayStr = formatDate(today);
  const events = getEventsForDate(todayStr)
    .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority) || (a.time || '').localeCompare(b.time || ''));

  if (events.length === 0) {
    els.dailyObjectives.innerHTML = '<li class="empty-state">No objectives for today. Use the chat to add some!</li>';
    return;
  }

  els.dailyObjectives.innerHTML = events.map(e => `
    <li class="cat-${e.category}${e.completed ? ' completed' : ''}" draggable="true" data-event-id="${e.id}" data-event-date="${todayStr}">
      <label class="checkbox-wrapper" title="Mark ${e.completed ? 'incomplete' : 'complete'}">
        <input type="checkbox" class="task-checkbox" data-id="${e.id}" data-date="${todayStr}" ${e.completed ? 'checked' : ''}>
        <span class="checkmark"></span>
      </label>
      ${getPriorityIcon(e.priority)}
      ${getRecurrenceIcon(e.recurrence, e.recurrenceEnd)}
      ${e.time ? `<span class="event-item-time">${formatTime(e.time)}</span>` : ''}
      <span class="event-item-title">${escapeHtml(e.title)}</span>
      <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
    </li>
  `).join('');

  bindObjectiveEvents(els.dailyObjectives);
}

function bindObjectiveEvents(container) {
  container.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('change', (ev) => {
      ev.stopPropagation();
      toggleEventComplete(cb.dataset.id, cb.dataset.date);
    });
  });
  container.querySelectorAll('.event-item-delete').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteEvent(btn.dataset.id);
    });
  });

  // Drag from sidebar
  container.querySelectorAll('li[draggable="true"]').forEach(li => {
    li.addEventListener('dragstart', (ev) => {
      state.draggedEvent = li.dataset.eventId;
      ev.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      state.draggedEvent = null;
      li.classList.remove('dragging');
    });
  });
}

function renderHorizon(today) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const endOfMonth = new Date(year, month + 1, 0);
  els.horizonLabel.textContent = `Remaining in ${today.toLocaleDateString('en-US', { month: 'long' })}`;

  const todayStr = formatDate(today);
  const upcoming = state.events.filter(e => {
    return e.date > todayStr && e.date <= formatDate(endOfMonth);
  }).sort((a, b) => a.date.localeCompare(b.date) || getPriorityOrder(a.priority) - getPriorityOrder(b.priority) || (a.time || '').localeCompare(b.time || ''));

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
    html += `<div class="horizon-date-group"><div class="horizon-date-label">${formatShortDate(d)}</div>`;
    groups[dateStr].forEach(e => {
      html += `<li class="cat-${e.category}${e.completed ? ' completed' : ''}" draggable="true" data-event-id="${e.id}" data-event-date="${dateStr}">
        <label class="checkbox-wrapper" title="Mark ${e.completed ? 'incomplete' : 'complete'}">
          <input type="checkbox" class="task-checkbox" data-id="${e.id}" data-date="${dateStr}" ${e.completed ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        ${getPriorityIcon(e.priority)}
        ${getRecurrenceIcon(e.recurrence, e.recurrenceEnd)}
        ${e.time ? `<span class="event-item-time">${formatTime(e.time)}</span>` : ''}
        <span class="event-item-title">${escapeHtml(e.title)}</span>
        <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
      </li>`;
    });
    html += '</div>';
  });

  els.horizonList.innerHTML = html;
  bindObjectiveEvents(els.horizonList);
}

function renderBirthdayCountdown(today) {
  // Find all events with "birthday" in the title
  const birthdayEvents = state.events.filter(e =>
    e.title.toLowerCase().includes('birthday')
  );

  if (birthdayEvents.length === 0) {
    els.birthdayList.innerHTML = '<div class="empty-state">No birthdays tracked yet. Add events with "birthday" in the title!</div>';
    return;
  }

  const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // Calculate next occurrence and days until for each birthday
  const birthdays = birthdayEvents.map(e => {
    const eventDate = new Date(e.date + 'T00:00:00');
    // Find the next occurrence this year or next
    let nextOccurrence = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    if (nextOccurrence.getTime() < todayTime) {
      nextOccurrence = new Date(today.getFullYear() + 1, eventDate.getMonth(), eventDate.getDate());
    }
    const diffMs = nextOccurrence.getTime() - todayTime;
    const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return { ...e, nextOccurrence, daysUntil };
  }).sort((a, b) => a.daysUntil - b.daysUntil);

  els.birthdayList.innerHTML = birthdays.map(b => {
    const isToday = b.daysUntil === 0;
    const isTomorrow = b.daysUntil === 1;
    const isThisWeek = b.daysUntil <= 7;

    let countdownText;
    if (isToday) countdownText = 'Today!';
    else if (isTomorrow) countdownText = 'Tomorrow!';
    else if (isThisWeek) countdownText = `${b.daysUntil} days away`;
    else if (b.daysUntil <= 30) countdownText = `${b.daysUntil} days away`;
    else {
      const weeks = Math.floor(b.daysUntil / 7);
      countdownText = `${weeks} week${weeks > 1 ? 's' : ''} away`;
    }

    const urgencyClass = isToday ? 'birthday-today' : isThisWeek ? 'birthday-soon' : '';
    const dateLabel = formatShortDate(b.nextOccurrence);

    return `<div class="birthday-card ${urgencyClass}">
      <div class="birthday-icon">${isToday ? '&#x1F382;' : '&#x1F381;'}</div>
      <div class="birthday-info">
        <div class="birthday-name">${escapeHtml(b.title)}</div>
        <div class="birthday-date">${dateLabel}</div>
      </div>
      <div class="birthday-countdown">${countdownText}</div>
    </div>`;
  }).join('');
}

function renderMonthView() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const today = new Date();

  let html = '';

  // Previous month padding
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    const dateStr = formatDate(d);
    const events = getEventsForDate(dateStr);
    html += buildDayCell(d, events, true, sameDay(d, today));
  }

  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, month, day);
    const dateStr = formatDate(d);
    const events = getEventsForDate(dateStr);
    html += buildDayCell(d, events, false, sameDay(d, today));
  }

  // Next month padding
  const totalCells = startDay + lastDay.getDate();
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    const dateStr = formatDate(d);
    const events = getEventsForDate(dateStr);
    html += buildDayCell(d, events, true, false);
  }

  els.calendarDays.innerHTML = html;

  // Add click + drag handlers
  els.calendarDays.querySelectorAll('.calendar-day').forEach(cell => {
    cell.addEventListener('click', (e) => {
      // Don't open modal if clicking on a checkbox
      if (e.target.classList.contains('task-checkbox') || e.target.classList.contains('checkmark')) return;
      state.selectedDate = new Date(cell.dataset.date + 'T00:00:00');
      openModal(cell.dataset.date);
    });

    // Drag-to-reschedule: drop targets
    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', () => {
      cell.classList.remove('drag-over');
    });
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      if (state.draggedEvent) {
        rescheduleEvent(state.draggedEvent, cell.dataset.date);
      }
    });
  });

  // Make individual day events draggable
  els.calendarDays.querySelectorAll('.day-event[data-event-id]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      state.draggedEvent = el.dataset.eventId;
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
      state.draggedEvent = null;
      el.classList.remove('dragging');
    });
  });

  // Checkbox handlers in month view
  els.calendarDays.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleEventComplete(cb.dataset.id, cb.dataset.date);
    });
  });
}

function buildDayCell(date, events, otherMonth, isToday) {
  const dateStr = formatDate(date);
  const classes = ['calendar-day'];
  if (otherMonth) classes.push('other-month');
  if (isToday) classes.push('today');

  // Progress mini-indicator
  const progress = getProgressForDate(dateStr);
  let progressIndicator = '';
  if (progress.total > 0) {
    progressIndicator = `<div class="day-progress"><div class="day-progress-fill${progress.percent === 100 ? ' complete' : ''}" style="width:${progress.percent}%"></div></div>`;
  }

  let eventsHtml = '';
  const maxShow = 3;
  const sorted = events.sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority));
  sorted.slice(0, maxShow).forEach(e => {
    eventsHtml += `<div class="day-event cat-${e.category}${e.completed ? ' completed' : ''}" draggable="true" data-event-id="${e.id}">
      <label class="checkbox-mini" onclick="event.stopPropagation()">
        <input type="checkbox" class="task-checkbox" data-id="${e.id}" data-date="${dateStr}" ${e.completed ? 'checked' : ''}>
        <span class="checkmark-mini"></span>
      </label>
      ${e.recurrence && e.recurrence !== 'none' ? '<span class="recurrence-dot" title="Recurring">&#x21BB;</span>' : ''}${e.time ? formatTime(e.time) + ' ' : ''}${escapeHtml(e.title)}
    </div>`;
  });
  if (events.length > maxShow) {
    eventsHtml += `<div class="day-event-more">+${events.length - maxShow} more</div>`;
  }

  return `<div class="${classes.join(' ')}" data-date="${dateStr}">
    <div class="day-number">${date.getDate()}</div>
    ${progressIndicator}
    <div class="day-events">${eventsHtml}</div>
  </div>`;
}

function renderWeekView() {
  const today = new Date();
  const curr = new Date(state.currentDate);
  const dayOfWeek = curr.getDay();
  const sunday = new Date(curr);
  sunday.setDate(curr.getDate() - dayOfWeek);

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const dateStr = formatDate(d);
    const events = getEventsForDate(dateStr)
      .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority) || (a.time || '').localeCompare(b.time || ''));
    const isToday = sameDay(d, today);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const progress = getProgressForDate(dateStr);

    html += `<div class="week-day-row${isToday ? ' today' : ''}" data-date="${dateStr}">
      <div class="week-day-label">
        <span class="week-day-name">${dayNames[i]}</span>
        <span class="week-day-date">${d.getDate()}</span>
        ${progress.total > 0 ? `<span class="week-progress-badge${progress.percent === 100 ? ' complete' : ''}">${progress.completed}/${progress.total}</span>` : ''}
      </div>
      <div class="week-day-events">
        ${events.map(e => `<div class="week-event cat-${e.category}${e.completed ? ' completed' : ''}" draggable="true" data-event-id="${e.id}">
          <label class="checkbox-wrapper-sm" onclick="event.stopPropagation()">
            <input type="checkbox" class="task-checkbox" data-id="${e.id}" data-date="${dateStr}" ${e.completed ? 'checked' : ''}>
            <span class="checkmark-sm"></span>
          </label>
          ${getPriorityIcon(e.priority)}
          ${getRecurrenceIcon(e.recurrence, e.recurrenceEnd)}
          ${e.time ? `<span class="week-event-time">${formatTime(e.time)}</span>` : ''}
          ${escapeHtml(e.title)}
        </div>`).join('')}
      </div>
    </div>`;
  }

  els.weekGrid.innerHTML = html;

  els.weekGrid.querySelectorAll('.week-day-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-checkbox') || e.target.classList.contains('checkmark-sm')) return;
      openModal(row.dataset.date);
    });

    // Drop targets for week view
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (state.draggedEvent) {
        rescheduleEvent(state.draggedEvent, row.dataset.date);
      }
    });
  });

  // Draggable week events
  els.weekGrid.querySelectorAll('.week-event[data-event-id]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      state.draggedEvent = el.dataset.eventId;
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
      state.draggedEvent = null;
      el.classList.remove('dragging');
    });
  });

  // Week view checkbox handlers
  els.weekGrid.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleEventComplete(cb.dataset.id, cb.dataset.date);
    });
  });
}

// ===== Drag-to-Reschedule =====
function rescheduleEvent(eventId, newDate) {
  const event = state.events.find(e => e.id === eventId);
  if (event && event.date !== newDate) {
    if (event.recurrence && event.recurrence !== 'none') {
      event.date = newDate;
      saveEvents();
      syncEventToSupabase(event);
      render();
      addChatMessage(`Rescheduled recurring "${event.title}" to start from ${formatDisplay(new Date(newDate + 'T00:00:00'))}.`, 'bot');
    } else {
      event.date = newDate;
      saveEvents();
      syncEventToSupabase(event);
      render();
      addChatMessage(`Rescheduled "${event.title}" to ${formatDisplay(new Date(newDate + 'T00:00:00'))}.`, 'bot');
    }
  }
  state.draggedEvent = null;
}

// ===== Focus Mode =====
function toggleFocusMode() {
  state.focusMode = !state.focusMode;
  if (state.focusMode) {
    renderFocusMode();
    els.focusOverlay.classList.remove('hidden');
    document.body.classList.add('focus-active');
  } else {
    els.focusOverlay.classList.add('hidden');
    document.body.classList.remove('focus-active');
  }
}

function renderFocusMode() {
  const todayStr = formatDate(new Date());
  const events = getEventsForDate(todayStr)
    .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority) || (a.time || '').localeCompare(b.time || ''));
  const progress = getProgressForDate(todayStr);

  if (els.focusProgressFill) {
    els.focusProgressFill.style.width = `${progress.percent}%`;
    els.focusProgressFill.className = 'progress-fill' + (progress.percent === 100 ? ' complete' : '');
  }
  if (els.focusProgressText) {
    els.focusProgressText.textContent = progress.total > 0 ? `${progress.completed}/${progress.total} completed (${progress.percent}%)` : 'No tasks for today';
  }

  if (events.length === 0) {
    els.focusList.innerHTML = '<div class="focus-empty">No tasks for today. Enjoy your free time!</div>';
    return;
  }

  els.focusList.innerHTML = events.map(e => `
    <div class="focus-task${e.completed ? ' completed' : ''}" data-id="${e.id}">
      <label class="checkbox-wrapper focus-checkbox">
        <input type="checkbox" class="task-checkbox" data-id="${e.id}" data-date="${todayStr}" ${e.completed ? 'checked' : ''}>
        <span class="checkmark"></span>
      </label>
      <div class="focus-task-info">
        <div class="focus-task-header">
          ${getPriorityIcon(e.priority)}
          <span class="focus-task-title">${escapeHtml(e.title)}</span>
        </div>
        <div class="focus-task-meta">
          <span class="cat-badge cat-${e.category}">${e.category}</span>
          ${e.recurrence && e.recurrence !== 'none' ? `<span class="recurrence-badge">&#x21BB; ${e.recurrence}</span>` : ''}
          ${e.time ? `<span class="focus-task-time">${formatTime(e.time)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  els.focusList.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleEventComplete(cb.dataset.id, cb.dataset.date);
    });
  });
}

// ===== Conflict Detection =====
let pendingConflictEvent = null;
let conflictingEvents = [];

function findExistingEvents(date) {
  return getEventsForDate(date);
}

function showConflictDialog(newEvent, existing) {
  // pendingConflictEvent is already set by addEventWithConflictCheck as { event, source }
  conflictingEvents = existing;

  const dateDisplay = formatDisplay(new Date(newEvent.date + 'T00:00:00'));
  const timeNote = newEvent.time ? ` at ${formatTime(newEvent.time)}` : '';
  const count = existing.length === 1 ? '1 event' : `${existing.length} events`;

  els.conflictMessage.textContent = `You already have ${count} on ${dateDisplay}${timeNote}:`;

  els.conflictExisting.innerHTML = existing.map(e => `
    <div class="conflict-event-item cat-${e.category}">
      ${getPriorityIcon(e.priority)}
      ${e.time ? `<span class="conflict-event-time">${formatTime(e.time)}</span>` : ''}
      <span class="conflict-event-title">${escapeHtml(e.title)}</span>
      <span class="conflict-event-cat">${e.category}</span>
    </div>
  `).join('');

  els.conflictOverlay.classList.remove('hidden');
}

function closeConflictDialog() {
  els.conflictOverlay.classList.add('hidden');
  pendingConflictEvent = null;
  conflictingEvents = [];
}

function addEventWithConflictCheck(event, source) {
  const existing = findExistingEvents(event.date);
  if (existing.length > 0) {
    pendingConflictEvent = { event, source };
    showConflictDialog(event, existing);
  } else {
    commitAddEvent(event, source);
  }
}

function commitAddEvent(event, source) {
  addEvent(event);
  if (source === 'chat') {
    const dateObj = new Date(event.date + 'T00:00:00');
    const dateDisplay = formatDisplay(dateObj);
    const timeDisplay = event.time ? ` at ${formatTime(event.time)}` : '';
    const categoryLabels = {
      objective: 'objective', meeting: 'meeting', deadline: 'deadline',
      reminder: 'reminder', personal: 'personal event'
    };
    const priorityLabel = event.priority !== 'medium' ? ` [${event.priority} priority]` : '';
    const endLabel = event.recurrenceEnd ? ` until ${formatDisplay(new Date(event.recurrenceEnd + 'T00:00:00'))}` : '';
    const recurrenceLabel = event.recurrence !== 'none' ? ` (repeats ${event.recurrence}${endLabel})` : '';
    const response = `Added "${event.title}" as a ${categoryLabels[event.category]} on ${dateDisplay}${timeDisplay}${priorityLabel}${recurrenceLabel}.`;
    addChatMessage(response, 'bot');
  } else if (source === 'modal') {
    closeModal();
  }
}

// ===== Events CRUD =====
function addEvent(event) {
  event.completed = event.completed || false;
  event.priority = event.priority || 'medium';
  event.recurrence = event.recurrence || 'none';
  event.recurrenceEnd = event.recurrenceEnd || null;
  event.completedDates = event.completedDates || [];
  state.events.push(event);
  saveEvents();
  syncEventToSupabase(event);
  render();
}

function deleteEvent(id) {
  state.events = state.events.filter(e => e.id !== id);
  saveEvents();
  deleteEventFromSupabase(id);
  render();
  if (state.focusMode) renderFocusMode();
}

// ===== Modal =====
function openModal(dateStr) {
  els.eventDate.value = dateStr || formatDate(new Date());
  els.eventTitle.value = '';
  els.eventTime.value = '';
  els.eventCategory.value = 'objective';
  els.eventPriority.value = 'medium';
  els.eventRecurrence.value = 'none';
  els.eventRecurrenceEnd.value = '';
  els.recurrenceEndRow.classList.add('hidden');
  els.modalTitle.textContent = 'Add Event';
  els.modalOverlay.classList.remove('hidden');
  els.eventTitle.focus();
}

function closeModal() {
  els.modalOverlay.classList.add('hidden');
}

// ===== Chat Parser =====
function parseChat(text) {
  const result = { title: '', date: null, time: null, category: 'objective', priority: 'medium', recurrence: 'none', recurrenceEnd: null };
  const lower = text.toLowerCase();

  // Detect recurrence
  if (lower.includes('every day') || lower.includes('everyday') || lower.match(/\bdaily\b/))
    result.recurrence = 'daily';
  else if (lower.includes('every week') || lower.match(/\bweekly\b/))
    result.recurrence = 'weekly';
  else if (lower.includes('every month') || lower.match(/\bmonthly\b/))
    result.recurrence = 'monthly';
  else if (lower.includes('every year') || lower.match(/\byearly\b/) || lower.match(/\bannually\b/))
    result.recurrence = 'yearly';

  // Detect category
  if (lower.includes('meeting') || lower.includes('meet with') || lower.includes('call with'))
    result.category = 'meeting';
  else if (lower.includes('deadline') || lower.includes('due') || lower.includes('finish') || lower.includes('submit'))
    result.category = 'deadline';
  else if (lower.includes('remind') || lower.includes('remember') || lower.includes("don't forget"))
    result.category = 'reminder';
  else if (lower.includes('gym') || lower.includes('workout') || lower.includes('dinner') ||
           lower.includes('lunch') || lower.includes('birthday') || lower.includes('party') ||
           lower.includes('doctor') || lower.includes('dentist') || lower.includes('haircut'))
    result.category = 'personal';

  // Detect priority
  if (lower.includes('urgent') || lower.includes('important') || lower.includes('critical') || lower.includes('high priority') || lower.includes('asap'))
    result.priority = 'high';
  else if (lower.includes('low priority') || lower.includes('whenever') || lower.includes('not urgent') || lower.includes('optional'))
    result.priority = 'low';

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

  // Detect recurrence end: "for X weeks/days/months" — calculated from the event's start date
  if (result.recurrence !== 'none') {
    const forWeeksMatch = lower.match(/\bfor\s+(\d+)\s+weeks?\b/);
    const forDaysMatch = lower.match(/\bfor\s+(\d+)\s+days?\b/);
    const forMonthsMatch = lower.match(/\bfor\s+(\d+)\s+months?\b/);
    const startDate = new Date(result.date + 'T00:00:00');
    if (forWeeksMatch) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + parseInt(forWeeksMatch[1]) * 7);
      result.recurrenceEnd = formatDate(end);
    } else if (forDaysMatch) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + parseInt(forDaysMatch[1]) - 1);
      result.recurrenceEnd = formatDate(end);
    } else if (forMonthsMatch) {
      const end = new Date(startDate);
      end.setMonth(end.getMonth() + parseInt(forMonthsMatch[1]));
      result.recurrenceEnd = formatDate(end);
    }
  }

  // Clean title
  let title = text;
  title = title.replace(/\b(on|at|by|for|next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/gi, '');
  title = title.replace(/\b(today|tomorrow)\b/gi, '');
  title = title.replace(monthPattern, '');
  title = title.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, '');
  title = title.replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '');
  title = title.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '');
  title = title.replace(/\b(urgent|important|critical|high priority|low priority|asap|not urgent|optional|whenever)\b/gi, '');
  title = title.replace(/\b(every\s+day|everyday|daily|every\s+week|weekly|every\s+month|monthly|every\s+year|yearly|annually)\b/gi, '');
  title = title.replace(/\bfor\s+\d+\s+(weeks?|days?|months?)\b/gi, '');
  title = title.replace(/\s{2,}/g, ' ').trim();

  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  result.title = title || text;
  return result;
}

// ===== Query Detection =====
function tryHandleQuery(text) {
  const lower = text.toLowerCase().trim();

  // Detect query patterns — broad coverage of natural phrasing
  const queryPatterns = [
    // "what" questions
    /what(.{0,20})(planned|scheduled|happening|going on|coming up|on the calendar|on the schedule|on the agenda|lined up)/i,
    /what do (we|i|you) have/i,
    /what (are|is) (on|for|happening)/i,
    /what('s| is) (planned|scheduled|happening|coming up|going on|lined up)/i,
    /what('s| is) (on|for)/i,
    /what events/i,
    /what am i doing/i,
    /what are we doing/i,
    // "do we/I have" questions
    /do (we|i) have (anything|something|any ?thing|plans?|events?)/i,
    /have (we|i) got (anything|something|any ?thing)/i,
    // "is/are there" questions
    /is (there )?(anything|something|any ?thing) (on|planned|scheduled|happening|set|booked)/i,
    /are (we|there)(.{0,15})(planned|scheduled|free|busy|booked|available|open)/i,
    /are there (any )?(events?|plans?|meetings?|tasks?)/i,
    // "show/check/tell/give" commands
    /show (me )?(my |our |the )?(events?|schedule|plans?|calendar|agenda|tasks?|day)/i,
    /check (my |our |the )?(schedule|calendar|plans?|events?|agenda|day)/i,
    /tell me (about )?(my |our |the )?(schedule|plans?|events?|day)/i,
    /give me (my |our |the )?(schedule|plans?|events?|rundown|breakdown)/i,
    /pull up (my |our |the )?(schedule|calendar|plans?|events?|day)/i,
    // "anything" questions
    /anything (planned|scheduled|on|happening|going on|coming up|set|booked|lined up)/i,
    /something (planned|scheduled|on|happening)/i,
    // schedule/plan/agenda phrases
    /plans? for/i,
    /schedule for/i,
    /agenda for/i,
    /calendar for/i,
    // "how does my day look" style
    /how('s| does| is| do)? (my|our|the) (day|week|month|schedule|calendar) look/i,
    /how('s| is) (my|our|the) (day|week|month)/i,
    // "am I / are we free/busy"
    /am i (free|busy|available|booked|open)/i,
    /are we (free|busy|available|booked|open)/i,
    // read back / recap
    /read (back|me|out)/i,
    /recap (my |our |the )?(day|schedule|plans?)/i,
    /run ?down (of |for )?(my |our |the )?(day|schedule|plans?)/i,
    /summary (of |for )?(my |our |the )?(day|schedule|plans?)/i,
    // "got anything" / "got plans"
    /(we |i )?(got|have) (anything|something|plans?|events?) (on|for|planned|scheduled|happening)/i,
    // "busy on" / "free on"
    /(busy|free|available|open|booked) (on|for)/i,
    // "look up" / "look at"
    /look (up|at) (my |our |the )?(schedule|calendar|plans?|events?|day)/i,
    // simple date-only queries that start with question words
    /^(what|anything|is there|do we|do i|are we|how).{0,50}(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2})/i,
  ];

  const isQuery = queryPatterns.some(p => p.test(lower));
  if (!isQuery) return false;

  // Parse the date from the query
  const date = parseDateFromText(text);
  if (!date) {
    addChatMessage("I couldn't figure out which date you mean. Try something like \"What do I have on Monday?\" or \"What's planned for March 25?\"", 'bot');
    return true;
  }

  const dateStr = formatDate(date);
  const events = getEventsForDate(dateStr)
    .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority) || (a.time || '').localeCompare(b.time || ''));

  const dateDisplay = formatDisplay(date);
  const today = new Date();
  const isToday = sameDay(date, today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = sameDay(date, tomorrow);
  const dayLabel = isToday ? 'today' : isTomorrow ? 'tomorrow' : `on ${dateDisplay}`;

  if (events.length === 0) {
    addChatBotHtml(`<div class="query-response">
      <div class="query-header empty">
        <span class="query-date-label">${dateDisplay}</span>
        <span class="query-summary">Nothing planned</span>
      </div>
      <div class="query-empty-msg">Your schedule is clear ${dayLabel}!</div>
    </div>`);

    // Navigate calendar to the queried date
    state.currentDate = new Date(date);
    render();
    return true;
  }

  const completed = events.filter(e => e.completed).length;
  const percent = Math.round((completed / events.length) * 100);
  const summary = events.length === 1 ? '1 item' : `${events.length} items`;

  const categoryIcons = {
    objective: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    meeting: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    deadline: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    reminder: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    personal: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  };

  const eventCards = events.map(e => {
    const icon = categoryIcons[e.category] || categoryIcons.objective;
    const timeStr = e.time ? formatTime(e.time) : '';
    const priClass = e.priority === 'high' ? 'pri-high' : e.priority === 'low' ? 'pri-low' : '';
    const doneClass = e.completed ? ' done' : '';
    const recurBadge = e.recurrence && e.recurrence !== 'none'
      ? `<span class="query-recur">&#x21BB; ${e.recurrence}</span>` : '';

    return `<div class="query-event-card cat-${e.category}${doneClass} ${priClass}">
      <div class="query-event-icon">${icon}</div>
      <div class="query-event-details">
        <span class="query-event-title">${escapeHtml(e.title)}</span>
        <span class="query-event-meta">${timeStr ? timeStr + ' ' : ''}<span class="query-cat-label">${e.category}</span>${recurBadge}</span>
      </div>
      ${e.completed ? '<span class="query-done-badge">Done</span>' : ''}
    </div>`;
  }).join('');

  const progressBar = `<div class="query-progress-track"><div class="query-progress-fill${percent === 100 ? ' complete' : ''}" style="width:${percent}%"></div></div>`;

  addChatBotHtml(`<div class="query-response">
    <div class="query-header">
      <span class="query-date-label">${dateDisplay}</span>
      <span class="query-summary">${summary}${completed > 0 ? ` &middot; ${completed} done` : ''}</span>
    </div>
    ${progressBar}
    <div class="query-event-list">${eventCards}</div>
  </div>`);

  // Navigate calendar to the queried date
  state.currentDate = new Date(date);
  render();
  return true;
}

function parseDateFromText(text) {
  const lower = text.toLowerCase();
  const today = new Date();

  if (lower.includes('today')) return today;

  if (lower.includes('tomorrow')) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }

  if (lower.includes('yesterday')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  }

  // Day names
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = lower.match(new RegExp(`\\b(next\\s+)?(this\\s+)?(${dayNames.join('|')})\\b`));
  if (dayMatch) {
    const targetDay = dayNames.indexOf(dayMatch[3]);
    const isNext = !!dayMatch[1];
    const d = new Date(today);
    let diff = targetDay - d.getDay();
    if (diff <= 0 || isNext) diff += 7;
    if (dayMatch[2] && diff > 7) diff -= 7; // "this Monday"
    d.setDate(d.getDate() + diff);
    return d;
  }

  // Month + day: "March 25", "March 25th"
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  const monthPattern = new RegExp(`\\b(${monthNames.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?`, 'i');
  const monthMatch = text.match(monthPattern);
  if (monthMatch) {
    const m = monthNames.indexOf(monthMatch[1].toLowerCase());
    const day = parseInt(monthMatch[2]);
    const y = monthMatch[3] ? parseInt(monthMatch[3]) : today.getFullYear();
    return new Date(y, m, day);
  }

  // Numeric dates: 3/25, 03/25/2026
  const numMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numMatch) {
    const m = parseInt(numMatch[1]) - 1;
    const day = parseInt(numMatch[2]);
    let y = numMatch[3] ? parseInt(numMatch[3]) : today.getFullYear();
    if (y < 100) y += 2000;
    return new Date(y, m, day);
  }

  // "this week" → show today
  if (lower.includes('this week') || lower.includes('my week')) return today;

  // Fallback: if nothing matched but it's a query, assume today
  if (lower.includes('today') || lower.match(/\bmy day\b/) || lower.match(/\bthe day\b/)) return today;

  // Last resort: assume today for vague queries
  if (lower.match(/what('s| do).*have/i) && !dayMatch && !monthMatch) return today;

  return null;
}

function formatChatResponse(text) {
  return text.replace(/\n/g, '<br>').replace(/•/g, '<span style="color:var(--primary)">•</span>');
}

function addChatBotHtml(html) {
  const div = document.createElement('div');
  div.className = 'chat-message bot';
  div.innerHTML = `<span>${html}</span>`;
  els.chatMessages.appendChild(div);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function handleChat(text) {
  if (!text.trim()) return;

  addChatMessage(text, 'user');
  els.chatInput.value = '';

  // Check if this is a query about existing events
  if (tryHandleQuery(text)) return;

  const parsed = parseChat(text);
  const event = {
    id: generateId(),
    title: parsed.title,
    date: parsed.date,
    time: parsed.time,
    category: parsed.category,
    priority: parsed.priority,
    recurrence: parsed.recurrence,
    recurrenceEnd: parsed.recurrenceEnd,
    completed: false,
    completedDates: [],
  };

  addEventWithConflictCheck(event, 'chat');
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

els.chatSend.addEventListener('click', () => handleChat(els.chatInput.value));
els.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleChat(els.chatInput.value);
});

els.eventForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const event = {
    id: generateId(),
    title: els.eventTitle.value.trim(),
    date: els.eventDate.value,
    time: els.eventTime.value || null,
    category: els.eventCategory.value,
    priority: els.eventPriority.value,
    recurrence: els.eventRecurrence.value,
    recurrenceEnd: els.eventRecurrenceEnd.value || null,
    completed: false,
    completedDates: [],
  };
  if (event.title) {
    addEventWithConflictCheck(event, 'modal');
  }
});

// Conflict dialog buttons
els.conflictCancel.addEventListener('click', () => {
  closeConflictDialog();
});

els.conflictKeepBoth.addEventListener('click', () => {
  if (pendingConflictEvent) {
    const { event, source } = pendingConflictEvent;
    closeConflictDialog();
    commitAddEvent(event, source);
  }
});

els.conflictReplace.addEventListener('click', () => {
  if (pendingConflictEvent) {
    const { event, source } = pendingConflictEvent;
    // Delete the conflicting events
    conflictingEvents.forEach(c => {
      state.events = state.events.filter(e => e.id !== c.id);
      deleteEventFromSupabase(c.id);
    });
    saveEvents();
    closeConflictDialog();
    commitAddEvent(event, source);
    addChatMessage(`Replaced ${conflictingEvents.length} conflicting event${conflictingEvents.length > 1 ? 's' : ''}.`, 'bot');
  }
});

els.conflictOverlay.addEventListener('click', (e) => {
  if (e.target === els.conflictOverlay) closeConflictDialog();
});

// Show/hide recurrence end date when recurrence changes
els.eventRecurrence.addEventListener('change', () => {
  if (els.eventRecurrence.value !== 'none') {
    els.recurrenceEndRow.classList.remove('hidden');
  } else {
    els.recurrenceEndRow.classList.add('hidden');
    els.eventRecurrenceEnd.value = '';
  }
});

els.modalCancel.addEventListener('click', closeModal);
els.modalOverlay.addEventListener('click', (e) => {
  if (e.target === els.modalOverlay) closeModal();
});

// Focus mode toggle
els.focusToggle.addEventListener('click', toggleFocusMode);
els.focusClose.addEventListener('click', toggleFocusMode);

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!els.conflictOverlay.classList.contains('hidden')) closeConflictDialog();
    else if (state.focusMode) toggleFocusMode();
    else closeModal();
  }
});

// ===== Live Clock Update =====
function updateClock() {
  els.currentDate.textContent = formatDisplay(new Date());
}
setInterval(updateClock, 60000);

// ===== Auth =====
const authEls = {
  screen: $('#authScreen'),
  form: $('#authForm'),
  email: $('#authEmail'),
  password: $('#authPassword'),
  signIn: $('#authSignIn'),
  signUp: $('#authSignUp'),
  error: $('#authError'),
  info: $('#authInfo'),
  signOutBtn: $('#signOutBtn'),
  appMain: $('#appMain'),
};

function showAuthError(msg) {
  authEls.error.textContent = msg;
  authEls.error.classList.remove('hidden');
  authEls.info.classList.add('hidden');
}

function showAuthInfo(msg) {
  authEls.info.textContent = msg;
  authEls.info.classList.remove('hidden');
  authEls.error.classList.add('hidden');
}

function showApp() {
  authEls.screen.classList.add('hidden');
  authEls.appMain.classList.remove('hidden');
}

function showAuth() {
  authEls.screen.classList.remove('hidden');
  authEls.appMain.classList.add('hidden');
}

// ===== Real-Time Sync =====
let realtimeChannel = null;

function startRealtimeSync() {
  if (!state.user || realtimeChannel) return;

  realtimeChannel = db
    .channel('calendar-sync')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'calendar_events',
      filter: `user_id=eq.${state.user.id}`,
    }, (payload) => {
      if (payload.eventType === 'INSERT') {
        const newEvent = rowToEvent(payload.new);
        if (!state.events.find(e => e.id === newEvent.id)) {
          state.events.push(newEvent);
          saveEvents();
          render();
        }
      } else if (payload.eventType === 'UPDATE') {
        const updated = rowToEvent(payload.new);
        const idx = state.events.findIndex(e => e.id === updated.id);
        if (idx >= 0) {
          state.events[idx] = updated;
        } else {
          state.events.push(updated);
        }
        saveEvents();
        render();
        if (state.focusMode) renderFocusMode();
      } else if (payload.eventType === 'DELETE') {
        state.events = state.events.filter(e => e.id !== payload.old.id);
        saveEvents();
        render();
        if (state.focusMode) renderFocusMode();
      }
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'calendar_streaks',
      filter: `user_id=eq.${state.user.id}`,
    }, (payload) => {
      if (payload.new) {
        state.streaks = {
          current: payload.new.current_streak,
          best: payload.new.best_streak,
          lastCompletedDate: payload.new.last_completed_date,
        };
        localStorage.setItem('calendarStreaks', JSON.stringify(state.streaks));
        updateStreaks();
      }
    })
    .subscribe();
}

function stopRealtimeSync() {
  if (realtimeChannel) {
    db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

async function initApp(user) {
  state.user = user;

  // Try loading from Supabase first, fall back to localStorage
  try {
    await migrateLocalToSupabase();
    await loadFromSupabase();
  } catch (e) {
    // Offline fallback: load from localStorage
    state.events = JSON.parse(localStorage.getItem('calendarEvents') || '[]').map(ev => ({
      ...ev,
      completed: ev.completed || false,
      priority: ev.priority || 'medium',
      recurrence: ev.recurrence || 'none',
      recurrenceEnd: ev.recurrenceEnd || null,
      completedDates: ev.completedDates || [],
    }));
    state.streaks = JSON.parse(localStorage.getItem('calendarStreaks') || '{"current":0,"best":0,"lastCompletedDate":null}');
  }

  // Start real-time sync for cross-device updates
  startRealtimeSync();

  showApp();
  render();
}

function usernameToEmail(username) {
  // If user already typed an email, use it as-is
  if (username.includes('@')) return username;
  return `${username.toLowerCase()}@calendar.local`;
}

authEls.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = usernameToEmail(authEls.email.value.trim());
  const password = authEls.password.value;

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    showAuthError(error.message);
  } else {
    await initApp(data.user);
  }
});

authEls.signUp.addEventListener('click', async () => {
  const username = authEls.email.value.trim();
  const email = usernameToEmail(username);
  const password = authEls.password.value;

  if (!username || password.length < 6) {
    showAuthError('Enter a username and password (min 6 chars).');
    return;
  }

  const { data, error } = await db.auth.signUp({ email, password });
  if (error) {
    showAuthError(error.message);
  } else if (data.user && !data.user.confirmed_at && data.user.identities?.length === 0) {
    showAuthError('That username is already taken.');
  } else if (data.session) {
    await initApp(data.user);
  } else {
    showAuthInfo('Account created! You can now sign in.');
  }
});

authEls.signOutBtn.addEventListener('click', async () => {
  stopRealtimeSync();
  await db.auth.signOut();
  state.user = null;
  state.events = [];
  state.streaks = { current: 0, best: 0, lastCompletedDate: null };
  showAuth();
});

// ===== Check Existing Session =====
(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    await initApp(session.user);
  } else {
    showAuth();
  }
})();
