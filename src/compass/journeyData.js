// ─────────────────────────────────────────────────────────────
// Compass knowledge: EVERY item here must come from verified DCB
// content before it is shown to a parent. Items marked
// verified: false show a "Draft" badge so nobody demos invented facts.
// ─────────────────────────────────────────────────────────────

export const DCB_BASE_URL = 'https://beijing.dulwich.org'
export const ADMISSIONS_URL = `${DCB_BASE_URL}/admissions/admissions-overview`
export const VISIT_URL = `${DCB_BASE_URL}/admissions/visit/visit-us`

export const STAGES = [
    { id: 'now', title: 'Right now', needsMatch: true },
    { id: 'joining', title: 'Joining and settling in', needsMatch: false },
    { id: 'interests', title: 'Developing interests', needsMatch: true },
    { id: 'beyond', title: 'Beyond the classroom', needsMatch: false },
    { id: 'growing', title: 'Growing through school', needsMatch: true },
    { id: 'ahead', title: 'Looking ahead', needsMatch: false },
]

// Replace with DCB's own year-group names if different
export const YEARS = [
    { value: 0, label: 'Reception' },
    ...Array.from({ length: 13 }, (_, i) => ({ value: i + 1, label: `Year ${i + 1}` })),
]

export const OPTIONS = {
    interests: [
        { id: 'volleyball', label: 'Volleyball', tags: ['volleyball', 'sport'] },
        { id: 'football', label: 'Football', tags: ['football', 'sport'] },
        { id: 'swimming', label: 'Swimming', tags: ['swimming', 'sport'] },
        { id: 'art', label: 'Art', tags: ['art', 'creativity'] },
        { id: 'music', label: 'Music', tags: ['music', 'creativity'] },
        { id: 'drama', label: 'Drama', tags: ['drama', 'creativity'] },
        { id: 'coding', label: 'Coding', tags: ['coding', 'stem'] },
        { id: 'outdoors', label: 'Outdoors', tags: ['outdoors', 'beyond'] },
    ],
    // Fallback when the parent isn't sure where to start
    explore: [
        { id: 'x-learning', label: 'Learning', tags: ['learning', 'academics'] },
        { id: 'x-sport', label: 'Sport', tags: ['sport'] },
        { id: 'x-creativity', label: 'Creativity', tags: ['creativity'] },
        { id: 'x-languages', label: 'Languages', tags: ['languages', 'mandarin'] },
        { id: 'x-beyond', label: 'Beyond the classroom', tags: ['beyond', 'outdoors'] },
        { id: 'x-community', label: 'Community and belonging', tags: ['community', 'belonging'] },
        { id: 'x-future', label: 'Future pathways', tags: ['pathways'] },
    ],
    languages: [
        { id: 'english', label: 'English', tags: ['english'] },
        { id: 'mandarin', label: 'Mandarin', tags: ['mandarin', 'languages'] },
        { id: 'other-language', label: 'Another language', tags: ['languages'] },
    ],
    priorities: [
        { id: 'confidence', label: 'Confidence', tags: ['confidence'] },
        { id: 'independence', label: 'Independence', tags: ['independence'] },
        { id: 'leadership', label: 'Leadership', tags: ['leadership'] },
        { id: 'grow-creativity', label: 'Creativity', tags: ['creativity'] },
        { id: 'wellbeing', label: 'Wellbeing', tags: ['wellbeing', 'belonging'] },
    ],
}

// Verified DCB pages (from the agent's verified link list)
const PAGES = {
    sports: { label: 'Physical Education (Sports)', path: '/learning/holistic-education/sports' },
    arts: { label: 'Visual and Performing Arts', path: '/learning/holistic-education/visual-performing-arts' },
    mandarin: { label: 'Mandarin at Dulwich College Beijing', path: '/learning/holistic-education/mandarin' },
    stem: { label: 'STEM / SE21', path: '/learning/holistic-education/stem-se21' },
    junior: { label: 'Junior School', path: '/learning/core-curriculum/junior-school' },
    senior: { label: 'Senior School', path: '/learning/core-curriculum/senior-school' },
    beyond: { label: 'Learning Beyond the Classroom', path: '/learning/learning-beyond-the-classroom' },
    community: { label: 'Dulwich Community Programmes', path: '/learning/holistic-education/co-curricular-activities/dulwich-community-programmes' },
    leadership: { label: 'Student Leadership', path: '/learning/holistic-education/student-leadership' },
    wellbeing: { label: 'Wellbeing at DCB', path: '/community/life-at-dulwich/wellbeing' },
    ibdp: { label: 'International Baccalaureate Diploma Programme', path: '/learning/core-curriculum/international-baccalaureate-diploma-programme' },
}
const page = (key) => ({ label: PAGES[key].label, url: DCB_BASE_URL + PAGES[key].path })

