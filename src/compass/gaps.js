// Knowledge-gap log. For the PoC it lives in this browser's localStorage;
// in the full build, POST these to a backend so DCB sees one shared digest.
const KEY = 'compass-gaps'

export function readGaps() {
    try {
        return JSON.parse(localStorage.getItem(KEY)) || []
    } catch {
        return []
    }
}

export function logGap(topic, context) {
    const gaps = readGaps()
    const existing = gaps.find((g) => g.topic === topic)
    const now = new Date().toISOString()
    if (existing) {
        existing.count += 1
        existing.last = now
        existing.context = context
    } else {
        gaps.push({ topic, context, count: 1, last: now })
    }
    try {
        localStorage.setItem(KEY, JSON.stringify(gaps))
    } catch {
        /* storage unavailable */
    }
    console.info('[compass] knowledge gap:', topic, context)
}