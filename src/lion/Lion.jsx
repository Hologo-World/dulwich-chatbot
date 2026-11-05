import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  askInline,
  forgetConversation,
  openAkemaChat,
  startVoiceCall,
  voiceAvailable,
} from "../compass/akemaBridge";
import { emptyFamily, loadFamily, saveFamily } from "../compass/storage";
import { cleanAnswer, mediaFor } from "./media";
import "./LionChat.css";

// ─────────────────────────────────────────────────────────────
// "Ask the Lion": answers from the Akema agent, shown on the page.
//   useLion()        – ask, askInSheet, openSheet, openChat, ...
//   useLionAnswer()  – [state, run] for an inline answer in any card
//   LionAnswerCard   – renders one answer (pending / done / error)
// The Akema bubble stays a separate, optional full chat.
// ─────────────────────────────────────────────────────────────

const LionContext = createContext(null);
export const useLion = () => useContext(LionContext);

// ── One chat per child, kept in this browser ────────────────
// threads: { [childId]: entries[] }
// sent:    { [childId]: the family context the Lion already has }
const THREADS_KEY = "compass-lion-threads";
const SENT_KEY = "compass-lion-sent";
const OLD_THREAD_KEY = "compass-lion-thread"; // the single shared chat from before

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};
const finished = (list) =>
  (Array.isArray(list) ? list : []).filter((m) => m.status !== "pending");

function loadThreads(firstChildId) {
  const saved = readJSON(THREADS_KEY, null);
  if (saved && typeof saved === "object") {
    return Object.fromEntries(
      Object.entries(saved).map(([k, v]) => [k, finished(v)]),
    );
  }
  // Move the old shared chat to the first child
  const old = finished(readJSON(OLD_THREAD_KEY, []));
  return old.length ? { [firstChildId]: old } : {};
}

// The family always exists, so every question belongs to a child's chat
function initialChildId() {
  let family = loadFamily();
  if (!family) {
    family = emptyFamily();
    saveFamily(family);
  }
  return family.activeId || family.children[0]?.id;
}

const SUGGESTIONS = [
  "What makes DCB different?",
  "How is Mandarin taught at DCB?",
  "What are the steps to apply?",
  "What sport can students do?",
];

