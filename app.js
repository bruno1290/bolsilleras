/* ============================================
   BOLSILLERAS — Supabase Multi-Player App
   ============================================ */

// ==========================================
// ★ CARTEL LUMINOSO — EDITA AQUÍ TUS FRASES ★
// Agrega, saca o cambia las frases de esta lista.
// Van rotando una tras otra en el cartel rojo.
// ==========================================
const BANNER_FRASES = [
  'Gracias por el estreno (Gacela tiene hambre)',
];

// ==========================================
// CONFIG — Reemplaza con tus datos de Supabase
// ==========================================
const SUPABASE_URL = 'https://xfkxpvltqtlzcazklpda.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhma3hwdmx0cXRsemNhemtscGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1Nzg2MDAsImV4cCI6MjEwMDE1NDYwMH0.QpS8u5Hmbf2w-gjvponNj4hWmEnohnM6GY38Y32tEt0';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// STATE
// ==========================================
let currentPlayer = null;     // { id, name, is_admin, ... }
let activePichanga = null;    // Current open pichanga
let activeSignups = [];       // Signups for active pichanga
let mySignup = null;          // Current player's signup
let allPlayers = [];          // All players cache
let currentSort = 'goals';

// ==========================================
// UTILITY
// ==========================================
function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

let loadingTimer = null;
function showLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'flex';
  if (loadingTimer) clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => {
    hideLoading();
  }, 2000);
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
  if (loadingTimer) {
    clearTimeout(loadingTimer);
    loadingTimer = null;
  }
}

// Modal
let modalResolve = null;
function showModal(title, message) {
  return new Promise((resolve) => {
    modalResolve = resolve;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-overlay').style.display = 'flex';
  });
}
const modalCancelEl = document.getElementById('modal-cancel');
if (modalCancelEl) {
  modalCancelEl.addEventListener('click', () => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
    if (modalResolve) modalResolve(false);
  });
}

const modalConfirmEl = document.getElementById('modal-confirm');
if (modalConfirmEl) {
  modalConfirmEl.addEventListener('click', () => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
    if (modalResolve) modalResolve(true);
  });
}

// ==========================================
// AUTH / SESSION (localStorage for session)
// ==========================================
function saveSession(playerId) {
  localStorage.setItem('bolsilleras_player_id', playerId);
}
function getSession() {
  return localStorage.getItem('bolsilleras_player_id');
}
function clearSession() {
  localStorage.removeItem('bolsilleras_player_id');
}

// ==========================================
// LOGIN SCREEN
// ==========================================
async function showLoginScreen() {
  hideLoading();
  document.getElementById('screen-login').style.display = 'block';
  document.getElementById('screen-app').style.display = 'none';
  showLoginPlayerList();
}

function openRegisterForm() {
  hideLoading();
  document.getElementById('login-player-list-section').style.display = 'none';
  document.getElementById('login-pin-section').style.display = 'none';
  document.getElementById('login-register-section').style.display = 'block';
  setTimeout(() => {
    const input = document.getElementById('reg-name');
    if (input) input.focus();
  }, 100);
}

function renderPlayerButtons(players) {
  const list = document.getElementById('login-player-list');
  if (!players || players.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:1rem;">No hay jugadores registrados todavía. ¡Crea la primera cuenta abajo!</p>';
    return;
  }

  list.innerHTML = players.map(p => {
    const face = (AVATARES_PUBLICO && p.avatar)
      ? `<div class="player-avatar player-avatar-svg">${avatarSVG(p.avatar)}</div>`
      : `<div class="player-avatar">${getInitials(p.name)}</div>`;
    return `
    <button class="login-player-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
      ${face}
      <span>${escapeHtml(p.name)}</span>
    </button>`;
  }).join('');

  list.querySelectorAll('.login-player-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showPinInput(btn.dataset.id, btn.dataset.name);
    });
  });
}

function openCreatePichangaModal() {
  // Cualquier jugador puede crear una pichanga
  const modal = document.getElementById('modal-create-pichanga');
  if (modal) modal.style.display = 'flex';
}

async function showLoginPlayerList() {
  document.getElementById('login-player-list-section').style.display = 'block';
  document.getElementById('login-register-section').style.display = 'none';
  document.getElementById('login-pin-section').style.display = 'none';

  const list = document.getElementById('login-player-list');
  let hasRenderedCache = false;

  // 1. Instant render from local cache if valid
  const cached = localStorage.getItem('bolsilleras_cached_players');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        renderPlayerButtons(parsed);
        hasRenderedCache = true;
      }
    } catch (e) {}
  }

  // 2. If no cache, show loading state
  if (!hasRenderedCache) {
    list.innerHTML = `
      <div style="text-align:center; padding:1.25rem; color:var(--text-secondary); font-size:0.85rem; font-weight:500;">
        <div class="loading-spinner" style="width:24px; height:24px; margin:0 auto 0.5rem; border-width:2px;"></div>
        Cargando jugadores...
      </div>
    `;
  }

  // 3. Fetch fresh players from Supabase, with retries (first request on a
  // cold connection / mobile network can fail or time out while other page
  // assets are still loading)
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Intentar con avatar; si la columna aún no existe, caer a solo id,name
      let { data: players, error } = await sb.from('players').select('id, name, avatar').order('name');
      if (error) {
        ({ data: players, error } = await sb.from('players').select('id, name').order('name'));
      }
      if (!error && players) {
        localStorage.setItem('bolsilleras_cached_players', JSON.stringify(players));
        renderPlayerButtons(players);
        return;
      }
    } catch (err) {
      console.error(`Error in showLoginPlayerList (attempt ${attempt}):`, err);
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }

  // All attempts failed
  if (!hasRenderedCache) renderPlayerButtons([]);
}

