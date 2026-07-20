/* ============================================
   BOLSILLERAS — Supabase Multi-Player App
   ============================================ */

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
let currentSort = 'winRate';

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

function showLoading() { document.getElementById('loading-overlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

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
document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').style.display = 'none';
  if (modalResolve) modalResolve(false);
});
document.getElementById('modal-confirm').addEventListener('click', () => {
  document.getElementById('modal-overlay').style.display = 'none';
  if (modalResolve) modalResolve(true);
});

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
  document.getElementById('screen-login').style.display = 'block';
  document.getElementById('screen-app').style.display = 'none';
  showLoginPlayerList();
}

async function showLoginPlayerList() {
  document.getElementById('login-player-list-section').style.display = 'block';
  document.getElementById('login-register-section').style.display = 'none';
  document.getElementById('login-pin-section').style.display = 'none';

  const { data: players, error } = await sb.from('players').select('id, name').order('name');
  if (error) {
    showToast('Error cargando jugadores', 'error');
    return;
  }

  const list = document.getElementById('login-player-list');
  if (players.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:1rem;">No hay jugadores. Crea la primera cuenta.</p>';
    return;
  }

  list.innerHTML = players.map(p => `
    <button class="login-player-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
      <div class="player-avatar">${getInitials(p.name)}</div>
      <span>${escapeHtml(p.name)}</span>
    </button>
  `).join('');

  list.querySelectorAll('.login-player-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showPinInput(btn.dataset.id, btn.dataset.name);
    });
  });
}

function showPinInput(playerId, playerName) {
  document.getElementById('login-player-list-section').style.display = 'none';
  document.getElementById('login-pin-section').style.display = 'block';
  document.getElementById('pin-player-name').textContent = playerName;
  document.getElementById('login-pin').value = '';
  document.getElementById('login-pin').focus();

  // Store selected player id temporarily
  document.getElementById('login-pin-section').dataset.playerId = playerId;
}

// PIN login
document.getElementById('btn-login-pin').addEventListener('click', loginWithPin);
document.getElementById('login-pin').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginWithPin();
});

async function loginWithPin() {
  const playerId = document.getElementById('login-pin-section').dataset.playerId;
  const pin = document.getElementById('login-pin').value.trim();

  if (pin.length !== 4) {
    showToast('El PIN debe ser de 4 dígitos', 'error');
    return;
  }

  showLoading();
  const { data, error } = await sb.from('players').select('*').eq('id', playerId).single();
  hideLoading();

  if (error || !data) {
    showToast('Error al iniciar sesión', 'error');
    return;
  }

  if (data.pin !== pin) {
    showToast('PIN incorrecto', 'error');
    document.getElementById('login-pin').value = '';
    document.getElementById('login-pin').focus();
    return;
  }

  currentPlayer = data;
  saveSession(data.id);
  enterApp();
}

// Register
document.getElementById('btn-show-register').addEventListener('click', () => {
  document.getElementById('login-player-list-section').style.display = 'none';
  document.getElementById('login-register-section').style.display = 'block';
  document.getElementById('reg-name').focus();
});

document.getElementById('btn-back-to-list').addEventListener('click', showLoginPlayerList);
document.getElementById('btn-back-from-pin').addEventListener('click', showLoginPlayerList);

document.getElementById('btn-register').addEventListener('click', registerPlayer);
document.getElementById('reg-pin').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') registerPlayer();
});

async function registerPlayer() {
  const name = document.getElementById('reg-name').value.trim();
  const pin = document.getElementById('reg-pin').value.trim();

  if (!name) { showToast('Ingresa tu nombre', 'error'); return; }
  if (name.length < 2) { showToast('Nombre muy corto', 'error'); return; }
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { showToast('El PIN debe ser de 4 dígitos', 'error'); return; }

  showLoading();

  // Check if name already exists
  const { data: existing } = await sb.from('players').select('id').ilike('name', name);
  if (existing && existing.length > 0) {
    hideLoading();
    showToast('Ya existe un jugador con ese nombre', 'error');
    return;
  }

  // Check if first player → make admin
  const { count } = await sb.from('players').select('id', { count: 'exact', head: true });
  const isAdmin = count === 0;

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

  currentPlayer = data;
  saveSession(data.id);
  showToast(`¡Bienvenido ${name}! ${isAdmin ? '(Eres admin 👑)' : '⚽'}`);
  enterApp();
}

