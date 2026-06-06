// Update date in topbar
(function () {
  const el = document.getElementById('topbar-date');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
})();

// Active nav link
(function () {
  const links = document.querySelectorAll('.nav__link');
  const page = location.pathname.split('/').pop() || 'index.html';
  links.forEach(l => {
    const href = l.getAttribute('href') || '';
    if (href === page || (page === 'index.html' && href === './') || href.includes(page)) {
      l.classList.add('active');
    }
  });
})();

// Category pill filter
document.querySelectorAll('.category-pill').forEach(pill => {
  pill.addEventListener('click', function () {
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
  });
});

// Search bar submit
const searchForm = document.querySelector('.search-bar');
if (searchForm) {
  searchForm.addEventListener('submit', e => {
    e.preventDefault();
    const q = searchForm.querySelector('.search-bar__input').value.trim();
    if (q) window.location.href = `archive.html?q=${encodeURIComponent(q)}`;
  });
}

// Newsletter form
const newsletterForm = document.querySelector('.newsletter__form');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', e => {
    e.preventDefault();
    const btn = newsletterForm.querySelector('.newsletter__btn');
    btn.textContent = 'Subscribed!';
    btn.style.background = '#2d5a27';
    setTimeout(() => { btn.textContent = 'Subscribe'; btn.style.background = ''; }, 3000);
  });
}

// Duplicate ticker content for seamless loop
document.querySelectorAll('.ticker-scroll__inner, .breaking-banner__scroll').forEach(el => {
  el.innerHTML += el.innerHTML;
});
