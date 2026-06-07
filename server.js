const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Data directory (use DATA_DIR env var for Railway persistent volume) ───────
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

const SESSIONS_DIR  = path.join(DATA_DIR, 'sessions');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const USERS_FILE    = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const UPLOADS_DIR   = path.join(__dirname, 'images', 'uploads');

// Ensure directories exist
[DATA_DIR, SESSIONS_DIR, UPLOADS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ── Discord OAuth config ──────────────────────────────────────────────────────
const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const SITE_URL              = process.env.SITE_URL || `http://localhost:${PORT}`;
const DISCORD_REDIRECT_URI  = `${SITE_URL}/auth/discord/callback`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return (file.endsWith('users.json') || file.endsWith('settings.json')) ? {} : []; }
}
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

// Seed default files if missing
if (!fs.existsSync(ARTICLES_FILE)) writeJSON(ARTICLES_FILE, []);
if (!fs.existsSync(BOOKINGS_FILE)) writeJSON(BOOKINGS_FILE, []);
if (!fs.existsSync(SETTINGS_FILE)) writeJSON(SETTINGS_FILE, { breakingNews: '', ticker: [] });
if (!fs.existsSync(USERS_FILE)) {
  // Use ADMIN_PASSWORD env var if set, otherwise fall back to default
  const initialPassword = process.env.ADMIN_PASSWORD || 'Admin2024!';
  writeJSON(USERS_FILE, {
    admin: {
      username: 'admin',
      password: bcrypt.hashSync(initialPassword, 10),
      displayName: 'Editor-in-Chief',
      role: 'admin'
    }
  });
  console.log(process.env.ADMIN_PASSWORD
    ? '[RBC] Admin account created from ADMIN_PASSWORD env var.'
    : '[RBC] Admin account created with default password Admin2024! — set ADMIN_PASSWORD env var to control this.'
  );
}

