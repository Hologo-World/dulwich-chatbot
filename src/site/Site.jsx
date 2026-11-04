import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Compass from "../compass/Compass";
import { loadAkemaWidget, onAkemaLinkClick } from "../compass/akemaBridge";
import {
  LionAnswerCard,
  LionProvider,
  useLion,
  useLionAnswer,
} from "../lion/Lion";
import {
  DCB_HOME,
  HOME_QUESTIONS,
  NAV,
  SECTIONS,
  findSectionByUrl,
} from "./siteData";
import { STAGES } from "../compass/journeyData";
import { hasSavedJourney } from "../compass/storage";
import "./Site.css";

// Opens the journey from anywhere on the site
const JourneyContext = createContext({ open: () => {}, close: () => {} });
const useJourney = () => useContext(JourneyContext);

// Pages live in the hash: #/learning, #/learning/sports.
// The journey opens on top of the current page: #/journey
// (#card-<id> and #gaps are Compass deep links, so they open it too).
function parseHash() {
  const h = window.location.hash.slice(1);
  if (h === "/journey" || h.startsWith("card-") || h === "gaps") {
    return { journey: true };
  }
  const [, route = "", anchor = null] = h.split("/");
  return { route: route || "home", anchor, journey: false };
}

function initialLocation() {
  const p = parseHash();
  return p.journey ? { route: "home", anchor: null, journey: true } : p;
}

