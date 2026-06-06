const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const UPLOADS_DIR = path.join(__dirname, 'images', 'uploads');

// ── helpers ──────────────────────────────────────────────────────────────────

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return file.endsWith('users.json') ? {} : file.endsWith('settings.json') ? {} : []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

// ── middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'rbc-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

// Image upload config
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// Serve static files (public website)
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html']
}));

// Auth guard for admin routes
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── AUTH API ──────────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users[username];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.user = { username: user.username, displayName: user.displayName, role: user.role };
  res.json({ ok: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) return res.json(req.session.user);
  res.status(401).json({ error: 'Not logged in' });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const users = readJSON(USERS_FILE);
  const user = users[req.session.user.username];
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ error: 'Current password is incorrect' });
  user.password = bcrypt.hashSync(newPassword, 10);
  writeJSON(USERS_FILE, users);
  res.json({ ok: true });
});

app.post('/api/update-profile', requireAuth, (req, res) => {
  const { displayName } = req.body;
  if (!displayName || !displayName.trim())
    return res.status(400).json({ error: 'Display name required' });
  const users = readJSON(USERS_FILE);
  const user = users[req.session.user.username];
  user.displayName = displayName.trim();
  writeJSON(USERS_FILE, users);
  req.session.user.displayName = user.displayName;
  res.json({ ok: true, displayName: user.displayName });
});

// ── ARTICLES API ──────────────────────────────────────────────────────────────

// Public — get published articles
app.get('/api/articles', (req, res) => {
  let articles = readJSON(ARTICLES_FILE);
  const { category, limit, search } = req.query;
  // Only return published articles to public
  const isAdmin = req.session && req.session.user;
  if (!isAdmin) articles = articles.filter(a => a.status === 'published');
  if (category && category !== 'all') articles = articles.filter(a => a.category === category);
  if (search) {
    const q = search.toLowerCase();
    articles = articles.filter(a =>
      a.title.toLowerCase().includes(q) || (a.excerpt || '').toLowerCase().includes(q)
    );
  }
  articles = articles.sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
  if (limit) articles = articles.slice(0, parseInt(limit));
  res.json(articles);
});

