// ─────────────────────────────────────────────────────────────
// Bridge between Compass and the Akema chat widget.
//
// The widget exposes (undocumented, confirm with Akema):
//   window.Chatbot.open() / close() / send(text) / state / api()
//   window.ChatbotWidgetConfig.onEvent(event)
//
// askInline() sends a question through the widget's conversation
// WITHOUT opening the bubble, waits for the Lion's reply and returns
// the text, so the page can show the answer wherever it wants.
// ─────────────────────────────────────────────────────────────

const AKEMA_CONFIG = {
    key:
        import.meta.env.VITE_AKEMA_KEY ||
        'pk_434a91e8a5f2403c62aa06bfe5ae7e9b5e0265a67fde234e3f5d2f09b241529e',
    appKey: import.meta.env.VITE_AKEMA_APP_KEY || '2a60d798f32afecda0c066cb06ea9b61',
    api: import.meta.env.VITE_AKEMA_API || 'https://akema.ai/api',
    ws: import.meta.env.VITE_AKEMA_WS || 'wss://akema.ai',
    // Bubble sits bottom-left so it never covers the Ask the Lion panel (right)
    position: 'left',
}

const listeners = new Set()
const rawListeners = new Set() // raw widget events, used by askInline
const sentByCompass = new Set() // messages Compass sent, so we don't re-parse them

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const textOf = (parts) =>
    (parts || [])
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text)
        .join(' ')
        .trim()

// ── Events from the widget ──────────────────────────────────
// { type: 'message', from: 'visitor' | 'ai' | ..., text }
// { type: 'tool', tool, url, method, body }
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