async function showPinInput(playerId, playerName) {
  showLoading();
  const { data: player, error } = await sb.from('players').select('*').eq('id', playerId).single();
  hideLoading();

  if (error || !player) {
    showToast('Error al seleccionar jugador', 'error');
    return;
  }

  const section = document.getElementById('login-pin-section');
  const title = section.querySelector('.login-section-title');
  const btn = document.getElementById('btn-login-pin');

  const isDefaultPin = player.pin === '1234';

  if (isDefaultPin) {
    title.textContent = 'Crea tu clave de 4 dígitos';
    btn.textContent = 'Guardar Clave y Entrar';
    section.dataset.isSetup = 'true';
  } else {
    title.textContent = 'Ingresa tu PIN';
    btn.textContent = 'Entrar';
    section.dataset.isSetup = 'false';
  }

  document.getElementById('login-player-list-section').style.display = 'none';
  section.style.display = 'block';
  document.getElementById('pin-player-name').textContent = player.name;
  document.getElementById('login-pin').value = '';
  document.getElementById('login-pin').focus();

  section.dataset.playerId = playerId;
}

// PIN login / Setup handler
const btnLoginPinEl = document.getElementById('btn-login-pin');
if (btnLoginPinEl) btnLoginPinEl.addEventListener('click', loginWithPin);

const loginPinEl = document.getElementById('login-pin');
if (loginPinEl) {
  loginPinEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginWithPin();
  });
}

async function loginWithPin() {
  const section = document.getElementById('login-pin-section');
  const playerId = section ? section.dataset.playerId : null;
  const pinInput = document.getElementById('login-pin');
  const pin = pinInput ? pinInput.value.trim() : '';
  const isSetup = section ? section.dataset.isSetup === 'true' : false;

  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    showToast('La clave debe ser de 4 dígitos numéricos', 'error');
    return;
  }

  showLoading();
  const { data: player, error } = await sb.from('players').select('*').eq('id', playerId).single();

  if (error || !player) {
    hideLoading();
    showToast('Error al iniciar sesión', 'error');
    return;
  }

  if (isSetup) {
    // Save new PIN
    const { error: updateErr } = await sb.from('players').update({ pin }).eq('id', playerId);
    hideLoading();

    if (updateErr) {
      showToast('Error al guardar clave: ' + updateErr.message, 'error');
      return;
    }

    player.pin = pin;
    showToast(`¡Clave creada para ${player.name}! 🔐`);
    currentPlayer = player;
    saveSession(player.id);
    enterApp();
    return;
  }

  hideLoading();
  if (player.pin !== pin) {
    showToast('Clave incorrecta', 'error');
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
    return;
  }

  const lower = player.name.toLowerCase();
  if (lower.includes('gacela') || lower.includes('bruno')) {
    player.is_admin = true;
  }

  currentPlayer = player;
  saveSession(player.id);
  enterApp();
}

// Register
const btnShowRegEl = document.getElementById('btn-show-register');
if (btnShowRegEl) {
  btnShowRegEl.addEventListener('click', () => {
    const listSec = document.getElementById('login-player-list-section');
    if (listSec) listSec.style.display = 'none';
    const regSec = document.getElementById('login-register-section');
    if (regSec) regSec.style.display = 'block';
    const regName = document.getElementById('reg-name');
    if (regName) regName.focus();
  });
}

const btnBackToListEl = document.getElementById('btn-back-to-list');
if (btnBackToListEl) btnBackToListEl.addEventListener('click', showLoginPlayerList);

const btnBackFromPinEl = document.getElementById('btn-back-from-pin');
if (btnBackFromPinEl) btnBackFromPinEl.addEventListener('click', showLoginPlayerList);

const btnRegisterEl = document.getElementById('btn-register');
if (btnRegisterEl) btnRegisterEl.addEventListener('click', registerPlayer);

const regPinEl = document.getElementById('reg-pin');
if (regPinEl) {
  regPinEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') registerPlayer();
  });
}

async function registerPlayer() {
  const name = document.getElementById('reg-name').value.trim();
  const pin = document.getElementById('reg-pin').value.trim();

  if (!name) { showToast('Ingresa tu nombre', 'error'); return; }
  if (name.length < 2) { showToast('Nombre muy corto', 'error'); return; }
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { showToast('El PIN debe ser de 4 dígitos', 'error'); return; }

  showLoading();

  // Check if name already exists -> redirect to PIN login/setup instead of failing
  const { data: existing } = await sb.from('players').select('*').ilike('name', name);
  if (existing && existing.length > 0) {
    hideLoading();
    const player = existing[0];
    showToast(`El jugador "${player.name}" ya existe. Ingresa tu clave:`, 'success');
    showPinInput(player.id, player.name);
    return;
  }

  // Only 'Gacela' or 'Bruno' gets admin privileges
  const lowerName = name.toLowerCase();
  const isAdmin = lowerName.includes('gacela') || lowerName.includes('bruno');

  const { data, error } = await sb.from('players').insert({
    name,
    pin,
    is_admin: isAdmin,
    aliases: []
  }).select().single();

  hideLoading();

  if (error) {
    showToast('Error al crear cuenta: ' + error.message, 'error');
    return;
  }

  // Update local cache immediately so the new account is visible on reload
  try {
    const cached = localStorage.getItem('bolsilleras_cached_players');
    let playersList = cached ? JSON.parse(cached) : [];
    if (!playersList.find(p => p.id === data.id)) {
      playersList.push({ id: data.id, name: data.name });
      playersList.sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem('bolsilleras_cached_players', JSON.stringify(playersList));
    }
  } catch(e) {}

  currentPlayer = data;
  saveSession(data.id);
  showToast(`¡Bienvenido ${name}! ${isAdmin ? '(Eres admin 👑)' : '⚽'}`);
  enterApp();
}