// onOpen: called whenever the chat opens (the site opens the journey behind it)
export function LionProvider({ children, onLink, onOpen }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Whose chat is showing: follows the child selected in the journey
  const [activeKey, setActiveKey] = useState(initialChildId);
  const activeKeyRef = useRef(activeKey);
  const [threads, setThreads] = useState(() => loadThreads(activeKey));
  const sent = useRef(readJSON(SENT_KEY, {}));

  const pageContext = useRef(null); // the active child's selections, as a sentence
  const [contextLabel, setContextLabel] = useState(null); // e.g. "Maya"
  const [memory, setMemory] = useState([]); // e.g. ["Year 4, age 8", "Art"]
  const [familyList, setFamilyList] = useState([]); // [{ id, label }]
  const [requestedChild, setRequestedChild] = useState(null);
  const [viewer, setViewer] = useState(null); // a photo, video or the tour, shown in Compass

  const onLinkRef = useRef(onLink);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);
  useEffect(() => {
    onLinkRef.current = onLink;
  }, [onLink]);

  useEffect(() => {
    writeJSON(
      THREADS_KEY,
      Object.fromEntries(
        Object.entries(threads).map(([k, v]) => [k, finished(v).slice(-50)]),
      ),
    );
  }, [threads]);

  const updateThread = (key, fn) =>
    setThreads((all) => ({ ...all, [key]: fn(all[key] || []) }));

  // Every question goes into the chat of the child it was asked for, and to
  // that child's own Akema conversation. The child's selections are sent the
  // first time and again whenever they change, so the Lion always knows them.
  const ask = useCallback(async (question, { context, source } = {}) => {
    const key = activeKeyRef.current;
    const id = `${Date.now()}-${Math.random()}`;
    updateThread(key, (t) => [
      ...t,
      { id, question, source, status: "pending", at: new Date().toISOString() },
    ]);
    const message =
      context && context !== sent.current[key]
        ? `${context} ${question}`
        : question;
    try {
      const answer = await askInline(message, { conversationKey: key });
      if (context) {
        sent.current = { ...sent.current, [key]: context };
        writeJSON(SENT_KEY, sent.current);
      }
      updateThread(key, (t) =>
        t.map((m) => (m.id === id ? { ...m, status: "done", answer } : m)),
      );
      return answer;
    } catch (err) {
      updateThread(key, (t) =>
        t.map((m) =>
          m.id === id ? { ...m, status: "error", answer: err.message } : m,
        ),
      );
      throw err;
    }
  }, []);

  // Adds a finished entry (e.g. a voice call transcript) to a child's chat
  const addEntry = useCallback((entry, key = activeKeyRef.current) => {
    updateThread(key, (t) => [
      ...t,
      {
        id: `${Date.now()}-${Math.random()}`,
        status: "done",
        at: new Date().toISOString(),
        ...entry,
      },
    ]);
  }, []);

  const openSheet = useCallback(() => {
    setSheetOpen(true);
    onOpenRef.current?.();
  }, []);

  const askInSheet = useCallback(
    (question, opts = {}) => {
      openSheet();
      ask(question, {
        context: opts.context ?? pageContext.current,
        source: opts.source,
      }).catch(() => {
        /* the error is shown in the conversation */
      });
    },
    [ask, openSheet],
  );

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Called by the open child's journey: who they are and what's known about them
  const setPageContext = useCallback(
    (c, label = null, childId, memoryChips) => {
      pageContext.current = c;
      setContextLabel(label);
      if (childId) {
        activeKeyRef.current = childId;
        setActiveKey(childId);
      }
      if (memoryChips) setMemory(memoryChips);
    },
    [],
  );

  // The family's children, for the switcher in the chat
  const setChildren = useCallback((list) => setFamilyList(list), []);

  // Switching child from the chat: the journey follows (see Family.jsx)
  const selectChild = useCallback((id) => {
    activeKeyRef.current = id;
    setActiveKey(id);
    setRequestedChild(id);
  }, []);
  const clearRequest = useCallback(() => setRequestedChild(null), []);

  // A child removed from the family: drop their chat and conversation
  const forgetChild = useCallback((id) => {
    setThreads((all) => {
      const next = { ...all };
      delete next[id];
      return next;
    });
    const nextSent = { ...sent.current };
    delete nextSent[id];
    sent.current = nextSent;
    writeJSON(SENT_KEY, nextSent);
    forgetConversation(id);
  }, []);

  // A link that takes the parent somewhere on the page (a journey card or a
  // site section) also slides the chat away, so they can see where they landed.
  // The Lion tab on the right brings the conversation back.
  const handleLink = useCallback((url) => {
    const handled = !!onLinkRef.current?.(url);
    if (handled) setSheetOpen(false);
    return handled;
  }, []);
  const getPageContext = useCallback(() => pageContext.current, []);
  const openViewer = useCallback((item) => setViewer(item), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  const thread = threads[activeKey] || [];

  const value = useMemo(
    () => ({
      ask,
      askInSheet,
      sheetOpen,
      openSheet,
      closeSheet,
      thread,
      activeKey,
      handleLink,
      setPageContext,
      contextLabel,
      memory,
      familyList,
      setChildren,
      selectChild,
      requestedChild,
      clearRequest,
      forgetChild,
      addEntry,
      getPageContext,
      viewer,
      openViewer,
      closeViewer,
      openChat: openAkemaChat,
    }),
    [
      ask,
      askInSheet,
      sheetOpen,
      openSheet,
      closeSheet,
      thread,
      activeKey,
      handleLink,
      setPageContext,
      contextLabel,
      memory,
      familyList,
      setChildren,
      selectChild,
      requestedChild,
      clearRequest,
      forgetChild,
      addEntry,
      getPageContext,
      viewer,
      openViewer,
      closeViewer,
    ],
  );

  return (
    <LionContext.Provider value={value}>
      {children}
      <LionSheet />
      <MediaViewer />
    </LionContext.Provider>
  );
}

