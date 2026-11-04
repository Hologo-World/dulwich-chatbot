// ─────────────────────────────────────────────────────────────
// Demo site structure. Every page path below comes from the Lion's
// verified DCB link list. The site itself states no DCB facts: each
// section asks the Lion, which answers from verified knowledge.
// ─────────────────────────────────────────────────────────────

export const DCB_HOME = 'https://beijing.dulwich.org'

export const NAV = [
    {
        route: 'why-dulwich',
        label: 'Why Dulwich',
        intro: 'What shapes the College, from its values to its campus. Ask the Lion about anything here.',
    },
    {
        route: 'learning',
        label: 'Learning',
        intro: 'From the early years to the IB Diploma, and everything beyond the classroom.',
    },
    {
        route: 'admissions',
        label: 'Admissions',
        intro: 'How to apply, who can apply, and how to come and see the College for yourself.',
    },
    {
        route: 'community',
        label: 'Community',
        intro: 'Wellbeing, families, students and alumni.',
    },
]

// id becomes the anchor: #/learning/sports
export const SECTIONS = [
    // Why Dulwich
    { route: 'why-dulwich', id: 'dulwich-difference', title: 'The Dulwich Difference', path: '/why-dulwich/our-college/dulwich-difference', question: 'What makes the Dulwich approach different?' },
    { route: 'why-dulwich', id: 'vision-values', title: 'Vision and values', path: '/why-dulwich/our-college/vision-and-values', question: 'What are the College’s vision and values?' },
    { route: 'why-dulwich', id: 'facilities', title: 'Environment and facilities', path: '/why-dulwich/our-college/facilities', question: 'What is the school environment like?' },
    { route: 'why-dulwich', id: 'air-quality', title: 'Air quality', path: '/why-dulwich/our-college/air-quality-management', question: 'How does DCB manage air quality?' },
    { route: 'why-dulwich', id: 'academic-results', title: 'IGCSE and IB results', path: '/why-dulwich/our-college/academic-results', question: 'What are DCB’s recent IGCSE and IB Diploma results?' },
    { route: 'why-dulwich', id: 'university', title: 'University matriculation', path: '/why-dulwich/our-college/university-matriculation', question: 'Where have DCB graduates gone on to study?' },
    { route: 'why-dulwich', id: 'safeguarding', title: 'Safeguarding', path: '/why-dulwich/our-college/safeguarding', question: 'How does DCB keep students safe?' },

    // Learning
    { route: 'learning', id: 'ducks', title: 'DUCKS (early years)', path: '/learning/core-curriculum/ducks', question: 'What is DUCKS and who is it for?' },
    { route: 'learning', id: 'junior', title: 'Junior School', path: '/learning/core-curriculum/junior-school', question: 'What is learning like in the Junior School?' },
    { route: 'learning', id: 'senior', title: 'Senior School', path: '/learning/core-curriculum/senior-school', question: 'What is learning like in the Senior School?' },
    { route: 'learning', id: 'ibdp', title: 'IB Diploma Programme', path: '/learning/core-curriculum/international-baccalaureate-diploma-programme', question: 'How does the IB Diploma Programme work at DCB?' },
    { route: 'learning', id: 'sports', title: 'Sport', path: '/learning/holistic-education/sports', question: 'What sport can students do at DCB?' },
    { route: 'learning', id: 'arts', title: 'Visual and performing arts', path: '/learning/holistic-education/visual-performing-arts', question: 'What arts, music and drama opportunities are there?' },
    { route: 'learning', id: 'mandarin', title: 'Mandarin', path: '/learning/holistic-education/mandarin', question: 'How is Mandarin taught at DCB?' },
    { route: 'learning', id: 'stem', title: 'STEM', path: '/learning/holistic-education/stem-se21', question: 'What STEM opportunities are there?' },
    { route: 'learning', id: 'leadership', title: 'Student leadership', path: '/learning/holistic-education/student-leadership', question: 'How can students take on leadership roles?' },
    { route: 'learning', id: 'cca', title: 'Co-curricular activities', path: '/learning/holistic-education/co-curricular-activities', question: 'What co-curricular activities are available?' },
    { route: 'learning', id: 'beyond', title: 'Learning beyond the classroom', path: '/learning/learning-beyond-the-classroom', question: 'What trips and learning beyond the classroom are there?' },
    { route: 'learning', id: 'careers', title: 'University and careers counselling', path: '/learning/core-curriculum/university-and-careers-counselling', question: 'How does DCB support university and career choices?' },

    // Admissions
    { route: 'admissions', id: 'overview', title: 'Admissions overview', path: '/admissions/admissions-overview', question: 'How do admissions work at DCB?' },
    { route: 'admissions', id: 'how-to-apply', title: 'How to apply', path: '/admissions/apply/how-to-apply', question: 'What are the steps to apply?' },
    { route: 'admissions', id: 'eligibility', title: 'Eligibility', path: '/admissions/apply/eligibility', question: 'Who is eligible to apply to DCB?' },
    { route: 'admissions', id: 'fees', title: 'Fees', path: '/admissions/apply/fees', question: 'What fees are involved in applying?' },
    { route: 'admissions', id: 'faq', title: 'Frequently asked questions', path: '/admissions/apply/frequently-asked-questions', question: 'What do families most often ask about admissions?' },
    { route: 'admissions', id: 'visit', title: 'Visit us', path: '/admissions/visit/visit-us', question: 'How can we visit the campus?' },
    { route: 'admissions', id: 'enquire', title: 'Enquire', path: '/admissions/enquire', question: 'How do we get in touch with Admissions?' },

    // Community
    { route: 'community', id: 'wellbeing', title: 'Wellbeing', path: '/community/life-at-dulwich/wellbeing', question: 'How does DCB support student wellbeing?' },
    { route: 'community', id: 'student-stories', title: 'Student stories', path: '/community/our-members/student-stories', question: 'What do DCB students say about their experience?' },
    { route: 'community', id: 'parents', title: 'Meet our parents', path: '/community/our-members/meet-our-parents', question: 'How are parents involved in school life?' },
    { route: 'community', id: 'friends', title: 'Friends of Dulwich', path: '/community/our-members/friends-of-dulwich', question: 'What is Friends of Dulwich?' },
    { route: 'community', id: 'calendar', title: 'School calendar', path: '/community/life-at-dulwich/school-calendar', question: 'What does the school year look like?' },
    { route: 'community', id: 'alumni', title: 'Alumni', path: '/community/our-members/alumni', question: 'How does DCB stay connected with alumni?' },
]

export const HOME_QUESTIONS = [
    'What makes DCB different?',
    'How is Mandarin taught?',
    'What are the steps to apply?',
    'How does DCB manage air quality?',
]

const norm = (u) => String(u).replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase()

// Finds the demo-site section for a DCB web address (used for links in answers)
export function findSectionByUrl(url) {
    const target = norm(url)
    return SECTIONS.find((s) => norm(DCB_HOME + s.path) === target) || null
}