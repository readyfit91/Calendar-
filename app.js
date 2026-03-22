// ===== State =====
const state = {
  events: JSON.parse(localStorage.getItem('calendarEvents') || '[]'),
  currentDate: new Date(),
  selectedDate: new Date(),
  view: 'month',
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
  modalCancel: $('#modalCancel'),
  modalTitle: $('#modalTitle'),
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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== Rendering =====
function render() {
  const today = new Date();
  els.currentDate.textContent = formatDisplay(today);
  els.todayLabel.textContent = formatDisplay(today);
  els.monthYear.textContent = formatMonthYear(state.currentDate);

  renderDailyObjectives(today);
  renderHorizon(today);

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

  els.dailyObjectives.innerHTML = events.map(e => `
    <li class="cat-${e.category}">
      ${e.time ? `<span class="event-item-time">${formatTime(e.time)}</span>` : ''}
      <span class="event-item-title">${escapeHtml(e.title)}</span>
      <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
    </li>
  `).join('');

  els.dailyObjectives.querySelectorAll('.event-item-delete').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteEvent(btn.dataset.id);
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
      html += `<li class="cat-${e.category}">
        ${e.time ? `<span class="event-item-time">${formatTime(e.time)}</span>` : ''}
        <span class="event-item-title">${escapeHtml(e.title)}</span>
        <button class="event-item-delete" data-id="${e.id}" title="Delete">&times;</button>
      </li>`;
    });
    html += '</div>';
  });

  els.horizonList.innerHTML = html;
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
  const prevMonthLast = new Date(year, month, 0);
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

  // Add click handlers
  els.calendarDays.querySelectorAll('.calendar-day').forEach(cell => {
    cell.addEventListener('click', () => {
      state.selectedDate = new Date(cell.dataset.date + 'T00:00:00');
      openModal(cell.dataset.date);
    });
  });
}

function buildDayCell(date, events, otherMonth, isToday) {
  const dateStr = formatDate(date);
  const classes = ['calendar-day'];
  if (otherMonth) classes.push('other-month');
  if (isToday) classes.push('today');

  let eventsHtml = '';
  const maxShow = 3;
  events.slice(0, maxShow).forEach(e => {
    eventsHtml += `<div class="day-event cat-${e.category}">${e.time ? formatTime(e.time) + ' ' : ''}${escapeHtml(e.title)}</div>`;
  });
  if (events.length > maxShow) {
    eventsHtml += `<div class="day-event-more">+${events.length - maxShow} more</div>`;
  }

  return `<div class="${classes.join(' ')}" data-date="${dateStr}">
    <div class="day-number">${date.getDate()}</div>
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
    const events = getEventsForDate(dateStr);
    const isToday = sameDay(d, today);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    html += `<div class="week-day-row${isToday ? ' today' : ''}" data-date="${dateStr}">
      <div class="week-day-label">
        <span class="week-day-name">${dayNames[i]}</span>
        <span class="week-day-date">${d.getDate()}</span>
      </div>
      <div class="week-day-events">
        ${events.map(e => `<div class="week-event cat-${e.category}">
          ${e.time ? `<span class="week-event-time">${formatTime(e.time)}</span>` : ''}
          ${escapeHtml(e.title)}
        </div>`).join('')}
      </div>
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
  saveEvents();
  render();
}

// ===== Modal =====
function openModal(dateStr) {
  els.eventDate.value = dateStr || formatDate(new Date());
  els.eventTitle.value = '';
  els.eventTime.value = '';
  els.eventCategory.value = 'objective';
  els.modalTitle.textContent = 'Add Event';
  els.modalOverlay.classList.remove('hidden');
  els.eventTitle.focus();
}

function closeModal() {
  els.modalOverlay.classList.add('hidden');
}

// ===== Chat Parser =====
function parseChat(text) {
  const result = { title: '', date: null, time: null, category: 'objective' };
  const lower = text.toLowerCase();

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

  // Parse time - look for patterns like "at 2pm", "at 14:00", "at 2:30 pm"
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

  // "today"
  if (lower.includes('today')) {
    result.date = todayStr;
  }
  // "tomorrow"
  else if (lower.includes('tomorrow')) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    result.date = formatDate(d);
  }
  // Day names: "on Monday", "next Friday", etc.
  else {
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

  // Explicit dates: "March 25", "March 25th", "3/25", "2026-03-25"
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

  // Numeric date: "3/25" or "03/25"
  const numDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numDateMatch && !result.date) {
    const m = parseInt(numDateMatch[1]);
    const d = parseInt(numDateMatch[2]);
    let y = numDateMatch[3] ? parseInt(numDateMatch[3]) : today.getFullYear();
    if (y < 100) y += 2000;
    result.date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Default to today if no date found
  if (!result.date) {
    result.date = todayStr;
  }

  // Clean title - remove date/time fragments
  let title = text;
  // Remove common filler phrases
  title = title.replace(/\b(on|at|by|for|next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/gi, '');
  title = title.replace(/\b(today|tomorrow)\b/gi, '');
  title = title.replace(monthPattern, '');
  title = title.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, '');
  title = title.replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '');
  title = title.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '');
  title = title.replace(/\s{2,}/g, ' ').trim();

  // Capitalize first letter
  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  result.title = title || text;
  return result;
}

function handleChat(text) {
  if (!text.trim()) return;

  // Add user message
  addChatMessage(text, 'user');

  // Parse
  const parsed = parseChat(text);
  const event = {
    id: generateId(),
    title: parsed.title,
    date: parsed.date,
    time: parsed.time,
    category: parsed.category,
  };

  addEvent(event);

  // Build response
  const dateObj = new Date(event.date + 'T00:00:00');
  const dateDisplay = formatDisplay(dateObj);
  const timeDisplay = event.time ? ` at ${formatTime(event.time)}` : '';
  const categoryLabels = {
    objective: 'objective', meeting: 'meeting', deadline: 'deadline',
    reminder: 'reminder', personal: 'personal event'
  };

  const response = `Added "${event.title}" as a ${categoryLabels[event.category]} on ${dateDisplay}${timeDisplay}.`;
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

// Close modal on Escape
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