// [state, run, reset] for an inline answer. state: { status, question, answer }
export function useLionAnswer(initial) {
  const { ask } = useLion();
  const [state, setState] = useState(() =>
    initial && initial.status === "done" ? initial : { status: "idle" },
  );
  const run = useCallback(
    (question, opts) => {
      setState({ status: "pending", question });
      ask(question, opts).then(
        (answer) => setState({ status: "done", question, answer }),
        (err) => setState({ status: "error", question, answer: err.message }),
      );
    },
    [ask],
  );
  const reset = useCallback(() => setState({ status: "idle" }), []);
  return [state, run, reset];
}

export function LionAnswerCard({ state, inSheet = false }) {
  const { handleLink, openSheet } = useLion();
  if (!state || state.status === "idle") return null;

  return (
    <div
      className="lion-answer"
      aria-live="polite"
      aria-busy={state.status === "pending"}
    >
      <p className="lion-answer__head">
        <span aria-hidden="true">🦁</span> The Lion
      </p>

      {state.status === "pending" && (
        <div className="lion-answer__pending">
          <span className="sr-only">
            Looking through verified DCB information
          </span>
          <i />
          <i />
          <i />
        </div>
      )}

      {state.status === "done" && (
        <>
          <Markdown
            text={cleanAnswer({
              question: state.question,
              answer: state.answer,
            })}
            onLink={handleLink}
          />
          <AnswerMedia question={state.question} answer={state.answer} />
          {!inSheet && (
            <button type="button" className="link" onClick={openSheet}>
              See the whole conversation
            </button>
          )}
        </>
      )}

      {state.status === "error" && (
        <p className="lion-answer__error">{state.answer}</p>
      )}
    </div>
  );
}

