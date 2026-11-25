// ---------- State ----------
var STORAGE_KEY = 'studyPlanner.tasks';
var tasks = load();
var filter = 'all';
var query = '';
var sortBy = 'due';
var editingId = null;

// ---------- Elements ----------
var $ = function (id) { return document.getElementById(id); };
var form = $('taskForm'), titleInput = $('title'), subjectInput = $('subject');
var priorityInput = $('priority'), dueInput = $('due'), errorEl = $('error');
var listEl = $('list'), emptyEl = $('empty'), searchInput = $('search');
var sortSelect = $('sort'), filtersEl = $('filters');

// ---------- Storage ----------
function load() {
  try {
    var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) { /* storage unavailable */ }
}

// ---------- Helpers ----------
function todayString() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}
function formatDate(str) {
  var p = str.split('-');
  return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
var PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function visibleTasks() {
  var q = query.toLowerCase();
  var out = tasks.filter(function (t) {
    if (filter === 'active' && t.done) return false;
    if (filter === 'done' && !t.done) return false;
    return !q || t.title.toLowerCase().indexOf(q) !== -1 || t.subject.toLowerCase().indexOf(q) !== -1;
  });
  out.sort(function (a, b) {
    if (sortBy === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (sortBy === 'newest') return b.created - a.created;
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  });
  return out;
}

// ---------- Rendering ----------
function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildTask(t) {
  var today = todayString();
  var li = el('li', 'task ' + t.priority + (t.done ? ' done' : ''));
  li.dataset.id = t.id;

  var box = el('input');
  box.type = 'checkbox';
  box.checked = t.done;
  box.dataset.action = 'toggle';
  box.setAttribute('aria-label', 'Mark "' + t.title + '" as done');

  var body = el('div');
  if (t.id === editingId) {
    var input = el('input', 'edit-input');
    input.type = 'text';
    input.value = t.title;
    input.maxLength = 80;
    input.dataset.role = 'edit';
    input.setAttribute('aria-label', 'Edit task title');
    body.appendChild(input);
  } else {
    body.appendChild(el('div', 'name', t.title));
  }
  var meta = el('div', 'meta');
  meta.appendChild(el('span', 'tag', t.subject));
  meta.appendChild(el('span', 'tag', t.priority + ' priority'));
  if (t.due) {
    var overdue = !t.done && t.due < today;
    meta.appendChild(el('span', 'tag' + (overdue ? ' overdue' : ''), (overdue ? 'Overdue: ' : 'Due ') + formatDate(t.due)));
  }
  body.appendChild(meta);

  var actions = el('div', 'actions');
  if (t.id === editingId) {
    actions.appendChild(button('Save', 'save'));
    actions.appendChild(button('Cancel', 'cancel'));
  } else {
    actions.appendChild(button('Edit', 'edit'));
    actions.appendChild(button('Delete', 'delete'));
  }

  li.appendChild(box);
  li.appendChild(body);
  li.appendChild(actions);
  return li;
}
function button(label, action) {
  var b = el('button', 'small', label);
  b.type = 'button';
  b.dataset.action = action;
  return b;
}

function render() {
  var shown = visibleTasks();
  listEl.textContent = '';
  shown.forEach(function (t) { listEl.appendChild(buildTask(t)); });

  if (shown.length === 0) {
    emptyEl.hidden = false;
    emptyEl.textContent = tasks.length === 0
      ? 'Nothing planned yet. Add your first task above.'
      : 'No tasks match your search or filter.';
  } else {
    emptyEl.hidden = true;
  }

  var done = tasks.filter(function (t) { return t.done; }).length;
  var pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  $('barFill').style.width = pct + '%';
  $('percent').textContent = pct + '%';
  $('summary').textContent = tasks.length
    ? done + ' of ' + tasks.length + ' tasks done'
    : 'No tasks yet';
}

// ---------- Actions ----------
form.addEventListener('submit', function (e) {
  e.preventDefault();
  var title = titleInput.value.trim();
  if (!title) { errorEl.textContent = 'Enter a task title first.'; titleInput.focus(); return; }
  errorEl.textContent = '';
  tasks.push({
    id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
    title: title,
    subject: subjectInput.value,
    priority: priorityInput.value,
    due: dueInput.value,
    done: false,
    created: Date.now()
  });
  save();
  form.reset();
  priorityInput.value = 'medium';
  render();
});

// One listener handles every button and checkbox in the list (event delegation)
listEl.addEventListener('click', function (e) {
  var target = e.target.closest('[data-action]');
  if (!target) return;
  var li = target.closest('.task');
  var id = li.dataset.id;
  var action = target.dataset.action;
  var task = tasks.filter(function (t) { return t.id === id; })[0];

  if (action === 'toggle') { task.done = target.checked; save(); }
  if (action === 'delete') { tasks = tasks.filter(function (t) { return t.id !== id; }); save(); }
  if (action === 'edit') { editingId = id; }
  if (action === 'cancel') { editingId = null; }
  if (action === 'save') {
    var value = li.querySelector('[data-role="edit"]').value.trim();
    if (value) { task.title = value; save(); }
    editingId = null;
  }
  render();
  if (action === 'edit') {
    var field = listEl.querySelector('[data-role="edit"]');
    if (field) { field.focus(); field.select(); }
  }
});

listEl.addEventListener('keydown', function (e) {
  if (e.target.dataset.role !== 'edit') return;
  if (e.key === 'Enter') { e.target.closest('.task').querySelector('[data-action="save"]').click(); }
  if (e.key === 'Escape') { editingId = null; render(); }
});

searchInput.addEventListener('input', function () { query = searchInput.value.trim(); render(); });
sortSelect.addEventListener('change', function () { sortBy = sortSelect.value; render(); });

filtersEl.addEventListener('click', function (e) {
  var chip = e.target.closest('[data-filter]');
  if (!chip) return;
  filter = chip.dataset.filter;
  filtersEl.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
  render();
});

var clearBtn = $('clearDone'), clearTimer = null;
function resetClear() { clearTimeout(clearTimer); delete clearBtn.dataset.armed; clearBtn.textContent = 'Clear completed'; }

// Browsers can block confirm() pop-ups, so clearing takes two clicks instead
clearBtn.addEventListener('click', function () {
  var count = tasks.filter(function (t) { return t.done; }).length;
  if (!count) return;
  if (!clearBtn.dataset.armed) {
    clearBtn.dataset.armed = '1';
    clearBtn.textContent = 'Click again to remove ' + count;
    clearTimer = setTimeout(resetClear, 4000);
    return;
  }
  resetClear();
  tasks = tasks.filter(function (t) { return !t.done; });
  save();
  render();
});

// ---------- Theme ----------
var root = document.documentElement, themeBtn = $('themeBtn');
function setTheme(t) { root.setAttribute('data-theme', t); themeBtn.textContent = t === 'dark' ? 'Light' : 'Dark'; }
setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
themeBtn.addEventListener('click', function () { setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });

render();