function togglePostMatchSection() {
  const sec = document.getElementById('postmatch-section');
  if (!sec) return;
  const isHidden = sec.style.display === 'none';
  sec.style.display = isHidden ? 'block' : 'none';
  const btn = document.getElementById('btn-toggle-postmatch');
  if (btn) {
    btn.textContent = isHidden
      ? '▲ Ocultar'
      : '📝 Reportar mi Equipo y Goles';
  }
}

// Auto-login on page load
async function tryAutoLogin() {
  const savedId = getSession();
  if (!savedId) {
    showLoginScreen();
    return;
  }

  showLoading();
  const MAX_ATTEMPTS = 3;
  let data = null, error = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    ({ data, error } = await sb.from('players').select('*').eq('id', savedId).single());
    if (!error && data) break;
    if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
  hideLoading();

  if (error || !data) {
    clearSession();
    showLoginScreen();
    return;
  }

  currentPlayer = data;
  enterApp();
}

// ==========================================
// ENTER APP
// ==========================================
function enterApp() {
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-app').style.display = 'block';

  // Set header & admin privileges
  const isAdmin = checkIsAdmin(currentPlayer);
  currentPlayer.is_admin = isAdmin;

  document.getElementById('header-username').textContent = currentPlayer.name;
  renderHeaderAvatar();
  if (isAdmin) {
    document.getElementById('admin-badge').style.display = 'inline';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  } else {
    document.getElementById('admin-badge').style.display = 'none';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }

  // Load data
  loadActivePichanga();
  setupRealtimeSubscriptions();

  // Default tab
  switchTab('pichanga');
}

// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
  clearSession();
  currentPlayer = null;
  activePichanga = null;
  activeSignups = [];
  mySignup = null;
  // Remove realtime subscriptions
  sb.removeAllChannels();
  showLoginScreen();
});

