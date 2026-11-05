import { useEffect, useMemo, useRef, useState } from "react";
import {
  ADMISSIONS_URL,
  EVIDENCE,
  OPTIONS,
  STAGES,
  VISIT_URL,
  YEARS,
  AGES,
  AGE_CUTOFF,
  ageToYear,
  INTEREST_AREAS,
} from "./journeyData";
import { onAkemaEvent } from "./akemaBridge";
import { LionAnswerCard, useLion, useLionAnswer } from "../lion/Lion";
import { logGap, readGaps } from "./gaps";
import "./Compass.css";
import "./Journey.css";

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

const EMPTY = {
  age: null,
  year: null,
  interests: [],
  languages: [],
  priorities: [],
};
const NOT_ANSWERED = { interests: false, languages: false, priorities: false };

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

// What the parent shared that connects to this item.
// A "specific" interest (e.g. Volleyball) only counts if the card covers it.
function sharedOptions(item, ctx) {
  return GROUPS.flatMap((g) => ctx[g])
    .map(findOption)
    .filter((o) => o && o.tags.some((t) => item.tags.includes(t)));
}
// Specific interests that at least one verified card covers
const COVERED = new Set(EVIDENCE.flatMap((e) => e.covers || []));

function matchedLabels(item, ctx) {
  return sharedOptions(item, ctx)
    .filter((o) => !o.specific || item.covers?.includes(o.id))
    .map((o) => o.label);
}
// Specific interests this card touches on that no verified card covers
// (e.g. Volleyball): shown as "not verified yet" and logged as a gap
function uncoveredLabels(item, ctx) {
  return sharedOptions(item, ctx)
    .filter((o) => o.specific && !COVERED.has(o.id))
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
  playground: "outdoors",
  outdoor: "outdoors",
  trips: "outdoors",
  art: "art",
  film: "film",
  debate: "debate",
  "public speaking": "debate",
  university: "cat-pathways",
  career: "cat-pathways",
  community: "cat-community",
  camping: "outdoors",
  sport: "cat-sport",
  athletic: "cat-sport",
  arts: "cat-arts",
  creative: "cat-arts",
  computer: "cat-computing",
  computing: "cat-computing",
  technology: "cat-computing",
  tech: "cat-computing",
  academic: "cat-academics",
  studies: "cat-academics",
  maths: "maths",
  math: "maths",
  numbers: "maths",
  reading: "writing",
  read: "writing",
  books: "writing",
  stories: "writing",
  debating: "debate",
  mun: "debate",
  robot: "robotics",
  games: "game-design",
  gaming: "game-design",
  filming: "film",
  video: "film",
  volunteering: "cat-community",
  service: "cat-community",
};

function findMentions(text) {
  const lower = text.toLowerCase();
  const ids = new Set();
  ALL_OPTIONS.filter((o) => !o.explore).forEach((o) => {
    if (lower.includes(o.label.toLowerCase())) ids.add(o.id);
  });
  Object.entries(SYNONYMS).forEach(([word, id]) => {
    // whole words, plus simple endings: read, reads, reading; robot, robots
    if (new RegExp(`\\b${word}(?:s|es|ing|ed|er)?\\b`).test(lower)) ids.add(id);
  });
  return ids;
}

