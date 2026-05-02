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
  const text = newSubtaskInput.value.trim();
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
