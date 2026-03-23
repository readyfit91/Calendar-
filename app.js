// ===== State =====
const state = {
  events: JSON.parse(localStorage.getItem('calendarEvents') || '[]'),
  completions: JSON.parse(localStorage.getItem('calendarCompletions') || '{}'),
  currentDate: new Date(),
  selectedDate: new Date(),
  view: 'month',
  dragEvent: null,
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
  modalCancel: $('#modalCancel'),
  modalTitle: $('#modalTitle'),
  progressFill: $('#progressFill'),
  progressText: $('#progressText'),
  progressPercent: $('#progressPercent'),
  progressMessage: $('#progressMessage'),
  progressContainer: $('#progressContainer'),
  streakBadge: $('#streakBadge'),
  streakCount: $('#streakCount'),
  overdueSection: $('#overdueSection'),
  overdueList: $('#overdueList'),
  celebration: $('#celebration'),
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
    .sort((a, b) => {
      // Sort by priority first (high > medium > low), then by time
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const pa = priorityOrder[a.priority || 'medium'];
      const pb = priorityOrder[b.priority || 'medium'];
      if (pa !== pb) return pa - pb;
      return (a.time || '').localeCompare(b.time || '');
    });
}

function saveEvents() {
  localStorage.setItem('calendarEvents', JSON.stringify(state.events));
}

function saveCompletions() {
  localStorage.setItem('calendarCompletions', JSON.stringify(state.completions));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function isCompleted(eventId) {
  return !!state.completions[eventId];
}

function toggleComplete(eventId) {
  if (state.completions[eventId]) {
    delete state.completions[eventId];
  } else {
    state.completions[eventId] = Date.now();
  }
  saveCompletions();
  render();
  checkAllComplete();
}

function getPriorityIcon(priority) {
  switch (priority) {
    case 'high': return '<span class="priority-indicator priority-high" title="High priority">&#9650;</span>';
    case 'low': return '<span class="priority-indicator priority-low" title="Low priority">&#9660;</span>';
    default: return '';
  }
}

// ===== Progress & Streaks =====
function updateProgress() {
  const todayStr = formatDate(new Date());
  const todayEvents = getEventsForDate(todayStr);

  if (todayEvents.length === 0) {
    els.progressContainer.classList.add('no-tasks');
    els.progressText.textContent = 'No tasks today';
    els.progressPercent.textContent = '';
    els.progressFill.style.width = '0%';
    els.progressMessage.textContent = 'Add some objectives to get started!';
    return;
  }

  els.progressContainer.classList.remove('no-tasks');
  const completed = todayEvents.filter(e => isCompleted(e.id)).length;
  const total = todayEvents.length;
  const percent = Math.round((completed / total) * 100);

  els.progressText.textContent = `${completed} / ${total} completed`;
  els.progressPercent.textContent = `${percent}%`;
  els.progressFill.style.width = `${percent}%`;

  // Dynamic fill color
  if (percent === 100) {
    els.progressFill.className = 'progress-fill complete';
  } else if (percent >= 50) {
    els.progressFill.className = 'progress-fill good';
  } else {
    els.progressFill.className = 'progress-fill';
  }

  // Motivational messages
  if (percent === 100) {
    els.progressMessage.textContent = 'You crushed it today!';
    els.progressMessage.className = 'progress-message celebrate';
  } else if (percent >= 75) {
    els.progressMessage.textContent = 'Almost there, keep pushing!';
    els.progressMessage.className = 'progress-message';
  } else if (percent >= 50) {
    els.progressMessage.textContent = 'Halfway done, nice work!';
    els.progressMessage.className = 'progress-message';
  } else if (completed > 0) {
    els.progressMessage.textContent = 'Good start, keep going!';
    els.progressMessage.className = 'progress-message';
  } else {
    els.progressMessage.textContent = 'Start checking off your tasks!';
    els.progressMessage.className = 'progress-message';
  }
}

function calculateStreak() {
  const today = new Date();
  let streak = 0;

  // Check today first
  const todayStr = formatDate(today);
  const todayEvents = getEventsForDate(todayStr);
  const todayAllDone = todayEvents.length > 0 && todayEvents.every(e => isCompleted(e.id));

  // Go backwards from yesterday (or today if all done)
  const startOffset = todayAllDone ? 0 : 1;
  if (todayAllDone) streak = 1;

  for (let i = startOffset; i < 365; i++) {
    if (i === 0) continue; // already counted today
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const events = getEventsForDate(dateStr);

    if (events.length === 0) continue; // skip days with no tasks
    if (events.every(e => isCompleted(e.id))) {
      streak++;
    } else {
      break;
    }
  }

  els.streakCount.textContent = streak;
  els.streakBadge.classList.toggle('active', streak > 0);
}

function checkAllComplete() {
  const todayStr = formatDate(new Date());
  const todayEvents = getEventsForDate(todayStr);
  if (todayEvents.length > 0 && todayEvents.every(e => isCompleted(e.id))) {
    showCelebration();
  }
}

function showCelebration() {
  els.celebration.classList.remove('hidden');
  setTimeout(() => {
    els.celebration.classList.add('hidden');
  }, 2500);
}

// ===== Overdue =====
function renderOverdue() {
  const todayStr = formatDate(new Date());
  const overdue = state.events.filter(e => {
    return e.date < todayStr && !isCompleted(e.id);
  }).sort((a, b) => b.date.localeCompare(a.date));

  if (overdue.length === 0) {
    els.overdueSection.classList.add('hidden');
    return;
  }

  els.overdueSection.classList.remove('hidden');
  els.overdueList.innerHTML = overdue.map(e => {
    const dateObj = new Date(e.date + 'T00:00:00');
    const daysAgo = Math.floor((new Date() - dateObj) / (1000 * 60 * 60 * 24));
    return `<li class="overdue-item cat-${e.category}">
      <button class="task-check" data-id="${e.id}" title="Mark complete">&#10003;</button>
      <div class="overdue-item-content">
        ${getPriorityIcon(e.priority)}
        <span class="event-item-title">${escapeHtml(e.title)}</span>
        <span class="overdue-age">${daysAgo}d overdue</span>
      </div>
      <div class="overdue-actions">
        <button class="overdue-reschedule" data-id="${e.id}" title="Move to today">&#8634;</button>
        <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
      </div>
    </li>`;
  }).join('');

  // Attach handlers
  els.overdueList.querySelectorAll('.task-check').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleComplete(btn.dataset.id);
    });
  });

  els.overdueList.querySelectorAll('.overdue-reschedule').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      rescheduleToToday(btn.dataset.id);
    });
  });

  els.overdueList.querySelectorAll('.event-item-delete').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteEvent(btn.dataset.id);
    });
  });
}