// Auto-login on page load
async function tryAutoLogin() {
  const savedId = getSession();
  if (!savedId) {
    showLoginScreen();
    return;
  }

  showLoading();
  const { data, error } = await sb.from('players').select('*').eq('id', savedId).single();
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

  // Set header
  document.getElementById('header-username').textContent = currentPlayer.name;
  if (currentPlayer.is_admin) {
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
  // Find the latest open pichanga
  const { data, error } = await sb
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
  document.getElementById('pichanga-date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // Status badge
  const statusBadge = document.getElementById('pichanga-status-badge');
  const isOpen = activePichanga.status === 'open';
  statusBadge.textContent = isOpen ? 'Abierta' : 'Cerrada';
  statusBadge.className = `pichanga-status ${isOpen ? 'status-open' : 'status-closed'}`;

  // Live scores
  const blancoGoals = activeSignups
    .filter(s => s.team === 'blanco')
    .reduce((sum, s) => sum + (s.goals || 0), 0);
  const colorGoals = activeSignups
    .filter(s => s.team === 'color')
    .reduce((sum, s) => sum + (s.goals || 0), 0);
  document.getElementById('live-score-blanco').textContent = blancoGoals;
  document.getElementById('live-score-color').textContent = colorGoals;

  // My controls
  const controlsEl = document.getElementById('my-controls');
  const signupPrompt = document.getElementById('signup-prompt');
  const signupControls = document.getElementById('signup-controls');

  if (!isOpen) {
    controlsEl.style.display = 'none';
  } else {
    controlsEl.style.display = 'block';

    if (!mySignup) {
      signupPrompt.style.display = 'block';
      signupControls.style.display = 'none';
    } else {
      signupPrompt.style.display = 'none';
      signupControls.style.display = 'block';

      // Team picker
      document.getElementById('pick-blanco').classList.toggle('active-team', mySignup.team === 'blanco');
      document.getElementById('pick-color').classList.toggle('active-team', mySignup.team === 'color');

      // Goals
      document.getElementById('my-goals').textContent = mySignup.goals || 0;
    }
  }

  // Signups list
  const blancoPlayers = activeSignups.filter(s => s.team === 'blanco');
  const colorPlayers = activeSignups.filter(s => s.team === 'color');
  const noTeamPlayers = activeSignups.filter(s => !s.team);

  document.getElementById('signup-count').textContent = activeSignups.length;
  document.getElementById('blanco-count').textContent = blancoPlayers.length;
  document.getElementById('color-count').textContent = colorPlayers.length;

  document.getElementById('signups-blanco').innerHTML = blancoPlayers.map(s => `
    <div class="signup-player-chip">
      <span>${escapeHtml(s.players?.name || '???')}</span>
      ${s.goals > 0 ? `<span class="signup-player-goals">${s.goals}⚽</span>` : ''}
    </div>
  `).join('') || '<div style="padding:0.5rem;font-size:0.7rem;color:var(--text-muted);">—</div>';

  document.getElementById('signups-color').innerHTML = colorPlayers.map(s => `
    <div class="signup-player-chip">
      <span>${escapeHtml(s.players?.name || '???')}</span>
      ${s.goals > 0 ? `<span class="signup-player-goals">${s.goals}⚽</span>` : ''}
    </div>
  `).join('') || '<div style="padding:0.5rem;font-size:0.7rem;color:var(--text-muted);">—</div>';

  const noTeamEl = document.getElementById('signups-no-team');
  if (noTeamPlayers.length > 0) {
    noTeamEl.innerHTML = `
      <div class="signups-no-team-label">Sin equipo:</div>
      ${noTeamPlayers.map(s => `<span class="no-team-chip">${escapeHtml(s.players?.name || '???')}</span>`).join('')}
    `;
  } else {
    noTeamEl.innerHTML = '';
  }

  // Admin controls visibility
  if (currentPlayer.is_admin && isOpen) {
    document.getElementById('admin-pichanga-controls').style.display = 'flex';
  } else {
    document.getElementById('admin-pichanga-controls').style.display = 'none';
  }
}

// --- Signup Actions ---
document.getElementById('btn-signup').addEventListener('click', async () => {
  if (!activePichanga) return;

  const { data, error } = await sb.from('signups').insert({
    pichanga_id: activePichanga.id,
    player_id: currentPlayer.id,
    team: null,
    goals: 0
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

document.getElementById('btn-cancel-signup').addEventListener('click', async () => {
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

// Team picker
document.getElementById('pick-blanco').addEventListener('click', () => selectTeam('blanco'));
document.getElementById('pick-color').addEventListener('click', () => selectTeam('color'));

async function selectTeam(team) {
  if (!mySignup) return;

  const { error } = await sb.from('signups')
    .update({ team })
    .eq('id', mySignup.id);

  if (error) {
    showToast('Error al elegir equipo', 'error');
    return;
  }

  mySignup.team = team;
  const idx = activeSignups.findIndex(s => s.id === mySignup.id);
  if (idx >= 0) activeSignups[idx].team = team;
  renderPichanga();
  showToast(team === 'blanco' ? '⬜ Equipo Blanco' : '🎨 Equipo Color');
}

// Goals
document.getElementById('btn-goal-plus').addEventListener('click', () => updateGoals(1));
document.getElementById('btn-goal-minus').addEventListener('click', () => updateGoals(-1));

async function updateGoals(delta) {
  if (!mySignup) return;
  const newGoals = Math.max(0, (mySignup.goals || 0) + delta);

  const { error } = await sb.from('signups')
    .update({ goals: newGoals })
    .eq('id', mySignup.id);

  if (error) {
    showToast('Error', 'error');
    return;
  }

  mySignup.goals = newGoals;
  const idx = activeSignups.findIndex(s => s.id === mySignup.id);
  if (idx >= 0) activeSignups[idx].goals = newGoals;
  renderPichanga();
}

// --- Admin Actions ---
document.getElementById('btn-create-pichanga').addEventListener('click', async () => {
  if (!currentPlayer.is_admin) return;

  showLoading();
  const { data, error } = await sb.from('pichangas').insert({
    fecha: new Date().toISOString().split('T')[0],
    status: 'open'
  }).select().single();
  hideLoading();

  if (error) {
    showToast('Error al crear pichanga: ' + error.message, 'error');
    return;
  }

  activePichanga = data;
  activeSignups = [];
  mySignup = null;
  renderPichanga();
  showToast('¡Pichanga creada! 🏟️');
});

document.getElementById('btn-close-pichanga').addEventListener('click', async () => {
  if (!currentPlayer.is_admin || !activePichanga) return;

  const confirmed = await showModal('Cerrar pichanga', '¿Seguro? Se calcularán los resultados finales.');
  if (!confirmed) return;

  // Calculate final scores
  const scoreBl = activeSignups
    .filter(s => s.team === 'blanco')
    .reduce((sum, s) => sum + (s.goals || 0), 0);
  const scoreCol = activeSignups
    .filter(s => s.team === 'color')
    .reduce((sum, s) => sum + (s.goals || 0), 0);

  showLoading();
  const { error } = await sb.from('pichangas')
    .update({
      status: 'closed',
      score_blanco: scoreBl,
      score_color: scoreCol
    })
    .eq('id', activePichanga.id);
  hideLoading();

  if (error) {
    showToast('Error al cerrar pichanga', 'error');
    return;
  }

  showToast(`Pichanga cerrada: Blanco ${scoreBl} - ${scoreCol} Color 🏁`);
  activePichanga = null;
  activeSignups = [];
  mySignup = null;
  loadActivePichanga();
});

document.getElementById('btn-delete-pichanga').addEventListener('click', async () => {
  if (!currentPlayer.is_admin || !activePichanga) return;

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
  // Get all closed pichangas with their signups
  const { data: pichangas, error: pError } = await sb
    .from('pichangas')
    .select('id, score_blanco, score_color')
    .eq('status', 'closed');

  if (pError) { showToast('Error cargando stats', 'error'); return; }

  const { data: signups, error: sError } = await sb
    .from('signups')
    .select('player_id, team, goals, pichanga_id, players(name)')
    .in('pichanga_id', pichangas.map(p => p.id));

  if (sError) { showToast('Error cargando stats', 'error'); return; }

  // Build pichanga lookup
  const pichangaMap = {};
  pichangas.forEach(p => { pichangaMap[p.id] = p; });

  // Calculate per-player stats
  const playerStats = {};

  signups.forEach(s => {
    if (!playerStats[s.player_id]) {
      playerStats[s.player_id] = {
        name: s.players?.name || '???',
        matches: 0, wins: 0, draws: 0, losses: 0, goals: 0
      };
    }

    const ps = playerStats[s.player_id];
    ps.matches++;
    ps.goals += (s.goals || 0);

    const pich = pichangaMap[s.pichanga_id];
    if (pich && s.team) {
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

  // Summary
  const totalGoals = pichangas.reduce((sum, p) => sum + (p.score_blanco || 0) + (p.score_color || 0), 0);
  document.getElementById('total-matches').textContent = pichangas.length;
  document.getElementById('total-goals').textContent = totalGoals;

  const { count } = await sb.from('players').select('id', { count: 'exact', head: true });
  document.getElementById('total-players').textContent = count || 0;

  // Build rows
  let rows = Object.entries(playerStats).map(([id, s]) => ({
    id,
    ...s,
    winRate: s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0
  }));

  const tbody = document.getElementById('stats-body');
  const table = document.getElementById('stats-table');
  const empty = document.getElementById('stats-empty');

  if (rows.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  table.style.display = 'table';
  empty.style.display = 'none';

  // Sort
  rows.sort((a, b) => {
    const diff = b[currentSort] - a[currentSort];
    if (diff !== 0) return diff;
    if (currentSort !== 'winRate') {
      const wrDiff = b.winRate - a.winRate;
      if (wrDiff !== 0) return wrDiff;
    }
    return b.goals - a.goals;
  });

  tbody.innerHTML = rows.map((r, i) => {
    const rank = i + 1;
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    return `
      <tr>
        <td><span class="player-rank ${rankClass}">${medal || rank}</span></td>
        <td class="td-name">${escapeHtml(r.name)}</td>
        <td>${r.matches}</td>
        <td class="td-wins">${r.wins}</td>
        <td class="td-draws">${r.draws}</td>
        <td class="td-losses">${r.losses}</td>
        <td class="td-winrate">${r.winRate}%</td>
        <td class="td-goals">${r.goals}</td>
      </tr>
    `;
  }).join('');

  // Sorting headers
  document.querySelectorAll('#stats-table th.sortable').forEach(th => {
    th.classList.toggle('active-sort', th.dataset.sort === currentSort);
    th.onclick = () => {
      currentSort = th.dataset.sort;
      loadStats();
    };
  });
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

    const isDraw = m.score_blanco === m.score_color;
    const blancoWins = m.score_blanco > m.score_color;
    const scoreClassBl = isDraw ? 'draw' : (blancoWins ? 'winner' : 'loser');
    const scoreClassCol = isDraw ? 'draw' : (blancoWins ? 'loser' : 'winner');

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

    const adminDeleteHtml = currentPlayer.is_admin ? `
      <div class="history-delete-container">
        <button class="btn-delete-match" data-id="${m.id}">🗑️ Eliminar</button>
      </div>
    ` : '';

    return `
      <div class="history-card" data-id="${m.id}">
        <div class="history-card-header">
          <span class="history-date">${dateStr}</span>
        </div>
        <div class="history-score-row">
          <div class="history-team">
            <div class="history-team-label">⬜ Blanco</div>
            <div class="history-team-score ${scoreClassBl}">${m.score_blanco}</div>
          </div>
          <span class="history-vs">VS</span>
          <div class="history-team">
            <div class="history-team-label">🎨 Color</div>
            <div class="history-team-score ${scoreClassCol}">${m.score_color}</div>
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
// INIT
// ==========================================
tryAutoLogin();