// Public — get single article by slug
app.get('/api/articles/:idOrSlug', (req, res) => {
  const articles = readJSON(ARTICLES_FILE);
  const isAdmin = req.session && req.session.user;
  const article = articles.find(a => a.id === req.params.idOrSlug || a.slug === req.params.idOrSlug);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  if (!isAdmin && article.status !== 'published') return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

// Admin — create article
app.post('/api/articles', requireAuth, (req, res) => {
  const { title, subtitle, body, category, tags, status, heroEmoji, imageCaption } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const articles = readJSON(ARTICLES_FILE);
  let slug = slugify(title);
  // Ensure slug uniqueness
  let slugBase = slug, i = 2;
  while (articles.find(a => a.slug === slug)) slug = `${slugBase}-${i++}`;

  const now = new Date().toISOString();
  const article = {
    id: generateId(),
    slug,
    title: title.trim(),
    subtitle: (subtitle || '').trim(),
    body: body || '',
    category: category || 'Uncategorised',
    tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    status: status || 'draft',
    heroEmoji: heroEmoji || '📰',
    imageCaption: imageCaption || '',
    author: req.session.user.displayName,
    authorUsername: req.session.user.username,
    createdAt: now,
    publishedAt: status === 'published' ? now : null,
    updatedAt: now
  };
  articles.unshift(article);
  writeJSON(ARTICLES_FILE, articles);
  res.json({ ok: true, article });
});

// Admin — update article
app.put('/api/articles/:id', requireAuth, (req, res) => {
  const articles = readJSON(ARTICLES_FILE);
  const idx = articles.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article not found' });
  const { title, subtitle, body, category, tags, status, heroEmoji, imageCaption } = req.body;
  const existing = articles[idx];
  const wasPublished = existing.status === 'published';
  const now = new Date().toISOString();

  // Re-slug only if title changed
  let slug = existing.slug;
  if (title && title.trim() !== existing.title) {
    slug = slugify(title);
    let slugBase = slug, i = 2;
    while (articles.find((a, i2) => a.slug === slug && i2 !== idx)) slug = `${slugBase}-${i++}`;
  }

  Object.assign(articles[idx], {
    title: (title || existing.title).trim(),
    subtitle: (subtitle !== undefined ? subtitle : existing.subtitle).trim(),
    body: body !== undefined ? body : existing.body,
    category: category || existing.category,
    tags: tags !== undefined ? tags.split(',').map(t => t.trim()).filter(Boolean) : existing.tags,
    status: status || existing.status,
    heroEmoji: heroEmoji || existing.heroEmoji,
    imageCaption: imageCaption !== undefined ? imageCaption : existing.imageCaption,
    slug,
    updatedAt: now,
    publishedAt: (!wasPublished && status === 'published') ? now : existing.publishedAt
  });
  writeJSON(ARTICLES_FILE, articles);
  res.json({ ok: true, article: articles[idx] });
});

// Admin — delete article
app.delete('/api/articles/:id', requireAuth, (req, res) => {
  let articles = readJSON(ARTICLES_FILE);
  const idx = articles.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  articles.splice(idx, 1);
  writeJSON(ARTICLES_FILE, articles);
  res.json({ ok: true });
});

// Image upload
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/images/uploads/${req.file.filename}` });
});

// ── Settings API ──────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  res.json(readJSON(SETTINGS_FILE));
});

app.put('/api/settings', requireAuth, (req, res) => {
  const current = readJSON(SETTINGS_FILE);
  const { breakingNews, ticker } = req.body;
  if (breakingNews !== undefined) current.breakingNews = breakingNews.trim();
  if (ticker !== undefined) current.ticker = ticker;
  writeJSON(SETTINGS_FILE, current);
  res.json({ ok: true, settings: current });
});

// ── Bookings API ──────────────────────────────────────────────────────────────

// Public — submit a booking enquiry
app.post('/api/bookings', (req, res) => {
  const { username, business, package: pkg, content, contact } = req.body;
  if (!username || !business || !pkg || !content)
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  const bookings = readJSON(BOOKINGS_FILE);
  const booking = {
    id: generateId(),
    username: username.trim(),
    business: business.trim(),
    package: pkg.trim(),
    content: content.trim(),
    contact: (contact || '').trim(),
    status: 'new',
    submittedAt: new Date().toISOString()
  };
  bookings.unshift(booking);
  writeJSON(BOOKINGS_FILE, bookings);
  res.json({ ok: true });
});

// Admin — get all bookings
app.get('/api/bookings', requireAuth, (req, res) => {
  res.json(readJSON(BOOKINGS_FILE));
});

// Admin — update booking status
app.put('/api/bookings/:id', requireAuth, (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  bookings[idx].status = req.body.status || bookings[idx].status;
  writeJSON(BOOKINGS_FILE, bookings);
  res.json({ ok: true, booking: bookings[idx] });
});

// Admin — delete booking
app.delete('/api/bookings/:id', requireAuth, (req, res) => {
  let bookings = readJSON(BOOKINGS_FILE);
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  bookings.splice(idx, 1);
  writeJSON(BOOKINGS_FILE, bookings);
  res.json({ ok: true });
});

// ── Category page routes (all served by section.html) ────────────────────────
const SECTION_PAGES = ['politics', 'economy', 'law', 'community', 'opinion', 'archive'];
SECTION_PAGES.forEach(p => {
  app.get(`/${p}`, (req, res) => res.sendFile(path.join(__dirname, 'section.html')));
  app.get(`/${p}.html`, (req, res) => res.sendFile(path.join(__dirname, 'section.html')));
});

// ── SPA fallback for admin panel ──────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));

// ── Article page route ────────────────────────────────────────────────────────
app.get('/article/:slug', (req, res) => res.sendFile(path.join(__dirname, 'article.html')));

app.listen(PORT, () => console.log(`RBC running at http://localhost:${PORT}`));
