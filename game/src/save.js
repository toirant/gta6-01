// Solmar City — saving and loading: one localStorage slot for the campaign.
// Stores cash, completed missions, health, ammo and the player's position.

const SAVE_KEY = 'solmar-city-save-v1';

export function saveGameData(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch (err) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* storage may be unavailable */ }
}
