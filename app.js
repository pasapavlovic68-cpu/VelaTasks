'use strict';

// ─── State ────────────────────────────────────────────────
const STORAGE_KEY = 'velaTasks_v1';
let tasks = [];
let currentTaskId = null;

// ─── DOM refs ─────────────────────────────────────────────
const taskListEl      = document.getElementById('taskList');
const emptyStateEl    = document.getElementById('emptyState');
const newTaskInput    = document.getElementById('newTaskInput');
const addTaskBtn      = document.getElementById('addTaskBtn');
const modalOverlay    = document.getElementById('modalOverlay');
const modalBackdrop   = document.getElementById('modalBackdrop');
const modalTitleEl    = document.getElementById('modalTitle');
const subtaskListEl   = document.getElementById('subtaskList');
const newSubtaskInput = document.getElementById('newSubtaskInput');
const addSubtaskBtn   = document.getElementById('addSubtaskBtn');
const closeModalBtn   = document.getElementById('closeModalBtn');
const saveModalBtn    = document.getElementById('saveModalBtn');

// ─── Persistence ──────────────────────────────────────────
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch { /* storage full – fail silently */ }
}

// ─── Helpers ──────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function isTaskDone(task) {
  return task.subtasks.length > 0 && task.subtasks.every(s => s.done);
}

// ─── Render: Task List ────────────────────────────────────
function renderTasks() {
  if (tasks.length === 0) {
    taskListEl.innerHTML = '';
    emptyStateEl.classList.remove('hidden');
    return;
  }
  emptyStateEl.classList.add('hidden');

  // Classify into three groups
  const inProgressTasks = [];
  const notStartedTasks = [];
  const completedTasks  = [];

  for (const task of tasks) {
    if (isTaskDone(task)) {
      completedTasks.push(task);
    } else if (task.subtasks.filter(s => s.done).length > 0) {
      inProgressTasks.push(task);
    } else {
      notStartedTasks.push(task);
    }
  }

  // In-progress: task with more done subtasks floats higher (stable sort)
  inProgressTasks.sort((a, b) =>
    b.subtasks.filter(s => s.done).length - a.subtasks.filter(s => s.done).length
  );

  const renderCard = (task) => {
    const total       = task.subtasks.length;
    const done        = task.subtasks.filter(s => s.done).length;
    const isCompleted = isTaskDone(task);
    const meta        = total === 0
      ? 'Нет подзадач'
      : `${done} из ${total} выполнено`;

    return `
      <div
        class="glass-card task-card ${isCompleted ? 'completed' : ''}"
        data-id="${task.id}"
        onclick="openModal('${task.id}')"
      >
        <div class="task-card-body">
          <div class="task-name">${escapeHtml(task.name)}</div>
          <div class="task-meta">${meta}</div>
        </div>
        <div class="task-card-right">
          <span class="status-pill ${isCompleted ? 'done' : 'in-progress'}">
            ${isCompleted ? 'Завершено' : 'В работе'}
          </span>
          <button
            class="btn-delete"
            onclick="deleteTask(event,'${task.id}')"
            aria-label="Удалить задачу"
          >✕</button>
        </div>
      </div>`;
  };

  // Active tasks: in-progress first, then not started
  let html = [...inProgressTasks, ...notStartedTasks].map(renderCard).join('');

  // Completed section (only if non-empty)
  if (completedTasks.length > 0) {
    html += `<div class="section-heading">Выполненные задачи</div>`;
    html += `<div class="completed-section">${completedTasks.map(renderCard).join('')}</div>`;
  }

  taskListEl.innerHTML = html;
}

// ─── Render: Subtask List (inside modal) ──────────────────
function renderSubtasks() {
  const task = tasks.find(t => t.id === currentTaskId);
  if (!task) return;

  if (task.subtasks.length === 0) {
    subtaskListEl.innerHTML =
      `<div class="subtask-empty">Нет подзадач — добавь первую</div>`;
    return;
  }

  subtaskListEl.innerHTML = task.subtasks.map(sub => `
    <div class="subtask-row ${sub.done ? 'row-done' : ''}" data-sub="${sub.id}">
      <span class="subtask-text">${escapeHtml(sub.text)}</span>
      <button class="btn-sub-edit" onclick="startEditSubtask('${sub.id}')" aria-label="Редактировать">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M7.5 1.5L9.5 3.5L3.5 9.5H1.5V7.5L7.5 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="btn-sub-delete" onclick="deleteSubtask('${sub.id}')" aria-label="Удалить">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 3h8M4 3V2h3v1M3.5 3L4 9.5h3L7.5 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <label class="toggle" aria-label="Выполнено">
        <input
          type="checkbox"
          ${sub.done ? 'checked' : ''}
          onchange="toggleSubtask('${sub.id}')"
        >
        <span class="toggle-track"></span>
      </label>
    </div>`
  ).join('');
}