// Phrases that mean "take this out". The captured word is what gets removed.
const REMOVE_PATTERNS = [
  /\bthan\s+(?:the\s+|a\s+)?([a-z]+)/g, // "music matters (more) than swimming"
  /\binstead\s+of\s+(?:the\s+)?([a-z]+)/g, // "music instead of art"
  /\b(?:replace|swap)\s+(?:the\s+)?([a-z]+)/g, // "replace art with music"
  /\b(?:remove|drop|without|skip|forget|less)\s+(?:the\s+|any\s+)?([a-z]+)/g, // "drop art"
  /\b(?:not|no\s+longer)\s+(?:into\s+|interested\s+in\s+)?([a-z]+)/g, // "not into art"
  /\b([a-z]+)\s+(?:is\s+)?(?:less\s+important|doesn['’]?t\s+matter|does\s+not\s+matter)/g, // "art doesn't matter"
];

function parseInput(text) {
  const lower = text.toLowerCase();

  // "8 year old", "8-year-old", "8 yrs old", "aged 8", "age 8"
  let age = null;
  const am =
    lower.match(/\b(\d{1,2})\s*-?\s*(?:years?|yrs?)\s*-?\s*old\b/) ||
    lower.match(/\bage[sd]?\s+(\d{1,2})\b/);
  if (am && ageToYear(Number(am[1])) != null) age = Number(am[1]);

  let year = null;
  const ym = lower.match(/\byear\s*(\d{1,2})\b/);
  if (ym && Number(ym[1]) <= 13) year = Number(ym[1]);
  else if (/reception/.test(lower)) year = 0;
  else if (/nursery/.test(lower)) year = -1;
  else if (/toddler/.test(lower)) year = -2;
  else if (age != null) year = ageToYear(age);

  // Everything named in a "take this out" phrase is removed...
  const removeIds = new Set();
  REMOVE_PATTERNS.forEach((re) => {
    for (const m of lower.matchAll(re)) {
      findMentions(m[1]).forEach((id) => removeIds.add(id));
    }
  });

  // ...and never added back, even though it's mentioned in the sentence
  const addIds = [...findMentions(lower)].filter((id) => !removeIds.has(id));
  return { age, year, addIds, removeIds: [...removeIds] };
}

function applyParsed(ctx, p) {
  const next = { ...ctx };
  if (p.age != null) next.age = p.age;
  if (p.year != null) next.year = p.year;
  GROUPS.forEach((g) => {
    next[g] = ctx[g].filter((id) => !p.removeIds.includes(id));
  });
  p.addIds.forEach((id) => {
    const opt = findOption(id);
    const g = opt?.group;
    if (g && !next[g].includes(id)) next[g] = [...next[g], id];
    // A specific (e.g. Tennis) brings its area (Sport) with it
    if (opt?.parent && !next.interests.includes(opt.parent)) {
      next.interests = [...next.interests, opt.parent];
    }
  });
  return next;
}

// Questions go to the Lion; statements can change the journey
function isQuestionText(text) {
  return (
    /\?\s*$/.test(text) ||
    /^(what|how|when|where|who|why|which|can|could|does|do|is|are|will|would|tell me|show me)\b/i.test(
      text.trim(),
    )
  );
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

// Turns the parent's selections into a natural message for the Lion
// `who` names the child, so the Lion keeps each child's details apart
function describeContext(ctx, who = "My child") {
  const labels = (g) =>
    ctx[g].map((id) => findOption(id)?.label).filter(Boolean);
  const list = (arr) =>
    arr.length <= 1
      ? arr.join("")
      : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;

  const parts = [];
  if (ctx.year != null) {
    const age = ctx.age != null ? ` (age ${ctx.age} on ${AGE_CUTOFF})` : "";
    parts.push(`${who} would be joining ${yearLabel(ctx.year)}${age}.`);
  } else if (who !== "My child") {
    parts.push(`This is about ${who.replace(/^My child\s*/, "my child ")}.`);
  }
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

// Saved selections may refer to options that no longer exist: drop those
function sanitizeCtx(c) {
  if (!c) return EMPTY;
  const valid = (g) =>
    (Array.isArray(c[g]) ? c[g] : []).filter(
      (id) => findOption(id)?.group === g,
    );
  return {
    age: ageToYear(c.age) != null ? c.age : null,
    year: YEARS.some((y) => y.value === c.year) ? c.year : null,
    interests: valid("interests"),
    languages: valid("languages"),
    priorities: valid("priorities"),
  };
}

const WELCOME_BACK =
  "Welcome back. Here’s the journey you were exploring. Anything you’d like to change?";

// ── Adaptive discovery: information goals, not a script ─────
function nextGoal(ctx, answered) {
  if (ctx.year == null) return "age";
  if (!answered.interests) return "interests";
  if (!ctx.languages.length && !answered.languages) return "languages";
  if (!ctx.priorities.length && !answered.priorities) return "priorities";
  return "ready";
}

const PROMPTS = {
  age: `How old will they be on ${AGE_CUTOFF}, when they’d join?`,
  interests: "What do they happily spend hours doing?",
  languages: "Which languages does your child feel most comfortable using?",
  priorities: "Anything you’d especially love school to help them grow in?",
  ready: "That gives me plenty to start with. Let me show you something.",
};

const WELCOME =
  "Hello, I’m the DCB Lion. Tell me a little about your child and I’ll show you what their time at Dulwich College Beijing could include.";

// ── Component ───────────────────────────────────────────────
export default function Compass({
  child,
  label = "your child",
  familySize = 1,
  onSave,
  onRename,
}) {
  // Pick up where this child's journey left off (saved in this browser)
  const [saved] = useState(() => child?.data || null);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // How the Lion refers to this child, so each child's details stay separate
  const childName = child?.name?.trim() || "";
  const who = childName
    ? `My child ${childName}`
    : familySize > 1
      ? `My child (${label})`
      : "My child";
  const possessive = childName ? `${childName}’s` : "your child’s";
  const [ctx, setCtx] = useState(() => sanitizeCtx(saved?.ctx));
  const [answered, setAnswered] = useState(() => ({
    ...NOT_ANSWERED,
    ...(saved?.answered || {}),
  }));
  const [phase, setPhase] = useState(() =>
    saved?.phase === "journey" ? "journey" : "discovery",
  );
  const [lionNote, setLionNote] = useState(() =>
    saved?.phase === "journey" ? WELCOME_BACK : WELCOME,
  );
  const [exploreMode, setExploreMode] = useState(!!saved?.exploreMode);
  const [input, setInput] = useState("");
  const [openItem, setOpenItem] = useState(null); // journey stage entry
  const [editing, setEditing] = useState(false);
  const [updated, setUpdated] = useState(new Set());
  const [showGaps, setShowGaps] = useState(false);
  const prevJourney = useRef(null);
  const trackRef = useRef(null);
  const editorRef = useRef(null);
  const [editRequest, setEditRequest] = useState(0);

  // Open the interests editor and bring it into view
  const openEditor = () => {
    setEditing(true);
    setEditRequest((n) => n + 1);
  };
  const loggedGaps = useRef(new Set(saved?.loggedGaps || []));
  const events = useRef(saved?.events || []);
  const firstCtx = useRef(true);

  // A short history of what the family did, kept with the saved journey
  const record = (type, detail) => {
    events.current = [
      ...events.current,
      { at: new Date().toISOString(), type, detail },
    ].slice(-50);
  };

  // The Lion: answers appear on the page, the chat bubble stays closed
  const { askInSheet, setPageContext } = useLion();
  const [intro, runIntro, resetIntro] = useLionAnswer(saved?.intro);

  const journey = useMemo(() => buildJourney(ctx), [ctx]);
  const contextText = describeContext(ctx, who);
  const goal = nextGoal(ctx, answered);
  const canReveal = ctx.year != null && ctx.interests.length > 0;

  // Keep the latest journey available to the link handler
  const journeyRef = useRef(journey);
  useEffect(() => {
    journeyRef.current = journey;
  }, [journey]);

  // Questions asked from the Ask the Lion panel carry the family context
  useEffect(() => {
    // The Lion's memory of this child: sent with their next question and
    // shown in the chat. Uses whatever has been chosen so far, even before
    // the journey is revealed.
    const memory = [
      ctx.year != null
        ? `${yearLabel(ctx.year)}${ctx.age != null ? `, age ${ctx.age}` : ""}`
        : null,
      ...selectedLabels(ctx),
    ].filter(Boolean);
    setPageContext(contextText || null, childName || label, child?.id, memory);
  }, [contextText, childName, label, child?.id, ctx, setPageContext]);
  useEffect(() => () => setPageContext(null, null), [setPageContext]);

  // Scroll up to the editor whenever it's asked for
  useEffect(() => {
    if (!editRequest) return;
    const el = editorRef.current;
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.querySelector("select, button")?.focus({ preventScroll: true });
  }, [editRequest]);

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
    const context = { year: yearLabel(ctx.year), shared: selectedLabels(ctx) };
    const topics = [];
    journey.forEach((s) => {
      if (s.kind === "gap") topics.push(s.topic);
      if (s.kind === "item")
        uncoveredLabels(s.item, ctx).forEach((l) =>
          topics.push(`${l} at DCB (${s.stage.title})`),
        );
    });
    topics.forEach((t) => {
      if (loggedGaps.current.has(t)) return;
      loggedGaps.current.add(t);
      logGap(t, context);
    });
  }, [journey, phase, ctx]);

  // Record each change to the selections
  useEffect(() => {
    if (firstCtx.current) {
      firstCtx.current = false;
      return;
    }
    record("selections", {
      year: yearLabel(ctx.year) ?? null,
      shared: selectedLabels(ctx),
    });
  }, [ctx]);

  // Save everything to this browser whenever it changes
  useEffect(() => {
    onSaveRef.current?.({
      ctx,
      answered,
      phase,
      exploreMode,
      intro: intro.status === "done" ? intro : null,
      journey:
        phase === "journey"
          ? journey.map((s) => ({
              stage: s.stage.id,
              kind: s.kind,
              item: s.item?.id ?? null,
            }))
          : null,
      loggedGaps: [...loggedGaps.current],
      events: events.current,
    });
  }, [ctx, answered, phase, exploreMode, intro, journey]);

  // Messages typed in the full chat bubble can still remix the journey
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

  // What the parent says or types in the Lion chat (including voice calls)
  // updates this child's journey, e.g. "he loves to read" adds Reading.
  useEffect(() => {
    const onSaid = (e) => {
      const { text, childId } = e.detail || {};
      if (!text || (childId && child?.id && childId !== child.id)) return;
      if (isQuestionText(text)) return;
      const p = parseInput(text);
      if (p.year == null && p.addIds.length === 0 && p.removeIds.length === 0)
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
          : "Got it. I’ve added that to the journey.",
      );
    };
    window.addEventListener("compass:said", onSaid);
    return () => window.removeEventListener("compass:said", onSaid);
  }, [child?.id]);

  // DCB links in answers or the chat: open the matching journey card.
  // (Site.jsx sends a cancelable "compass:link" event; preventDefault = handled.)
  useEffect(() => {
    const norm = (u) =>
      String(u || "")
        .replace(/[#?].*$/, "")
        .replace(/\/+$/, "")
        .toLowerCase();
    const onLink = (e) => {
      const target = norm(e.detail);
      const inJourney = journeyRef.current.find(
        (s) => s.kind === "item" && norm(s.item.source.url) === target,
      );
      if (inJourney) {
        setOpenItem(inJourney);
        e.preventDefault();
        return;
      }
      const item = EVIDENCE.find((x) => norm(x.source.url) === target);
      if (item) {
        setOpenItem({
          kind: "item",
          item,
          stage: STAGES.find((s) => s.id === item.stage),
        });
        e.preventDefault();
      }
    };
    window.addEventListener("compass:link", onLink);
    return () => window.removeEventListener("compass:link", onLink);
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

  // Stay on the journey page when a drawer or the digest closes
  const clearHash = () => window.history.replaceState(null, "", "#/journey");

  // Clear the saved journey and begin again
  const startOver = () => {
    events.current = [];
    loggedGaps.current = new Set();
    prevJourney.current = null;
    setCtx(EMPTY);
    setAnswered(NOT_ANSWERED);
    setPhase("discovery");
    setExploreMode(false);
    setEditing(false);
    setOpenItem(null);
    resetIntro();
    setLionNote(WELCOME);
  };

  // Arrow buttons move the journey one card at a time
  const scrollTrack = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.querySelector(".stage")?.offsetWidth || 320;
    el.scrollBy({ left: dir * (cardWidth + 20), behavior: "smooth" });
  };

  // Ask the Lion in the side panel, with the family context
  const ask = (question) =>
    askInSheet(question, {
      context: contextText,
      source: `${possessive} journey`,
    });

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

  // Interests: an area and its specifics travel together
  const toggleInterest = (id) => {
    const opt = findOption(id);
    const adding = !ctx.interests.includes(id);
    setCtx((c) => {
      let list = c.interests;
      if (adding) {
        list = [...list, id];
        if (opt?.parent && !list.includes(opt.parent))
          list = [...list, opt.parent];
      } else {
        // removing an area also removes its specifics
        list = list.filter((x) => x !== id && findOption(x)?.parent !== id);
      }
      return { ...c, interests: list };
    });
    if (phase === "discovery" && adding) setLionNote(teaserFor(id));
    if (phase === "journey")
      setLionNote(
        adding
          ? "Got it. I’ve added that to your journey."
          : "Easy, let’s change that.",
      );
  };
  const toggleAny = (group, id) =>
    group === "interests" ? toggleInterest(id) : toggle(group, id);

  const chooseAge = (age) => {
    const year = ageToYear(age);
    setCtx((c) => ({ ...c, age, year }));
    if (phase === "journey") setLionNote(`Updated for ${yearLabel(year)}.`);
  };

  const markAnswered = (group) => setAnswered((a) => ({ ...a, [group]: true }));

  const reveal = () => {
    record("revealed", {
      year: yearLabel(ctx.year) ?? null,
      shared: selectedLabels(ctx),
    });
    setPhase("journey");
    setEditing(false);
    // The Lion's first verified insight appears right beside the journey
    runIntro("What could their journey at DCB include?", {
      context: contextText,
      source: `${possessive} journey`,
    });
    setLionNote(
      "Based on the interests you shared, here are some opportunities you could explore at DCB. Anything you’d like me to change?",
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");

    // Questions go to the Lion, even if they mention an interest
    if (isQuestionText(text)) {
      setLionNote(
        "Good question. My answer is in the panel beside your journey.",
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
      setLionNote("Let me look into that for you.");
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
          <h1 className="intro__title">Let’s build {possessive} journey</h1>
          <p className="lion-say">{lionNote}</p>

          <label className="child-name">
            <span>Who’s this journey for?</span>
            <input
              value={child?.name || ""}
              onChange={(e) => onRename?.(e.target.value)}
              placeholder="A first name or nickname (optional)"
              maxLength={30}
            />
          </label>

          {(ctx.year != null || selectedLabels(ctx).length > 0) && (
            <ContextBar
              ctx={ctx}
              onRemove={toggleAny}
              onEdit={() => setEditing((v) => !v)}
              editing={editing}
            />
          )}
          {editing && (
            <ContextEditor ctx={ctx} onToggle={toggleAny} onAge={chooseAge} />
          )}

          <div className="question">
            {exploreMode && goal === "interests" ? (
              <>
                <p className="question__text">
                  Pick anything that sounds interesting
                </p>
                <InterestPicker
                  selected={ctx.interests}
                  onToggle={toggleInterest}
                />
                <QuestionActions
                  primary={ctx.interests.length ? "That’s everything" : null}
                  onPrimary={() => markAnswered("interests")}
                />
              </>
            ) : (
              <>
                <p className="question__text">{PROMPTS[goal]}</p>
                {goal === "age" && (
                  <>
                    <div
                      className="chips age-chips"
                      role="group"
                      aria-label="Age"
                    >
                      {AGES.map((a) => (
                        <button
                          key={a}
                          type="button"
                          className="chip chip--age"
                          onClick={() => chooseAge(a)}
                        >
                          <strong>{a}</strong>
                          <small>{yearLabel(ageToYear(a))}</small>
                        </button>
                      ))}
                    </div>
                    <p className="age-note">
                      We’ll show the usual DCB year group for that age.
                      Admissions will confirm the right year for your family.
                    </p>
                  </>
                )}
                {goal === "interests" && (
                  <>
                    <p className="question__hint">
                      Pick any areas first, then tell me more if you like.
                    </p>
                    <InterestPicker
                      selected={ctx.interests}
                      onToggle={toggleInterest}
                    />
                    <QuestionActions
                      primary={
                        ctx.interests.length ? "That’s everything" : null
                      }
                      onPrimary={() => markAnswered("interests")}
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
              <div className="lion-dock__text">
                <p className="one-child-note">
                  Showing {possessive} journey.
                  {familySize > 1
                    ? " Each child has their own; switch at the top."
                    : " Exploring for more than one child? Add them at the top."}
                </p>
                <p className="lion-say lion-say--small">{lionNote}</p>
                <LionAnswerCard state={intro} />
              </div>
            </div>
            <ContextBar
              ctx={ctx}
              onRemove={toggleAny}
              onEdit={() => setEditing((v) => !v)}
              editing={editing}
            />
            {editing && (
              <div ref={editorRef} className="editor-anchor">
                <ContextEditor
                  ctx={ctx}
                  onToggle={toggleAny}
                  onAge={chooseAge}
                />
              </div>
            )}
          </header>

          <div className="track-wrap">
            <button
              type="button"
              className="track-nav track-nav--prev"
              aria-label="Previous stages"
              onClick={() => scrollTrack(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="track-nav track-nav--next"
              aria-label="Next stages"
              onClick={() => scrollTrack(1)}
            >
              ›
            </button>
            <ol className="track" ref={trackRef}>
              {journey.map((s, i) => (
                <li
                  key={s.stage.id}
                  id={`stage-${s.stage.id}`}
                  className={`stage${updated.has(s.stage.id) ? " stage--updated" : ""}`}
                >
                  <div className="stage__rail" aria-hidden="true">
                    <span className="stage__step">{i + 1}</span>
                    <span className="stage__line" />
                  </div>
                  <div className="stage__head">
                    <h2 className="stage__title">{s.stage.title}</h2>
                    {updated.has(s.stage.id) && (
                      <span className="stage__flag">Updated</span>
                    )}
                  </div>
                  <StageCard
                    entry={s}
                    ctx={ctx}
                    onOpen={() => setOpenItem(s)}
                    onInvite={openEditor}
                  />
                </li>
              ))}
            </ol>
          </div>

          <div className="quick" role="group" aria-label="Quick actions">
            <button type="button" className="chip" onClick={openEditor}>
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
            <button type="button" className="chip" onClick={startOver}>
              Start over
            </button>
          </div>

          <InputBar
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Ask a question, or change anything, e.g. “music matters more than art”"
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
          key={openItem.item?.id || openItem.topic || openItem.stage.id}
          entry={openItem}
          ctx={ctx}
          contextText={contextText}
          onClose={() => {
            setOpenItem(null);
            clearHash();
          }}
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
          {ctx.age != null ? `, age ${ctx.age}` : ""}
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

// Areas first; picking an area opens its specifics underneath
function InterestPicker({ selected, onToggle }) {
  const areas = INTEREST_AREAS.map((a) => ({ id: a.id, label: a.label }));
  const open = INTEREST_AREAS.filter(
    (a) => a.children.length && selected.includes(a.id),
  );
  return (
    <div className="interest-picker">
      <Chips options={areas} selected={selected} onToggle={onToggle} />
      {open.map((a) => (
        <div key={a.id} className="subpick">
          <p className="subpick__q">
            <span className="subpick__area">{a.label}</span> {a.prompt}
          </p>
          <Chips options={a.children} selected={selected} onToggle={onToggle} />
        </div>
      ))}
    </div>
  );
}

function ContextEditor({ ctx, onToggle, onAge }) {
  return (
    <div className="editor">
      <label className="editor__row">
        <span>Age on {AGE_CUTOFF}</span>
        <select
          value={ctx.age ?? ""}
          onChange={(e) => onAge(Number(e.target.value))}
        >
          <option value="" disabled>
            Choose an age
          </option>
          {AGES.map((a) => (
            <option key={a} value={a}>
              {a} ({yearLabel(ageToYear(a))})
            </option>
          ))}
        </select>
      </label>
      <p className="editor__label">Interests</p>
      <InterestPicker
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
      <button type="button" className="jcard jcard--invite" onClick={onInvite}>
        <span className="jcard__plus" aria-hidden="true">
          +
        </span>
        <p>
          Tell me what you’d love school to help them grow in, and I’ll add it
          here.
        </p>
        <span className="jcard__cta">Add a priority</span>
      </button>
    );
  }
  if (entry.kind === "gap") {
    return (
      <button type="button" className="jcard jcard--gap" onClick={onOpen}>
        <p className="jcard__gap-title">Not verified yet</p>
        <p>
          I don’t have verified DCB information for this part of the journey
          yet.
        </p>
        <span className="jcard__cta">See options</span>
      </button>
    );
  }
  const { item } = entry;
  const links = matchedLabels(item, ctx);
  const missing = uncoveredLabels(item, ctx);
  return (
    <button type="button" className="jcard" onClick={onOpen}>
      <div className="jcard__media">
        {item.media?.type === "image" ? (
          <img src={item.media.url} alt={item.media.alt || ""} loading="lazy" />
        ) : (
          <span className="jcard__media-empty" aria-hidden="true">
            🦁
          </span>
        )}
        {!item.verified && <span className="badge jcard__badge">Draft</span>}
      </div>
      <div className="jcard__body">
        <h3 className="jcard__title">{item.title}</h3>
        <p className="jcard__summary">{item.summary}</p>
        {links.length > 0 && (
          <ul className="jcard__tags" aria-label="Connected to what you shared">
            {links.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {missing.length > 0 && (
          <p className="jcard__note">
            {missing.join(", ")}: not in DCB’s verified information yet
          </p>
        )}
        <span className="jcard__foot">
          <span className="jcard__cta">Explore</span>
          <span className="jcard__source">{item.source.label}</span>
        </span>
      </div>
    </button>
  );
}

function Drawer({ entry, ctx, contextText, onClose }) {
  // The Lion answers right inside the drawer
  const [answer, runAnswer] = useLionAnswer();

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
        {isGap && <p className="drawer__stage">{entry.stage.title}</p>}

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
            <div className="drawer__hero">
              {item.media?.type === "image" ? (
                <img src={item.media.url} alt={item.media.alt || ""} />
              ) : (
                <Media media={item.media} />
              )}
            </div>
            <p className="drawer__stage">{entry.stage.title}</p>
            <h2 className="drawer__title">{item.title}</h2>
            {!item.verified && (
              <span className="badge">Draft, needs verified content</span>
            )}
            <p className="drawer__lead">{item.summary}</p>
            {String(item.detail || "")
              .split("\n\n")
              .map((para, i) => (
                <p key={i} className="drawer__detail">
                  {para}
                </p>
              ))}
            {matchedLabels(item, ctx).length > 0 && (
              <div className="drawer__why">
                <span>Why this is here</span>
                <ul className="jcard__tags">
                  {matchedLabels(item, ctx).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
            {uncoveredLabels(item, ctx).length > 0 && (
              <p className="jcard__note">
                {uncoveredLabels(item, ctx).join(", ")} isn’t in DCB’s verified
                information yet. I’ve noted it so the College can add it. You
                can ask the Lion, or contact the team.
              </p>
            )}
            {item.voice && (
              <blockquote className="voice">
                <p>“{item.voice.quote}”</p>
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
                disabled={answer.status === "pending"}
                onClick={() =>
                  runAnswer(`Tell me more about ${item.title} at DCB.`, {
                    context: contextText,
                    source: `the ${item.title} card`,
                  })
                }
              >
                Ask the Lion about this
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
            <LionAnswerCard state={answer} />
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
