const STORAGE_KEY = "taskflow_v2_tasks";
const THEME_KEY = "taskflow_theme";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  taskForm: $("#taskForm"),
  taskInput: $("#taskInput"),
  categoryInput: $("#categoryInput"),
  priorityInput: $("#priorityInput"),
  dueDateInput: $("#dueDateInput"),
  editingId: $("#editingId"),
  taskList: $("#taskList"),
  filterTabs: $$(".filter-tab"),
  searchInput: $("#searchInput"),
  sortSelect: $("#sortSelect"),
  modalBackdrop: $("#modalBackdrop"),
  modalTitle: $("#modalTitle"),
  saveTaskBtn: $("#saveTaskBtn"),
  toast: $("#toast"),
  toastText: $("#toastText"),
  confettiLayer: $("#confettiLayer")
};

let tasks = loadTasks();
let activeFilter = "All";
let selectedWeekDate = dateKey(new Date());
let currentView = "dashboard";
let toastTimeout;

init();

function init() {
  applySavedTheme();
  setDateLabels();
  bindEvents();
  render();
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.filter(task =>
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.completed === "boolean" &&
      ["Work", "Personal", "Study"].includes(task.category) &&
      ["Low", "Medium", "High"].includes(task.priority)
    );
  } catch (error) {
    console.warn("AlmaTrix could not read saved tasks:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error("AlmaTrix could not save tasks:", error);
    showToast("Couldn't save. Check your browser storage settings.", "error");
    return false;
  }
}

function bindEvents() {
  elements.taskForm.addEventListener("submit", handleTaskSubmit);

  ["#addTaskBtn", "#topAddBtn"].forEach(selector => {
    $(selector).addEventListener("click", () => openModal());
  });

  ["#modalClose", "#cancelModal"].forEach(selector => {
    $(selector).addEventListener("click", closeModal);
  });

  elements.modalBackdrop.addEventListener("click", event => {
    if (event.target === elements.modalBackdrop) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      elements.searchInput.focus();
    }
  });

  elements.filterTabs.forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      elements.filterTabs.forEach(tab => tab.classList.toggle("active", tab === button));
      renderTasks();
    });
  });

  elements.searchInput.addEventListener("input", renderTasks);
  elements.sortSelect.addEventListener("change", renderTasks);

  elements.taskList.addEventListener("click", handleTaskAction);
  elements.taskList.addEventListener("change", handleTaskChange);

  $("#clearCompletedBtn").addEventListener("click", clearCompleted);
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#topThemeToggle").addEventListener("click", toggleTheme);
  $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  $$(".nav-item, .text-button[data-view]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $$(".category-link").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = "All";
      elements.filterTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.filter === "All"));
      elements.searchInput.value = "";
      setView("tasks");
      elements.searchInput.value = button.dataset.category;
      renderTasks();
    });
  });

  $("#weekStrip").addEventListener("click", event => {
    const dayButton = event.target.closest("[data-date]");
    if (!dayButton) return;
    selectedWeekDate = dayButton.dataset.date;
    setView("week");
    renderWeek();
    renderTasks();
  });
}

function setDateLabels() {
  const now = new Date();
  $("#topDate").textContent = new Intl.DateTimeFormat("en", {
    weekday: "short", day: "numeric", month: "short"
  }).format(now);
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";
  $("#pageTitle").innerHTML = `${greeting} <span>Let's make it count.</span>`;
}

function openModal(task = null) {
  elements.taskForm.reset();
  elements.editingId.value = task?.id || "";
  elements.modalTitle.textContent = task ? "Edit your task" : "Create a task";
  elements.saveTaskBtn.innerHTML = task ? "Save changes <span>→</span>" : "Create task <span>→</span>";
  if (task) {
    elements.taskInput.value = task.title;
    elements.categoryInput.value = task.category;
    elements.priorityInput.value = task.priority;
    elements.dueDateInput.value = task.dueDate || "";
  }
  elements.modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => elements.taskInput.focus(), 50);
}

