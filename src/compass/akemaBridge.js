// ─────────────────────────────────────────────────────────────
// Bridge between Compass and the Akema chat widget.
//
// The widget exposes (undocumented, confirm with Akema):
//   window.Chatbot.open() / close() / send(text) / state
//   window.ChatbotWidgetConfig.onEvent(event) – called for every
//   request, realtime event and frontend-tool call the widget makes.
// ─────────────────────────────────────────────────────────────

const AKEMA_CONFIG = {
    key:
        import.meta.env.VITE_AKEMA_KEY ||
        'pk_434a91e8a5f2403c62aa06bfe5ae7e9b5e0265a67fde234e3f5d2f09b241529e',
    appKey: import.meta.env.VITE_AKEMA_APP_KEY || '2a60d798f32afecda0c066cb06ea9b61',
    api: import.meta.env.VITE_AKEMA_API || 'https://akema.ai/api',
    ws: import.meta.env.VITE_AKEMA_WS || 'wss://akema.ai',
}

const listeners = new Set()
const sentByCompass = new Set() // questions Compass sent, so we don't re-parse them

// Subscribe to chat activity. Returns an unsubscribe function.
// Events: { type: 'message', from: 'visitor' | 'ai' | ..., text }
//         { type: 'tool', tool, url, method, body }
export function onAkemaEvent(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
}

function emit(event) {
    listeners.forEach((fn) => {
        try {
            fn(event)
        } catch (err) {
            console.error('[compass] listener failed', err)
        }
    })
}

const textOf = (parts) =>
    (parts || [])
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text)
        .join(' ')
        .trim()

// Translate the widget's raw log events into Compass events
function handleWidgetEvent(e) {
    if (!e || !e.kind) return

    // The parent sent a message (from the chat box or via Chatbot.send)
    if (e.kind === 'req' && e.message === 'POST /messages' && e.detail?.item) {
        const text = textOf(e.detail.item.parts)
        if (!text) return
        if (sentByCompass.has(text)) {
            sentByCompass.delete(text)
            return
        }
        emit({ type: 'message', from: 'visitor', text })
        return
    }

    // The AI (or a human agent) replied
    if (e.kind === 'evt' && e.message.startsWith('timelineItemCreated') && e.detail?.item) {
        const item = e.detail.item
        const from = item.actor?.type || 'unknown'
        if (from === 'visitor') return // already handled above
        const text = textOf(item.parts)
        if (text) emit({ type: 'message', from, text })
        return
    }

    // The Akema agent called a frontend tool
    if (e.kind === 'tool' && e.detail?.url) {
        emit({
            type: 'tool',
            tool: String(e.message).split(' → ')[0],
            url: e.detail.url,
            method: e.detail.method || 'GET',
            body: e.detail.body ?? null,
        })
    }
}

// Adds the Akema chat bubble to the page (only once)
export function loadAkemaWidget() {
    if (document.getElementById('akema-widget')) return

    // Must be set before the script runs; the widget reads it at startup
    window.ChatbotWidgetConfig = {
        ...(window.ChatbotWidgetConfig || {}),
        onEvent: handleWidgetEvent,
    }

    const script = document.createElement('script')
    script.id = 'akema-widget'
    script.src = 'https://akema.ai/embed/widget.js'
    script.async = true
    script.dataset.chatbotKey = AKEMA_CONFIG.key
    script.dataset.chatbotApi = AKEMA_CONFIG.api
    script.dataset.chatbotWs = AKEMA_CONFIG.ws
    script.dataset.chatbotAppKey = AKEMA_CONFIG.appKey
    document.body.appendChild(script)
}

// Wait for window.Chatbot to exist, then (briefly) for it to finish booting
function waitForChatbot(mountTimeout = 10000, bootTimeout = 6000) {
    return new Promise((resolve) => {
        const start = Date.now()
        let mountedAt = null
        const tick = () => {
            const bot = window.Chatbot
            if (bot && bot.__mounted) {
                mountedAt = mountedAt || Date.now()
                if (bot.state?.booted || Date.now() - mountedAt > bootTimeout) return resolve(bot)
            } else if (Date.now() - start > mountTimeout) {
                return resolve(null)
            }
            setTimeout(tick, 150)
        }
        tick()
    })
}

// Opens the chat and sends a question from Compass
export async function askAkema(question) {
    loadAkemaWidget()
    const bot = await waitForChatbot()

    if (!bot) {
        console.warn('[compass] chat widget never mounted. Check widget.js in the Network tab.')
        try {
            await navigator.clipboard.writeText(question)
            return 'copied'
        } catch {
            return 'failed'
        }
    }

    bot.open()
    if (bot.state?.bootError) {
        console.warn('[compass] chat widget failed to boot:', bot.state.bootError)
        return 'failed'
    }

    try {
        sentByCompass.add(question.trim())
        await bot.send(question)
        return 'sent'
    } catch (err) {
        console.error('[compass] could not send the question:', err)
        return 'opened'
    }
}

// Loads the widget (if needed) and opens the chat panel
export async function openAkemaChat() {
    loadAkemaWidget()
    const bot = await waitForChatbot()
    if (bot) bot.open()
    return !!bot
}

// Sends a message into the chat as the parent.
// open: false sends it without opening the panel (the bubble shows an unread badge).
export async function sendToAkema(text, { open = true } = {}) {
    loadAkemaWidget()
    const bot = await waitForChatbot()
    if (!bot || bot.state?.bootError) return false
    if (open) bot.open()
    try {
        sentByCompass.add(text.trim())
        await bot.send(text)
        return true
    } catch (err) {
        console.error('[compass] could not send the context:', err)
        return false
    }
}

// Calls fn(url) when the parent clicks a link inside the chat.
// If fn returns true, Compass handles the click instead of opening a new tab.
export function onAkemaLinkClick(fn) {
    let root = null
    let stopped = false

    const handler = (e) => {
        const link = e.composedPath().find((el) => el.tagName === 'A' && el.href)
        if (link && fn(link.href)) {
            e.preventDefault()
            e.stopPropagation()
        }
    }

    // The widget may load later (at the journey reveal), so keep checking
    const attach = () => {
        if (stopped) return
        const r = window.Chatbot?.root
        if (!r) return setTimeout(attach, 300)
        root = r
        root.addEventListener('click', handler, true)
    }
    attach()

    return () => {
        stopped = true
        root?.removeEventListener('click', handler, true)
    }
}