function rescheduleToToday(id) {
  const event = state.events.find(e => e.id === id);
  if (event) {
    event.date = formatDate(new Date());
    saveEvents();
    render();
  }
}

// ===== Rendering =====
function render() {
  const today = new Date();
  els.currentDate.textContent = formatDisplay(today);
  els.todayLabel.textContent = formatDisplay(today);
  els.monthYear.textContent = formatMonthYear(state.currentDate);

  renderDailyObjectives(today);
  renderHorizon(today);
  renderOverdue();
  updateProgress();
  calculateStreak();

  if (state.view === 'month') {
    renderMonthView();
  } else {
    renderWeekView();
  }
}

function renderDailyObjectives(today) {
  const todayStr = formatDate(today);
  const events = getEventsForDate(todayStr);

  if (events.length === 0) {
    els.dailyObjectives.innerHTML = '<li class="empty-state">No objectives for today. Use the chat to add some!</li>';
    return;
  }

  els.dailyObjectives.innerHTML = events.map(e => {
    const done = isCompleted(e.id);
    return `
    <li class="cat-${e.category} ${done ? 'completed' : ''} priority-${e.priority || 'medium'}" draggable="true" data-event-id="${e.id}">
      <button class="task-check ${done ? 'checked' : ''}" data-id="${e.id}" title="${done ? 'Mark incomplete' : 'Mark complete'}">
        ${done ? '&#10003;' : ''}
      </button>
      ${getPriorityIcon(e.priority)}
      ${e.time ? `<span class="event-item-time">${formatTime(e.time)}</span>` : ''}
      <span class="event-item-title ${done ? 'done' : ''}">${escapeHtml(e.title)}</span>
      <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
    </li>`;
  }).join('');

  // Attach completion handlers
  els.dailyObjectives.querySelectorAll('.task-check').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleComplete(btn.dataset.id);
    });
  });

  els.dailyObjectives.querySelectorAll('.event-item-delete').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteEvent(btn.dataset.id);
    });
  });

  // Drag handlers for daily objectives
  els.dailyObjectives.querySelectorAll('li[draggable]').forEach(li => {
    li.addEventListener('dragstart', (ev) => {
      state.dragEvent = li.dataset.eventId;
      ev.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      state.dragEvent = null;
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
    html += `<div class="horizon-date-group"><div class="horizon-date-label">${formatShortDate(d)}</div>`;
    groups[dateStr].forEach(e => {
      const done = isCompleted(e.id);
      html += `<li class="cat-${e.category} ${done ? 'completed' : ''}">
        <button class="task-check ${done ? 'checked' : ''}" data-id="${e.id}" title="${done ? 'Mark incomplete' : 'Mark complete'}">
          ${done ? '&#10003;' : ''}
        </button>
        ${getPriorityIcon(e.priority)}
        ${e.time ? `<span class="event-item-time">${formatTime(e.time)}</span>` : ''}
        <span class="event-item-title ${done ? 'done' : ''}">${escapeHtml(e.title)}</span>
        <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
      </li>`;
    });
    html += '</div>';
  });

  els.horizonList.innerHTML = html;

  els.horizonList.querySelectorAll('.task-check').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleComplete(btn.dataset.id);
    });
  });

  els.horizonList.querySelectorAll('.event-item-delete').forEach(btn => {
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

  // Add click and drop handlers
  els.calendarDays.querySelectorAll('.calendar-day').forEach(cell => {
    cell.addEventListener('click', () => {
      state.selectedDate = new Date(cell.dataset.date + 'T00:00:00');
      openModal(cell.dataset.date);
    });

    // Drop zone for drag-and-drop
    cell.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', () => {
      cell.classList.remove('drag-over');
    });
    cell.addEventListener('drop', (ev) => {
      ev.preventDefault();
      cell.classList.remove('drag-over');
      if (state.dragEvent) {
        moveEventToDate(state.dragEvent, cell.dataset.date);
      }
    });
  });
}

