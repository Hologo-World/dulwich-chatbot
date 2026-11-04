import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { askInline, openAkemaChat } from "../compass/akemaBridge";

// ─────────────────────────────────────────────────────────────
// "Ask the Lion": answers from the Akema agent, shown on the page.
//   useLion()        – ask, askInSheet, openSheet, openChat, ...
//   useLionAnswer()  – [state, run] for an inline answer in any card
//   LionAnswerCard   – renders one answer (pending / done / error)
// The Akema bubble stays a separate, optional full chat.
// ─────────────────────────────────────────────────────────────

const LionContext = createContext(null);
export const useLion = () => useContext(LionContext);

const SUGGESTIONS = [
  "What makes DCB different?",
  "How is Mandarin taught at DCB?",
  "What are the steps to apply?",
  "What sport can students do?",
];

export function LionProvider({ children, onLink }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [thread, setThread] = useState([]);
  const lastContext = useRef(null); // family context the Lion already has
  const pageContext = useRef(null); // context of the page the parent is on
  const onLinkRef = useRef(onLink);

  useEffect(() => {
    onLinkRef.current = onLink;
  }, [onLink]);

  // Sends the family context once, then only again when it changes
  const ask = useCallback(async (question, { context } = {}) => {
    const message =
      context && context !== lastContext.current
        ? `${context} ${question}`
        : question;
    const answer = await askInline(message);
    if (context) lastContext.current = context;
    return answer;
  }, []);

  const askInSheet = useCallback(
    (question, opts = {}) => {
      const id = `${Date.now()}-${Math.random()}`;
      const context = opts.context ?? pageContext.current;
      setSheetOpen(true);
      setThread((t) => [...t, { id, question, status: "pending" }]);
      ask(question, { context }).then(
        (answer) =>
          setThread((t) =>
            t.map((m) => (m.id === id ? { ...m, status: "done", answer } : m)),
          ),
        (err) =>
          setThread((t) =>
            t.map((m) =>
              m.id === id ? { ...m, status: "error", answer: err.message } : m,
            ),
          ),
      );
    },
    [ask],
  );

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const setPageContext = useCallback((c) => {
    pageContext.current = c;
  }, []);
  const handleLink = useCallback((url) => !!onLinkRef.current?.(url), []);

  const value = useMemo(
    () => ({
      ask,
      askInSheet,
      sheetOpen,
      openSheet,
      closeSheet,
      thread,
      handleLink,
      setPageContext,
      openChat: openAkemaChat,
    }),
    [
      ask,
      askInSheet,
      sheetOpen,
      openSheet,
      closeSheet,
      thread,
      handleLink,
      setPageContext,
    ],
  );

  return (
    <LionContext.Provider value={value}>
      {children}
      <LionSheet />
    </LionContext.Provider>
  );
}

// [state, run] for an inline answer. state: { status, question, answer }
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

export function LionAnswerCard({ state }) {
  const { handleLink, openChat } = useLion();
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
          <Markdown text={state.answer} onLink={handleLink} />
          <button type="button" className="link" onClick={openChat}>
            Continue in chat
          </button>
        </>
      )}

      {state.status === "error" && (
        <p className="lion-answer__error">{state.answer}</p>
      )}
    </div>
  );
}

// ── The side panel (like an "Ask Gemini" panel) ─────────────
function LionSheet() {
  const { sheetOpen, closeSheet, thread, askInSheet, openChat } = useLion();
  const [question, setQuestion] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread, sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, closeSheet]);

  const submit = (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    askInSheet(q);
  };

  return (
    <aside
      className={`lion-sheet${sheetOpen ? " lion-sheet--open" : ""}`}
      aria-label="Ask the Lion"
      aria-hidden={!sheetOpen}
    >
      <header className="lion-sheet__head">
        <span className="lion-sheet__icon" aria-hidden="true">
          🦁
        </span>
        <div>
          <h2>Ask the Lion</h2>
          <p>Answers from verified DCB information</p>
        </div>
        <button
          type="button"
          className="lion-sheet__close"
          aria-label="Close"
          onClick={closeSheet}
        >
          ×
        </button>
      </header>

      <div className="lion-sheet__body">
        {thread.length === 0 ? (
          <div className="lion-sheet__empty">
            <p>Ask anything about life and learning at DCB.</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  onClick={() => askInSheet(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          thread.map((m) => (
            <div key={m.id} className="lion-turn">
              <p className="lion-turn__q">{m.question}</p>
              <LionAnswerCard state={m} />
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form className="lion-sheet__form" onSubmit={submit}>
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a follow-up"
          aria-label="Ask the Lion"
        />
        <button type="submit" className="btn btn--small">
          Ask
        </button>
      </form>
      <button
        type="button"
        className="link lion-sheet__chat"
        onClick={openChat}
      >
        Open the full chat
      </button>
    </aside>
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
