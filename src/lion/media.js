// ─────────────────────────────────────────────────────────────
// Media the Lion can show inside the chat, instead of sending
// parents away to other pages or social platforms.
//   • DCB photos, matched to the DCB pages an answer links to
//   • DCB's virtual campus tour, for questions about the campus
//   • DCB's short videos, once DCB supplies them (see VIDEOS)
// Every item is DCB's own material; confirm usage with DCB marketing.
// ─────────────────────────────────────────────────────────────
import { EVIDENCE } from "../compass/journeyData";

const DCB = "https://beijing.dulwich.org";
const ASSETS = "https://assets.dulwich.org/dulwich";
const norm = (u) =>
    String(u).replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();

// From DCB's "Take a look at DCB with our new Virtual Tour!" page
export const VIRTUAL_TOUR = {
    kind: "tour",
    title: "DCB virtual campus tour",
    url: "https://virtualtour.dulwich.org/beijing",
    page: `${DCB}/dulwich-life/virtual-tour`,
    thumb: `${ASSETS}/blocks/92224/p/image/virtual-tour1.jpg`,
    images: [
        { url: `${ASSETS}/blocks/92224/p/image/virtual-tour1.jpg`, alt: "DCB virtual tour" },
        { url: `${ASSETS}/blocks/92226/p/image/virtual-tour2-20230202-082927-403.jpg`, alt: "DCB virtual tour" },
        { url: `${ASSETS}/blocks/92228/p/image/virtual-tour3.jpg`, alt: "DCB virtual tour" },
    ],
};

// DCB's short-form videos, tagged by topic. Add them as DCB supplies them:
//   type: "youtube" (an embed URL), "vimeo" (an embed URL) or "mp4" (a file URL)
//   page: the DCB page it belongs to; keywords: words that should bring it up
export const VIDEOS = [
    // {
    //   title: "Swimming at DCB",
    //   type: "mp4",
    //   url: "https://…/swimming.mp4",
    //   poster: "https://assets.dulwich.org/…/poster.jpg",
    //   page: `${DCB}/learning/holistic-education/sports`,
    //   keywords: ["swim"],
    // },
];

// Photos by DCB page, taken from the verified journey cards
const PAGE_IMAGES = new Map();
function addImage(pageUrl, image) {
    const key = norm(pageUrl);
    if (!PAGE_IMAGES.has(key)) PAGE_IMAGES.set(key, []);
    const list = PAGE_IMAGES.get(key);
    if (!list.some((i) => i.url === image.url)) list.push(image);
}
EVIDENCE.forEach((e) => {
    if (e.media?.type === "image") {
        addImage(e.source.url, {
            kind: "image",
            url: e.media.url,
            alt: e.media.alt || e.title,
            title: e.title,
            page: e.source.url,
        });
    }
});
// The tour's photos also illustrate the facilities and visit pages
[`${DCB}/why-dulwich/our-college/facilities`, `${DCB}/admissions/visit/visit-us`, VIRTUAL_TOUR.page].forEach(
    (p) =>
        VIRTUAL_TOUR.images.forEach((i) =>
            addImage(p, { ...i, kind: "image", title: "Around the campus", page: VIRTUAL_TOUR.page }),
        ),
);

const TOUR_PAGES = new Set(
    [
        `${DCB}/why-dulwich/our-college/facilities`,
        `${DCB}/admissions/visit/visit-us`,
        VIRTUAL_TOUR.page,
    ].map(norm),
);

// Questions or answers about the campus bring up the tour
const TOUR_WORDS =
    /\b(campus|facilit\w*|tour|outdoor\w*|playground\w*|grounds|spaces|librar\w*|pool|theatres?|sports? (?:domes?|hall)|visit\w*)\b/i;

// The media to show under one answer
export function mediaFor({ question = "", answer = "" }) {
    const links = [...String(answer).matchAll(/https?:\/\/beijing\.dulwich\.org[^\s)\]>]*/gi)].map(
        (m) => m[0],
    );
    const linked = new Set(links.map(norm));

    const images = [];
    linked.forEach((l) =>
        (PAGE_IMAGES.get(l) || []).forEach((i) => {
            if (!images.some((x) => x.url === i.url)) images.push(i);
        }),
    );

    const text = `${question} ${answer}`.toLowerCase();
    const videos = VIDEOS.filter(
        (v) =>
            (v.page && linked.has(norm(v.page))) ||
            (v.keywords || []).some((k) => text.includes(k.toLowerCase())),
    ).map((v) => ({ kind: "video", ...v }));

    const tour =
        TOUR_WORDS.test(text) || [...linked].some((l) => TOUR_PAGES.has(l)) ? VIRTUAL_TOUR : null;

    return { images: images.slice(0, 4), videos: videos.slice(0, 2), tour };
}