function closeModal() {
  elements.modalBackdrop.hidden = true;
  document.body.style.overflow = "";
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const title = elements.taskInput.value.trim();
  if (!title) {
    elements.taskInput.focus();
    showToast("Please enter a task name.", "error");
    return;
  }

  const editingId = elements.editingId.value;
  const existingTask = tasks.find(task => task.id === editingId);
  const previousTasks = [...tasks];

  if (existingTask) {
    Object.assign(existingTask, {
      title,
      category: elements.categoryInput.value,
      priority: elements.priorityInput.value,
      dueDate: elements.dueDateInput.value
    });
  } else {
    tasks.unshift({
      id: makeId(),
      title,
      category: elements.categoryInput.value,
      priority: elements.priorityInput.value,
      dueDate: elements.dueDateInput.value,
      completed: false,
      createdAt: Date.now()
    });
  }

  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }

  closeModal();
  activeFilter = "All";
  elements.filterTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.filter === "All"));
  elements.searchInput.value = "";
  render();
  showToast(existingTask ? "Your changes have been saved." : "Task added. You're on a roll!");
}

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function handleTaskAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const row = button.closest("[data-id]");
  const task = tasks.find(item => item.id === row?.dataset.id);
  if (!task) return;

  if (button.dataset.action === "edit") {
    openModal(task);
    return;
  }

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete "${task.title}"?`)) return;
    const previousTasks = [...tasks];
    tasks = tasks.filter(item => item.id !== task.id);
    if (!saveTasks()) {
      tasks = previousTasks;
      return;
    }
    render();
    showToast("Task deleted.");
  }
}

function handleTaskChange(event) {
  if (!event.target.matches(".task-check")) return;
  const row = event.target.closest("[data-id]");
  const task = tasks.find(item => item.id === row?.dataset.id);
  if (!task) return;

  const oldStatus = task.completed;
  task.completed = event.target.checked;
  if (!saveTasks()) {
    task.completed = oldStatus;
    renderTasks();
    return;
  }

  render();
  if (task.completed) {
    showToast("Nice work! One more win. ✨");
    celebrate();
    if (tasks.length && tasks.every(item => item.completed)) {
      setTimeout(() => {
        showToast("All tasks complete — amazing work! 🎉");
        celebrate();
      }, 500);
    }
  } else {
    showToast("Task moved back to active.");
  }
}

function clearCompleted() {
  const completed = tasks.filter(task => task.completed);
  if (!completed.length) {
    showToast("No completed tasks to clear.");
    return;
  }
  if (!confirm(`Remove ${completed.length} completed task${completed.length === 1 ? "" : "s"}?`)) return;
  const previousTasks = [...tasks];
  tasks = tasks.filter(task => !task.completed);
  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }
  render();
  showToast("Completed tasks cleared.");
}

function getVisibleTasks() {
  const query = elements.searchInput.value.trim().toLowerCase();
  let visible = tasks.filter(task => {
    const matchesFilter = activeFilter === "All" ||
      (activeFilter === "Active" && !task.completed) ||
      (activeFilter === "Completed" && task.completed);
    const matchesSearch = !query ||
      task.title.toLowerCase().includes(query) ||
      task.category.toLowerCase().includes(query) ||
      task.priority.toLowerCase().includes(query);
    const matchesWeek = currentView !== "week" || task.dueDate === selectedWeekDate;
    return matchesFilter && matchesSearch && matchesWeek;
  });

  const sort = elements.sortSelect.value;
  visible.sort((a, b) => {
    if (sort === "due") return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
    if (sort === "priority") return ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]);
    if (sort === "alphabetical") return a.title.localeCompare(b.title);
    return b.createdAt - a.createdAt;
  });
  return visible;
}

function render() {
  renderStats();
  renderTasks();
  renderWeek();
  renderCategories();
}

function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const active = total - completed;
  const today = dateKey(new Date());
  const overdue = tasks.filter(task => !task.completed && task.dueDate && task.dueDate < today).length;
  const percent = total ? Math.round(completed / total * 100) : 0;

  $("#totalCount").textContent = total;
  $("#activeCount").textContent = active;
  $("#completedCount").textContent = completed;
  $("#overdueCount").textContent = overdue;
  $("#navTaskCount").textContent = total;
  $("#allTabCount").textContent = total;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressRing").style.setProperty("--progress", `${percent}%`);
  $("#progressBar").style.width = `${percent}%`;
  $("#legendCompleted").textContent = completed;
  $("#legendActive").textContent = active;
  $("#progressHeadline").textContent = total === 0 ? "Your journey starts here." :
    percent === 100 ? "You did it. Every task is done!" :
    percent >= 60 ? "You're building great momentum." : "Every little step counts.";
  $("#progressCopy").textContent = total === 0
    ? "Add a task and take the first step toward a more focused day."
    : `${completed} of ${total} task${total === 1 ? "" : "s"} completed. ${active ? "Keep going at your own pace." : "Enjoy that well-earned break."}`;
}

function renderCategories() {
  ["Work", "Personal", "Study"].forEach(category => {
    const id = category.toLowerCase() + "Count";
    $("#" + id).textContent = tasks.filter(task => task.category === category && !task.completed).length;
  });
}

function renderTasks() {
  const visible = getVisibleTasks();
  elements.taskList.replaceChildren();

  if (currentView === "week") {
    $("#taskSectionTitle").textContent = `Tasks for ${new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "short" }).format(new Date(`${selectedWeekDate}T12:00:00`))}`;
  } else if (currentView === "tasks") {
    $("#taskSectionTitle").textContent = "All your tasks";
  } else {
    $("#taskSectionTitle").textContent = "Your tasks";
  }

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const art = document.createElement("div");
    art.className = "empty-illustration";
    art.textContent = currentView === "week" ? "▦" : "✦";
    const title = document.createElement("strong");
    title.textContent = currentView === "week" ? "A little breathing room" : "Nothing on this list just yet";
    const copy = document.createElement("p");
    copy.textContent = currentView === "week"
      ? "No tasks due on this day. Pick another day or add a task with this due date."
      : "Try another filter, or add a task to get your momentum going.";
    empty.append(art, title, copy);
    elements.taskList.append(empty);
  } else {
    visible.forEach((task, index) => elements.taskList.append(createTaskRow(task, index)));
  }

  $("#listSummary").textContent = `Showing ${visible.length} of ${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
  $("#clearCompletedBtn").disabled = !tasks.some(task => task.completed);
}

