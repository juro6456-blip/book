const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "red123123";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const BOOK_PATH = path.join(DATA_DIR, "book.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const ALLOWED_THEMES = ["classic", "noir", "forest", "royal"];
const ALLOWED_PAPERS = ["warm", "white", "sepia"];

const defaultBook = {
  meta: {
    title: "Дом между строк",
    author: "Ваше имя",
    subtitle: "живая рукопись о том, что прячется в обычном дне",
    coverNote: "Каждая глава здесь выглядит как найденная страница: ее можно переписать, переставить и сразу открыть читателю.",
    theme: "classic",
    updatedAt: new Date().toISOString()
  },
  settings: {
    dropCap: true,
    paper: "warm",
    fontSize: 18,
    lineHeight: 1.72,
    pageWidth: 860
  },
  chapters: [
    {
      id: "chapter-1",
      title: "Дверь, которой вчера не было",
      epigraph: "Иногда история начинается не со слов, а с тихого щелчка замка.",
      body: "Утром Никлас заметил дверь в стене кладовой. Вчера там висели куртки, коробка с елочными игрушками и старая удочка отца. Сегодня между ними стояла узкая темная дверь с медной ручкой, теплой, будто ее только что держали в ладони.\n\nОн мог бы позвать взрослых. Мог бы закрыть кладовую и сделать вид, что ничего не случилось. Но за дверью кто-то тихо перевернул страницу.\n\n- Ты тоже это слышишь? - спросила Виола, появившись в коридоре так внезапно, словно сама вышла из стены.\n\n- Я надеялся, что нет.\n\nВиола улыбнулась и протянула ему фонарик.\n\n- Тогда пойдем проверим. Если дверь умеет появляться, она наверняка умеет и исчезать.\n\nНиклас нажал на ручку. Воздух пахнул чернилами, дождем и свежим хлебом. За порогом была не комната, а длинная библиотека под открытым небом. Полки уходили вдаль, между ними росла трава, а над книгами медленно проплывали облака.\n\nНа ближайшей странице лежала записка: \"Не ищите конец. Сначала найдите того, кто вырвал начало\".",
      note: "Глава задает тон: обычный дом превращается в портал, но главное чудо должно оставаться простым и личным."
    },
    {
      id: "chapter-2",
      title: "Чернила, которые отвечают",
      epigraph: "То, что записано честно, однажды начинает говорить.",
      body: "В библиотеке не было библиотекаря. Зато на каждом столе стояла чернильница, и в каждой чернильнице мерцала крошечная ночь.\n\nВиола открыла первую попавшуюся книгу. Страницы оказались пустыми.\n\n- Похоже, нас пригласили писать самим.\n\n- Или признаться, что мы ничего не знаем, - сказал Никлас.\n\nОн обмакнул перо и написал: \"Кто украл начало?\" Чернила на секунду стали серебряными, потом буквы поползли по бумаге, складываясь в новый ответ.\n\n\"Тот, кто боится своей первой фразы\".\n\nНиклас перечитал строку три раза. За дальними полками что-то шевельнулось. Не громко, не страшно, но достаточно, чтобы Виола закрыла книгу и прижала ее к груди.\n\n- Кажется, нас услышали.\n\n- Тогда надо говорить тише?\n\n- Нет, - сказала она. - Тогда надо говорить правду.",
      note: "Можно развить тему живой рукописи: книга отвечает на страхи героев и подталкивает их писать честнее."
    }
  ]
};

async function ensureBook() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(BOOK_PATH);
  } catch {
    await fs.writeFile(BOOK_PATH, JSON.stringify(defaultBook, null, 2), "utf8");
  }
}

async function readBook() {
  await ensureBook();
  const raw = await fs.readFile(BOOK_PATH, "utf8");
  return normalizeBook(JSON.parse(raw));
}