function handleWidgetEvent(e) {
    if (!e || !e.kind) return
    rawListeners.forEach((fn) => {
        try {
            fn(e)
        } catch {
            /* ignore */
        }
    })

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

    if (e.kind === 'evt' && e.message.startsWith('timelineItemCreated') && e.detail?.item) {
        const item = e.detail.item
        const from = item.actor?.type || 'unknown'
        if (from === 'visitor') return
        const text = textOf(item.parts)
        if (text) emit({ type: 'message', from, text })
        return
    }

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

// ── Loading the widget ──────────────────────────────────────
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
    script.dataset.chatbotPosition = AKEMA_CONFIG.position
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

// ── One Akema conversation per child ────────────────────────
// Remembers which Akema conversation belongs to which child (or other
// key), so each child's chat has its own memory on the Lion's side too.
const CONV_KEY = 'compass-lion-conversations'

function loadConversations() {
    try {
        return JSON.parse(localStorage.getItem(CONV_KEY)) || {}
    } catch {
        return {}
    }
}

function rememberConversation(key, id) {
    if (!key || !id) return
    try {
        const map = loadConversations()
        map[key] = id
        localStorage.setItem(CONV_KEY, JSON.stringify(map))
    } catch {
        /* storage unavailable */
    }
}

export function forgetConversation(key) {
    try {
        const map = loadConversations()
        delete map[key]
        localStorage.setItem(CONV_KEY, JSON.stringify(map))
    } catch {
        /* storage unavailable */
    }
}

// Points the widget at this key's conversation (or a fresh one)
async function switchConversation(bot, key) {
    if (!key) return
    const id = loadConversations()[key]
    if (!id) {
        bot.state.conversation = null
        return
    }
    if (bot.state.conversation?.id === id) return
    try {
        bot.state.conversation = await bot.api('GET', `/conversations/${encodeURIComponent(id)}`)
    } catch {
        bot.state.conversation = null // it may have been removed; start a new one
    }
}

// ── Inline answers (the bubble stays closed) ────────────────
async function readTimeline(bot, conversationId) {
    const res = await bot.api('GET', `/conversations/${conversationId}/timeline?limit=50`)
    return res?.items || []
}

// The Lion only replies reliably while the widget's live connection is up,
// which normally happens when the chat panel is opened. Opening and closing
// in the same moment starts that connection without ever showing the panel.
async function ensureLive(bot, timeout = 6000) {
    if (bot.state.subscribed) return true
    if (!bot.state.panelOpen) {
        bot.open()
        bot.close()
    }
    const start = Date.now()
    while (Date.now() - start < timeout) {
        if (bot.state.subscribed) return true
        await sleep(150)
    }
    console.warn('[compass] the chat connection did not come up; answers may be slow')
    return false
}

const isReply = (i) => i && i.type === 'message' && i.actor && i.actor.type !== 'visitor'

async function askInlineNow(question, { conversationKey, timeout = 60000 } = {}) {
    loadAkemaWidget()
    const bot = await waitForChatbot()
    if (!bot) throw new Error('The Lion isn’t available right now. Please try again in a moment.')
    if (bot.state?.bootError) throw new Error('The Lion couldn’t connect. Please try again later.')

    await ensureLive(bot)
    await switchConversation(bot, conversationKey)

    // A closed conversation can't take new messages, so start a fresh one
    const current = bot.state.conversation
    if (current && (current.status === 'resolved' || current.acceptsMessages === false)) {
        bot.state.conversation = null
    }

    // Remember everything already in the conversation, so only new replies count
    const before = new Set()
    if (bot.state.conversation) {
        try {
            ; (await readTimeline(bot, bot.state.conversation.id)).forEach((i) => before.add(i.id))
        } catch {
            /* fall back to what the widget already holds */
        }
    }
    bot.state.items.forEach((_, id) => before.add(id))

    // Listen for replies arriving live (fast path)
    const live = []
    const onRaw = (e) => {
        if (e.kind !== 'evt' || !String(e.message).startsWith('timelineItemCreated')) return
        const d = e.detail
        if (!d || !isReply(d.item) || before.has(d.item.id)) return
        const text = textOf(d.item.parts)
        if (text && !live.some((r) => r.id === d.item.id)) {
            live.push({ id: d.item.id, conversationId: d.conversationId, text })
        }
    }
    rawListeners.add(onRaw)

    try {
        const text = question.trim()
        sentByCompass.add(text)
        await bot.send(text)

        const sent = [...bot.state.items.values()].find(
            (i) => !before.has(i.id) && i.actor?.type === 'visitor',
        )
        if (!bot.state.conversation || (sent && bot.state.failed.has(sent.id))) {
            throw new Error('Your question couldn’t be sent. Please try again.')
        }
        const conversationId = bot.state.conversation.id
        rememberConversation(conversationKey, conversationId)

        // Wait for the reply: live events first, the timeline as a backup
        const deadline = Date.now() + timeout
        let polled = []
        let firstSeen = null
        let tick = 0
        while (Date.now() < deadline) {
            await sleep(400)
            tick += 1
            if (tick % 4 === 0) {
                try {
                    polled = (await readTimeline(bot, conversationId))
                        .filter((i) => !before.has(i.id) && isReply(i))
                        .map((i) => textOf(i.parts))
                        .filter(Boolean)
                } catch {
                    /* try again on the next round */
                }
            }
            const fromLive = live.filter((r) => r.conversationId === conversationId).map((r) => r.text)
            const found = fromLive.length >= polled.length ? fromLive : polled
            if (found.length) {
                // Give a follow-up message a moment to arrive, then answer
                if (!firstSeen) firstSeen = Date.now()
                else if (Date.now() - firstSeen > 1200) return found.join('\n\n')
            }
        }
        throw new Error('The Lion is taking longer than usual. Try again, or continue in the chat.')
    } finally {
        rawListeners.delete(onRaw)
    }
}

// One question at a time, so each reply is matched to the right question
let inlineQueue = Promise.resolve()
// opts.conversationKey: e.g. a child's id, so each child has their own conversation
export function askInline(question, opts = {}) {
    const run = () => askInlineNow(question, opts)
    const result = inlineQueue.then(run, run)
    inlineQueue = result.catch(() => { })
    return result
}

// ── Voice calls ─────────────────────────────────────────────
// Rebuilds the widget's own voice feature for our chat: the same
// LiveKit client and /voice/token endpoint the widget uses, with our UI.

// True when Akema has voice switched on for this website and language
export async function voiceAvailable() {
    loadAkemaWidget()
    const bot = await waitForChatbot()
    const voice = bot?.state?.voice
    return !!(
        bot &&
        !bot.state.bootError &&
        bot.state.features?.voice === true &&
        voice?.clientUrl &&
        (voice.languages || []).includes(bot.state.language)
    )
}

// Starts a call. Callbacks:
//   onStatus('connecting' | 'listening' | 'thinking' | 'speaking')
//   onTranscript({ id, role: 'user' | 'assistant', text })  (text grows as it streams)
//   onEnd()
// Returns { setMuted(bool), end() }.
export async function startVoiceCall({ onStatus, onTranscript, onEnd, conversationKey } = {}) {
    loadAkemaWidget()
    const bot = await waitForChatbot()
    if (!bot || bot.state.bootError) throw new Error('The Lion isn’t available right now.')
    await ensureLive(bot) // also registers the visitor, which the token needs
    await switchConversation(bot, conversationKey)

    // Join the current conversation if it's open, so voice and text share it
    const conv = bot.state.conversation
    const conversationId =
        conv && conv.status !== 'resolved' && conv.acceptsMessages !== false ? conv.id : bot.ulid()

    onStatus?.('connecting')
    const [lk, token] = await Promise.all([
        import(/* @vite-ignore */ bot.state.voice.clientUrl),
        bot.api('POST', '/voice/token', { conversationId }),
    ])

    rememberConversation(conversationKey, token.conversationId || conversationId)

    const room = new lk.Room()
    const audio = new Set()
    let ended = false
    const finish = () => {
        if (ended) return
        ended = true
        audio.forEach((el) => el.remove())
        audio.clear()
        onEnd?.()
    }

    // The Lion's voice
    room.on(lk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== lk.Track.Kind.Audio) return
        const el = track.attach()
        el.setAttribute('data-compass-voice', '')
        document.body.appendChild(el)
        audio.add(el)
    })
    room.on(lk.RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => {
            el.remove()
            audio.delete(el)
        })
    })
    room.on(lk.RoomEvent.Disconnected, finish)

    // listening / thinking / speaking
    room.on(lk.RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
        if (changed['lk.agent.state'] !== undefined) {
            onStatus?.(participant.attributes['lk.agent.state'])
        }
    })

    // Live captions for both sides
    room.registerTextStreamHandler('lk.transcription', async (reader) => {
        const attrs = reader.info.attributes || {}
        const id = attrs['lk.segment_id'] || reader.info.id
        const trackId = attrs['lk.transcribed_track_id']
        const role =
            trackId && room.localParticipant.trackPublications.has(trackId) ? 'user' : 'assistant'
        let text = ''
        for await (const chunk of reader) {
            text += chunk
            onTranscript?.({ id, role, text })
        }
    })

    try {
        await room.connect(token.url, token.token)
        await room.localParticipant.setMicrophoneEnabled(true)
    } catch (err) {
        room.disconnect()
        finish()
        throw err
    }
    onStatus?.('listening')

    return {
        setMuted: (muted) => room.localParticipant.setMicrophoneEnabled(!muted),
        end: () => {
            room.disconnect()
            finish()
        },
    }
}

// ── Opening the full chat ───────────────────────────────────
export async function openAkemaChat() {
    loadAkemaWidget()
    const bot = await waitForChatbot()
    if (bot) bot.open()
    return !!bot
}

// ── Links clicked inside the chat bubble ────────────────────
// If fn(url) returns true, the page handles the click instead of a new tab.
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