// If ADMIN_PASSWORD env var is set and differs from stored hash, update it.
// This lets you reset the password by changing the env var in Railway.
if (process.env.ADMIN_PASSWORD) {
  const users = readJSON(USERS_FILE);
  if (users.admin && !bcrypt.compareSync(process.env.ADMIN_PASSWORD, users.admin.password)) {
    users.admin.password = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
    writeJSON(USERS_FILE, users);
    console.log('[RBC] Admin password updated from ADMIN_PASSWORD env var.');
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
const SESSION_SECRET = process.env.SESSION_SECRET || 'rbc-secret-change-in-production';
if (!process.env.SESSION_SECRET) {
  console.warn('[RBC] WARNING: SESSION_SECRET env var not set. Sessions will be invalidated on every restart. Set it in Railway Variables.');
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

app.use(session({
  // ttl in seconds — 30 days so reader logins survive long periods without visiting
  store: new FileStore({ path: SESSIONS_DIR, ttl: 30 * 24 * 60 * 60, retries: 0, logFn: () => {} }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Refresh cookie expiry on every request — keeps active users logged in
  cookie: {
    maxAge: THIRTY_DAYS, // 30 days for public readers
    httpOnly: true,
    sameSite: 'lax'
  }
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

// Serve static files
app.use(express.static(__dirname, { index: 'index.html', extensions: ['html'] }));

// Auth guards
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).json({ error: 'Forbidden' });
}

// ── ADMIN AUTH ────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users[username];
  if (!user || user.role !== 'admin' || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid username or password' });
  req.session.user = { username: user.username, displayName: user.displayName, role: user.role };
  // Admin sessions expire after 8 hours (shorter than public reader sessions)
  req.session.cookie.maxAge = 8 * 60 * 60 * 1000;
  res.json({ ok: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) return res.json(req.session.user);
  res.status(401).json({ error: 'Not logged in' });
});

app.post('/api/change-password', requireAdmin, (req, res) => {
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

app.post('/api/update-profile', requireAdmin, (req, res) => {
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

// ── PASSWORD RESET (requires RESET_SECRET env var) ───────────────────────────
app.post('/api/reset-password', (req, res) => {
  const { secret, newPassword } = req.body;
  const RESET_SECRET = process.env.RESET_SECRET;
  if (!RESET_SECRET) return res.status(503).json({ error: 'Reset not configured — set RESET_SECRET env var in Railway' });
  if (secret !== RESET_SECRET) return res.status(401).json({ error: 'Invalid reset secret' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const users = readJSON(USERS_FILE);
  users.admin.password = bcrypt.hashSync(newPassword, 10);
  writeJSON(USERS_FILE, users);
  res.json({ ok: true });
});

// ── DISCORD OAUTH (for public readers) ───────────────────────────────────────
app.get('/auth/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID) return res.redirect('/?discord=not-configured');
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify'
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?discord=error');
  try {
    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No token');

    // Fetch Discord user
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const discordUser = await userRes.json();

    // Upsert reader in users.json
    const users = readJSON(USERS_FILE);
    const key = `discord_${discordUser.id}`;
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || 0) % 5}.png`;

    if (!users[key]) {
      users[key] = {
        username: key,
        discordId: discordUser.id,
        discordTag: discordUser.username + (discordUser.discriminator && discordUser.discriminator !== '0' ? '#' + discordUser.discriminator : ''),
        displayName: discordUser.global_name || discordUser.username,
        avatar,
        role: 'reader',
        createdAt: new Date().toISOString(),
        viewedArticles: []
      };
    } else {
      // Update avatar / displayName in case they changed
      users[key].avatar = avatar;
      users[key].displayName = discordUser.global_name || discordUser.username;
      users[key].discordTag = discordUser.username + (discordUser.discriminator && discordUser.discriminator !== '0' ? '#' + discordUser.discriminator : '');
    }
    writeJSON(USERS_FILE, users);

    // Create public session
    req.session.publicUser = {
      key,
      discordId: discordUser.id,
      displayName: users[key].displayName,
      avatar,
      role: 'reader'
    };
    res.redirect('/?discord=success');
  } catch (err) {
    console.error('Discord OAuth error:', err);
    res.redirect('/?discord=error');
  }
});

app.get('/api/public-me', (req, res) => {
  if (req.session && req.session.publicUser) return res.json(req.session.publicUser);
  res.status(401).json({ error: 'Not logged in' });
});

app.post('/api/public-logout', (req, res) => {
  delete req.session.publicUser;
  req.session.save(() => res.json({ ok: true }));
});

// ── ARTICLES API ──────────────────────────────────────────────────────────────
app.get('/api/articles', (req, res) => {
  let articles = readJSON(ARTICLES_FILE);
  const { category, limit, search } = req.query;
  const isAdmin = req.session && req.session.user;
  if (!isAdmin) articles = articles.filter(a => a.status === 'published');
  if (category && category !== 'all') articles = articles.filter(a => a.category === category);
  if (search) {
    const q = search.toLowerCase();
    articles = articles.filter(a => a.title.toLowerCase().includes(q) || (a.subtitle || '').toLowerCase().includes(q));
  }
  articles = articles.sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
  if (limit) articles = articles.slice(0, parseInt(limit));
  res.json(articles);
});

app.get('/api/articles/:idOrSlug', (req, res) => {
  const articles = readJSON(ARTICLES_FILE);
  const isAdmin = req.session && req.session.user;
  const article = articles.find(a => a.id === req.params.idOrSlug || a.slug === req.params.idOrSlug);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  if (!isAdmin && article.status !== 'published') return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

app.post('/api/articles', requireAdmin, (req, res) => {
  const { title, subtitle, body, category, tags, status, heroEmoji, heroImage, imageCaption } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const articles = readJSON(ARTICLES_FILE);
  let slug = slugify(title);
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
    heroImage: heroImage || '',
    imageCaption: imageCaption || '',
    author: req.session.user.displayName,
    authorUsername: req.session.user.username,
    createdAt: now,
    publishedAt: status === 'published' ? now : null,
    updatedAt: now,
    views: 0
  };
  articles.unshift(article);
  writeJSON(ARTICLES_FILE, articles);
  res.json({ ok: true, article });
});

app.put('/api/articles/:id', requireAdmin, (req, res) => {
  const articles = readJSON(ARTICLES_FILE);
  const idx = articles.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article not found' });
  const { title, subtitle, body, category, tags, status, heroEmoji, heroImage, imageCaption } = req.body;
  const existing = articles[idx];
  const wasPublished = existing.status === 'published';
  const now = new Date().toISOString();
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
    heroImage: heroImage !== undefined ? heroImage : (existing.heroImage || ''),
    imageCaption: imageCaption !== undefined ? imageCaption : existing.imageCaption,
    slug,
    updatedAt: now,
    publishedAt: (!wasPublished && status === 'published') ? now : existing.publishedAt
  });
  writeJSON(ARTICLES_FILE, articles);
  res.json({ ok: true, article: articles[idx] });
});

app.delete('/api/articles/:id', requireAdmin, (req, res) => {
  let articles = readJSON(ARTICLES_FILE);
  const idx = articles.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  articles.splice(idx, 1);
  writeJSON(ARTICLES_FILE, articles);
  res.json({ ok: true });
});

// Image upload
app.post('/api/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/images/uploads/${req.file.filename}` });
});

// ── VIEW TRACKING ─────────────────────────────────────────────────────────────
const viewCache = new Map();
const VIEW_COOLDOWN = 60 * 60 * 1000; // 1 hour
const BOT_PATTERN = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu|duckduck|teoma|ia_archiver|facebookexternalhit|whatsapp|twitterbot|linkedinbot|discordbot|telegrambot|preview|headless|phantom|selenium|puppeteer|playwright|wget|curl|python|java|go-http|ruby|scrapy|httpclient|okhttp/i;

app.post('/api/articles/:id/view', (req, res) => {
  if (req.headers['x-rbc-view'] !== '1') return res.status(400).json({ ok: false });
  const ua = req.headers['user-agent'] || '';
  if (BOT_PATTERN.test(ua)) return res.json({ ok: false, reason: 'bot' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const key = `${ip}:${req.params.id}`;
  const now = Date.now();
  if (viewCache.has(key) && now - viewCache.get(key) < VIEW_COOLDOWN)
    return res.json({ ok: false, reason: 'duplicate' });

  const articles = readJSON(ARTICLES_FILE);
  const idx = articles.findIndex(a => a.id === req.params.id || a.slug === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false });
  if (articles[idx].status !== 'published') return res.json({ ok: false });

  articles[idx].views = (articles[idx].views || 0) + 1;

  // Record which articles this Discord user has read
  if (req.session && req.session.publicUser) {
    const users = readJSON(USERS_FILE);
    const u = users[req.session.publicUser.key];
    if (u) {
      if (!u.viewedArticles) u.viewedArticles = [];
      if (!u.viewedArticles.includes(req.params.id)) {
        u.viewedArticles.push(req.params.id);
        writeJSON(USERS_FILE, users);
      }
    }
  }

  writeJSON(ARTICLES_FILE, articles);
  viewCache.set(key, now);
  if (viewCache.size > 10000) {
    for (const [k, t] of viewCache) { if (now - t > VIEW_COOLDOWN) viewCache.delete(k); }
  }
  res.json({ ok: true, views: articles[idx].views });
});

// ── SETTINGS API ──────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => res.json(readJSON(SETTINGS_FILE)));

app.put('/api/settings', requireAdmin, (req, res) => {
  const current = readJSON(SETTINGS_FILE);
  const { breakingNews, ticker } = req.body;
  if (breakingNews !== undefined) current.breakingNews = breakingNews.trim();
  if (ticker !== undefined) current.ticker = ticker;
  writeJSON(SETTINGS_FILE, current);
  res.json({ ok: true, settings: current });
});

// ── BOOKINGS API ──────────────────────────────────────────────────────────────
app.post('/api/bookings', (req, res) => {
  const { username, business, package: pkg, content, contact } = req.body;
  if (!username || !business || !pkg || !content)
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  const bookings = readJSON(BOOKINGS_FILE);
  bookings.unshift({
    id: generateId(),
    username: username.trim(),
    business: business.trim(),
    package: pkg.trim(),
    content: content.trim(),
    contact: (contact || '').trim(),
    status: 'new',
    submittedAt: new Date().toISOString()
  });
  writeJSON(BOOKINGS_FILE, bookings);
  res.json({ ok: true });
});

app.get('/api/bookings', requireAdmin, (req, res) => res.json(readJSON(BOOKINGS_FILE)));

app.put('/api/bookings/:id', requireAdmin, (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  bookings[idx].status = req.body.status || bookings[idx].status;
  writeJSON(BOOKINGS_FILE, bookings);
  res.json({ ok: true, booking: bookings[idx] });
});

app.delete('/api/bookings/:id', requireAdmin, (req, res) => {
  let bookings = readJSON(BOOKINGS_FILE);
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  bookings.splice(idx, 1);
  writeJSON(BOOKINGS_FILE, bookings);
  res.json({ ok: true });
});

// ── READERS API (admin only) ──────────────────────────────────────────────────
app.get('/api/readers', requireAdmin, (req, res) => {
  const users = readJSON(USERS_FILE);
  const readers = Object.values(users)
    .filter(u => u.role === 'reader')
    .map(u => ({
      key: u.username,
      displayName: u.displayName,
      discordTag: u.discordTag,
      avatar: u.avatar,
      createdAt: u.createdAt,
      articlesRead: (u.viewedArticles || []).length
    }));
  res.json(readers);
});

// ── PAGE ROUTES ───────────────────────────────────────────────────────────────
const SECTION_PAGES = ['politics', 'economy', 'law', 'community', 'opinion', 'archive'];
SECTION_PAGES.forEach(p => {
  app.get(`/${p}`, (req, res) => res.sendFile(path.join(__dirname, 'section.html')));
  app.get(`/${p}.html`, (req, res) => res.sendFile(path.join(__dirname, 'section.html')));
});
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.get('/article/:slug', (req, res) => res.sendFile(path.join(__dirname, 'article.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'reset-password.html')));

app.listen(PORT, () => console.log(`RBC running at http://localhost:${PORT}`));