function buildDayCell(date, events, otherMonth, isToday) {
  const dateStr = formatDate(date);
  const classes = ['calendar-day'];
  if (otherMonth) classes.push('other-month');
  if (isToday) classes.push('today');

  // Check if all events for this day are completed
  const allDone = events.length > 0 && events.every(e => isCompleted(e.id));
  if (allDone) classes.push('all-done');

  // Check for overdue incomplete tasks
  const todayStr = formatDate(new Date());
  const hasOverdue = !otherMonth && dateStr < todayStr && events.some(e => !isCompleted(e.id));
  if (hasOverdue) classes.push('has-overdue');

  let eventsHtml = '';
  const maxShow = 3;
  events.slice(0, maxShow).forEach(e => {
    const done = isCompleted(e.id);
    eventsHtml += `<div class="day-event cat-${e.category} ${done ? 'done' : ''}">${e.time ? formatTime(e.time) + ' ' : ''}${escapeHtml(e.title)}</div>`;
  });
  if (events.length > maxShow) {
    eventsHtml += `<div class="day-event-more">+${events.length - maxShow} more</div>`;
  }

  // Mini progress dot
  let progressDot = '';
  if (events.length > 0) {
    const completed = events.filter(e => isCompleted(e.id)).length;
    const pct = Math.round((completed / events.length) * 100);
    let dotClass = 'progress-dot';
    if (pct === 100) dotClass += ' dot-complete';
    else if (pct > 0) dotClass += ' dot-partial';
    progressDot = `<div class="${dotClass}" title="${completed}/${events.length} done"></div>`;
  }

  return `<div class="${classes.join(' ')}" data-date="${dateStr}">
    <div class="day-top">
      <div class="day-number">${date.getDate()}</div>
      ${progressDot}
    </div>
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
    const isToday = sameDay(d, today);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const isOverdue = dateStr < todayStr && events.some(e => !isCompleted(e.id));
    const allDone = events.length > 0 && events.every(e => isCompleted(e.id));

    html += `<div class="week-day-row${isToday ? ' today' : ''}${isOverdue ? ' overdue' : ''}${allDone ? ' all-done' : ''}" data-date="${dateStr}">
      <div class="week-day-label">
        <span class="week-day-name">${dayNames[i]}</span>
        <span class="week-day-date">${d.getDate()}</span>
        ${events.length > 0 ? `<span class="week-day-progress">${events.filter(e => isCompleted(e.id)).length}/${events.length}</span>` : ''}
      </div>
      <div class="week-day-events">
        ${events.map(e => {
          const done = isCompleted(e.id);
          return `<div class="week-event cat-${e.category} ${done ? 'done' : ''}" draggable="true" data-event-id="${e.id}">
            <button class="task-check-sm ${done ? 'checked' : ''}" data-id="${e.id}">
              ${done ? '&#10003;' : ''}
            </button>
            ${getPriorityIcon(e.priority)}
            ${e.time ? `<span class="week-event-time">${formatTime(e.time)}</span>` : ''}
            <span class="${done ? 'done-text' : ''}">${escapeHtml(e.title)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  els.weekGrid.innerHTML = html;

  // Click to add event
  els.weekGrid.querySelectorAll('.week-day-row').forEach(row => {
    row.addEventListener('click', (ev) => {
      if (ev.target.closest('.task-check-sm') || ev.target.closest('.week-event')) return;
      openModal(row.dataset.date);
    });

    // Drop zone
    row.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });
    row.addEventListener('drop', (ev) => {
      ev.preventDefault();
      row.classList.remove('drag-over');
      if (state.dragEvent) {
        moveEventToDate(state.dragEvent, row.dataset.date);
      }
    });
  });

  // Check handlers on week events
  els.weekGrid.querySelectorAll('.task-check-sm').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleComplete(btn.dataset.id);
    });
  });

  // Drag handlers on week events
  els.weekGrid.querySelectorAll('.week-event[draggable]').forEach(el => {
    el.addEventListener('dragstart', (ev) => {
      ev.stopPropagation();
      state.dragEvent = el.dataset.eventId;
      ev.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      state.dragEvent = null;
    });
  });
}

// ===== Drag & Drop =====
function moveEventToDate(eventId, newDate) {
  const event = state.events.find(e => e.id === eventId);
  if (event && event.date !== newDate) {
    event.date = newDate;
    saveEvents();
    render();
    addChatMessage(`Moved "${event.title}" to ${formatDisplay(new Date(newDate + 'T00:00:00'))}.`, 'bot');
  }
  state.dragEvent = null;
}

// ===== Events CRUD =====
function addEvent(event) {
  state.events.push(event);
  saveEvents();
  render();
}

function deleteEvent(id) {
  state.events = state.events.filter(e => e.id !== id);
  delete state.completions[id];
  saveEvents();
  saveCompletions();
  render();
}

// ===== Modal =====
function openModal(dateStr) {
  els.eventDate.value = dateStr || formatDate(new Date());
  els.eventTitle.value = '';
  els.eventTime.value = '';
  els.eventCategory.value = 'objective';
  els.eventPriority.value = 'medium';
  els.modalTitle.textContent = 'Add Event';
  els.modalOverlay.classList.remove('hidden');
  els.eventTitle.focus();
}

function closeModal() {
  els.modalOverlay.classList.add('hidden');
}

// ===== Chat Parser =====
function parseChat(text) {
  const result = { title: '', date: null, time: null, category: 'objective', priority: 'medium' };
  const lower = text.toLowerCase();

  // Detect priority
  if (lower.includes('!high') || lower.includes('!urgent') || lower.includes('!important')) {
    result.priority = 'high';
  } else if (lower.includes('!low')) {
    result.priority = 'low';
  }

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

  // Clean title
  let title = text;
  title = title.replace(/\s*!(high|medium|low|urgent|important)\b/gi, '');
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
  const event = {
    id: generateId(),
    title: parsed.title,
    date: parsed.date,
    time: parsed.time,
    category: parsed.category,
    priority: parsed.priority,
  };

  addEvent(event);

  const dateObj = new Date(event.date + 'T00:00:00');
  const dateDisplay = formatDisplay(dateObj);
  const timeDisplay = event.time ? ` at ${formatTime(event.time)}` : '';
  const categoryLabels = {
    objective: 'objective', meeting: 'meeting', deadline: 'deadline',
    reminder: 'reminder', personal: 'personal event'
  };
  const priorityLabel = event.priority !== 'medium' ? ` [${event.priority} priority]` : '';

  const response = `Added "${event.title}" as a ${categoryLabels[event.category]} on ${dateDisplay}${timeDisplay}${priorityLabel}.`;
  addChatMessage(response, 'bot');

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
  };
  if (event.title) {
    addEvent(event);
    closeModal();
  }
});

els.modalCancel.addEventListener('click', closeModal);
els.modalOverlay.addEventListener('click', (e) => {
  if (e.target === els.modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ===== Live Clock Update =====
function updateClock() {
  els.currentDate.textContent = formatDisplay(new Date());
}
setInterval(updateClock, 60000);

// ===== Initial Render =====
render();