// Helper for draft items. Replace `detail` with verified DCB text and
// add media / voice / document, then set verified: true.
const draft = (id, stage, tags, title, todo, pageKey, extra = {}) => ({
    id,
    stage,
    tags,
    title,
    detail: `To add from verified DCB material: ${todo}`,
    years: null, // e.g. [7, 8, 9] to limit to certain year groups
    media: null, // { type: 'image' | 'video' | 'youtube', url, alt }
    voice: null, // { quote, who }  (approved stakeholder voice)
    document: null, // { label, url }
    source: page(pageKey),
    verified: false,
    ...extra,
})

export const EVIDENCE = [
    draft('now-volleyball', 'now', ['volleyball', 'sport'], 'Volleyball',
        'team or CCA name, year groups, when it runs and how to join.', 'sports'),
    draft('now-art', 'now', ['art', 'creativity'], 'Visual art',
        'a current art opportunity, exhibition or CCA for this age group.', 'arts'),
    draft('now-music', 'now', ['music', 'creativity'], 'Music',
        'ensembles, instrumental lessons or choirs open to this age group.', 'arts'),
    draft('now-mandarin', 'now', ['mandarin', 'languages'], 'Mandarin',
        'how Mandarin is taught at this entry point, including any native-speaker pathway.', 'mandarin'),

    draft('joining-primary', 'joining', ['belonging'], 'Settling into Junior School',
        'transition and buddy programmes for new Junior School families.', 'junior',
        { years: [0, 1, 2, 3, 4, 5, 6] }),
    draft('joining-senior', 'joining', ['belonging'], 'Settling into Senior School',
        'induction, tutor groups and House system for new Senior School students.', 'senior',
        { years: [7, 8, 9, 10, 11, 12, 13] }),

    draft('interests-sport', 'interests', ['sport', 'volleyball', 'football', 'swimming'],
        'Sport and competition', 'the sports programme, fixtures and leagues DCB takes part in.', 'sports'),
    draft('interests-arts', 'interests', ['art', 'music', 'drama', 'creativity'],
        'Performing and visual arts', 'productions, concerts and art opportunities through the year.', 'arts'),
    draft('interests-stem', 'interests', ['coding', 'stem', 'learning', 'academics'],
        'Science, technology and learning', 'STEM, coding or robotics programmes and curriculum highlights.', 'stem'),
    draft('interests-languages', 'interests', ['mandarin', 'languages', 'english'],
        'Languages across the school', 'language programmes and support available.', 'mandarin'),

    draft('beyond-trips', 'beyond', ['beyond', 'outdoors', 'independence'],
        'Trips and outdoor learning', 'residential trips, Field Studies or outdoor education for this age.', 'beyond'),
    draft('beyond-service', 'beyond', ['community', 'leadership', 'belonging'],
        'Service and community', 'service learning or community projects students take part in.', 'community'),

    draft('growing-confidence', 'growing', ['confidence', 'leadership', 'drama'],
        'Building confidence', 'student leadership roles, public speaking or performance opportunities.', 'leadership'),
    draft('growing-independence', 'growing', ['independence', 'wellbeing', 'creativity'],
        'Growing independence and wellbeing', 'pastoral programmes and opportunities to take ownership.', 'wellbeing'),

    draft('ahead-volleyball', 'ahead', ['volleyball', 'sport'], 'Volleyball in later years',
        'senior teams, competitions or tournaments, if verified.', 'sports'),
    draft('ahead-pathways', 'ahead', ['pathways', 'academics', 'learning'], 'Senior School pathways',
        'IGCSE / IB pathways and guidance. Describe options only; never predict outcomes.', 'ibdp'),
]