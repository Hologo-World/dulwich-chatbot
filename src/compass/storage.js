// ─────────────────────────────────────────────────────────────
// Saves the family's journey in this browser (localStorage) so it is
// still there after a refresh or a return visit. Nothing leaves the
// device: no account, no server. "Start over" clears it.
// ─────────────────────────────────────────────────────────────

const KEY = 'compass-journey'
const VERSION = 1

export function loadJourney() {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return null
        const data = JSON.parse(raw)
        return data && data.v === VERSION ? data : null
    } catch {
        return null
    }
}

export function saveJourney(data) {
    try {
        localStorage.setItem(
            KEY,
            JSON.stringify({ v: VERSION, savedAt: new Date().toISOString(), ...data }),
        )
    } catch {
        /* storage full or unavailable: the journey still works, it just isn't saved */
    }
}

export function clearJourney() {
    try {
        localStorage.removeItem(KEY)
    } catch {
        /* nothing to clear */
    }
}

// True when a journey has been revealed and saved
export function hasSavedJourney() {
    return loadJourney()?.phase === 'journey'
}