// ─── Actions ──────────────────────────────────────────────
function addTask() {
  const name = newTaskInput.value.trim();
  if (!name) return;

  tasks.unshift({
    id: uid(),
    name,
    subtasks: [],
    createdAt: Date.now()
  });

  saveTasks();
  newTaskInput.value = '';
  renderTasks();
}

function deleteTask(event, taskId) {
  event.stopPropagation();
  tasks = tasks.filter(t => t.id !== taskId);
  saveTasks();
  renderTasks();
}

function openModal(taskId) {
  currentTaskId = taskId;
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  modalTitleEl.textContent = task.name;
  renderSubtasks();

  modalOverlay.classList.add('visible');
  modalOverlay.setAttribute('aria-hidden', 'false');

  // Focus input after transition
  setTimeout(() => newSubtaskInput.focus(), 360);
}

function closeModal() {
  modalOverlay.classList.remove('visible');
  modalOverlay.setAttribute('aria-hidden', 'true');
  currentTaskId = null;
  newSubtaskInput.value = '';
}

function addSubtask() {
  if (!currentTaskId) return;
  const text = newSubtaskInput.value.trim().replace(/[\r\n]+/g, ' ');
  if (!text) return;

  const task = tasks.find(t => t.id === currentTaskId);
  if (!task) return;

  task.subtasks.push({ id: uid(), text, done: false });
  saveTasks();
  newSubtaskInput.value = '';
  renderSubtasks();
  renderTasks();

  // Scroll subtask list to bottom so new item is visible
  requestAnimationFrame(() => {
    const wrapper = subtaskListEl.parentElement;
    wrapper.scrollTop = wrapper.scrollHeight;
  });
}

function startEditSubtask(subId) {
  const task = tasks.find(t => t.id === currentTaskId);
  if (!task) return;
  const sub = task.subtasks.find(s => s.id === subId);
  if (!sub) return;

  const row = subtaskListEl.querySelector(`[data-sub="${subId}"]`);
  if (!row) return;

  row.innerHTML = `
    <input
      class="subtask-edit-input"
      value="${escapeHtml(sub.text)}"
      maxlength="300"
      autocomplete="off"
      spellcheck="false"
    >
    <button class="btn-sub-save" onclick="saveEditSubtask('${subId}')" aria-label="Сохранить">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <button class="btn-sub-cancel" onclick="renderSubtasks()" aria-label="Отменить">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>
  `;

  const input = row.querySelector('.subtask-edit-input');
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveEditSubtask(subId); }
    if (e.key === 'Escape') { e.preventDefault(); renderSubtasks(); }
  });
}

function saveEditSubtask(subId) {
  const task = tasks.find(t => t.id === currentTaskId);
  if (!task) return;

  const row = subtaskListEl.querySelector(`[data-sub="${subId}"]`);
  if (!row) return;

  const input = row.querySelector('.subtask-edit-input');
  if (!input) return;

  const text = input.value.trim().replace(/[\r\n]+/g, ' ');
  if (!text) return;

  const sub = task.subtasks.find(s => s.id === subId);
  if (!sub) return;

  sub.text = text;
  saveTasks();
  renderSubtasks();
}

function deleteSubtask(subId) {
  const task = tasks.find(t => t.id === currentTaskId);
  if (!task) return;

  task.subtasks = task.subtasks.filter(s => s.id !== subId);
  saveTasks();
  renderSubtasks();
  renderTasks();
}

function toggleSubtask(subtaskId) {
  if (!currentTaskId) return;
  const task = tasks.find(t => t.id === currentTaskId);
  if (!task) return;

  const sub = task.subtasks.find(s => s.id === subtaskId);
  if (!sub) return;

  sub.done = !sub.done;
  saveTasks();
  renderSubtasks();
  renderTasks();
}

// ─── Event Listeners ──────────────────────────────────────
addTaskBtn.addEventListener('click', addTask);

newTaskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addTask(); }
});

addSubtaskBtn.addEventListener('click', addSubtask);

newSubtaskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }
});

closeModalBtn.addEventListener('click', closeModal);
saveModalBtn.addEventListener('click', closeModal);

// Close on backdrop tap
modalBackdrop.addEventListener('click', closeModal);

// Prevent touches inside modal from closing it
document.getElementById('modal').addEventListener('click', e => e.stopPropagation());

// ─── Init ─────────────────────────────────────────────────
loadTasks();
renderTasks();