// ── The full-page chat, with the journey behind it ──────────
// Closed: a Lion tab on the right edge pulls it back in.
function LionSheet() {
  const {
    sheetOpen,
    openSheet,
    closeSheet,
    thread,
    askInSheet,
    contextLabel,
    handleLink,
    addEntry,
    activeKey,
    memory,
    familyList,
    selectChild,
    getPageContext,
  } = useLion();
  const [question, setQuestion] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // ── Voice ──
  const [voiceOk, setVoiceOk] = useState(false);
  const [call, setCall] = useState(null); // { status, lines, muted, error }
  const callRef = useRef(null);
  const linesRef = useRef([]);

  useEffect(() => {
    if (!sheetOpen) return;
    let alive = true;
    voiceAvailable().then((ok) => alive && setVoiceOk(ok));
    return () => {
      alive = false;
    };
  }, [sheetOpen]);

  const startCall = async () => {
    const callKey = activeKey; // the child this call is about
    const context = getPageContext();
    linesRef.current = [];
    setCall({ status: "connecting", lines: [], muted: false });
    try {
      callRef.current = await startVoiceCall({
        conversationKey: callKey,
        context,
        onContext: (result) => {
          const note = {
            id: "context-note",
            role: "note",
            text:
              result === "shared"
                ? `Shared ${contextLabel || "your child"}’s details with the Lion`
                : `Couldn’t share ${contextLabel || "your child"}’s details with the Lion`,
          };
          linesRef.current = [
            note,
            ...linesRef.current.filter((l) => l.id !== note.id),
          ];
          setCall((c) => (c ? { ...c, lines: linesRef.current } : c));
        },
        onStatus: (status) => setCall((c) => (c ? { ...c, status } : c)),
        onTranscript: (seg) => {
          // What the parent says can shape the journey (e.g. "he loves to read")
          if (seg.final && seg.role === "user") tellJourney(seg.text, callKey);
          const lines = linesRef.current.some((l) => l.id === seg.id)
            ? linesRef.current.map((l) => (l.id === seg.id ? seg : l))
            : [...linesRef.current, seg];
          linesRef.current = lines;
          setCall((c) => (c ? { ...c, lines } : c));
        },
        onEnd: (reason) => {
          // Keep the call in the conversation as a transcript
          const lines = linesRef.current.filter(
            (l) => l.role !== "note" && l.text.trim(),
          );
          if (lines.length)
            addEntry({ kind: "voice", source: "a voice call", lines }, callKey);
          callRef.current = null;
          if (reason && reason !== "ended") {
            // The voice service closed the call, not the parent
            setCall({
              status: "error",
              lines: [],
              muted: false,
              error: `The voice service ended the call (${reason}). You can try again, or keep typing.`,
            });
          } else {
            setCall(null);
          }
        },
      });
    } catch (err) {
      console.error("[compass] voice call failed", err);
      callRef.current = null;
      setCall({
        status: "error",
        lines: [],
        muted: false,
        error:
          "The call couldn’t start. Check that the browser can use your microphone, then try again.",
      });
    }
  };

  const toggleMute = () => {
    if (!call || !callRef.current) return;
    const muted = !call.muted;
    callRef.current.setMuted(muted); // side effect outside the state update
    setCall((c) => (c ? { ...c, muted } : c));
  };

  const endCall = () => {
    if (callRef.current) callRef.current.end();
    else setCall(null);
  };

  // Hiding the chat, or switching to another child, ends any call
  useEffect(() => {
    if (!sheetOpen && callRef.current) callRef.current.end();
  }, [sheetOpen]);
  useEffect(() => {
    if (callRef.current) callRef.current.end();
  }, [activeKey]);
  useEffect(() => () => callRef.current?.end(), []);

  useEffect(() => {
    if (sheetOpen) endRef.current?.scrollIntoView({ block: "end" });
  }, [thread, sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      // A card drawer opened from an answer closes first
      if (
        e.key === "Escape" &&
        !document.querySelector(".drawer-backdrop, .lion-viewer")
      )
        closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, closeSheet]);

  const resize = (el) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const submit = (e) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q) return;
    tellJourney(q, activeKey); // statements like "she loves music" update the journey
    setQuestion("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    askInSheet(q);
  };

  return (
    <>
      <button
        type="button"
        className={`lion-tab${sheetOpen ? " lion-tab--hidden" : ""}`}
        onClick={openSheet}
        aria-label="Open the chat with the Lion"
        tabIndex={sheetOpen ? -1 : 0}
      >
        <span className="lion-tab__icon" aria-hidden="true">
          🦁
        </span>
        <span className="lion-tab__text">Ask the Lion</span>
      </button>

      <section
        className={`lion-sheet lion-chat${sheetOpen ? " lion-sheet--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Chat with the Lion"
        aria-hidden={!sheetOpen}
      >
        <header className="lion-chat__bar">
          <span className="lion-chat__avatar" aria-hidden="true">
            🦁
          </span>
          <div className="lion-chat__who">
            <strong>The Lion</strong>
            <span>Answers from verified DCB information</span>
          </div>
          {familyList.length > 1 ? (
            <div
              className="lion-chat__children"
              role="tablist"
              aria-label="Whose chat"
            >
              {familyList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === activeKey}
                  className={`lion-chat__child${c.id === activeKey ? " lion-chat__child--on" : ""}`}
                  onClick={() => selectChild(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : (
            contextLabel && (
              <span className="lion-chat__context">
                Thinking about {contextLabel}
              </span>
            )
          )}
          <button
            type="button"
            className="lion-chat__hide"
            onClick={closeSheet}
          >
            Back to the journey
            <span aria-hidden="true">›</span>
          </button>
        </header>

        {memory.length > 0 && (
          <div
            className="lion-chat__memory"
            aria-label="What the Lion remembers"
          >
            <span>What I know about {contextLabel || "your child"}</span>
            <ul>
              {memory.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="lion-chat__scroll">
          <div className="lion-chat__column">
            {thread.length === 0 && !call ? (
              <div className="lion-chat__empty">
                <span className="lion-chat__hello" aria-hidden="true">
                  🦁
                </span>
                <h2>How can I help you explore DCB?</h2>
                <p>
                  Ask about learning, activities, admissions or everyday life at
                  the College.
                  {contextLabel ? ` I’ll keep ${contextLabel} in mind.` : ""}
                </p>
                <div className="lion-chat__suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="lion-suggestion"
                      onClick={() => askInSheet(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              thread.map((m) =>
                m.kind === "voice" ? (
                  <VoiceTranscript key={m.id} lines={m.lines} />
                ) : (
                  <div key={m.id} className="lion-turn2">
                    {m.source && (
                      <p className="lion-msg__source">Asked from {m.source}</p>
                    )}
                    <div className="lion-msg lion-msg--you">
                      <p>{m.question}</p>
                    </div>
                    <div
                      className="lion-msg lion-msg--lion"
                      aria-live="polite"
                      aria-busy={m.status === "pending"}
                    >
                      <span className="lion-msg__avatar" aria-hidden="true">
                        🦁
                      </span>
                      <div className="lion-msg__body">
                        {m.status === "pending" && (
                          <div className="lion-answer__pending">
                            <span className="sr-only">
                              Looking through verified DCB information
                            </span>
                            <i />
                            <i />
                            <i />
                          </div>
                        )}
                        {m.status === "done" && (
                          <>
                            <Markdown
                              text={cleanAnswer({
                                question: m.question,
                                answer: m.answer,
                              })}
                              onLink={handleLink}
                            />
                            <AnswerMedia
                              question={m.question}
                              answer={m.answer}
                            />
                          </>
                        )}
                        {m.status === "error" && (
                          <p className="lion-answer__error">{m.answer}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ),
              )
            )}
            {call && call.lines.length > 0 && (
              <VoiceTranscript lines={call.lines} live />
            )}
            <div ref={endRef} />
          </div>
        </div>

        {call ? (
          <VoiceBar
            call={call}
            onMute={toggleMute}
            onEnd={endCall}
            onRetry={startCall}
          />
        ) : (
          <form className="lion-chat__composer" onSubmit={submit}>
            <div className="lion-chat__box">
              <textarea
                ref={inputRef}
                rows={1}
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  resize(e.target);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Ask the Lion anything about DCB"
                aria-label="Message the Lion"
              />
              {voiceOk && (
                <button
                  type="button"
                  className="lion-chat__mic"
                  onClick={startCall}
                  aria-label="Talk to the Lion"
                  title="Talk to the Lion"
                >
                  <MicIcon />
                </button>
              )}
              <button
                type="submit"
                className="lion-chat__send"
                aria-label="Send"
                disabled={!question.trim()}
              >
                <span aria-hidden="true">↑</span>
              </button>
            </div>
            <p className="lion-chat__fine">
              The Lion answers only from DCB’s verified information.
            </p>
          </form>
        )}
      </section>
    </>
  );
}

// ── Photos, videos and the campus tour, inside Compass ──────
function AnswerMedia({ question, answer }) {
  const { openViewer } = useLion();
  const { images, videos, tour } = useMemo(
    () => mediaFor({ question, answer }),
    [question, answer],
  );
  if (!images.length && !videos.length && !tour) return null;

  return (
    <div className="answer-media">
      {images.length > 0 && (
        <p className="answer-media__label-top">Photos from DCB</p>
      )}
      {images.length > 0 && (
        <div className="answer-media__strip">
          {images.map((i) => (
            <button
              key={i.url}
              type="button"
              className="answer-media__img"
              onClick={() => openViewer(i)}
              aria-label={`View photo: ${i.title || i.alt}`}
            >
              <img src={i.url} alt={i.alt || ""} loading="lazy" />
              {i.title && <span>{i.title}</span>}
            </button>
          ))}
        </div>
      )}

      {videos.map((v) => (
        <button
          key={v.url}
          type="button"
          className="answer-media__wide"
          onClick={() => openViewer(v)}
        >
          <span className="answer-media__thumb">
            {v.poster && <img src={v.poster} alt="" loading="lazy" />}
            <span className="answer-media__play" aria-hidden="true">
              ▶
            </span>
          </span>
          <span className="answer-media__label">
            <strong>{v.title}</strong>
            <small>Watch here</small>
          </span>
        </button>
      ))}

      {tour && (
        <button
          type="button"
          className="answer-media__wide"
          onClick={() => openViewer(tour)}
        >
          <span className="answer-media__thumb">
            <img src={tour.thumb} alt="" loading="lazy" />
            <span className="answer-media__play" aria-hidden="true">
              360°
            </span>
          </span>
          <span className="answer-media__label">
            <strong>Take the virtual campus tour</strong>
            <small>Walk around DCB without leaving this page</small>
          </span>
        </button>
      )}
    </div>
  );
}

function MediaViewer() {
  const { viewer, closeViewer, handleLink } = useLion();

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e) => e.key === "Escape" && closeViewer();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, closeViewer]);

  if (!viewer) return null;
  const v = viewer;
  const title = v.kind === "tour" ? v.title : v.title || v.alt || "DCB";

  return (
    <div
      className="lion-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={closeViewer}
    >
      <div
        className={`lion-viewer__panel lion-viewer__panel--${v.kind}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lion-viewer__bar">
          <p>{title}</p>
          <button
            type="button"
            className="lion-viewer__close"
            aria-label="Close"
            onClick={closeViewer}
          >
            ×
          </button>
        </header>

        <div className="lion-viewer__stage">
          {v.kind === "image" && <img src={v.url} alt={v.alt || ""} />}
          {v.kind === "video" &&
            (v.type === "mp4" ? (
              <video
                src={v.url}
                poster={v.poster}
                controls
                autoPlay
                playsInline
              />
            ) : (
              <iframe
                src={v.url}
                title={v.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ))}
          {v.kind === "tour" && (
            <iframe
              src={v.url}
              title="DCB virtual campus tour"
              allow="fullscreen; accelerometer; gyroscope; xr-spatial-tracking"
              allowFullScreen
            />
          )}
        </div>

        <footer className="lion-viewer__foot">
          {v.kind === "tour" ? (
            <>
              <span>
                If the tour doesn’t load here, it can open in a new tab.
              </span>
              <a href={v.url} target="_blank" rel="noreferrer">
                Open the tour in a new tab
              </a>
            </>
          ) : (
            v.page && (
              <button
                type="button"
                className="lion-viewer__more"
                onClick={() => {
                  closeViewer();
                  handleLink(v.page);
                }}
              >
                See this in the journey
              </button>
            )
          )}
        </footer>
      </div>
    </div>
  );
}

// ── Voice pieces ────────────────────────────────────────────
const VOICE_STATUS = {
  connecting: "Connecting to the Lion…",
  initializing: "Connecting to the Lion…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "The Lion is speaking",
};

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

// Lets the open child's journey pick up what the parent says or types
// in the chat (Compass.jsx listens for this)
function tellJourney(text, childId) {
  window.dispatchEvent(
    new CustomEvent("compass:said", { detail: { text, childId } }),
  );
}

function VoiceTranscript({ lines, live = false }) {
  const { handleLink } = useLion();
  return (
    <div
      className={`lion-turn2 lion-voice-log${live ? " lion-voice-log--live" : ""}`}
    >
      <p className="lion-msg__source">
        {live ? "Voice call, live" : "Voice call"}
      </p>
      {lines.map((l) =>
        l.role === "note" ? (
          <p key={l.id} className="lion-voice-log__note">
            {l.text}
          </p>
        ) : l.role === "user" ? (
          <div key={l.id} className="lion-msg lion-msg--you">
            <p>{l.text}</p>
          </div>
        ) : (
          <div key={l.id} className="lion-msg lion-msg--lion">
            <span className="lion-msg__avatar" aria-hidden="true">
              🦁
            </span>
            <div className="lion-msg__body">
              {/* Links in the Lion's words show as links, not [text](url) */}
              <Markdown text={l.text} onLink={handleLink} />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function VoiceBar({ call, onMute, onEnd, onRetry }) {
  if (call.status === "error") {
    return (
      <div className="lion-voice" role="status">
        <p className="lion-voice__error">{call.error}</p>
        <div className="lion-voice__actions">
          <button type="button" className="lion-voice__btn" onClick={onRetry}>
            Try again
          </button>
          <button
            type="button"
            className="lion-voice__btn lion-voice__btn--end"
            onClick={onEnd}
          >
            Back to typing
          </button>
        </div>
      </div>
    );
  }
  const state = VOICE_STATUS[call.status] ? call.status : "listening";
  return (
    <div className="lion-voice">
      <span
        className={`lion-voice__orb lion-voice__orb--${state}`}
        aria-hidden="true"
      >
        🦁
      </span>
      <p className="lion-voice__status" role="status" aria-live="polite">
        {call.muted ? "Microphone off" : VOICE_STATUS[state]}
      </p>
      <div className="lion-voice__actions">
        <button
          type="button"
          className={`lion-voice__btn${call.muted ? " lion-voice__btn--on" : ""}`}
          onClick={onMute}
          aria-pressed={call.muted}
          disabled={call.status === "connecting"}
        >
          {call.muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          className="lion-voice__btn lion-voice__btn--end"
          onClick={onEnd}
        >
          End call
        </button>
      </div>
    </div>
  );
}

// ── Small, safe markdown: paragraphs, lists, bold, links ────
function LionLink({ href, onLink, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (onLink && onLink(href)) e.preventDefault();
      }}
    >
      {children}
    </a>
  );
}

function renderInline(text, onLink, keyPrefix) {
  const re =
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s)<]+)/g;
  const out = [];
  let last = 0;
  let n = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[1]) {
      out.push(
        <LionLink key={key} href={m[2]} onLink={onLink}>
          {m[1]}
        </LionLink>,
      );
    } else if (m[3]) {
      out.push(<strong key={key}>{m[3]}</strong>);
    } else {
      const url = m[4].replace(/[.,;:!?]+$/, "");
      out.push(
        <LionLink key={key} href={url} onLink={onLink}>
          {url}
        </LionLink>,
      );
      if (url.length < m[4].length) out.push(m[4].slice(url.length));
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, onLink }) {
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", lines: para });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "ul", items: list });
    list = null;
  };

  String(text || "")
    .split("\n")
    .forEach((line) => {
      const item = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
      if (item) {
        flushPara();
        if (!list) list = [];
        list.push(item[1]);
        return;
      }
      flushList();
      if (!line.trim()) {
        flushPara();
        return;
      }
      para.push(line.replace(/^#+\s*/, ""));
    });
  flushPara();
  flushList();

  return (
    <div className="md">
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(l, onLink, `${i}-${j}`)}
              </span>
            ))}
          </p>
        ) : (
          <ul key={i}>
            {b.items.map((t, j) => (
              <li key={j}>{renderInline(t, onLink, `${i}-${j}`)}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
