// Local save/load. One slot, versioned, with graceful handling of bad data.
const SAVE_KEY = 'mythlings.save.v1';

export function saveGame(state) {
  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      state,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return { ok: true, at: payload.savedAt };
  } catch (err) {
    console.warn('Save failed', err);
    return { ok: false, error: String(err) };
  }
}

export function loadRawSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.state || data.version !== 1) return null;
    return data;
  } catch (err) {
    console.warn('Could not read save', err);
    return null;
  }
}

export function hasSave() {
  return !!loadRawSave();
}

export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
}

export function lastSavedLabel() {
  const data = loadRawSave();
  if (!data) return 'No journey saved yet';
  const d = new Date(data.savedAt);
  return `Saved ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
