export interface ThemePreset { id: string; name: string; mode: 'dark' | 'light'; background: string; surface: string; surfaceRaised: string; border: string; text: string; muted: string; accent: string; danger: string; radius: number }

const THEME_KEY = 'vigourUiReviewTheme';
const CUSTOM_THEME_KEY = 'vigourUiReviewCustomTheme';

function migrateLocalValue(currentKey: string, legacyKey: string): string | null {
  const current = localStorage.getItem(currentKey);
  if (current !== null) return current;
  const legacy = localStorage.getItem(legacyKey);
  if (legacy !== null) localStorage.setItem(currentKey, legacy);
  return legacy;
}

export function loadThemeId() { return migrateLocalValue(THEME_KEY, 'designAcceptanceTheme') ?? 'dark'; }
export function loadCustomTheme() { return migrateLocalValue(CUSTOM_THEME_KEY, 'designAcceptanceCustomTheme'); }
export function saveCustomThemeValue(value: ThemePreset) { localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(value)); }

export const themes: ThemePreset[] = [
  { id: 'dark', name: '霓虹暗色', mode: 'dark', background: '#090d16', surface: '#101724', surfaceRaised: '#172235', border: '#293650', text: '#e9f0ff', muted: '#8492aa', accent: '#7ea8ff', danger: '#ff6175', radius: 10 },
  { id: 'light', name: 'Cal 黑白', mode: 'light', background: '#f4f4f4', surface: '#ffffff', surfaceRaised: '#f8f8f8', border: '#dedede', text: '#242424', muted: '#6b7280', accent: '#171717', danger: '#d92d3a', radius: 8 },
  { id: 'slash', name: 'Slash 铜黑', mode: 'dark', background: '#08080a', surface: '#0e0f12', surfaceRaised: '#15161b', border: '#2e3038', text: '#e2e3e9', muted: '#9194a1', accent: '#cc9166', danger: '#e85d70', radius: 8 },
  { id: 'dock', name: 'Dock 奶油蓝', mode: 'light', background: '#f4f8fb', surface: '#ffffff', surfaceRaised: '#eef6ff', border: '#d6e4f1', text: '#23374a', muted: '#708399', accent: '#4f8fce', danger: '#d85162', radius: 12 },
  { id: 'monad', name: 'Monad 羊皮纸', mode: 'light', background: '#f5edda', surface: '#fff9e9', surfaceRaised: '#fff4cf', border: '#dccb9b', text: '#413821', muted: '#81775d', accent: '#e5c75a', danger: '#bd4d45', radius: 6 },
  { id: 'frame', name: 'Frame 午夜蓝', mode: 'dark', background: '#05050a', surface: '#0b0b13', surfaceRaised: '#11111d', border: '#303056', text: '#f0efff', muted: '#8c8ca8', accent: '#8279ff', danger: '#ff687c', radius: 4 },
  { id: 'column', name: 'Column 金融靛蓝', mode: 'light', background: '#f3f4f7', surface: '#ffffff', surfaceRaised: '#f7f7fa', border: '#e0e2e8', text: '#262834', muted: '#747788', accent: '#4b56c0', danger: '#ca4054', radius: 6 },
  { id: 'mode', name: 'Mode 鼠尾草', mode: 'light', background: '#eef2e3', surface: '#f9fbed', surfaceRaised: '#e5ecd5', border: '#cbd5b9', text: '#1f3d32', muted: '#667a70', accent: '#0b614b', danger: '#b94b51', radius: 10 },
  { id: 'modal', name: 'Modal 磷光绿', mode: 'dark', background: '#111414', surface: '#191d1d', surfaceRaised: '#212525', border: '#3b4742', text: '#eef7f2', muted: '#91a29b', accent: '#bafc75', danger: '#ff6f7e', radius: 14 },
];

export function applyTheme(theme: ThemePreset) {
  const style = document.documentElement.style;
  style.colorScheme = theme.mode;
  for (const [name, value] of Object.entries(theme)) {
    if (['id', 'name', 'mode'].includes(name)) continue;
    style.setProperty(`--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, typeof value === 'number' ? `${value}px` : value);
  }
  localStorage.setItem(THEME_KEY, theme.id);
}