// ==========================================
// NAVIGATION
// ==========================================
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(tabName) {
  navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  tabContents.forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tabName}`));

  if (tabName === 'stats') loadStats();
  if (tabName === 'history') loadHistory();
  if (tabName === 'pichanga') loadActivePichanga();
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ==========================================
// PICHANGA TAB
// ==========================================
async function loadActivePichanga() {
  // Buscar pichanga abierta; si no hay, mostrar la última cerrada
  // para permitir reporte tardío de equipo y goles (no bloquea nada).
  let { data, error } = await sb
    .from('pichangas')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    showToast('Error cargando pichanga', 'error');
    return;
  }

  if (!data || data.length === 0) {
    ({ data, error } = await sb
      .from('pichangas')
      .select('*')
      .eq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1));

    if (error) {
      showToast('Error cargando pichanga', 'error');
      return;
    }
  }

  if (!data || data.length === 0) {
    activePichanga = null;
    activeSignups = [];
    mySignup = null;
    renderPichanga();
    return;
  }

  activePichanga = data[0];
  await loadSignups();
  renderPichanga();
}

async function loadSignups() {
  if (!activePichanga) return;

  const { data, error } = await sb
    .from('signups')
    .select('*, players(name)')
    .eq('pichanga_id', activePichanga.id);

  if (error) {
    console.error('Error loading signups:', error);
    return;
  }

  activeSignups = data || [];
  mySignup = activeSignups.find(s => s.player_id === currentPlayer.id) || null;
}

function renderPichanga() {
  const emptyEl = document.getElementById('pichanga-empty');
  const activeEl = document.getElementById('pichanga-active');
  const createBtn = document.getElementById('btn-create-pichanga');

  // El botón "Crear Pichanga" aparece cuando NO hay una abierta
  const hayAbierta = activePichanga && activePichanga.status === 'open';
  if (createBtn) createBtn.style.display = hayAbierta ? 'none' : 'block';

  if (!activePichanga) {
    emptyEl.style.display = 'block';
    activeEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  activeEl.style.display = 'block';

  // Date
  const fecha = new Date(activePichanga.fecha + 'T12:00:00');
  const dateStr = fecha.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const dateEl = document.getElementById('pichanga-date');
  if (dateEl) dateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  // Lugar, hora y costo
  const venueEl = document.getElementById('pichanga-venue');
  const horaEl = document.getElementById('pichanga-hora');
  const costEl = document.getElementById('pichanga-cost');
  if (venueEl) venueEl.textContent = activePichanga.sede || 'Zapping Center';
  if (horaEl) horaEl.textContent = activePichanga.hora || '21:00 hrs';
  if (costEl) costEl.textContent = '$' + (activePichanga.costo_por_cabeza || 2500).toLocaleString('es-CL');

  // Status badge (si está cerrada, mostrar el resultado declarado por el admin)
  const statusBadge = document.getElementById('pichanga-status-badge');
  const isOpen = activePichanga.status === 'open';
  if (isOpen) {
    statusBadge.textContent = 'Abierta';
  } else {
    const sBl = activePichanga.score_blanco;
    const sCol = activePichanga.score_color;
    if (sBl === null || sCol === null) {
      statusBadge.textContent = 'Cerrada — Resultado pendiente ⏳';
    } else {
      const resultado = sBl === sCol ? 'Empate 🤝' : (sBl > sCol ? 'Ganó ⬜ Blanco' : 'Ganó 🎨 Color');
      statusBadge.textContent = `Cerrada — ${resultado}`;
    }
  }
  statusBadge.className = `pichanga-status ${isOpen ? 'status-open' : 'status-closed'}`;

  // Resultado grande: solo cuando el admin ya definió el ganador
  const winnerBigEl = document.getElementById('pichanga-winner-big');
  if (winnerBigEl) {
    const sBl = activePichanga.score_blanco;
    const sCol = activePichanga.score_color;
    if (!isOpen && sBl !== null && sCol !== null) {
      let texto;
      if (sBl === sCol) texto = '🤝 Empate';
      else if (sBl > sCol) texto = 'Ganó ⬜ Blanco';
      else texto = 'Ganó 🎨 Color';
      winnerBigEl.textContent = texto;
      winnerBigEl.style.display = 'block';
    } else {
      winnerBigEl.style.display = 'none';
    }
  }

  // My controls — SIEMPRE visibles, aunque esté cerrada:
  // el reporte tardío de equipo/goles no se bloquea y las stats se
  // recalculan solas con cada cambio.
  const controlsEl = document.getElementById('my-controls');
  const signupPrompt = document.getElementById('signup-prompt');
  const signupControls = document.getElementById('signup-controls');

  controlsEl.style.display = 'block';

  if (!mySignup) {
    signupPrompt.style.display = 'block';
    signupControls.style.display = 'none';
    const sb2 = document.getElementById('btn-signup');
    if (sb2) sb2.textContent = isOpen ? '🙋 ¡Me anoto!' : '🙋 Yo jugué (anotarme y reportar)';
  } else {
    signupPrompt.style.display = 'none';
    signupControls.style.display = 'block';

    // Team picker
    const pb = document.getElementById('pick-blanco');
    if (pb) pb.classList.toggle('active-team', mySignup.team === 'blanco');
    const pc = document.getElementById('pick-color');
    if (pc) pc.classList.toggle('active-team', mySignup.team === 'color');

    // Goles del jugador
    const mg = document.getElementById('my-goals');
    if (mg) mg.textContent = mySignup.goals || 0;
  }

  // Total de anotados (el detalle de convocados vive en la pestaña Pichangas)
  const scEl = document.getElementById('signup-count');
  if (scEl) scEl.textContent = activeSignups.length;

  // Admin controls: solo con pichanga abierta. El resultado se edita
  // exclusivamente en la pestaña Pichangas.
  const adminPanel = document.getElementById('admin-pichanga-controls');
  adminPanel.style.display = (checkIsAdmin(currentPlayer) && isOpen) ? 'flex' : 'none';
}

// --- Signup Actions ---
const btnSignupEl = document.getElementById('btn-signup');
if (btnSignupEl) {
  btnSignupEl.addEventListener('click', async () => {
    if (!activePichanga) return;

    const { data, error } = await sb.from('signups').insert({
      pichanga_id: activePichanga.id,
      player_id: currentPlayer.id,
      team: null,
      goals: 0,
      assists: 0
    }).select('*, players(name)').single();

    if (error) {
      showToast('Error al anotarte: ' + error.message, 'error');
      return;
    }

    mySignup = data;
    activeSignups.push(data);
    renderPichanga();
    showToast('¡Te anotaste! 🙋');
  });
}

const btnCancelSignupEl = document.getElementById('btn-cancel-signup');
if (btnCancelSignupEl) {
  btnCancelSignupEl.addEventListener('click', async () => {
    if (!mySignup) return;

    const confirmed = await showModal('¿No juegas?', '¿Seguro que quieres bajarte de la pichanga?');
    if (!confirmed) return;

    const { error } = await sb.from('signups').delete().eq('id', mySignup.id);
    if (error) {
      showToast('Error', 'error');
      return;
    }

    activeSignups = activeSignups.filter(s => s.id !== mySignup.id);
    mySignup = null;
    renderPichanga();
    showToast('Te bajaste de la pichanga');
  });
}

// Team picker
const pickBlancoEl = document.getElementById('pick-blanco');
if (pickBlancoEl) pickBlancoEl.addEventListener('click', () => selectTeam('blanco'));

const pickColorEl = document.getElementById('pick-color');
if (pickColorEl) pickColorEl.addEventListener('click', () => selectTeam('color'));

async function selectTeam(team) {
  if (!mySignup) {
    showToast('Debes estar anotado para elegir equipo', 'error');
    return;
  }

  showLoading();
  const { data, error } = await sb.from('signups')
    .update({ team })
    .eq('id', mySignup.id)
    .select();
  hideLoading();

  if (error) {
    showToast('Error al elegir equipo: ' + error.message, 'error');
    return;
  }

  if (!data || data.length === 0) {
    showToast('Inscripción no encontrada. Recargando...', 'error');
    await loadSignups();
    renderPichanga();
    return;
  }

  mySignup.team = team;
  const idx = activeSignups.findIndex(s => s.id === mySignup.id);
  if (idx >= 0) activeSignups[idx].team = team;
  renderPichanga();
  showToast(team === 'blanco' ? '⬜ Equipo Blanco' : '🎨 Equipo Color');
}

// Goles del jugador (las asistencias se eliminaron; el ganador NO se
// calcula de los goles — lo define el Admin).
const btnGoalPlusEl = document.getElementById('btn-goal-plus');
if (btnGoalPlusEl) btnGoalPlusEl.addEventListener('click', () => updateGoals(1));

const btnGoalMinusEl = document.getElementById('btn-goal-minus');
if (btnGoalMinusEl) btnGoalMinusEl.addEventListener('click', () => updateGoals(-1));

async function updateGoals(delta) {
  if (!mySignup) {
    showToast('Debes estar anotado para sumar goles', 'error');
    return;
  }
  const newGoals = Math.max(0, (mySignup.goals || 0) + delta);

  const { data, error } = await sb.from('signups')
    .update({ goals: newGoals })
    .eq('id', mySignup.id)
    .select();

  if (error) {
    showToast('Error al actualizar goles', 'error');
    return;
  }

  if (!data || data.length === 0) {
    showToast('Inscripción no encontrada. Recargando...', 'error');
    await loadSignups();
    renderPichanga();
    return;
  }

  mySignup.goals = newGoals;
  const idx = activeSignups.findIndex(s => s.id === mySignup.id);
  if (idx >= 0) activeSignups[idx].goals = newGoals;
  renderPichanga();
}

function checkIsAdmin(player) {
  if (!player) return false;
  const name = (player.name || '').toLowerCase();
  return name.includes('gacela') || name.includes('bruno') || player.is_admin === true;
}

// --- Admin Actions ---
// (El botón "Crear Pichanga" abre el modal vía onclick=openCreatePichangaModal;
//  ya no requiere ser admin — cualquier jugador puede crear.)

const btnCancelCreateEl = document.getElementById('btn-cancel-create-pichanga');
if (btnCancelCreateEl) {
  btnCancelCreateEl.addEventListener('click', () => {
    const modal = document.getElementById('modal-create-pichanga');
    if (modal) modal.style.display = 'none';
  });
}

const btnConfirmCreateEl = document.getElementById('btn-confirm-create-pichanga');
if (btnConfirmCreateEl) {
  btnConfirmCreateEl.addEventListener('click', async () => {
    // Cualquier jugador puede crear
    const sede = document.getElementById('create-sede')?.value || 'Zapping Center';
    const horaRaw = document.getElementById('create-hora')?.value || '21:00';
    const hora = horaRaw ? (horaRaw + ' hrs') : '21:00 hrs';

    const modal = document.getElementById('modal-create-pichanga');
    if (modal) modal.style.display = 'none';
    showLoading();

    try {
      const base = {
        fecha: new Date().toISOString().split('T')[0],
        status: 'open',
        sede: sede
      };
      // Intentar guardar la hora; si la columna aún no existe en Supabase, crear sin ella
      let { data, error } = await sb.from('pichangas').insert({ ...base, hora }).select().single();
      if (error) {
        ({ data, error } = await sb.from('pichangas').insert(base).select().single());
      }
      hideLoading();

      if (error) {
        showToast('Error al crear pichanga: ' + error.message, 'error');
        return;
      }

      activePichanga = data;
      activeSignups = [];
      mySignup = null;
      renderPichanga();
      showToast(`¡Pichanga creada en ${sede} · ${hora}! 🏟️`);
    } catch (err) {
      hideLoading();
      showToast('Error al crear pichanga', 'error');
      console.error(err);
    }
  });
}

// Target del modal de ganador (solo se abre desde la pestaña Pichangas)
let winnerTarget = null; // { id }

// Cerrar pichanga: SOLO cierra. El resultado queda pendiente y el admin
// lo define después en la pestaña Pichangas con "Editar resultado".
const btnClosePichangaEl = document.getElementById('btn-close-pichanga');
if (btnClosePichangaEl) {
  btnClosePichangaEl.addEventListener('click', async () => {
    if (!checkIsAdmin(currentPlayer) || !activePichanga) return;

    const confirmed = await showModal('Cerrar pichanga', 'Se cierra la pichanga. El resultado lo defines después en la pestaña Pichangas (los jugadores igual pueden seguir reportando).');
    if (!confirmed) return;

    showLoading();
    const { error } = await sb.from('pichangas')
      .update({ status: 'closed', score_blanco: null, score_color: null })
      .eq('id', activePichanga.id);
    hideLoading();

    if (error) {
      showToast('Error al cerrar pichanga', 'error');
      return;
    }

    showToast('Pichanga cerrada 🏁 Define el ganador en 📋 Pichangas');
    loadActivePichanga();
  });
}

function closeWinnerModal() {
  const modal = document.getElementById('modal-winner');
  if (modal) modal.style.display = 'none';
}

const btnCancelWinnerEl = document.getElementById('btn-cancel-winner');
if (btnCancelWinnerEl) btnCancelWinnerEl.addEventListener('click', closeWinnerModal);

// El equipo ganador se guarda en score_blanco/score_color (1-0, 0-1 o 1-1 empate)
// para no tener que migrar la base de datos. Se usa SOLO desde la pestaña
// Pichangas ("Editar resultado"). Al elegir ganador, la victoria se cuenta
// automáticamente a los jugadores de ese equipo.
async function declararGanador(winner) {
  if (!checkIsAdmin(currentPlayer) || !winnerTarget) return;

  let scoreBl = 0, scoreCol = 0;
  if (winner === 'blanco') { scoreBl = 1; scoreCol = 0; }
  else if (winner === 'color') { scoreBl = 0; scoreCol = 1; }
  else { scoreBl = 1; scoreCol = 1; } // empate

  const { id } = winnerTarget;
  closeWinnerModal();
  showLoading();
  const { error } = await sb.from('pichangas')
    .update({ status: 'closed', score_blanco: scoreBl, score_color: scoreCol })
    .eq('id', id);
  hideLoading();

  if (error) {
    showToast('Error al guardar resultado', 'error');
    return;
  }

  const txt = winner === 'empate' ? 'Empate 🤝' : (winner === 'blanco' ? 'Ganó ⬜ Blanco' : 'Ganó 🎨 Color');
  winnerTarget = null;
  showToast(`Resultado guardado — ${txt} 🏆`);
  loadHistory();
  loadActivePichanga();
}

const btnWinnerBlancoEl = document.getElementById('btn-winner-blanco');
if (btnWinnerBlancoEl) btnWinnerBlancoEl.addEventListener('click', () => declararGanador('blanco'));

const btnWinnerColorEl = document.getElementById('btn-winner-color');
if (btnWinnerColorEl) btnWinnerColorEl.addEventListener('click', () => declararGanador('color'));

const btnWinnerEmpateEl = document.getElementById('btn-winner-empate');
if (btnWinnerEmpateEl) btnWinnerEmpateEl.addEventListener('click', () => declararGanador('empate'));

const btnDeletePichangaEl = document.getElementById('btn-delete-pichanga');
if (btnDeletePichangaEl) {
  btnDeletePichangaEl.addEventListener('click', async () => {
    if (!currentPlayer?.is_admin || !activePichanga) return;

    const confirmed = await showModal('Eliminar pichanga', '¿Seguro? Se borrarán todas las inscripciones.');
    if (!confirmed) return;

    showLoading();
    const { error } = await sb.from('pichangas').delete().eq('id', activePichanga.id);
    hideLoading();

    if (error) {
      showToast('Error al eliminar', 'error');
      return;
    }

    showToast('Pichanga eliminada', 'error');
    activePichanga = null;
    activeSignups = [];
    mySignup = null;
    loadActivePichanga();
  });
}

// ==========================================
// REALTIME SUBSCRIPTIONS
// ==========================================
function setupRealtimeSubscriptions() {
  // Listen for signup changes
  sb.channel('signups-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'signups' }, async (payload) => {
      if (activePichanga) {
        await loadSignups();
        renderPichanga();
      }
    })
    .subscribe();

  // Listen for pichanga changes
  sb.channel('pichangas-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pichangas' }, async () => {
      await loadActivePichanga();
    })
    .subscribe();
}

// ==========================================
// STATS TAB
// ==========================================
async function loadStats() {
  try {
    // Get all closed pichangas with their signups
    const { data: pichangas, error: pError } = await sb
      .from('pichangas')
      .select('id, score_blanco, score_color, costo_por_cabeza')
      .eq('status', 'closed');

    if (pError) {
      console.error('Stats error:', pError);
      return;
    }

    const table = document.getElementById('stats-table');
    const empty = document.getElementById('stats-empty');

    function toggleTables(show) {
      if (table) table.style.display = show ? 'table' : 'none';
      if (empty) empty.style.display = show ? 'none' : 'block';
    }

    if (!pichangas || pichangas.length === 0) {
      document.getElementById('total-matches').textContent = '0';
      const tg0 = document.getElementById('total-goals');
      if (tg0) tg0.textContent = '0';
      const spentEl = document.getElementById('total-spent');
      if (spentEl) spentEl.textContent = '$0';
      toggleTables(false);
      return;
    }

    const { data: signups, error: sError } = await sb
      .from('signups')
      .select('player_id, team, goals, assists, pichanga_id, players(name)')
      .in('pichanga_id', pichangas.map(p => p.id));

    if (sError || !signups || signups.length === 0) {
      toggleTables(false);
      return;
    }

  // Build pichanga lookup
  const pichangaMap = {};
  pichangas.forEach(p => { pichangaMap[p.id] = p; });

  // Calculate per-player stats
  const playerStats = {};

  signups.forEach(s => {
    if (!playerStats[s.player_id]) {
      playerStats[s.player_id] = {
        name: s.players?.name || '???',
        matches: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, totalSpent: 0
      };
    }

    const ps = playerStats[s.player_id];
    ps.matches++;
    ps.goals += (s.goals || 0);
    ps.assists += (s.assists || 0);

    const pich = pichangaMap[s.pichanga_id];
    const cost = pich ? (pich.costo_por_cabeza || 2500) : 2500;
    ps.totalSpent += cost;

    // Victorias/derrotas solo si el admin ya definió el resultado
    const hasResult = pich && pich.score_blanco !== null && pich.score_color !== null;
    if (hasResult && s.team) {
      const isDraw = pich.score_blanco === pich.score_color;
      if (isDraw) {
        ps.draws++;
      } else {
        const blancoWins = pich.score_blanco > pich.score_color;
        const playerWon = (s.team === 'blanco' && blancoWins) || (s.team === 'color' && !blancoWins);
        if (playerWon) ps.wins++;
        else ps.losses++;
      }
    }
  });

  // Summary — total de goles reportados por los jugadores (no el marcador del admin)
  const totalGoals = Object.values(playerStats).reduce((sum, ps) => sum + ps.goals, 0);
  const grandTotalSpent = Object.values(playerStats).reduce((sum, ps) => sum + ps.totalSpent, 0);

  document.getElementById('total-matches').textContent = pichangas.length;
  const tgEl = document.getElementById('total-goals');
  if (tgEl) tgEl.textContent = totalGoals;
  const spentEl = document.getElementById('total-spent');
  if (spentEl) spentEl.textContent = '$' + grandTotalSpent.toLocaleString('es-CL');

  // Build rows
  let rows = Object.entries(playerStats).map(([id, s]) => ({
    id,
    ...s,
    winRate: s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0
  }));

  const tbody = document.getElementById('stats-body');

  if (rows.length === 0) {
    toggleTables(false);
    return;
  }

  toggleTables(true);

  // Ordenar por la columna seleccionada (PJ, Victorias, Derrotas o Goles)
  rows.sort((a, b) => {
    const diff = b[currentSort] - a[currentSort];
    if (diff !== 0) return diff;
    return b.wins - a.wins;
  });

  tbody.innerHTML = rows.map((r, i) => {
    const rank = i + 1;
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    return `
      <tr>
        <td><span class="player-rank ${rankClass}">${medal || rank}</span></td>
        <td class="td-name">${escapeHtml(r.name)}</td>
        <td style="font-weight:800;">${r.matches}</td>
        <td class="td-wins">${r.wins}</td>
        <td class="td-losses">${r.losses}</td>
        <td class="td-goals">${r.goals}</td>
        <td style="color:var(--yellow);font-weight:700;">$${r.totalSpent.toLocaleString('es-CL')}</td>
      </tr>
    `;
  }).join('');

  // Encabezados ordenables
  document.querySelectorAll('#stats-table th.sortable').forEach(th => {
    th.classList.toggle('active-sort', th.dataset.sort === currentSort);
    th.onclick = () => {
      currentSort = th.dataset.sort;
      loadStats();
    };
  });

  // Chips "Ordenar por" (arriba de la tabla)
  document.querySelectorAll('.stats-sort-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.sort === currentSort);
    chip.onclick = () => {
      currentSort = chip.dataset.sort;
      loadStats();
    };
  });
  } catch (err) {
    console.error('Error in loadStats:', err);
  }
}

// ==========================================
// HISTORY TAB
// ==========================================
async function loadHistory() {
  const { data: pichangas, error } = await sb
    .from('pichangas')
    .select('*')
    .eq('status', 'closed')
    .order('fecha', { ascending: false });

  if (error) { showToast('Error', 'error'); return; }

  const container = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  if (!pichangas || pichangas.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  // Load signups for all pichangas
  const { data: allSignups } = await sb
    .from('signups')
    .select('*, players(name)')
    .in('pichanga_id', pichangas.map(p => p.id));

  container.innerHTML = pichangas.map(m => {
    const fecha = new Date(m.fecha + 'T12:00:00');
    const dateStr = fecha.toLocaleDateString('es-CL', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });

    const hasResult = m.score_blanco !== null && m.score_color !== null;
    const isDraw = hasResult && m.score_blanco === m.score_color;
    const blancoWins = hasResult && m.score_blanco > m.score_color;
    const scoreClassBl = !hasResult ? 'draw' : (isDraw ? 'draw' : (blancoWins ? 'winner' : 'loser'));
    const scoreClassCol = !hasResult ? 'draw' : (isDraw ? 'draw' : (blancoWins ? 'loser' : 'winner'));

    const mSignups = (allSignups || []).filter(s => s.pichanga_id === m.id);
    const blancoPlayers = mSignups.filter(s => s.team === 'blanco');
    const colorPlayers = mSignups.filter(s => s.team === 'color');

    const playersBlHtml = blancoPlayers.map(s => {
      const goals = s.goals || 0;
      const goalStr = goals > 0 ? ` <span class="history-player-goals">(${goals}⚽)</span>` : '';
      return `${escapeHtml(s.players?.name || '???')}${goalStr}`;
    }).join('<br>') || '<span style="color:var(--text-muted)">—</span>';

    const playersColHtml = colorPlayers.map(s => {
      const goals = s.goals || 0;
      const goalStr = goals > 0 ? ` <span class="history-player-goals">(${goals}⚽)</span>` : '';
      return `${escapeHtml(s.players?.name || '???')}${goalStr}`;
    }).join('<br>') || '<span style="color:var(--text-muted)">—</span>';

    // Resultado (lo define el admin; mientras tanto queda pendiente)
    const resultBl = !hasResult ? '⏳ Pendiente' : (isDraw ? '🤝 Empate' : (blancoWins ? '🏆 Ganó' : 'Perdió'));
    const resultCol = !hasResult ? '⏳ Pendiente' : (isDraw ? '🤝 Empate' : (blancoWins ? 'Perdió' : '🏆 Ganó'));

    const sedeName = m.sede || 'Zapping Center';
    const costoVal = '$' + (m.costo_por_cabeza || 2500).toLocaleString('es-CL');

    const adminDeleteHtml = checkIsAdmin(currentPlayer) ? `
      <div class="history-delete-container" style="display:flex; gap:0.5rem; justify-content:flex-end; flex-wrap:wrap;">
        <button class="btn-edit-winner" data-id="${m.id}" style="background:rgba(245,197,24,0.12); color:var(--yellow); border:1px solid rgba(245,197,24,0.4); border-radius:var(--radius-md); padding:0.35rem 0.7rem; font-size:0.75rem; font-weight:700; cursor:pointer;">✏️ Editar resultado</button>
        <button class="btn-delete-match" data-id="${m.id}">🗑️ Eliminar</button>
      </div>
    ` : '';

    return `
      <div class="history-card" data-id="${m.id}">
        <div class="history-card-header">
          <span class="history-date">📍 <strong>${escapeHtml(sedeName)}</strong> · ${dateStr}</span>
          <span style="font-size:0.75rem; font-weight:700; color:var(--yellow);">👥 ${mSignups.length} · ${costoVal} / jug.</span>
        </div>
        <div class="history-score-row">
          <div class="history-team">
            <div class="history-team-label">⬜ Blanco</div>
            <div class="history-team-score ${scoreClassBl}" style="font-size:0.9rem;">${resultBl}</div>
          </div>
          <span class="history-vs">VS</span>
          <div class="history-team">
            <div class="history-team-label">🎨 Color</div>
            <div class="history-team-score ${scoreClassCol}" style="font-size:0.9rem;">${resultCol}</div>
          </div>
        </div>
        <div class="history-players">
          <div class="history-player-list">${playersBlHtml}</div>
          <div class="history-player-list">${playersColHtml}</div>
        </div>
        ${adminDeleteHtml}
      </div>
    `;
  }).join('');

  // Edit winner handlers (admin only)
  container.querySelectorAll('.btn-edit-winner').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!checkIsAdmin(currentPlayer)) return;
      winnerTarget = { id: btn.dataset.id, mode: 'edit' };
      const warnEl = document.getElementById('winner-team-warning');
      if (warnEl) warnEl.style.display = 'none';
      const modal = document.getElementById('modal-winner');
      if (modal) modal.style.display = 'flex';
    });
  });

  // Delete handlers (admin only)
  container.querySelectorAll('.btn-delete-match').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showModal('Eliminar pichanga', '¿Seguro? Se borrarán todos los datos de esta pichanga.');
      if (!confirmed) return;

      showLoading();
      const { error } = await sb.from('pichangas').delete().eq('id', btn.dataset.id);
      hideLoading();

      if (error) {
        showToast('Error al eliminar', 'error');
        return;
      }

      showToast('Pichanga eliminada', 'error');
      loadHistory();
    });
  });
}

// ==========================================
// ★ CARTEL LUMINOSO ROTATIVO ★
// ==========================================
function initLedBanner() {
  const track = document.getElementById('led-track');
  if (!track) return;

  const frases = (Array.isArray(BANNER_FRASES) && BANNER_FRASES.length)
    ? BANNER_FRASES
    : ['Bolsilleras ⚽'];
  let i = 0;

  function playNext() {
    const frase = frases[i % frases.length];
    i++;

    // Velocidad según largo (más texto = más tiempo, para que se lea)
    const dur = Math.max(9, Math.round(frase.length * 0.42));
    track.textContent = '★  ' + frase + '  ★';
    track.style.setProperty('--led-dur', dur + 's');

    // Reiniciar la animación de scroll
    track.classList.remove('led-run');
    void track.offsetWidth; // fuerza reflow
    track.classList.add('led-run');
  }

  track.addEventListener('animationend', (e) => {
    if (e.animationName === 'led-scroll') playNext();
  });

  playNext();
}

// ==========================================
// ★ EDITOR DE PERSONAJE (AVATAR) ★
// ==========================================
let avatarEditCfg = null;

function renderHeaderAvatar() {
  const el = document.getElementById('header-avatar');
  if (!el || !currentPlayer) return;
  // Oculto para el público: solo visible en modo público o para el admin (pruebas)
  const puedeVer = AVATARES_PUBLICO || checkIsAdmin(currentPlayer);
  if (!puedeVer) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = avatarSVG(currentPlayer.avatar || avatarDefault());
}

function openAvatarEditor() {
  if (!currentPlayer) return;
  if (!AVATARES_PUBLICO && !checkIsAdmin(currentPlayer)) return; // oculto al público
  avatarEditCfg = avatarNormalize(currentPlayer.avatar || avatarDefault());
  renderAvatarEditor();
  const modal = document.getElementById('modal-avatar');
  if (modal) modal.style.display = 'flex';
}

function renderAvatarEditor() {
  const prev = document.getElementById('avatar-preview');
  if (prev) prev.innerHTML = avatarSVG(avatarEditCfg);

  const wrap = document.getElementById('avatar-controls');
  if (!wrap) return;

  const swatchRow = (label, key, colors) => `
    <div class="av-row">
      <span class="av-row-label">${label}</span>
      <div class="av-opts">
        ${colors.map((col, i) => `
          <button class="av-swatch ${avatarEditCfg[key] === i ? 'active' : ''}"
                  data-key="${key}" data-val="${i}"
                  style="background:${col}"></button>`).join('')}
      </div>
    </div>`;

  const chipRow = (label, key, names) => `
    <div class="av-row">
      <span class="av-row-label">${label}</span>
      <div class="av-opts">
        ${names.map((nm, i) => `
          <button class="av-chip ${avatarEditCfg[key] === i ? 'active' : ''}"
                  data-key="${key}" data-val="${i}">${nm}</button>`).join('')}
      </div>
    </div>`;

  const jerseyRow = () => `
    <div class="av-row">
      <span class="av-row-label">Camiseta</span>
      <div class="av-opts">
        ${AVATAR_OPTIONS.jersey.map(j => `
          <button class="av-chip av-chip-jersey ${avatarEditCfg.jersey === j.id ? 'active' : ''}"
                  data-key="jersey" data-val="${j.id}">
            <span class="av-jersey-dot" style="background:${j.main};border-color:${j.sec}"></span>${j.name}
          </button>`).join('')}
      </div>
    </div>`;

  wrap.innerHTML =
    swatchRow('Piel', 'skin', AVATAR_OPTIONS.skin) +
    chipRow('Peinado', 'hairStyle', AVATAR_OPTIONS.hairStyle) +
    swatchRow('Color de pelo', 'hairColor', AVATAR_OPTIONS.hairColor) +
    jerseyRow() +
    chipRow('Accesorio', 'accessory', AVATAR_OPTIONS.accessory);

  wrap.querySelectorAll('[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.key;
      const v = btn.dataset.val;
      avatarEditCfg[k] = (k === 'jersey') ? v : parseInt(v, 10);
      renderAvatarEditor();
    });
  });
}

async function saveAvatar() {
  if (!currentPlayer || !avatarEditCfg) return;
  const cfg = avatarNormalize(avatarEditCfg);
  showLoading();
  const { error } = await sb.from('players').update({ avatar: cfg }).eq('id', currentPlayer.id);
  hideLoading();

  if (error) {
    showToast('Falta activar los personajes en la base de datos (avísale al admin)', 'error');
    console.error('saveAvatar:', error);
    return;
  }

  currentPlayer.avatar = cfg;
  const modal = document.getElementById('modal-avatar');
  if (modal) modal.style.display = 'none';
  renderHeaderAvatar();

  // Actualizar la caché local de jugadores para que se vea al recargar
  try {
    const cached = JSON.parse(localStorage.getItem('bolsilleras_cached_players') || '[]');
    const idx = cached.findIndex(p => p.id === currentPlayer.id);
    if (idx >= 0) { cached[idx].avatar = cfg; localStorage.setItem('bolsilleras_cached_players', JSON.stringify(cached)); }
  } catch (e) {}

  showToast('¡Personaje guardado! 🎽');
}

document.getElementById('header-avatar')?.addEventListener('click', openAvatarEditor);
document.getElementById('btn-save-avatar')?.addEventListener('click', saveAvatar);
document.getElementById('btn-cancel-avatar')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-avatar');
  if (modal) modal.style.display = 'none';
});

// ==========================================
// INIT
// ==========================================
initLedBanner();
tryAutoLogin();
