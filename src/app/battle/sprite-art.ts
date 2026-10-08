import { Team } from '../core/models/unit-instance.model';

/**
 * Flat SVG sprites for each class, facing right. The WebGL stage draws 3D
 * characters; these are what units look like when WebGL is unavailable.
 */
const SPRITE_VIEWBOX = { x: -6, y: -8, width: 76, height: 84 };

type Pick = (player: string, enemy: string) => string;

const ART: Record<string, (c: Pick) => string> = {
  fighter: (c) => `
    <path d="M30 6 C30 2, 38 2, 40 8 C38 12, 32 10, 30 6 Z" fill="${c('#f59e0b', '#ef4444')}"/>
    <rect x="20" y="10" width="24" height="22" rx="6" fill="${c('#94a3b8', '#475569')}" stroke="#1e293b" stroke-width="2"/>
    <path d="M22 18 H42 V22 H22 Z" fill="#0f172a"/>
    <circle cx="28" cy="20" r="1.5" fill="${c('#38bdf8', '#f87171')}"/>
    <circle cx="36" cy="20" r="1.5" fill="${c('#38bdf8', '#f87171')}"/>
    <rect x="22" y="32" width="20" height="20" rx="3" fill="${c('#cbd5e1', '#334155')}" stroke="#1e293b" stroke-width="2"/>
    <path d="M26 36 L32 44 L38 36" stroke="gold" stroke-width="2" stroke-linecap="round" fill="none"/>
    <rect x="23" y="52" width="7" height="15" rx="2" fill="#475569"/>
    <rect x="34" y="52" width="7" height="15" rx="2" fill="#475569"/>
    <rect x="21" y="62" width="9" height="6" rx="2" fill="#1e293b"/>
    <rect x="34" y="62" width="9" height="6" rx="2" fill="#1e293b"/>
    <path d="M48 24 L52 14 L54 14 L50 26 Z" fill="#e2e8f0" stroke="#475569"/>
    <rect x="45" y="25" width="10" height="3" rx="1" fill="#d97706" transform="rotate(25 45 25)"/>
    <rect x="44" y="27" width="4" height="8" rx="1" fill="#78350f" transform="rotate(25 44 27)"/>
    <path d="M10 28 C10 28, 22 26, 22 36 C22 46, 16 54, 10 58 C4 54, -2 46, -2 36 C-2 26, 10 28, 10 28 Z" fill="${c('#2563eb', '#991b1b')}" stroke="#ffd700" stroke-width="2" transform="translate(8, 0)"/>
    <path d="M18 36 V48" stroke="#ffd700" stroke-width="2" stroke-linecap="round"/>`,

  cleric: (c) => `
    <ellipse cx="32" cy="7" rx="14" ry="4" fill="none" stroke="#facc15" stroke-width="2.5" stroke-dasharray="3 1"/>
    <path d="M20 22 C20 10, 44 10, 44 22 C44 32, 40 34, 32 34 C24 34, 20 32, 20 22 Z" fill="${c('#f8fafc', '#450a0a')}" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="28" cy="22" r="1.5" fill="#0f172a"/>
    <circle cx="36" cy="22" r="1.5" fill="#0f172a"/>
    <path d="M30 26 Q32 28 34 26" stroke="#d97706" stroke-width="1" fill="none"/>
    <path d="M18 34 L46 34 L50 66 L14 66 Z" fill="${c('#f1f5f9', '#7f1d1d')}" stroke="#1e293b" stroke-width="1.5"/>
    <path d="M28 34 L28 62 M36 34 L36 62" stroke="#eab308" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="46" r="3" fill="#eab308"/>
    <rect x="48" y="12" width="4" height="54" rx="2" fill="#78350f"/>
    <circle cx="50" cy="12" r="7" fill="none" stroke="#facc15" stroke-width="2.5"/>
    <path d="M50 4 V20 M42 12 H58" stroke="#facc15" stroke-width="2.5"/>
    <circle cx="50" cy="12" r="2.5" fill="#38bdf8"/>`,

  archer: (c) => `
    <rect x="14" y="24" width="6" height="22" rx="2" fill="#78350f" transform="rotate(-15 14 24)"/>
    <line x1="14" y1="20" x2="16" y2="24" stroke="#facc15" stroke-width="2"/>
    <line x1="18" y1="18" x2="20" y2="24" stroke="#facc15" stroke-width="2"/>
    <path d="M18 18 C18 10, 42 8, 46 16 C46 22, 38 24, 32 24 C22 24, 18 20, 18 18 Z" fill="${c('#15803d', '#991b1b')}" stroke="#0f172a" stroke-width="1.5"/>
    <path d="M38 12 C44 4, 48 2, 50 0 C48 6, 44 10, 40 12 Z" fill="${c('#fbbf24', '#f97316')}"/>
    <ellipse cx="32" cy="23" rx="10" ry="8" fill="#fed7aa"/>
    <circle cx="28" cy="22" r="1.5" fill="#1e293b"/>
    <circle cx="36" cy="22" r="1.5" fill="#1e293b"/>
    <path d="M20 30 L44 30 L46 54 L18 54 Z" fill="${c('#166534', '#7f1d1d')}" stroke="#0f172a" stroke-width="1.5"/>
    <rect x="23" y="44" width="18" height="4" rx="1" fill="#78350f"/>
    <rect x="29" y="43" width="6" height="6" rx="1" fill="#facc15"/>
    <rect x="24" y="54" width="6" height="13" rx="2" fill="#78350f"/>
    <rect x="34" y="54" width="6" height="13" rx="2" fill="#78350f"/>
    <path d="M48 10 C58 28, 58 46, 48 62" fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>
    <path d="M48 10 L48 62" stroke="#e2e8f0" stroke-width="1"/>
    <path d="M34 36 L56 36" stroke="#475569" stroke-width="2" stroke-linecap="round"/>
    <polygon points="56,36 52,33 52,39" fill="#94a3b8"/>`,

  witch: (c) => `
    <path d="M12 22 C16 20, 48 20, 52 22 C48 24, 16 24, 12 22 Z" fill="${c('#312e81', '#581c87')}" stroke="#0f172a" stroke-width="1.5"/>
    <path d="M20 22 L30 2 C32 1, 38 6, 44 22 Z" fill="${c('#1e1b4b', '#3b0764')}" stroke="#0f172a" stroke-width="1.5"/>
    <rect x="24" y="18" width="16" height="4" fill="#f59e0b"/>
    <rect x="29" y="17" width="6" height="6" fill="#facc15"/>
    <ellipse cx="32" cy="26" rx="9" ry="7" fill="#fed7aa"/>
    <path d="M18 24 C22 36, 20 44, 16 48 M46 24 C42 36, 44 44, 48 48" stroke="${c('#6366f1', '#c084fc')}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <circle cx="28" cy="26" r="1.5" fill="#4338ca"/>
    <circle cx="36" cy="26" r="1.5" fill="#4338ca"/>
    <path d="M20 34 L44 34 L48 66 L16 66 Z" fill="${c('#1e1b4b', '#3b0764')}" stroke="#0f172a" stroke-width="1.5"/>
    <path d="M26 34 L32 50 L38 34" stroke="#a855f7" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="50" cy="36" r="7" fill="${c('#818cf8', '#f43f5e')}" opacity="0.85"/>
    <circle cx="50" cy="36" r="4" fill="${c('#c7d2fe', '#fecdd3')}"/>
    <circle cx="50" cy="36" r="9" fill="none" stroke="#c084fc" stroke-dasharray="2 2"/>`,

  lancer: (c) => `
    <path d="M32 0 L36 12 L28 12 Z" fill="${c('#38bdf8', '#e11d48')}"/>
    <path d="M18 12 C18 6, 46 6, 46 12 C46 22, 42 26, 32 26 C22 26, 18 22, 18 12 Z" fill="${c('#0284c7', '#991b1b')}" stroke="#1e293b" stroke-width="1.5"/>
    <path d="M14 10 L18 18 L12 20 Z" fill="#facc15"/>
    <path d="M50 10 L46 18 L52 20 Z" fill="#facc15"/>
    <path d="M22 18 H42 V21 H22 Z" fill="#0f172a"/>
    <circle cx="28" cy="20" r="1.5" fill="#38bdf8"/>
    <circle cx="36" cy="20" r="1.5" fill="#38bdf8"/>
    <path d="M20 28 L44 28 L42 52 L22 52 Z" fill="${c('#0369a1', '#7f1d1d')}" stroke="#1e293b" stroke-width="1.5"/>
    <ellipse cx="18" cy="30" rx="4" ry="3" fill="#facc15"/>
    <ellipse cx="46" cy="30" rx="4" ry="3" fill="#facc15"/>
    <rect x="23" y="52" width="7" height="15" rx="2" fill="#0c4a6e"/>
    <rect x="34" y="52" width="7" height="15" rx="2" fill="#0c4a6e"/>
    <rect x="50" y="2" width="3" height="66" rx="1.5" fill="#78350f"/>
    <path d="M51 -6 L57 6 L45 6 Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="1"/>
    <rect x="46" y="6" width="10" height="3" rx="1" fill="#facc15"/>
    <path d="M51 9 L63 15 L51 21 Z" fill="${c('#38bdf8', '#ef4444')}"/>`,

  gunner: (c) => `
    <path d="M12 18 C14 8, 50 8, 52 18 C46 22, 18 22, 12 18 Z" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
    <path d="M20 16 C28 4, 36 4, 44 16 Z" fill="#0f172a" stroke="#f59e0b" stroke-width="1"/>
    <path d="M16 14 C12 6, 10 2, 8 0 C12 4, 16 8, 18 12 Z" fill="${c('#f59e0b', '#ef4444')}"/>
    <ellipse cx="32" cy="24" rx="9" ry="7" fill="#fed7aa"/>
    <circle cx="28" cy="23" r="1.5" fill="#0f172a"/>
    <circle cx="36" cy="23" r="1.5" fill="#0f172a"/>
    <path d="M28 28 H36" stroke="#94a3b8" stroke-width="1" stroke-dasharray="1 1"/>
    <path d="M18 32 L46 32 L48 64 L16 64 Z" fill="${c('#1e3a8a', '#78350f')}" stroke="#0f172a" stroke-width="1.5"/>
    <line x1="20" y1="32" x2="44" y2="52" stroke="#b45309" stroke-width="3.5"/>
    <circle cx="25" cy="37" r="1" fill="#facc15"/>
    <circle cx="30" cy="41" r="1" fill="#facc15"/>
    <circle cx="35" cy="45" r="1" fill="#facc15"/>
    <rect x="23" y="54" width="7" height="13" rx="2" fill="#0f172a"/>
    <rect x="34" y="54" width="7" height="13" rx="2" fill="#0f172a"/>
    <path d="M38 38 L48 44 L44 48 L36 40 Z" fill="#92400e"/>
    <rect x="44" y="26" width="5" height="26" rx="1" fill="#64748b" stroke="#0f172a" transform="rotate(35 44 26)"/>
    <circle cx="43" cy="39" r="2" fill="#facc15"/>`,
};

function spriteSvg(classId: string, team: Team): string {
  const pick: Pick = (player, enemy) => (team === 'player' ? player : enemy);
  const { x, y, width: w, height: h } = SPRITE_VIEWBOX;
  // Enemies face left: mirror around the art's vertical centre line.
  const facing = team === 'enemy' ? ` transform="translate(${2 * x + w} 0) scale(-1 1)"` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">` +
    `<g${facing}>${(ART[classId] ?? ART['fighter'])(pick)}</g></svg>`
  );
}

export function spriteUrl(classId: string, team: Team): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(spriteSvg(classId, team))}`;
}