async function writeBook(book) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const next = normalizeBook(book);
  next.meta.updatedAt = new Date().toISOString();
  await fs.writeFile(BOOK_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function normalizeBook(input) {
  const meta = input && input.meta ? input.meta : {};
  const settings = input && input.settings ? input.settings : {};
  const rawChapters = Array.isArray(input && input.chapters) ? input.chapters : [];
  const chapters = rawChapters.length > 0 ? rawChapters : defaultBook.chapters;

  return {
    meta: {
      title: text(meta.title, defaultBook.meta.title, 140),
      author: text(meta.author, defaultBook.meta.author, 120),
      subtitle: text(meta.subtitle, "", 240),
      coverNote: text(meta.coverNote, "", 800),
      theme: ALLOWED_THEMES.includes(meta.theme) ? meta.theme : "classic",
      updatedAt: text(meta.updatedAt, new Date().toISOString(), 80)
    },
    settings: {
      dropCap: Boolean(settings.dropCap),
      paper: ALLOWED_PAPERS.includes(settings.paper) ? settings.paper : "warm",
      fontSize: number(settings.fontSize, 14, 28, 18),
      lineHeight: number(settings.lineHeight, 1.35, 2.2, 1.72),
      pageWidth: number(settings.pageWidth, 680, 1120, 860)
    },
    chapters: chapters.map((chapter, index) => ({
      id: text(chapter.id, `chapter-${Date.now()}-${index}`, 80),
      title: text(chapter.title, `Глава ${index + 1}`, 180),
      epigraph: text(chapter.epigraph, "", 500),
      body: text(chapter.body, "", 50000),
      note: text(chapter.note, "", 2000)
    }))
  };
}

function text(value, fallback, maxLength) {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function number(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2_000_000) throw new Error("Payload too large");
  }
  return JSON.parse(body || "{}");
}

function send(res, status, payload, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  if (Buffer.isBuffer(payload)) {
    res.end(payload);
    return;
  }
  res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
}

async function serveFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cleanPath = decodeURIComponent(url.pathname);
  const target = cleanPath === "/" ? "/index.html" : cleanPath === "/admin" ? "/admin.html" : cleanPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, target));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    send(res, 200, data, MIME[path.extname(filePath)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (needsAdminAccess(url.pathname, req.method) && !hasAdminAccess(req)) {
      res.writeHead(401, {
        "Content-Type": "text/plain; charset=utf-8",
        "WWW-Authenticate": 'Basic realm="Book Admin"',
        "Cache-Control": "no-store"
      });
      res.end("Нужен пароль администратора");
      return;
    }

    if (url.pathname === "/api/book" && req.method === "GET") {
      send(res, 200, await readBook());
      return;
    }

    if (url.pathname === "/api/book" && req.method === "PUT") {
      const payload = await readJson(req);
      send(res, 200, await writeBook(payload));
      return;
    }

    if (url.pathname === "/api/reset" && req.method === "POST") {
      const fresh = normalizeBook(defaultBook);
      fresh.meta.updatedAt = new Date().toISOString();
      await fs.writeFile(BOOK_PATH, JSON.stringify(fresh, null, 2), "utf8");
      send(res, 200, fresh);
      return;
    }

    if (req.method === "GET") {
      await serveFile(req, res);
      return;
    }

    send(res, 405, { error: "Метод не поддерживается" });
  } catch (error) {
    send(res, 500, { error: error.message || "Ошибка сервера" });
  }
});

ensureBook().then(() => {
  server.listen(PORT, () => {
    console.log(`Living book is running: http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    if (!ADMIN_PASSWORD) {
      console.log("Admin password is disabled. Set ADMIN_PASSWORD to protect editing.");
    }
  });
});

function needsAdminAccess(pathname, method) {
  return pathname === "/admin" ||
    pathname === "/admin.html" ||
    (pathname === "/api/book" && method === "PUT") ||
    (pathname === "/api/reset" && method === "POST");
}

function hasAdminAccess(req) {
  if (!ADMIN_PASSWORD) return true;
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const [, password] = decoded.split(":");
  return password === ADMIN_PASSWORD;
}