function createTaskRow(task, index) {
  const row = document.createElement("article");
  row.className = `task-row${task.completed ? " completed" : ""}`;
  row.dataset.id = task.id;
  row.style.animationDelay = `${Math.min(index * 35, 210)}ms`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-check";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Mark ${task.title} ${task.completed ? "active" : "complete"}`);

  const main = document.createElement("div");
  main.className = "task-main";
  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  const category = document.createElement("span");
  category.className = `category-chip ${task.category.toLowerCase()}`;
  category.textContent = task.category;
  const priority = document.createElement("span");
  priority.className = `priority-chip ${task.priority.toLowerCase()}`;
  priority.textContent = `${task.priority === "High" ? "↑" : task.priority === "Low" ? "↓" : "•"} ${task.priority} priority`;
  meta.append(category, priority);

  if (task.dueDate) {
    const due = document.createElement("span");
    due.className = "due-chip";
    const today = dateKey(new Date());
    if (!task.completed && task.dueDate < today) {
      due.classList.add("overdue");
      due.textContent = `⚠ Overdue · ${formatDate(task.dueDate)}`;
    } else if (!task.completed && task.dueDate === today) {
      due.classList.add("today");
      due.textContent = `◷ Due today`;
    } else {
      due.textContent = `◷ ${formatDate(task.dueDate)}`;
    }
    meta.append(due);
  }

  main.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "task-action";
  edit.dataset.action = "edit";
  edit.title = "Edit task";
  edit.setAttribute("aria-label", `Edit ${task.title}`);
  edit.textContent = "✎";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "task-action delete";
  remove.dataset.action = "delete";
  remove.title = "Delete task";
  remove.setAttribute("aria-label", `Delete ${task.title}`);
  remove.textContent = "×";
  actions.append(edit, remove);
  row.append(checkbox, main, actions);
  return row;
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}

function renderWeek() {
  const strip = $("#weekStrip");
  strip.replaceChildren();
  const today = new Date();
  const start = new Date(today);
  const dayOffset = (today.getDay() + 6) % 7;
  start.setDate(today.getDate() - dayOffset);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dateKey(date);
    const dayTasks = tasks.filter(task => task.dueDate === key);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-card${selectedWeekDate === key ? " selected" : ""}`;
    button.dataset.date = key;
    const dayName = document.createElement("span");
    dayName.className = "day-name";
    dayName.textContent = new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = date.getDate();
    const count = document.createElement("span");
    count.className = "day-count";
    count.textContent = `${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"}`;
    button.append(dayName, dayNumber, count);
    strip.append(button);
  }
}

function setView(view) {
  currentView = view;
  document.body.classList.toggle("view-week", view === "week");
  document.body.classList.toggle("view-tasks", view === "tasks");
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $("#breadcrumbTitle").textContent = view === "week" ? "Weekly planner" : view === "tasks" ? "All tasks" : "Overview";
  $("#pageSubtitle").textContent = view === "week"
    ? "A clearer view of what your week holds."
    : view === "tasks" ? "Everything you need to do, all in one place." : "A little progress each day adds up to big results.";
  $("#sidebar").classList.remove("open");
  renderTasks();
  if (view === "week") {
    $("#tasksPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (view === "tasks") {
    $("#tasksPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function applySavedTheme() {
  let theme = "dark";
  try {
    theme = localStorage.getItem(THEME_KEY) || "dark";
  } catch {}
  document.body.classList.toggle("light", theme === "light");
  updateThemeControls(theme);
}

function toggleTheme() {
  const theme = document.body.classList.contains("light") ? "dark" : "light";
  document.body.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  updateThemeControls(theme);
  showToast(`${theme === "light" ? "Light" : "Dark"} mode enabled.`);
}

function updateThemeControls(theme) {
  $("#themeIcon").textContent = theme === "light" ? "☾" : "☼";
  $("#themeText").textContent = theme === "light" ? "Dark appearance" : "Light appearance";
  $("#topThemeToggle").textContent = theme === "light" ? "☾" : "☼";
  $("#topThemeToggle").title = `Switch to ${theme === "light" ? "dark" : "light"} mode`;
}

function showToast(text, type = "success") {
  clearTimeout(toastTimeout);
  elements.toastText.textContent = text;
  $(".toast-icon", elements.toast).textContent = type === "error" ? "!" : "✓";
  $(".toast-icon", elements.toast).style.background = type === "error" ? "var(--red)" : "var(--green)";
  elements.toast.classList.add("show");
  toastTimeout = setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

function celebrate() {
  const colors = ["#4b8bff", "#42d6a4", "#ffc36b", "#bd8bff", "#ff7788"];
  for (let i = 0; i < 42; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    piece.style.transform = `rotate(${Math.random() * 180}deg)`;
    elements.confettiLayer.append(piece);
    setTimeout(() => piece.remove(), 2400);
  }
}