export default function Site() {
  const [loc, setLoc] = useState(initialLocation);
  const [journeyMounted, setJourneyMounted] = useState(loc.journey);
  const journeyOpenRef = useRef(loc.journey);
  const returnHash = useRef("#/");

  useEffect(() => {
    journeyOpenRef.current = loc.journey;
    if (loc.journey) setJourneyMounted(true); // keep it mounted to keep its state
  }, [loc.journey]);

  // Opening the journey keeps the page behind it where it was
  useEffect(() => {
    const onHash = () =>
      setLoc((prev) => {
        const p = parseHash();
        return p.journey ? { ...prev, journey: true } : p;
      });
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openJourney = useCallback(() => {
    if (journeyOpenRef.current) return;
    returnHash.current = window.location.hash || "#/";
    window.location.hash = "#/journey";
  }, []);

  const closeJourney = useCallback(() => {
    const back = returnHash.current;
    window.location.hash = back && back !== "#/journey" ? back : "#/";
  }, []);

  // The chat bubble is available on every page but never opens by itself
  useEffect(() => {
    loadAkemaWidget();
  }, []);

  // No page scrolling behind the open journey
  useEffect(() => {
    document.body.style.overflow = loc.journey ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [loc.journey]);

  // Scroll to the section named in the address, and highlight it
  useEffect(() => {
    if (!loc.anchor) {
      window.scrollTo(0, 0);
      return;
    }
    const el = document.getElementById(`sec-${loc.anchor}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("section-card--focus");
    const t = setTimeout(
      () => el.classList.remove("section-card--focus"),
      2200,
    );
    return () => clearTimeout(t);
  }, [loc.route, loc.anchor]);

  // A DCB link in an answer or in the chat: stay on this site.
  // 1. With the journey open, Compass opens a matching card if it has one.
  // 2. Otherwise go to the matching section of this site.
  // 3. No match: let the link open the real DCB page in a new tab.
  const handleLink = useCallback((url) => {
    if (journeyOpenRef.current) {
      const notHandled = window.dispatchEvent(
        new CustomEvent("compass:link", { detail: url, cancelable: true }),
      );
      if (!notHandled) return true;
    }
    const section = findSectionByUrl(url);
    if (!section) return false;
    window.location.hash = `#/${section.route}/${section.id}`;
    return true;
  }, []);

  useEffect(() => onAkemaLinkClick(handleLink), [handleLink]);

  const page =
    loc.route === "home" ? <Home /> : <SectionPage route={loc.route} />;

  return (
    <LionProvider onLink={handleLink}>
      <JourneyContext.Provider
        value={{ open: openJourney, close: closeJourney }}
      >
        <div className="site">
          <Header route={loc.route} />
          <main className="site__main" aria-hidden={loc.journey || undefined}>
            {page}
          </main>
          <Footer />
          {journeyMounted && <JourneyOverlay open={loc.journey} />}
        </div>
      </JourneyContext.Provider>
    </LionProvider>
  );
}

function Header({ route }) {
  const { openSheet } = useLion();
  return (
    <header className="site-header">
      <a className="brand" href="#/">
        <span className="brand__mark" aria-hidden="true">
          D
        </span>
        <span className="brand__text">
          Dulwich College Beijing
          <small>Compass preview</small>
        </span>
      </a>
      <nav className="site-nav" aria-label="Main">
        {NAV.map((n) => (
          <a
            key={n.route}
            href={`#/${n.route}`}
            className={route === n.route ? "is-active" : undefined}
            aria-current={route === n.route ? "page" : undefined}
          >
            {n.label}
          </a>
        ))}
      </nav>
      <button type="button" className="ask-pill" onClick={openSheet}>
        <span aria-hidden="true">🦁</span> Ask the Lion
      </button>
    </header>
  );
}

// The journey as a full-screen experience on top of the site
function JourneyOverlay({ open }) {
  const { close } = useJourney();
  const { openSheet } = useLion();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // Let an open card drawer or the Lion panel close first
      if (document.querySelector(".drawer-backdrop, .lion-sheet--open")) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={`journey-overlay${open ? " journey-overlay--open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Your child’s journey"
      aria-hidden={!open}
    >
      <div className="journey-overlay__bar">
        <span className="journey-overlay__mark" aria-hidden="true">
          🦁
        </span>
        <p className="journey-overlay__title">Your child’s journey</p>
        <button type="button" className="ask-pill" onClick={openSheet}>
          <span aria-hidden="true">🦁</span> Ask the Lion
        </button>
        <button
          type="button"
          className="journey-overlay__close"
          aria-label="Close the journey"
          onClick={close}
        >
          ×
        </button>
      </div>
      <div className="journey-overlay__body">
        <Compass />
      </div>
    </div>
  );
}

function Home() {
  const [answer, run] = useLionAnswer();
  const [question, setQuestion] = useState("");
  const journey = useJourney();

  const submit = (e) => {
    e.preventDefault();
    const q = question.trim();
    if (q) run(q);
  };

  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__main">
            <h1>What could school at DCB look like for your child?</h1>
            <p className="hero__lede">
              Ask the Lion anything about the College, or let it build an
              illustrative journey from what matters to your family.
            </p>

            <form className="ask-box" onSubmit={submit}>
              <span className="ask-box__icon" aria-hidden="true">
                🦁
              </span>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask the Lion about DCB"
                aria-label="Ask the Lion about DCB"
              />
              <button
                type="submit"
                className="ask-box__go"
                disabled={answer.status === "pending"}
              >
                Ask
              </button>
            </form>

            <div className="hero__chips">
              {HOME_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="suggest"
                  onClick={() => {
                    setQuestion(q);
                    run(q);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            <LionAnswerCard state={answer} />
          </div>

          <aside className="journey-teaser" aria-label="Your child’s journey">
            <h2>Your child’s journey</h2>
            <p>
              Tell the Lion a little about your child and see six stages of
              school life at DCB, built from verified College information.
            </p>
            <ol className="journey-teaser__stages">
              {STAGES.map((s, i) => (
                <li key={s.id}>
                  <span className="journey-teaser__num">{i + 1}</span>
                  {s.title}
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="journey-teaser__cta"
              onClick={journey.open}
            >
              {hasSavedJourney()
                ? "Continue your child’s journey"
                : "Build your child’s journey"}
            </button>
          </aside>
        </div>
      </section>

      <section className="areas" aria-labelledby="areas-title">
        <h2 id="areas-title" className="areas__title">
          Explore the College
        </h2>
        <div className="areas__grid">
          {NAV.map((n) => (
            <a key={n.route} className="area-card" href={`#/${n.route}`}>
              <h3>{n.label}</h3>
              <p>{n.intro}</p>
              <span className="area-card__count">
                {SECTIONS.filter((s) => s.route === n.route).length} topics to
                explore
              </span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

function SectionPage({ route }) {
  const nav = NAV.find((n) => n.route === route);
  if (!nav) {
    return (
      <section className="page-band">
        <div className="page-band__inner">
          <h1>This page isn’t part of the preview</h1>
          <a href="#/">Back to the home page</a>
        </div>
      </section>
    );
  }
  return (
    <>
      <section className="page-band">
        <div className="page-band__inner">
          <p className="page-band__trail">
            <a href="#/">Home</a> / {nav.label}
          </p>
          <h1>{nav.label}</h1>
          <p className="page-band__intro">{nav.intro}</p>
        </div>
      </section>
      <div className="section-grid">
        {SECTIONS.filter((s) => s.route === route).map((s) => (
          <SectionCard key={s.id} section={s} />
        ))}
      </div>
    </>
  );
}

// A topic card: the title and the Lion. Tap the Lion to get its answer here.
function SectionCard({ section }) {
  const [answer, run] = useLionAnswer();
  const pending = answer.status === "pending";
  return (
    <article id={`sec-${section.id}`} className="section-card">
      <div className="section-card__head">
        <h2 className="section-card__title">{section.title}</h2>
        <button
          type="button"
          className={`lion-btn${pending ? " lion-btn--busy" : ""}`}
          onClick={() => run(section.question)}
          disabled={pending}
          aria-label={`Ask the Lion about ${section.title}`}
          title="Ask the Lion"
        >
          <span aria-hidden="true">🦁</span>
        </button>
      </div>
      <LionAnswerCard state={answer} />
      <a
        className="section-card__source"
        href={DCB_HOME + section.path}
        target="_blank"
        rel="noreferrer"
      >
        Full page on the DCB website
      </a>
    </article>
  );
}

function Footer() {
  const journey = useJourney();
  return (
    <footer className="site-footer">
      <p>
        Compass by Hologo, proof of concept. The Lion answers only from DCB’s
        verified information.
      </p>
      <button
        type="button"
        className="site-footer__journey"
        onClick={journey.open}
      >
        Build your child’s journey
      </button>
    </footer>
  );
}
