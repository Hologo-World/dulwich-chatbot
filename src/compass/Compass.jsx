import { useEffect, useMemo, useRef, useState } from "react";
import {
  ADMISSIONS_URL,
  EVIDENCE,
  OPTIONS,
  STAGES,
  VISIT_URL,
  YEARS,
} from "./journeyData";
import {
  askAkema,
  onAkemaEvent,
  onAkemaLinkClick,
  sendToAkema,
} from "./akemaBridge";
import { logGap, readGaps } from "./gaps";
import "./Compass.css";

// ── Context helpers ──────────────────────────────────────────
const GROUPS = ["interests", "languages", "priorities"];
const ALL_OPTIONS = [
  ...OPTIONS.interests.map((o) => ({ ...o, group: "interests" })),
  ...OPTIONS.explore.map((o) => ({ ...o, group: "interests", explore: true })),
  ...OPTIONS.languages.map((o) => ({ ...o, group: "languages" })),
  ...OPTIONS.priorities.map((o) => ({ ...o, group: "priorities" })),
];
const findOption = (id) => ALL_OPTIONS.find((o) => o.id === id);
const yearLabel = (y) => YEARS.find((x) => x.value === y)?.label;

const EMPTY = { year: null, interests: [], languages: [], priorities: [] };

function contextTags(ctx) {
  const tags = new Set();
  GROUPS.forEach((g) =>
    ctx[g].forEach((id) => findOption(id)?.tags.forEach((t) => tags.add(t))),
  );
  return tags;
}

function selectedLabels(ctx) {
  return GROUPS.flatMap((g) =>
    ctx[g].map((id) => findOption(id)?.label),
  ).filter(Boolean);
}

// Labels of what the parent shared that connect to this item
function matchedLabels(item, ctx) {
  return GROUPS.flatMap((g) => ctx[g])
    .map(findOption)
    .filter((o) => o && o.tags.some((t) => item.tags.includes(t)))
    .map((o) => o.label);
}

// ── Journey builder: curate one evidence item per stage ─────
function buildJourney(ctx) {
  const tags = contextTags(ctx);
  const used = new Set();
  return STAGES.map((stage) => {
    if (stage.id === "growing" && ctx.priorities.length === 0) {
      return { stage, kind: "invite" };
    }
    const best = EVIDENCE.filter(
      (e) =>
        e.stage === stage.id &&
        !used.has(e.id) &&
        (!e.years || ctx.year == null || e.years.includes(ctx.year)),
    )
      .map((e) => ({ e, score: e.tags.filter((t) => tags.has(t)).length }))
      .sort((a, b) => b.score - a.score)[0];

    if (best && (best.score > 0 || !stage.needsMatch)) {
      used.add(best.e.id);
      return { stage, kind: "item", item: best.e };
    }
    const topic = `${stage.title}: ${selectedLabels(ctx).join(", ") || "general"}`;
    return { stage, kind: "gap", topic };
  });
}

const keyOf = (s) =>
  s.kind === "item" ? s.item.id : `${s.kind}-${s.topic || ""}`;

// ── Natural-language parsing (simple keyword PoC) ──────────
// Swap this for an LLM extraction call later; keep the same output shape.
const SYNONYMS = {
  drawing: "art",
  painting: "art",
  sketching: "art",
  piano: "music",
  violin: "music",
  singing: "music",
  choir: "music",
  band: "music",
  chinese: "mandarin",
  putonghua: "mandarin",
  confident: "confidence",
  independent: "independence",
  leader: "leadership",
  soccer: "football",
  swim: "swimming",
  programming: "coding",
  robotics: "coding",
  theatre: "drama",
  acting: "drama",
  hiking: "outdoors",
  nature: "outdoors",
};

function findMentions(text) {
  const lower = text.toLowerCase();
  const ids = new Set();
  ALL_OPTIONS.filter((o) => !o.explore).forEach((o) => {
    if (lower.includes(o.label.toLowerCase())) ids.add(o.id);
  });
  Object.entries(SYNONYMS).forEach(([word, id]) => {
    if (new RegExp(`\\b${word}`).test(lower)) ids.add(id);
  });
  return ids;
}

