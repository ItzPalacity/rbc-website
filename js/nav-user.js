/* ── RBC Nav User Button + Sign-In Modal ─────────────────────────────────────
   Shared across index.html, article.html, section.html
   Injects a sign-in button (logged out) or avatar pill (logged in) into
   any element with id="nav-user-wrap".
   ───────────────────────────────────────────────────────────────────────────── */

(async function initNavUser() {
  const wrap = document.getElementById('nav-user-wrap');
  if (!wrap) return;

  // Inject modal into body once
  if (!document.getElementById('rbc-auth-modal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="rbc-auth-modal" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(10,20,40,.55);backdrop-filter:blur(3px);align-items:center;justify-content:center;">
        <div style="background:#fff;border-radius:12px;width:100%;max-width:400px;margin:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;">
          <!-- Header -->
          <div style="background:#0d1b2a;padding:20px 24px 16px;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="color:#fff;font-size:16px;font-weight:700;font-family:'Playfair Display',serif;">RBC Reader Account</div>
              <div style="color:rgba(255,255,255,.5);font-size:12px;margin-top:2px;">Sign in to track your reading history</div>
            </div>
            <button onclick="rbcCloseModal()" style="background:rgba(255,255,255,.1);border:none;color:#fff;width:28px;height:28px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
          </div>
          <!-- Tabs -->
          <div style="display:flex;border-bottom:1px solid #e2e8f0;">
            <button id="rbc-tab-signin" onclick="rbcTab('signin')" style="flex:1;padding:12px;border:none;background:#fff;font-size:13px;font-weight:600;color:#1a3a5c;cursor:pointer;border-bottom:2px solid #1a3a5c;font-family:inherit;">Sign In</button>
            <button id="rbc-tab-register" onclick="rbcTab('register')" style="flex:1;padding:12px;border:none;background:#fff;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;">Create Account</button>
          </div>
          <!-- Body -->
          <div style="padding:24px;">
            <!-- Error message -->
            <div id="rbc-auth-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px;padding:10px 12px;border-radius:6px;margin-bottom:16px;"></div>

            <!-- SIGN IN form -->
            <div id="rbc-form-signin">
              <div style="margin-bottom:14px;">
                <label style="display:block;font-size:12px;font-weight:600;color:#1a3a5c;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px;">Email</label>
                <input id="rbc-signin-email" type="email" placeholder="you@example.com" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:14px;font-family:inherit;box-sizing:border-box;outline:none;transition:border-color .15s;" onfocus="this.style.borderColor='#1a3a5c'" onblur="this.style.borderColor='#e2e8f0'" onkeydown="if(event.key==='Enter')rbcSignIn()" />
              </div>
              <div style="margin-bottom:18px;">
                <label style="display:block;font-size:12px;font-weight:600;color:#1a3a5c;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px;">Password</label>
                <input id="rbc-signin-password" type="password" placeholder="••••••••" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:14px;font-family:inherit;box-sizing:border-box;outline:none;transition:border-color .15s;" onfocus="this.style.borderColor='#1a3a5c'" onblur="this.style.borderColor='#e2e8f0'" onkeydown="if(event.key==='Enter')rbcSignIn()" />
              </div>
              <button onclick="rbcSignIn()" id="rbc-signin-btn" style="width:100%;padding:10px;background:#1a3a5c;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .15s;" onmouseenter="this.style.opacity='.88'" onmouseleave="this.style.opacity='1'">Sign In</button>
              <div style="display:flex;align-items:center;gap:10px;margin:16px 0;">
                <div style="flex:1;height:1px;background:#e2e8f0;"></div>
                <span style="font-size:12px;color:#94a3b8;">or</span>
                <div style="flex:1;height:1px;background:#e2e8f0;"></div>
              </div>
              <a href="/auth/discord" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px;background:#5865F2;color:#fff;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;box-sizing:border-box;transition:opacity .15s;" onmouseenter="this.style.opacity='.88'" onmouseleave="this.style.opacity='1'">
                <svg width="16" height="16" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.6a40.7 40.7 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.2 0A40.1 40.1 0 0 0 25.6.6 58.4 58.4 0 0 0 10.9 4.9C1.6 18.7-1 32.2.3 45.5a58.9 58.9 0 0 0 17.9 9 44.5 44.5 0 0 0 3.8-6.3 38.3 38.3 0 0 1-6-2.9c.5-.4 1-.7 1.5-1.1a41.9 41.9 0 0 0 35.9 0l1.5 1.1a38.4 38.4 0 0 1-6 2.9 44.4 44.4 0 0 0 3.8 6.3 58.7 58.7 0 0 0 17.9-9C72 30.2 68.9 16.8 60.1 4.9ZM23.7 37.4c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.3 7.2 0 4-2.8 7.2-6.3 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.3 7.2 0 4-2.8 7.2-6.3 7.2Z"/></svg>
                Continue with Discord
              </a>
            </div>

            <!-- REGISTER form -->
            <div id="rbc-form-register" style="display:none;">
              <div style="margin-bottom:14px;">
                <label style="display:block;font-size:12px;font-weight:600;color:#1a3a5c;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px;">Display Name</label>
                <input id="rbc-reg-name" type="text" placeholder="Your name" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:14px;font-family:inherit;box-sizing:border-box;outline:none;transition:border-color .15s;" onfocus="this.style.borderColor='#1a3a5c'" onblur="this.style.borderColor='#e2e8f0'" onkeydown="if(event.key==='Enter')rbcRegister()" />
              </div>
              <div style="margin-bottom:14px;">
                <label style="display:block;font-size:12px;font-weight:600;color:#1a3a5c;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px;">Email</label>
                <input id="rbc-reg-email" type="email" placeholder="you@example.com" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:14px;font-family:inherit;box-sizing:border-box;outline:none;transition:border-color .15s;" onfocus="this.style.borderColor='#1a3a5c'" onblur="this.style.borderColor='#e2e8f0'" onkeydown="if(event.key==='Enter')rbcRegister()" />
              </div>
              <div style="margin-bottom:18px;">
                <label style="display:block;font-size:12px;font-weight:600;color:#1a3a5c;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px;">Password</label>
                <input id="rbc-reg-password" type="password" placeholder="At least 6 characters" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:14px;font-family:inherit;box-sizing:border-box;outline:none;transition:border-color .15s;" onfocus="this.style.borderColor='#1a3a5c'" onblur="this.style.borderColor='#e2e8f0'" onkeydown="if(event.key==='Enter')rbcRegister()" />
              </div>
              <button onclick="rbcRegister()" style="width:100%;padding:10px;background:#1a3a5c;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .15s;" onmouseenter="this.style.opacity='.88'" onmouseleave="this.style.opacity='1'">Create Account</button>
              <div style="display:flex;align-items:center;gap:10px;margin:16px 0;">
                <div style="flex:1;height:1px;background:#e2e8f0;"></div>
                <span style="font-size:12px;color:#94a3b8;">or</span>
                <div style="flex:1;height:1px;background:#e2e8f0;"></div>
              </div>
              <a href="/auth/discord" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px;background:#5865F2;color:#fff;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;box-sizing:border-box;transition:opacity .15s;" onmouseenter="this.style.opacity='.88'" onmouseleave="this.style.opacity='1'">
                <svg width="16" height="16" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.6a40.7 40.7 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.2 0A40.1 40.1 0 0 0 25.6.6 58.4 58.4 0 0 0 10.9 4.9C1.6 18.7-1 32.2.3 45.5a58.9 58.9 0 0 0 17.9 9 44.5 44.5 0 0 0 3.8-6.3 38.3 38.3 0 0 1-6-2.9c.5-.4 1-.7 1.5-1.1a41.9 41.9 0 0 0 35.9 0l1.5 1.1a38.4 38.4 0 0 1-6 2.9 44.4 44.4 0 0 0 3.8 6.3 58.7 58.7 0 0 0 17.9-9C72 30.2 68.9 16.8 60.1 4.9ZM23.7 37.4c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.3 7.2 0 4-2.8 7.2-6.3 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.3 7.2 0 4-2.8 7.2-6.3 7.2Z"/></svg>
                Continue with Discord
              </a>
            </div>
          </div>
        </div>
      </div>
    `);

    // Close on backdrop click
    document.getElementById('rbc-auth-modal').addEventListener('click', function(e) {
      if (e.target === this) rbcCloseModal();
    });
    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') rbcCloseModal();
    });
  }

  // Render the nav button based on auth state
  try {
    const r = await fetch('/api/public-me');
    if (r.ok) {
      const u = await r.json();
      renderLoggedIn(wrap, u);
    } else {
      renderLoggedOut(wrap);
    }
  } catch {
    renderLoggedOut(wrap);
  }
})();

function renderLoggedIn(wrap, u) {
  const initials = (u.displayName || '?').charAt(0).toUpperCase();
  wrap.innerHTML = `
    <button id="nav-user-btn" onclick="toggleNavUserMenu(event)" style="display:flex;align-items:center;gap:7px;background:transparent;border:1.5px solid rgba(255,255,255,0.25);border-radius:20px;padding:4px 10px 4px 5px;cursor:pointer;color:#fff;font-family:inherit;font-size:12px;font-weight:600;transition:border-color .15s;" onmouseenter="this.style.borderColor='rgba(255,255,255,0.6)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.25)'">
      ${u.avatar
        ? `<img src="${u.avatar}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;" onerror="this.outerHTML='<span style=\\'width:22px;height:22px;border-radius:50%;background:#c8a84b;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;\\'>${initials}</span>'" />`
        : `<span style="width:22px;height:22px;border-radius:50%;background:#c8a84b;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${initials}</span>`
      }
      <span style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.displayName}</span>
      <span style="opacity:.6;font-size:10px;">▾</span>
    </button>
    <div id="nav-user-menu" style="display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:190px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:9999;overflow:hidden;">
      <div style="padding:12px 14px;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:13px;font-weight:700;color:#1a3a5c;">${u.displayName}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${u.discordTag ? 'Discord: ' + u.discordTag : 'RBC Reader'}</div>
      </div>
      <button onclick="navUserSignOut()" style="width:100%;padding:10px 14px;background:transparent;border:none;text-align:left;font-size:13px;color:#64748b;cursor:pointer;font-family:inherit;" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='transparent'">Sign Out</button>
    </div>`;
}

function renderLoggedOut(wrap) {
  wrap.innerHTML = `<button onclick="rbcOpenModal()" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.12);color:#fff;border:1.5px solid rgba(255,255,255,0.25);border-radius:20px;padding:5px 13px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all .15s;" onmouseenter="this.style.background='rgba(255,255,255,0.2)'" onmouseleave="this.style.background='rgba(255,255,255,0.12)'">Sign In</button>`;
}

function rbcOpenModal() {
  rbcClearError();
  document.getElementById('rbc-auth-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('rbc-signin-email').focus(), 50);
}

function rbcCloseModal() {
  document.getElementById('rbc-auth-modal').style.display = 'none';
  rbcClearError();
}

function rbcTab(tab) {
  const isSignin = tab === 'signin';
  document.getElementById('rbc-form-signin').style.display = isSignin ? 'block' : 'none';
  document.getElementById('rbc-form-register').style.display = isSignin ? 'none' : 'block';
  const activeStyle = 'border-bottom:2px solid #1a3a5c;color:#1a3a5c;';
  const inactiveStyle = 'border-bottom:2px solid transparent;color:#94a3b8;';
  document.getElementById('rbc-tab-signin').style.cssText += isSignin ? activeStyle : inactiveStyle;
  document.getElementById('rbc-tab-register').style.cssText += isSignin ? inactiveStyle : activeStyle;
  rbcClearError();
  setTimeout(() => {
    const f = isSignin ? 'rbc-signin-email' : 'rbc-reg-name';
    document.getElementById(f).focus();
  }, 30);
}

function rbcClearError() {
  const e = document.getElementById('rbc-auth-error');
  if (e) { e.style.display = 'none'; e.textContent = ''; }
}

function rbcShowError(msg) {
  const e = document.getElementById('rbc-auth-error');
  if (e) { e.textContent = msg; e.style.display = 'block'; }
}

async function rbcSignIn() {
  const email = document.getElementById('rbc-signin-email').value.trim();
  const password = document.getElementById('rbc-signin-password').value;
  if (!email || !password) return rbcShowError('Please enter your email and password.');
  const btn = document.getElementById('rbc-signin-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  try {
    const r = await fetch('/api/reader/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) { rbcShowError(data.error || 'Sign in failed.'); btn.textContent = 'Sign In'; btn.disabled = false; return; }
    rbcCloseModal();
    renderLoggedIn(document.getElementById('nav-user-wrap'), data.user);
    // Also refresh sidebar widget if present
    if (typeof loadDiscordWidget === 'function') loadDiscordWidget();
  } catch {
    rbcShowError('Something went wrong. Please try again.');
    btn.textContent = 'Sign In'; btn.disabled = false;
  }
}

async function rbcRegister() {
  const displayName = document.getElementById('rbc-reg-name').value.trim();
  const email = document.getElementById('rbc-reg-email').value.trim();
  const password = document.getElementById('rbc-reg-password').value;
  if (!displayName || !email || !password) return rbcShowError('Please fill in all fields.');
  if (password.length < 6) return rbcShowError('Password must be at least 6 characters.');
  try {
    const r = await fetch('/api/reader/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, email, password })
    });
    const data = await r.json();
    if (!r.ok) { rbcShowError(data.error || 'Registration failed.'); return; }
    rbcCloseModal();
    renderLoggedIn(document.getElementById('nav-user-wrap'), data.user);
    if (typeof loadDiscordWidget === 'function') loadDiscordWidget();
  } catch {
    rbcShowError('Something went wrong. Please try again.');
  }
}

function toggleNavUserMenu(e) {
  e.stopPropagation();
  const m = document.getElementById('nav-user-menu');
  if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', () => {
  const m = document.getElementById('nav-user-menu');
  if (m) m.style.display = 'none';
});

async function navUserSignOut() {
  await fetch('/api/public-logout', { method: 'POST' });
  location.reload();
}
