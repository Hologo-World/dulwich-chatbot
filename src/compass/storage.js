// ─────────────────────────────────────────────────────────────
// Saves the family's children and each child's journey in this
// browser (localStorage). Nothing leaves the device.
//
// { v: 2, activeId, children: [{ id, name, createdAt, data }] }
// `data` is one child's journey state, saved by Compass.
// ─────────────────────────────────────────────────────────────

const KEY = 'compass-journey'
const VERSION = 2

export function newChild() {
    return {
        id: `child-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        createdAt: new Date().toISOString(),
        data: null,
    }
}

export function emptyFamily() {
    const child = newChild()
    return { activeId: child.id, children: [child] }
}

export function loadFamily() {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return null
        const saved = JSON.parse(raw)
        if (saved?.v === VERSION && Array.isArray(saved.children) && saved.children.length) {
            return { activeId: saved.activeId, children: saved.children }
        }
        // Older single-child save: becomes the family's first child
        if (saved?.v === 1) {
            const child = { ...newChild(), data: saved }
            return { activeId: child.id, children: [child] }
        }
        return null
    } catch {
        return null
    }
}

export function saveFamily(family) {
    try {
        localStorage.setItem(
            KEY,
            JSON.stringify({ v: VERSION, savedAt: new Date().toISOString(), ...family }),
        )
    } catch {
        /* storage full or unavailable: the journey still works, it just isn't saved */
    }
}

// True when at least one child's journey has been revealed
export function hasSavedJourney() {
    return !!loadFamily()?.children.some((c) => c.data?.phase === 'journey')
}