function parseInput(text) {
  const lower = text.toLowerCase();
  let year = null;
  const ym = lower.match(/year\s*(\d{1,2})/);
  if (ym && Number(ym[1]) <= 13) year = Number(ym[1]);
  else if (/reception/.test(lower)) year = 0;

  const removeIds = new Set();
  const rm = lower.match(
    /(?:more than|instead of|rather than|remove|drop|not into|no longer|without)\s+([a-z]+)/,
  );
  if (rm) findMentions(rm[1]).forEach((id) => removeIds.add(id));
  const addIds = [...findMentions(lower)].filter((id) => !removeIds.has(id));
  return { year, addIds, removeIds: [...removeIds] };
}

function applyParsed(ctx, p) {
  const next = { ...ctx };
  if (p.year != null) next.year = p.year;
  GROUPS.forEach((g) => {
    next[g] = ctx[g].filter((id) => !p.removeIds.includes(id));
  });
  p.addIds.forEach((id) => {
    const g = findOption(id)?.group;
    if (g && !next[g].includes(id)) next[g] = [...next[g], id];
  });
  return next;
}

// Reads a frontend-tool URL like ...?add=music&remove=art&year=6
function parseToolUrl(url) {
  const params = new URL(url, window.location.href).searchParams;
  const ids = (key) =>
    (params.get(key) || "")
      .split(",")
      .filter(Boolean)
      .flatMap((word) => [...findMentions(word)]);
  const yearParam = params.get("year");
  const year =
    yearParam && !Number.isNaN(Number(yearParam)) ? Number(yearParam) : null;
  return { year, addIds: ids("add"), removeIds: ids("remove") };
}

function teaserFor(id) {
  const o = findOption(id);
  if (!o) return "";
  const e = EVIDENCE.find((x) => x.tags.some((t) => o.tags.includes(t)));
  return e
    ? `${o.label}, lovely. One place that could lead at DCB: “${e.title}”.`
    : `${o.label}, lovely.`;
}

// Turns the parent's selections into a natural message for the chat
function describeContext(ctx) {
  const labels = (g) =>
    ctx[g].map((id) => findOption(id)?.label).filter(Boolean);
  const list = (arr) =>
    arr.length <= 1
      ? arr.join("")
      : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;

  const parts = [];
  if (ctx.year != null)
    parts.push(`My child would be joining ${yearLabel(ctx.year)}.`);
  const interests = labels("interests").map((l) => l.toLowerCase());
  if (interests.length) parts.push(`They're interested in ${list(interests)}.`);
  const languages = labels("languages");
  if (languages.length)
    parts.push(`They're most comfortable in ${list(languages)}.`);
  const priorities = labels("priorities").map((l) => l.toLowerCase());
  if (priorities.length)
    parts.push(`We'd love school to help them grow in ${list(priorities)}.`);
  return parts.join(" ");
}

// ── Adaptive discovery: information goals, not a script ─────
function nextGoal(ctx, answered) {
  if (ctx.year == null) return "year";
  if (!answered.interests) return "interests";
  if (!ctx.languages.length && !answered.languages) return "languages";
  if (!ctx.priorities.length && !answered.priorities) return "priorities";
  return "ready";
}

const PROMPTS = {
  year: "What year would they be joining?",
  interests: "What do they happily spend hours doing?",
  languages: "Which languages does your child feel most comfortable using?",
  priorities: "Anything you’d especially love school to help them grow in?",
  ready: "That gives me plenty to start with. Let me show you something.",
};

const WELCOME =
  "Hello, I’m the DCB Lion. Tell me a little about your child and I’ll show you what their time at Dulwich College Beijing could include.";

