let book = null;
let selectedChapter = 0;
let saveTimer = null;
let dirty = false;
let saving = false;

const $ = (id) => document.getElementById(id);

const fields = {
  title: $("titleInput"),
  author: $("authorInput"),
  subtitle: $("subtitleInput"),
  coverNote: $("coverNoteInput"),
  theme: $("themeInput"),
  paper: $("paperInput"),
  dropCap: $("dropCapInput"),
  fontSize: $("fontSizeInput"),
  lineHeight: $("lineHeightInput"),
  pageWidth: $("pageWidthInput"),
  chapterTitle: $("chapterTitleInput"),
  chapterEpigraph: $("chapterEpigraphInput"),
  chapterBody: $("chapterBodyInput"),
  chapterNote: $("chapterNoteInput"),
  chapterSearch: $("chapterSearchInput")
};

const ui = {
  saveStatus: $("saveStatus"),
  chapterList: $("chapterList"),
  chapterCount: $("chapterCount"),
  wordCount: $("wordCount"),
  charCount: $("charCount"),
  currentChapterStats: $("currentChapterStats"),
  chapterEditorTitle: $("chapterEditorTitle"),
  previewTitle: $("previewTitle"),
  chapterPreview: $("chapterPreview"),
  fontSizeValue: $("fontSizeValue"),
  lineHeightValue: $("lineHeightValue"),
  pageWidthValue: $("pageWidthValue"),
  moveUp: $("moveUpBtn"),
  moveDown: $("moveDownBtn")
};

