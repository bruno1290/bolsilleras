/* ============================================
   BOLSILLERAS — Generador de Avatares (SVG por capas)
   --------------------------------------------
   Todo es fácil de ampliar: agrega tonos de piel,
   peinados, camisetas (equipos/países) o accesorios
   sumando entradas a las listas de AVATAR_OPTIONS.
   ============================================ */

// ⚙️ INTERRUPTOR: mientras sea false, los personajes son SECRETOS —
// solo el admin (Gacela) los ve y puede probarlos. El público no ve nada.
// Cuando quieras lanzarlo a todos, cámbialo a true.
const AVATARES_PUBLICO = false;

const AVATAR_OPTIONS = {
  // Tonos de piel
  skin: ['#f7d0a8', '#e8b083', '#c68642', '#8d5524'],

  // Colores de pelo
  hairColor: ['#2b2b2b', '#5a3825', '#a86a35', '#e0c070', '#c8c8c8'],

  // Estilos de pelo (0 = pelado)
  hairStyle: ['Pelado', 'Corto', 'Rulos', 'Puntas', 'Largo'],

  // Camisetas: nombre + color principal + color secundario (franja/cuello)
  jersey: [
    { id: 'blanco',    name: 'Blanco',     main: '#eef0f4', sec: '#c3c7cf' },
    { id: 'color',     name: 'Color',      main: '#d8433a', sec: '#2f6fd0' },
    { id: 'chile',     name: 'Chile',      main: '#ffffff', sec: '#d52b1e' },
    { id: 'brasil',    name: 'Brasil',     main: '#ffdf00', sec: '#009c3b' },
    { id: 'argentina', name: 'Argentina',  main: '#8fc1e8', sec: '#ffffff' },
    { id: 'negro',     name: 'Negro',      main: '#25262b', sec: '#f5c518' },
  ],

  // Accesorios
  accessory: ['Ninguno', 'Lentes', 'Cintillo', 'Gorro'],
};

// Config por defecto para un jugador sin avatar
function avatarDefault() {
  return { skin: 0, hairColor: 0, hairStyle: 1, jersey: 'blanco', accessory: 0 };
}

// Normaliza una config (rellena lo que falte y valida rangos)
function avatarNormalize(cfg) {
  const d = avatarDefault();
  cfg = (cfg && typeof cfg === 'object') ? cfg : {};
  const clamp = (v, arr, def) => (Number.isInteger(v) && v >= 0 && v < arr.length) ? v : def;
  const jerseyOk = AVATAR_OPTIONS.jersey.some(j => j.id === cfg.jersey);
  return {
    skin: clamp(cfg.skin, AVATAR_OPTIONS.skin, d.skin),
    hairColor: clamp(cfg.hairColor, AVATAR_OPTIONS.hairColor, d.hairColor),
    hairStyle: clamp(cfg.hairStyle, AVATAR_OPTIONS.hairStyle, d.hairStyle),
    jersey: jerseyOk ? cfg.jersey : d.jersey,
    accessory: clamp(cfg.accessory, AVATAR_OPTIONS.accessory, d.accessory),
  };
}

// Devuelve el markup SVG del avatar (viewBox 0 0 100 100)
function avatarSVG(cfg) {
  const c = avatarNormalize(cfg);
  const skin = AVATAR_OPTIONS.skin[c.skin];
  const skinShade = _shade(skin, -18);
  const hair = AVATAR_OPTIONS.hairColor[c.hairColor];
  const jersey = AVATAR_OPTIONS.jersey.find(j => j.id === c.jersey) || AVATAR_OPTIONS.jersey[0];

  // Pelo trasero (rulos/largo asoman por detrás de la cabeza)
  let backHair = '';
  if (c.hairStyle === 2) backHair = `<circle cx="50" cy="40" r="27" fill="${hair}"/>`;
  if (c.hairStyle === 4) backHair = `<path d="M24 44 C22 20 78 20 76 44 L76 78 C74 70 70 68 68 72 L68 44 L32 44 L32 72 C30 68 26 70 24 78 Z" fill="${hair}"/>`;

  // Pelo delantero (sobre la cabeza)
  let frontHair = '';
  if (c.hairStyle === 1) frontHair = `<path d="M27 46 C27 22 73 22 73 46 C70 33 62 27 50 27 C38 27 30 33 27 46 Z" fill="${hair}"/>`;
  if (c.hairStyle === 2) frontHair = `<path d="M26 42 C26 20 74 20 74 42 C70 32 62 26 50 26 C38 26 30 32 26 42 Z" fill="${hair}"/>`;
  if (c.hairStyle === 3) frontHair = `<path d="M28 44 L33 26 L39 40 L45 24 L51 40 L57 25 L63 40 L68 27 L72 44 C66 34 34 34 28 44 Z" fill="${hair}"/>`;
  if (c.hairStyle === 4) frontHair = `<path d="M27 46 C27 22 73 22 73 46 C70 33 62 27 50 27 C38 27 30 33 27 46 Z" fill="${hair}"/>`;

  // Accesorios
  let acc = '';
  if (c.accessory === 1) { // lentes
    acc = `<g fill="none" stroke="#1c1c22" stroke-width="2">
      <circle cx="41" cy="45" r="6"/><circle cx="59" cy="45" r="6"/>
      <line x1="47" y1="45" x2="53" y2="45"/></g>`;
  } else if (c.accessory === 2) { // cintillo
    acc = `<rect x="27" y="33" width="46" height="6" rx="3" fill="${jersey.sec}"/>`;
  } else if (c.accessory === 3) { // gorro
    acc = `<path d="M26 40 C26 20 74 20 74 40 Z" fill="${jersey.main}"/>
      <rect x="24" y="38" width="52" height="6" rx="3" fill="${jersey.sec}"/>
      <circle cx="50" cy="19" r="4" fill="${jersey.sec}"/>`;
  }

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs><clipPath id="avc"><circle cx="50" cy="50" r="50"/></clipPath></defs>
    <g clip-path="url(#avc)">
      <rect x="0" y="0" width="100" height="100" fill="${jersey.sec}" opacity="0.18"/>
      ${backHair}
      <!-- cuerpo con camiseta -->
      <ellipse cx="50" cy="104" rx="38" ry="30" fill="${jersey.main}"/>
      <path d="M38 82 L50 92 L62 82 L62 74 L38 74 Z" fill="${jersey.sec}"/>
      <!-- cuello -->
      <rect x="43" y="60" width="14" height="16" rx="5" fill="${skinShade}"/>
      <!-- orejas -->
      <circle cx="29" cy="47" r="5" fill="${skin}"/>
      <circle cx="71" cy="47" r="5" fill="${skin}"/>
      <!-- cabeza -->
      <circle cx="50" cy="45" r="22" fill="${skin}"/>
      <!-- ojos -->
      <circle cx="42" cy="45" r="2.6" fill="#232323"/>
      <circle cx="58" cy="45" r="2.6" fill="#232323"/>
      <!-- boca -->
      <path d="M43 54 Q50 60 57 54" fill="none" stroke="${skinShade}" stroke-width="2.4" stroke-linecap="round"/>
      ${frontHair}
      ${acc}
    </g>
    <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="2"/>
  </svg>`;
}

// Oscurece/aclara un hex (para sombras de piel)
function _shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