// ── Component ───────────────────────────────────────────────
export default function Compass() {
  const [ctx, setCtx] = useState(EMPTY);
  const [answered, setAnswered] = useState({
    interests: false,
    languages: false,
    priorities: false,
  });
  const [phase, setPhase] = useState("discovery");
  const [lionNote, setLionNote] = useState(WELCOME);
  const [exploreMode, setExploreMode] = useState(false);
  const [input, setInput] = useState("");
  const [openItem, setOpenItem] = useState(null); // journey stage entry
  const [editing, setEditing] = useState(false);
  const [updated, setUpdated] = useState(new Set());
  const [showGaps, setShowGaps] = useState(false);
  const [toast, setToast] = useState("");
  const prevJourney = useRef(null);
  const sentContext = useRef(null);
  const loggedGaps = useRef(new Set());

  const journey = useMemo(() => buildJourney(ctx), [ctx]);
  const goal = nextGoal(ctx, answered);
  const canReveal = ctx.year != null && ctx.interests.length > 0;

  // NEW: keep the latest journey available to the chat link handler
  const journeyRef = useRef(journey);
  useEffect(() => {
    journeyRef.current = journey;
  }, [journey]);

  // Highlight stages that changed after a remix
  useEffect(() => {
    if (phase !== "journey") return;
    const prev = prevJourney.current;
    prevJourney.current = journey;
    if (!prev) return;
    const changed = new Set(
      journey
        .filter((s, i) => keyOf(s) !== keyOf(prev[i]))
        .map((s) => s.stage.id),
    );
    if (!changed.size) return;
    setUpdated(changed);
    const t = setTimeout(() => setUpdated(new Set()), 2200);
    return () => clearTimeout(t);
  }, [journey, phase]);

  // Record knowledge gaps once per topic per session
  useEffect(() => {
    if (phase !== "journey") return;
    journey.forEach((s) => {
      if (s.kind === "gap" && !loggedGaps.current.has(s.topic)) {
        loggedGaps.current.add(s.topic);
        logGap(s.topic, {
          year: yearLabel(ctx.year),
          shared: selectedLabels(ctx),
        });
      }
    });
  }, [journey, phase, ctx]);

  // Keep the journey in sync with what happens in the Akema chat
  useEffect(() => {
    return onAkemaEvent((ev) => {
      let p = null;
      if (ev.type === "message" && ev.from === "visitor")
        p = parseInput(ev.text);
      if (ev.type === "tool" && ev.tool === "updateCompassJourney")
        p = parseToolUrl(ev.url);
      if (
        !p ||
        (p.year == null && p.addIds.length === 0 && p.removeIds.length === 0)
      )
        return;

      setCtx((c) => applyParsed(c, p));
      const groupsAdded = new Set(p.addIds.map((id) => findOption(id)?.group));
      setAnswered((a) => ({
        interests: a.interests || groupsAdded.has("interests"),
        languages: a.languages || groupsAdded.has("languages"),
        priorities: a.priorities || groupsAdded.has("priorities"),
      }));
      setLionNote(
        p.removeIds.length
          ? "Easy, let’s change that."
          : "Got it. I’ve updated your journey.",
      );
    });
  }, []);

  // NEW: links in the chat open the matching journey card instead of a new tab
  useEffect(() => {
    const norm = (u) => u.replace(/[#?].*$/, "").replace(/\/+$/, "");
    return onAkemaLinkClick((url) => {
      const target = norm(url);

      // Prefer the card already in the parent's journey
      const inJourney = journeyRef.current.find(
        (s) => s.kind === "item" && norm(s.item.source.url) === target,
      );
      if (inJourney) {
        setOpenItem(inJourney);
        return true;
      }

      // Otherwise any card that uses this page
      const item = EVIDENCE.find((e) => norm(e.source.url) === target);
      if (!item) return false; // no matching card: open the DCB page as usual
      setOpenItem({
        kind: "item",
        item,
        stage: STAGES.find((s) => s.id === item.stage),
      });
      return true;
    });
  }, []);

  // Deep links: #card-<id> opens a card, #gaps opens the admin digest
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.slice(1);
      if (h === "gaps") setShowGaps(true);
      if (h.startsWith("card-")) {
        const item = EVIDENCE.find((e) => e.id === h.slice(5));
        if (item) {
          setOpenItem({
            kind: "item",
            item,
            stage: STAGES.find((s) => s.id === item.stage),
          });
        }
      }
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const clearHash = () =>
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const ask = async (question) => {
    const key = JSON.stringify(ctx);
    const message =
      sentContext.current === key
        ? question
        : `${describeContext(ctx)} ${question}`;

    const result = await askAkema(message);
    if (result === "sent") {
      sentContext.current = key;
      notify("Sent to the chat.");
    } else if (result === "opened")
      notify("Chat opened. Type your question there.");
    else if (result === "copied")
      notify("Question copied. Paste it into the chat bubble.");
    else
      notify(
        "The chat isn’t available right now. Check the console for details.",
      );
  };

  const toggle = (group, id) => {
    const adding = !ctx[group].includes(id);
    setCtx((c) => ({
      ...c,
      [group]: adding ? [...c[group], id] : c[group].filter((x) => x !== id),
    }));
    if (phase === "discovery" && adding && group === "interests")
      setLionNote(teaserFor(id));
    if (phase === "journey")
      setLionNote(
        adding
          ? "Got it. I’ve added that to your journey."
          : "Easy, let’s change that.",
      );
  };

  const chooseYear = (value) => {
    setCtx((c) => ({ ...c, year: value }));
    if (phase === "journey") setLionNote(`Updated for ${yearLabel(value)}.`);
  };

  const markAnswered = (group) => setAnswered((a) => ({ ...a, [group]: true }));

  const reveal = () => {
    setPhase("journey");
    setEditing(false);

    // Tell the chat what the parent shared. Desktop opens the panel beside
    // the journey; phones only show an unread badge so the journey stays visible.
    const isDesktop = window.matchMedia("(min-width: 700px)").matches;
    const key = JSON.stringify(ctx);
    sendToAkema(
      `Hi! ${describeContext(ctx)} What could their journey at DCB include?`,
      { open: isDesktop },
    ).then((ok) => {
      if (ok) sentContext.current = key;
    });

    setLionNote(
      "Based on the interests you shared, here are some opportunities you could explore at DCB. How does this feel so far? Anything you’d like me to change?",
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");

    // Questions go to the chat, even if they mention an interest
    const isQuestion =
      /\?\s*$/.test(text) ||
      /^(what|how|when|where|who|why|which|can|could|does|do|is|are|will|would|tell me|show me)\b/i.test(
        text,
      );
    if (isQuestion) {
      setLionNote(
        "Let me check what DCB has verified on that. I’ve passed your question to the chat.",
      );
      ask(text);
      return;
    }

    // Everything else is treated as a change to the context
    const p = parseInput(text);
    const changed =
      p.year != null || p.addIds.length > 0 || p.removeIds.length > 0;

    if (changed) {
      setCtx((c) => applyParsed(c, p));
      const groupsAdded = new Set(p.addIds.map((id) => findOption(id)?.group));
      setAnswered((a) => ({
        interests: a.interests || groupsAdded.has("interests"),
        languages: a.languages || groupsAdded.has("languages"),
        priorities: a.priorities || groupsAdded.has("priorities"),
      }));
      if (phase === "journey") {
        setLionNote(
          p.removeIds.length
            ? "Easy, let’s change that."
            : "Got it. I’ve updated your journey.",
        );
      } else {
        const firstInterest = p.addIds.find(
          (id) => findOption(id)?.group === "interests",
        );
        setLionNote(
          firstInterest ? teaserFor(firstInterest) : "Thanks, that helps.",
        );
      }
      return;
    }

    // Not a question and nothing recognised
    if (phase === "journey") {
      setLionNote("Let me pass that to the chat.");
      ask(text);
      return;
    }

    setLionNote(
      "No problem at all. Sometimes it’s easier to explore than explain. Pick anything below that sounds interesting and I’ll show you where it could lead.",
    );
    setExploreMode(true);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={`compass compass--${phase}`}>
      {phase === "discovery" ? (
        <section className="intro" aria-live="polite">
          <div className="lion lion--large" aria-hidden="true">
            🦁
          </div>
          <h1 className="intro__title" style={{color:"black"}}>
            What could school at DCB look like for your child?
          </h1>
          <p className="lion-say">{lionNote}</p>

          {(ctx.year != null || selectedLabels(ctx).length > 0) && (
            <ContextBar
              ctx={ctx}
              onRemove={toggle}
              onEdit={() => setEditing((v) => !v)}
              editing={editing}
            />
          )}
          {editing && (
            <ContextEditor ctx={ctx} onToggle={toggle} onYear={chooseYear} />
          )}

          <div className="question">
            {exploreMode && goal === "interests" ? (
              <>
                <p className="question__text">
                  Pick anything that sounds interesting
                </p>
                <Chips
                  options={OPTIONS.explore}
                  selected={ctx.interests}
                  onToggle={(id) => toggle("interests", id)}
                />
                <QuestionActions
                  primary={ctx.interests.length ? "That’s everything" : null}
                  onPrimary={() => markAnswered("interests")}
                />
              </>
            ) : (
              <>
                <p className="question__text">{PROMPTS[goal]}</p>
                {goal === "year" && (
                  <div className="chips" role="group" aria-label="Year group">
                    {YEARS.map((y) => (
                      <button
                        key={y.value}
                        type="button"
                        className="chip"
                        onClick={() => chooseYear(y.value)}
                      >
                        {y.label}
                      </button>
                    ))}
                  </div>
                )}
                {goal === "interests" && (
                  <>
                    <Chips
                      options={OPTIONS.interests}
                      selected={ctx.interests}
                      onToggle={(id) => toggle("interests", id)}
                    />
                    <QuestionActions
                      primary={
                        ctx.interests.length ? "That’s everything" : null
                      }
                      onPrimary={() => markAnswered("interests")}
                      secondary="Not sure, let me explore"
                      onSecondary={() => setExploreMode(true)}
                    />
                  </>
                )}
                {(goal === "languages" || goal === "priorities") && (
                  <>
                    <Chips
                      options={OPTIONS[goal]}
                      selected={ctx[goal]}
                      onToggle={(id) => toggle(goal, id)}
                    />
                    <QuestionActions
                      secondary="Skip"
                      onSecondary={() => markAnswered(goal)}
                    />
                  </>
                )}
              </>
            )}
          </div>

          {canReveal && (
            <button type="button" className="btn btn--reveal" onClick={reveal}>
              {goal === "ready" ? "Show me" : "Show me what you have so far"}
            </button>
          )}

          <InputBar
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Or type, e.g. “Year 6, loves volleyball and drawing”"
          />
          <p className="lang-note">English. 中文 coming soon.</p>
        </section>
      ) : (
        <section className="journey">
          <header className="journey__top">
            <div className="lion-dock" aria-live="polite">
              <span className="lion lion--small" aria-hidden="true">
                🦁
              </span>
              <p className="lion-say lion-say--small">{lionNote}</p>
            </div>
            <ContextBar
              ctx={ctx}
              onRemove={toggle}
              onEdit={() => setEditing((v) => !v)}
              editing={editing}
            />
            {editing && (
              <ContextEditor ctx={ctx} onToggle={toggle} onYear={chooseYear} />
            )}
          </header>

          <ol className="track">
            {journey.map((s, i) => (
              <li
                key={s.stage.id}
                id={`stage-${s.stage.id}`}
                className={`stage${updated.has(s.stage.id) ? " stage--updated" : ""}`}
              >
                <div className="stage__head">
                  <span className="stage__step">{i + 1}</span>
                  <h2 className="stage__title">{s.stage.title}</h2>
                  {updated.has(s.stage.id) && (
                    <span className="stage__flag">Updated</span>
                  )}
                </div>
                <StageCard
                  entry={s}
                  ctx={ctx}
                  onOpen={() => setOpenItem(s)}
                  onInvite={() => setEditing(true)}
                />
              </li>
            ))}
          </ol>

          <div className="quick" role="group" aria-label="Quick actions">
            <button
              type="button"
              className="chip"
              onClick={() => setEditing(true)}
            >
              Change an interest
            </button>
            <button
              type="button"
              className="chip"
              onClick={() =>
                document.getElementById("stage-ahead")?.scrollIntoView({
                  behavior: "smooth",
                  inline: "start",
                  block: "nearest",
                })
              }
            >
              Look further ahead
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => ask("What does academic life look like at DCB?")}
            >
              Explore academics
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => ask("Tell me more about sport at DCB.")}
            >
              Explore sport
            </button>
          </div>

          <InputBar
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Change anything, e.g. “music matters more than art”"
          />

          <footer className="next">
            <p>Ready to talk to someone at DCB?</p>
            <div className="next__actions">
              <a
                className="btn btn--quiet"
                href={ADMISSIONS_URL}
                target="_blank"
                rel="noreferrer"
              >
                Speak to Admissions
              </a>
              {/* NEW: goes to the Visit Us page */}
              <a
                className="btn btn--quiet"
                href={VISIT_URL}
                target="_blank"
                rel="noreferrer"
              >
                Arrange a visit
              </a>
            </div>
          </footer>
        </section>
      )}

      {openItem && (
        <Drawer
          entry={openItem}
          ctx={ctx}
          onClose={() => {
            setOpenItem(null);
            clearHash();
          }}
          onAsk={ask}
        />
      )}
      {showGaps && (
        <GapDigest
          onClose={() => {
            setShowGaps(false);
            clearHash();
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────
function Chips({ options, selected, onToggle }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip${selected.includes(o.id) ? " chip--on" : ""}`}
          aria-pressed={selected.includes(o.id)}
          onClick={() => onToggle(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function QuestionActions({ primary, onPrimary, secondary, onSecondary }) {
  return (
    <div className="question__actions">
      {primary && (
        <button type="button" className="btn btn--small" onClick={onPrimary}>
          {primary}
        </button>
      )}
      {secondary && (
        <button type="button" className="link" onClick={onSecondary}>
          {secondary}
        </button>
      )}
    </div>
  );
}

function ContextBar({ ctx, onRemove, onEdit, editing }) {
  return (
    <div className="context" aria-label="What you’ve shared">
      {ctx.year != null && (
        <span className="context__chip context__chip--year">
          {yearLabel(ctx.year)}
        </span>
      )}
      {GROUPS.flatMap((g) =>
        ctx[g].map((id) => (
          <span key={id} className="context__chip">
            {findOption(id)?.label}
            <button
              type="button"
              aria-label={`Remove ${findOption(id)?.label}`}
              onClick={() => onRemove(g, id)}
            >
              ×
            </button>
          </span>
        )),
      )}
      <button type="button" className="link" onClick={onEdit}>
        {editing ? "Done" : "Edit"}
      </button>
    </div>
  );
}

function ContextEditor({ ctx, onToggle, onYear }) {
  return (
    <div className="editor">
      <label className="editor__row">
        <span>Joining</span>
        <select
          value={ctx.year ?? ""}
          onChange={(e) => onYear(Number(e.target.value))}
        >
          <option value="" disabled>
            Choose a year
          </option>
          {YEARS.map((y) => (
            <option key={y.value} value={y.value}>
              {y.label}
            </option>
          ))}
        </select>
      </label>
      <p className="editor__label">Interests</p>
      <Chips
        options={OPTIONS.interests}
        selected={ctx.interests}
        onToggle={(id) => onToggle("interests", id)}
      />
      <p className="editor__label">Languages</p>
      <Chips
        options={OPTIONS.languages}
        selected={ctx.languages}
        onToggle={(id) => onToggle("languages", id)}
      />
      <p className="editor__label">Help them grow in</p>
      <Chips
        options={OPTIONS.priorities}
        selected={ctx.priorities}
        onToggle={(id) => onToggle("priorities", id)}
      />
    </div>
  );
}

function StageCard({ entry, ctx, onOpen, onInvite }) {
  if (entry.kind === "invite") {
    return (
      <button type="button" className="card card--invite" onClick={onInvite}>
        <p>
          Tell me what you’d love school to help them grow in, and I’ll add it
          here.
        </p>
        <span className="card__action">Add a priority</span>
      </button>
    );
  }
  if (entry.kind === "gap") {
    return (
      <button type="button" className="card card--gap" onClick={onOpen}>
        <p>I don’t have verified DCB information for this part yet.</p>
        <span className="card__action">See options</span>
      </button>
    );
  }
  const { item } = entry;
  const links = matchedLabels(item, ctx);
  return (
    <button type="button" className="card" onClick={onOpen}>
      <div className="card__media">
        {item.media?.type === "image" ? (
          <img src={item.media.url} alt={item.media.alt || ""} />
        ) : (
          <span aria-hidden="true">{item.media ? "▶" : ""}</span>
        )}
      </div>
      {!item.verified && (
        <span className="badge">Draft, needs verified content</span>
      )}
      <h3 className="card__title">{item.title}</h3>
      {links.length > 0 && (
        <p className="card__why">Connected to {links.join(", ")}</p>
      )}
      <span className="card__action">Explore</span>
    </button>
  );
}

function Drawer({ entry, ctx, onClose, onAsk }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isGap = entry.kind === "gap";
  const item = entry.item;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={isGap ? entry.stage.title : item.title}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="drawer__close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <p className="drawer__stage">{entry.stage.title}</p>

        {isGap ? (
          <>
            <h2 className="drawer__title">Not verified yet</h2>
            <p>
              I don’t have verified DCB information about this yet. I can show
              you what I do know, or help you connect with the right team. I’ve
              noted the question so DCB can add it.
            </p>
            <div className="drawer__actions">
              <button
                type="button"
                className="btn btn--small"
                onClick={onClose}
              >
                Show me what you know
              </button>
              <a
                className="btn btn--quiet"
                href={ADMISSIONS_URL}
                target="_blank"
                rel="noreferrer"
              >
                Contact the team
              </a>
            </div>
          </>
        ) : (
          <>
            <h2 className="drawer__title">{item.title}</h2>
            {!item.verified && (
              <span className="badge">Draft, needs verified content</span>
            )}
            <Media media={item.media} />
            <p className="drawer__detail">{item.detail}</p>
            {matchedLabels(item, ctx).length > 0 && (
              <p className="drawer__why">
                Why this is here: you mentioned{" "}
                {matchedLabels(item, ctx).join(", ")}.
              </p>
            )}
            {item.voice && (
              <blockquote className="voice">
                <p>{item.voice.quote}</p>
                <cite>{item.voice.who}</cite>
              </blockquote>
            )}
            {item.document && (
              <a
                className="doc"
                href={item.document.url}
                target="_blank"
                rel="noreferrer"
              >
                {item.document.label}
              </a>
            )}
            <div className="drawer__actions">
              <button
                type="button"
                className="btn btn--small"
                onClick={() =>
                  onAsk(`Tell me more about ${item.title} at DCB.`)
                }
              >
                Ask about this
              </button>
              <a
                className="btn btn--quiet"
                href={item.source.url}
                target="_blank"
                rel="noreferrer"
              >
                Open on DCB website
              </a>
            </div>
            <details className="source">
              <summary>Source</summary>
              <p>
                {item.source.label}: {item.source.url}
              </p>
            </details>
          </>
        )}
      </aside>
    </div>
  );
}

function Media({ media }) {
  if (!media)
    return (
      <div className="media media--empty">
        Add a verified DCB photo or video
      </div>
    );
  if (media.type === "image")
    return <img className="media" src={media.url} alt={media.alt || ""} />;
  if (media.type === "video")
    return <video className="media" src={media.url} controls />;
  if (media.type === "youtube") {
    return (
      <iframe
        className="media"
        src={media.url}
        title={media.alt || "DCB video"}
        allowFullScreen
      />
    );
  }
  return null;
}

function GapDigest({ onClose }) {
  const gaps = readGaps().sort((a, b) => b.count - a.count);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Knowledge gaps"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="drawer__close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <h2 className="drawer__title">Knowledge gaps</h2>
        {gaps.length === 0 ? (
          <p>No gaps recorded in this browser yet.</p>
        ) : (
          <ul className="gaps">
            {gaps.map((g) => (
              <li key={g.topic}>
                <strong>{g.topic}</strong>
                <span>
                  Asked {g.count} time{g.count > 1 ? "s" : ""}, last{" "}
                  {new Date(g.last).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function InputBar({ value, onChange, onSubmit, placeholder }) {
  return (
    <form className="input" onSubmit={onSubmit}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Message the Lion"
      />
      <button type="submit" className="btn btn--small">
        Send
      </button>
    </form>
  );
}