async function loadBook() {
  setStatus("Загружаю...", "saving");
  try {
    const response = await fetch("/api/book", { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить книгу");
    book = await response.json();
    selectedChapter = clamp(selectedChapter, 0, book.chapters.length - 1);
    renderForm();
    setStatus("Готово", "idle");
  } catch (error) {
    setStatus(error.message || "Ошибка загрузки", "error");
  }
}

function renderForm() {
  if (!book) return;
  selectedChapter = clamp(selectedChapter, 0, book.chapters.length - 1);

  fields.title.value = book.meta.title || "";
  fields.author.value = book.meta.author || "";
  fields.subtitle.value = book.meta.subtitle || "";
  fields.coverNote.value = book.meta.coverNote || "";
  fields.theme.value = book.meta.theme || "classic";
  fields.paper.value = book.settings.paper || "warm";
  fields.dropCap.checked = Boolean(book.settings.dropCap);
  fields.fontSize.value = book.settings.fontSize || 18;
  fields.lineHeight.value = book.settings.lineHeight || 1.72;
  fields.pageWidth.value = book.settings.pageWidth || 860;

  renderChapterEditor();
  renderChapterList();
  updateRangeLabels();
  updateStats();
  updatePreview();
}

function renderChapterList() {
  const query = (fields.chapterSearch.value || "").trim().toLowerCase();
  ui.chapterList.innerHTML = "";

  book.chapters.forEach((chapter, index) => {
    const haystack = `${chapter.title} ${chapter.epigraph} ${chapter.body} ${chapter.note}`.toLowerCase();
    if (query && !haystack.includes(query)) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chapter-item";
    button.classList.toggle("active", index === selectedChapter);
    button.innerHTML = `
      <span class="chapter-item-number">${index + 1}</span>
      <span class="chapter-item-main">
        <strong>${escapeHtml(chapter.title || `Глава ${index + 1}`)}</strong>
        <small>${countWords(chapter.body)} слов · ${chapter.note ? "есть заметка" : "без заметки"}</small>
      </span>
    `;
    button.addEventListener("click", () => {
      syncAll();
      selectedChapter = index;
      renderChapterEditor();
      renderChapterList();
      updateStats();
      updatePreview();
    });
    ui.chapterList.append(button);
  });

  if (!ui.chapterList.children.length) {
    ui.chapterList.innerHTML = '<p class="empty-state">Ничего не найдено</p>';
  }
}

function renderChapterEditor() {
  const chapter = getCurrentChapter();
  if (!chapter) return;

  fields.chapterTitle.value = chapter.title || "";
  fields.chapterEpigraph.value = chapter.epigraph || "";
  fields.chapterBody.value = chapter.body || "";
  fields.chapterNote.value = chapter.note || "";
  ui.chapterEditorTitle.textContent = chapter.title || "Новая глава";
  ui.moveUp.disabled = selectedChapter === 0;
  ui.moveDown.disabled = selectedChapter === book.chapters.length - 1;
}

function syncAll() {
  syncMeta();
  syncChapter();
}

function syncMeta() {
  book.meta.title = fields.title.value.trim() || "Без названия";
  book.meta.author = fields.author.value.trim() || "Автор";
  book.meta.subtitle = fields.subtitle.value.trim();
  book.meta.coverNote = fields.coverNote.value.trim();
  book.meta.theme = fields.theme.value;
  book.settings.paper = fields.paper.value;
  book.settings.dropCap = fields.dropCap.checked;
  book.settings.fontSize = Number(fields.fontSize.value);
  book.settings.lineHeight = Number(fields.lineHeight.value);
  book.settings.pageWidth = Number(fields.pageWidth.value);
}

function syncChapter() {
  const chapter = getCurrentChapter();
  if (!chapter) return;
  chapter.title = fields.chapterTitle.value.trim() || `Глава ${selectedChapter + 1}`;
  chapter.epigraph = fields.chapterEpigraph.value.trim();
  chapter.body = fields.chapterBody.value;
  chapter.note = fields.chapterNote.value.trim();
}

async function saveBook() {
  if (!book || saving) return;
  clearTimeout(saveTimer);
  syncAll();
  saving = true;
  setStatus("Сохраняю...", "saving");

  try {
    const response = await fetch("/api/book", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(book)
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Сервер не принял изменения");
    }
    book = await response.json();
    selectedChapter = clamp(selectedChapter, 0, book.chapters.length - 1);
    dirty = false;
    renderChapterList();
    updateStats();
    setStatus(`Сохранено ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`, "saved");
  } catch (error) {
    setStatus(error.message || "Ошибка сохранения", "error");
  } finally {
    saving = false;
  }
}

function scheduleSave() {
  if (!book) return;
  syncAll();
  dirty = true;
  updateRangeLabels();
  updateStats();
  updatePreview();
  renderChapterList();
  setStatus("Есть изменения", "dirty");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBook, 800);
}

function setStatus(text, state = "idle") {
  ui.saveStatus.textContent = text;
  ui.saveStatus.className = `save-status is-${state}`;
}

function addChapter() {
  syncAll();
  const nextNumber = book.chapters.length + 1;
  book.chapters.push({
    id: `chapter-${Date.now()}`,
    title: `Новая глава ${nextNumber}`,
    epigraph: "",
    body: "Начните писать здесь...",
    note: ""
  });
  selectedChapter = book.chapters.length - 1;
  renderForm();
  scheduleSave();
  fields.chapterTitle.focus();
  fields.chapterTitle.select();
}

function duplicateChapter() {
  const chapter = getCurrentChapter();
  if (!chapter) return;
  syncAll();
  const copy = {
    ...chapter,
    id: `chapter-${Date.now()}`,
    title: `${chapter.title} — копия`
  };
  book.chapters.splice(selectedChapter + 1, 0, copy);
  selectedChapter += 1;
  renderForm();
  scheduleSave();
}

function deleteChapter() {
  if (book.chapters.length <= 1) {
    setStatus("Нельзя удалить последнюю главу", "error");
    return;
  }
  const chapter = getCurrentChapter();
  if (!window.confirm(`Удалить главу «${chapter.title}»?`)) return;
  book.chapters.splice(selectedChapter, 1);
  selectedChapter = clamp(selectedChapter, 0, book.chapters.length - 1);
  renderForm();
  scheduleSave();
}

function moveChapter(direction) {
  const nextIndex = selectedChapter + direction;
  if (nextIndex < 0 || nextIndex >= book.chapters.length) return;
  syncAll();
  const [chapter] = book.chapters.splice(selectedChapter, 1);
  book.chapters.splice(nextIndex, 0, chapter);
  selectedChapter = nextIndex;
  renderForm();
  scheduleSave();
}

function updateRangeLabels() {
  ui.fontSizeValue.textContent = `${fields.fontSize.value}px`;
  ui.lineHeightValue.textContent = Number(fields.lineHeight.value).toFixed(2);
  ui.pageWidthValue.textContent = `${fields.pageWidth.value}px`;
}

function updateStats() {
  const text = book.chapters.map((chapter) => chapter.body || "").join("\n");
  const current = getCurrentChapter();
  ui.chapterCount.textContent = book.chapters.length;
  ui.wordCount.textContent = formatNumber(countWords(text));
  ui.charCount.textContent = formatNumber(text.replace(/\s/g, "").length);
  ui.currentChapterStats.textContent = `${formatNumber(countWords(current.body))} слов · ${formatNumber((current.body || "").length)} знаков`;
  ui.chapterEditorTitle.textContent = current.title || "Новая глава";
}

function updatePreview() {
  const chapter = getCurrentChapter();
  ui.previewTitle.textContent = chapter.title || "Глава";
  const paragraphs = splitParagraphs(chapter.body).slice(0, 5);
  ui.chapterPreview.innerHTML = paragraphs.length
    ? paragraphs.map((paragraph) => `<p class="${isDialogue(paragraph) ? "dialogue" : ""}">${escapeHtml(normalizeDialogue(paragraph))}</p>`).join("")
    : '<p class="muted-preview">В этой главе пока нет текста.</p>';
}

function getCurrentChapter() {
  return book && book.chapters[selectedChapter];
}

function splitParagraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function isDialogue(text) {
  return /^[-—–]\s+/.test(text.trim());
}

function normalizeDialogue(text) {
  return text.trim().replace(/^[-—–]\s+/, "— ");
}

function countWords(text) {
  const matches = String(text || "").trim().match(/[A-Za-zА-Яа-яЁё0-9]+(?:[-'][A-Za-zА-Яа-яЁё0-9]+)?/g);
  return matches ? matches.length : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value || 0);
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

Object.values(fields).forEach((field) => {
  if (!field) return;
  const eventName = field.type === "search" ? "input" : "input";
  field.addEventListener(eventName, field === fields.chapterSearch ? renderChapterList : scheduleSave);
  field.addEventListener("change", field === fields.chapterSearch ? renderChapterList : scheduleSave);
});

$("saveBtn").addEventListener("click", saveBook);
$("addChapterBtn").addEventListener("click", addChapter);
$("duplicateChapterBtn").addEventListener("click", duplicateChapter);
$("deleteChapterBtn").addEventListener("click", deleteChapter);
$("moveUpBtn").addEventListener("click", () => moveChapter(-1));
$("moveDownBtn").addEventListener("click", () => moveChapter(1));

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveBook();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

loadBook();
