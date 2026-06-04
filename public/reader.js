let book = null;
let lastUpdatedAt = "";
let currentChapterIndex = -1;
let currentPageIndex = 0;
let chapterPages = [];
let totalPages = 0;
const COVER_PAGE_INDEX = -1;
const MAX_CHARS_PER_PAGE = 2600;

const els = {
  bookContent: document.getElementById("bookContent"),
  prev: document.getElementById("prevBtn"),
  next: document.getElementById("nextBtn"),
  pageSelect: document.getElementById("pageSelect"),
  syncStatus: document.getElementById("readerSyncStatus")
};

async function loadBook() {
  try {
    const response = await fetch("/api/book", { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить книгу");
    book = await response.json();
    lastUpdatedAt = book.meta.updatedAt;
    currentChapterIndex = COVER_PAGE_INDEX;
    currentPageIndex = 0;
    renderBook();
  } catch (error) {
    console.error("Error loading book:", error);
    els.bookContent.innerHTML = '<p class="error">Ошибка загрузки книги</p>';
  }
}

async function refreshBook() {
  try {
    const response = await fetch("/api/book", { cache: "no-store" });
    if (!response.ok) return;
    const nextBook = await response.json();
    if (!book || nextBook.meta.updatedAt !== lastUpdatedAt) {
      book = nextBook;
      lastUpdatedAt = book.meta.updatedAt;
      currentChapterIndex = clamp(currentChapterIndex, COVER_PAGE_INDEX, getBackCoverPageIndex());
      currentPageIndex = 0;
      setSyncStatus("Обновлено");
      renderBook();
    }
  } catch (error) {
    console.error("Error refreshing book:", error);
    setSyncStatus("Нет связи");
  }
}

function restoreReadingPosition() {
  if (!book) return;
  const savedPosition = localStorage.getItem(`book-position-${book.meta.title}`);
  if (!savedPosition) return;

  try {
    const pos = JSON.parse(savedPosition);
    if (pos.updatedAt === lastUpdatedAt) {
      const savedChapterIndex = Number(pos.chapterIndex);
      const savedPageIndex = Number(pos.pageIndex);
      currentChapterIndex = Number.isFinite(savedChapterIndex) ? savedChapterIndex : COVER_PAGE_INDEX;
      currentPageIndex = Number.isFinite(savedPageIndex) ? savedPageIndex : 0;
    }
  } catch {
    localStorage.removeItem(`book-position-${book.meta.title}`);
  }
}

function splitChapterIntoPages(body) {
  const paragraphs = splitParagraphs(body);
  const pages = [];
  let currentPage = [];
  let currentLength = 0;
  paragraphs.forEach((paragraph) => {
    if (currentLength + paragraph.length > MAX_CHARS_PER_PAGE && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentLength = 0;
    }
    currentPage.push(paragraph);
    currentLength += paragraph.length;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length ? pages : [["Текст главы пока пуст."]];
}

function renderBook() {
  if (!book) return;
  applyDesign();

  if (!book.chapters || book.chapters.length === 0) {
    els.bookContent.innerHTML = '<p class="error">Книга пуста</p>';
    return;
  }

  currentChapterIndex = clamp(currentChapterIndex, COVER_PAGE_INDEX, getBackCoverPageIndex());

  if (isCoverPage()) {
    chapterPages = [];
    totalPages = getTotalPages();
    currentPageIndex = 0;
    saveReadingPosition();
    els.bookContent.innerHTML = `${renderCover()}${renderFooter()}`;
    updateControls();
    updatePageSelector();
    return;
  }

  if (isBackCoverPage()) {
    chapterPages = [];
    totalPages = getTotalPages();
    currentPageIndex = 0;
    saveReadingPosition();
    els.bookContent.innerHTML = `${renderBackCover()}${renderFooter()}`;
    updateControls();
    updatePageSelector();
    return;
  }

  const chapter = book.chapters[currentChapterIndex];
  chapterPages = splitChapterIntoPages(chapter.body);
  totalPages = getTotalPages();
  currentPageIndex = clamp(currentPageIndex, 0, chapterPages.length - 1);

  const currentPageContent = chapterPages[currentPageIndex];
  saveReadingPosition();

  let content = "";

  if (currentPageIndex === 0) {
    content += renderChapterHeading(chapter);
  } else {
    content += `<p class="continued">Глава ${currentChapterIndex + 1} продолжается</p>`;
  }

  content += `
    <div class="chapter-body ${currentPageIndex === 0 ? "chapter-start" : ""}">
      ${currentPageContent.map(renderParagraph).join("")}
    </div>
  `;

  content += renderFooter();
  els.bookContent.innerHTML = content;
  updateControls();
  updatePageSelector();
}

function renderCover() {
  return `
    <section class="book-cover" aria-label="Обложка">
      <div class="cover-decoration"></div>
      <div class="cover-content">
        <p class="cover-label">Живая рукопись</p>
        <h1>${escapeHtml(book.meta.title)}</h1>
        <p class="author">${escapeHtml(book.meta.author)}</p>
        ${book.meta.subtitle ? `<p class="subtitle">${escapeHtml(book.meta.subtitle)}</p>` : ""}
        <div class="cover-separator"></div>
        ${book.meta.coverNote ? `<p class="cover-note">${escapeHtml(book.meta.coverNote)}</p>` : ""}
      </div>
    </section>
  `;
}

function renderBackCover() {
  return `
    <section class="book-cover back-cover" aria-label="Задняя обложка">
      <div class="cover-decoration"></div>
      <div class="cover-content">
        <p class="cover-label">Конец рукописи</p>
        <h1>${escapeHtml(book.meta.title)}</h1>
        <p class="author">${escapeHtml(book.meta.author)}</p>
        <div class="cover-separator"></div>
        <p class="cover-note">Вы дошли до последнего листа. Все главы сохранены в этой версии книги.</p>
      </div>
    </section>
  `;
}

function renderChapterHeading(chapter) {
  return `
    <header class="simple-chapter">
      <p class="chapter-number">Глава ${currentChapterIndex + 1}</p>
      <h2>${escapeHtml(chapter.title)}</h2>
      ${chapter.epigraph ? `<p class="epigraph">${escapeHtml(chapter.epigraph)}</p>` : ""}
    </header>
  `;
}

function renderParagraph(paragraph) {
  const isLineDialogue = isDialogue(paragraph);
  const normalized = isLineDialogue ? normalizeDialogue(paragraph) : paragraph;
  return `<p class="${isLineDialogue ? "dialogue" : ""}">${escapeHtml(normalized)}</p>`;
}

function renderFooter() {
  const globalPageNumber = getGlobalPageNumber(currentChapterIndex, currentPageIndex);
  return `
    <footer class="page-footer">
      <div class="page-indicator">Лист ${globalPageNumber} из ${totalPages}</div>
      <div class="progress-bar" aria-hidden="true">
        <div class="progress-fill" style="width: ${calculateProgress()}%"></div>
      </div>
    </footer>
  `;
}

function saveReadingPosition() {
  if (!book) return;
  const position = {
    chapterIndex: currentChapterIndex,
    pageIndex: currentPageIndex,
    updatedAt: lastUpdatedAt
  };
  localStorage.setItem(`book-position-${book.meta.title}`, JSON.stringify(position));
}

function calculateProgress() {
  if (!book || !book.chapters.length || totalPages === 0) return 0;
  return (getGlobalPageNumber(currentChapterIndex, currentPageIndex) / totalPages) * 100;
}

function updatePageSelector() {
  if (!book || !els.pageSelect) return;
  els.pageSelect.innerHTML = "";

  const coverOption = document.createElement("option");
  coverOption.value = "cover";
  coverOption.textContent = "Обложка · лист 1";
  coverOption.selected = isCoverPage();
  els.pageSelect.appendChild(coverOption);

  book.chapters.forEach((chapter, chapterIndex) => {
    const pages = splitChapterIntoPages(chapter.body);
    pages.forEach((_, pageIndex) => {
      const option = document.createElement("option");
      const globalPageNumber = getGlobalPageNumber(chapterIndex, pageIndex);
      option.value = `${chapterIndex}-${pageIndex}`;
      option.textContent = `Глава ${chapterIndex + 1}: ${chapter.title || "Без названия"} · лист ${globalPageNumber}`;
      option.selected = chapterIndex === currentChapterIndex && pageIndex === currentPageIndex;
      els.pageSelect.appendChild(option);
    });
  });

  const backCoverOption = document.createElement("option");
  backCoverOption.value = "back-cover";
  backCoverOption.textContent = `Задняя обложка · лист ${getTotalPages()}`;
  backCoverOption.selected = isBackCoverPage();
  els.pageSelect.appendChild(backCoverOption);
}

function getGlobalPageNumber(chapterIndex, pageIndex) {
  if (chapterIndex === COVER_PAGE_INDEX) return 1;
  if (chapterIndex === getBackCoverPageIndex()) return getTotalPages();

  let pagesBefore = 1;
  for (let i = 0; i < chapterIndex; i++) {
    pagesBefore += splitChapterIntoPages(book.chapters[i].body).length;
  }
  return pagesBefore + pageIndex + 1;
}

function getTotalPages() {
  return 2 + book.chapters.reduce((total, ch) => total + splitChapterIntoPages(ch.body).length, 0);
}

function getBackCoverPageIndex() {
  return book ? book.chapters.length : 0;
}

function applyDesign() {
  const theme = book.meta.theme || "classic";
  const paper = book.settings.paper || "warm";
  document.title = book.meta.title || "Книга";
  document.body.classList.remove("theme-classic", "theme-noir", "theme-forest", "theme-royal", "paper-warm", "paper-white", "paper-sepia", "has-dropcap");
  document.body.classList.add(`theme-${theme}`, `paper-${paper}`);
  if (book.settings.dropCap) document.body.classList.add("has-dropcap");

  document.documentElement.style.setProperty("--reader-font-size", `${book.settings.fontSize || 18}px`);
  document.documentElement.style.setProperty("--reader-line-height", book.settings.lineHeight || 1.72);
  document.documentElement.style.setProperty("--reader-page-width", `${book.settings.pageWidth || 860}px`);
}

function updateControls() {
  const isFirstPage = isCoverPage();
  const isLastPage = isBackCoverPage();
  els.prev.disabled = isFirstPage;
  els.next.disabled = isLastPage;
}

function goToPreviousPage() {
  if (isCoverPage()) return;

  if (isBackCoverPage()) {
    currentChapterIndex = book.chapters.length - 1;
    currentPageIndex = splitChapterIntoPages(book.chapters[currentChapterIndex].body).length - 1;
  } else if (currentPageIndex > 0) {
    currentPageIndex -= 1;
  } else if (currentChapterIndex > 0) {
    currentChapterIndex -= 1;
    currentPageIndex = splitChapterIntoPages(book.chapters[currentChapterIndex].body).length - 1;
  } else {
    currentChapterIndex = COVER_PAGE_INDEX;
    currentPageIndex = 0;
  }
  renderBook();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goToNextPage() {
  if (isCoverPage()) {
    currentChapterIndex = 0;
    currentPageIndex = 0;
    renderBook();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (currentPageIndex < chapterPages.length - 1) {
    currentPageIndex += 1;
  } else if (book && currentChapterIndex < book.chapters.length - 1) {
    currentChapterIndex += 1;
    currentPageIndex = 0;
  } else {
    currentChapterIndex = getBackCoverPageIndex();
    currentPageIndex = 0;
  }
  renderBook();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setSyncStatus(text) {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = text;
  clearTimeout(setSyncStatus.timer);
  setSyncStatus.timer = setTimeout(() => {
    els.syncStatus.textContent = "Живая рукопись";
  }, 1800);
}

function splitParagraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function isCoverPage() {
  return currentChapterIndex === COVER_PAGE_INDEX;
}

function isBackCoverPage() {
  return currentChapterIndex === getBackCoverPageIndex();
}

function isDialogue(text) {
  return /^[-—–]\s+/.test(text.trim());
}

function normalizeDialogue(text) {
  return text.trim().replace(/^[-—–]\s+/, "— ");
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

els.prev.addEventListener("click", goToPreviousPage);
els.next.addEventListener("click", goToNextPage);

els.pageSelect.addEventListener("change", () => {
  if (els.pageSelect.value === "cover") {
    currentChapterIndex = COVER_PAGE_INDEX;
    currentPageIndex = 0;
    renderBook();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (els.pageSelect.value === "back-cover") {
    currentChapterIndex = getBackCoverPageIndex();
    currentPageIndex = 0;
    renderBook();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const [chapterIndex, pageIndex] = els.pageSelect.value.split("-").map(Number);
  currentChapterIndex = chapterIndex;
  currentPageIndex = pageIndex;
  renderBook();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    if (!els.prev.disabled) goToPreviousPage();
  }
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    if (!els.next.disabled) goToNextPage();
  }
});

loadBook();
setInterval(refreshBook, 5000);
