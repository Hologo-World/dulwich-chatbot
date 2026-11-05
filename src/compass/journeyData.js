// ─────────────────────────────────────────────────────────────
// Compass knowledge for the PoC.
// Every card below is paraphrased from a public page on
// beijing.dulwich.org (fetched November 2026), and every image is
// DCB's own photography from assets.dulwich.org. Each card links to
// the page it came from. Before showing this outside the PoC, have
// DCB confirm the wording and the image usage.
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

// Year groups from Toddler (DUCKS) to Year 13
export const YEARS = [
    { value: -2, label: 'Toddler' },
    { value: -1, label: 'Nursery' },
    { value: 0, label: 'Reception' },
    ...Array.from({ length: 13 }, (_, i) => ({ value: i + 1, label: `Year ${i + 1}` })),
]

// Parents give their child's age on 1 September of the year they'd join;
// Compass shows the usual year group for that age.
// ASSUMPTION TO CONFIRM WITH DCB: UK-style year groups (age 4 on
// 1 September = Reception, 5 = Year 1 ... 17 = Year 13, 2 = Toddler, 3 = Nursery).
// This matches DCB's own ranges (DUCKS ages 2 to 7, Junior School ages 7 to 11).
export const AGE_CUTOFF = '1 September'
export const AGES = Array.from({ length: 16 }, (_, i) => i + 2) // 2 to 17
export const ageToYear = (age) =>
    Number.isInteger(age) && age >= 2 && age <= 17 ? age - 4 : null

// ── Interests: areas first, then the specifics inside each area ──
// Only specifics that DCB's verified pages mention are offered as chips.
// specific: true means a card only "covers" it if the card lists it in
// `covers`; if no card does, Compass says it isn't verified yet (and logs a
// gap) instead of implying DCB offers it.
export const INTEREST_AREAS = [
    {
        id: 'cat-sport',
        label: 'Sport',
        tags: ['sport'],
        prompt: 'Which sports especially?',
        children: [
            { id: 'swimming', label: 'Swimming', tags: ['swimming', 'sport'], specific: true },
            { id: 'football', label: 'Football', tags: ['football', 'sport'], specific: true },
            { id: 'tennis', label: 'Tennis', tags: ['tennis', 'sport'], specific: true },
            { id: 'rugby', label: 'Rugby', tags: ['rugby', 'sport'], specific: true },
            { id: 'badminton', label: 'Badminton', tags: ['badminton', 'sport'], specific: true },
        ],
    },
    {
        id: 'cat-arts',
        label: 'Arts',
        tags: ['creativity'],
        prompt: 'Which kinds of art?',
        children: [
            { id: 'art', label: 'Visual art', tags: ['art', 'creativity'] },
            { id: 'music', label: 'Music', tags: ['music', 'creativity'] },
            { id: 'drama', label: 'Drama', tags: ['drama', 'creativity'] },
            { id: 'film', label: 'Film and media', tags: ['film', 'art', 'creativity'] },
        ],
    },
    {
        id: 'cat-computing',
        label: 'Computing and technology',
        tags: ['stem', 'coding'],
        prompt: 'Anything in particular?',
        children: [
            { id: 'coding', label: 'Coding', tags: ['coding', 'stem'] },
            { id: 'robotics', label: 'Robotics', tags: ['robotics', 'coding', 'stem'], specific: true },
            { id: 'game-design', label: 'Game design', tags: ['games', 'coding', 'stem'], specific: true },
        ],
    },
    {
        id: 'cat-academics',
        label: 'Academics',
        tags: ['academics', 'learning'],
        prompt: 'Which subjects light them up?',
        children: [
            { id: 'maths', label: 'Maths', tags: ['maths', 'academics', 'learning'], specific: true },
            { id: 'writing', label: 'Reading and writing', tags: ['writing', 'academics', 'learning'], specific: true },
            { id: 'debate', label: 'Debate and public speaking', tags: ['debate', 'academics', 'confidence'], specific: true },
        ],
    },
    { id: 'cat-languages', label: 'Languages', tags: ['languages', 'mandarin'], children: [] },
    { id: 'outdoors', label: 'Outdoors and trips', tags: ['outdoors', 'beyond'], children: [] },
    { id: 'cat-community', label: 'Community and service', tags: ['community', 'belonging'], children: [] },
    { id: 'cat-pathways', label: 'Future pathways', tags: ['pathways'], children: [] },
]

// Recognised when typed, but not offered as a chip: nothing verified yet
const UNOFFERED = [
    { id: 'volleyball', label: 'Volleyball', tags: ['volleyball', 'sport'], specific: true, parent: 'cat-sport' },
]

export const OPTIONS = {
    // Flat list of every interest (areas and specifics) for matching and storage
    interests: [
        ...INTEREST_AREAS.flatMap((a) => [
            { id: a.id, label: a.label, tags: a.tags, area: true },
            ...a.children.map((c) => ({ ...c, parent: a.id })),
        ]),
        ...UNOFFERED,
    ],
    explore: [], // replaced by INTEREST_AREAS
    languages: [
        { id: 'english', label: 'English', tags: ['english', 'languages'] },
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

const ASSETS = 'https://assets.dulwich.org/dulwich'
const img = (path, alt) => ({ type: 'image', url: `${ASSETS}/${path}`, alt })

const PAGES = {
    sports: ['Physical Education (Sports)', '/learning/holistic-education/sports'],
    arts: ['Visual and Performing Arts', '/learning/holistic-education/visual-performing-arts'],
    mandarin: ['Mandarin at Dulwich College Beijing', '/learning/holistic-education/mandarin'],
    stem: ['STEM / SE21', '/learning/holistic-education/stem-se21'],
    junior: ['Junior School', '/learning/core-curriculum/junior-school'],
    senior: ['Senior School', '/learning/core-curriculum/senior-school'],
    beyond: ['Learning Beyond the Classroom', '/learning/learning-beyond-the-classroom'],
    cca: ['Co-Curricular Activities', '/learning/holistic-education/co-curricular-activities'],
    leadership: ['Student Leadership', '/learning/holistic-education/student-leadership'],
    wellbeing: ['Wellbeing at DCB', '/community/life-at-dulwich/wellbeing'],
    ucc: ['University and Careers Counselling', '/learning/core-curriculum/university-and-careers-counselling'],
}
const page = (key) => ({ label: PAGES[key][0], url: DCB_BASE_URL + PAGES[key][1] })

const card = (fields) => ({
    years: null,
    covers: [],
    voice: null,
    document: null,
    verified: true,
    ...fields,
})

const JUNIOR = [3, 4, 5, 6] // Junior School: ages 7 to 11
const SENIOR = [7, 8, 9, 10, 11, 12, 13] // Senior School: Years 7 to 13

export const EVIDENCE = [
    // ── Right now ──────────────────────────────
    card({
        id: 'now-sport',
        stage: 'now',
        tags: ['sport', 'volleyball', 'football', 'swimming', 'tennis', 'rugby', 'badminton'],
        covers: ['football', 'swimming', 'tennis', 'rugby', 'badminton'],
        title: 'Sport and PE',
        summary: 'A progressive PE pathway, with sports from swimming to rugby.',
        detail:
            'PE at DCB is built as a four-tier progressive pathway. Students on campus play sports including swimming, football, tennis, rugby and badminton.\n\nThe College also takes part in the Dulwich Olympiad, a sports event shared across the Dulwich family of schools.',
        media: img('blocks/junior-school-and-senior-school-sports-20191220-150737-931.jpg', 'Students playing tennis, swimming and football at DCB'),
        source: page('sports'),
    }),
    card({
        id: 'now-art',
        stage: 'now',
        tags: ['art', 'creativity'],
        title: 'Visual art',
        summary: 'Dedicated art rooms and specialist art teachers in every school.',
        detail:
            'DUCKS, Junior School and Senior School each have their own art rooms, art teachers and assistant art teachers, and student work is displayed all around campus. Students work with a wide range of materials, both on their own and together.\n\nArt also reaches beyond the classroom: DCB’s Art in Hospital project was shortlisted for the 2019 International School Award for Community Initiative.',
        media: img('blocks/dcb-js-art.jpg', 'Junior School art at DCB'),
        source: page('arts'),
    }),
    card({
        id: 'now-music',
        stage: 'now',
        tags: ['music', 'creativity'],
        title: 'Music',
        summary: 'Specialist music teachers, practice rooms and two theatres.',
        detail:
            'There are dedicated music teachers in DUCKS, Junior School and Senior School. In lessons, students try different instruments and learn composition.\n\nThe facilities include large music rooms for classes and rehearsals, sound-insulated practice rooms for individuals and small groups, and two theatres for rehearsals and performances.',
        media: img('blocks/dcb-music-art.jpg', 'Students making music at DCB'),
        source: page('arts'),
    }),
    card({
        id: 'now-drama',
        stage: 'now',
        tags: ['drama', 'creativity', 'confidence'],
        title: 'Drama and musicals',
        summary: 'Year-group productions, two black box theatres and a spring musical.',
        detail:
            'Year levels in DUCKS and Junior School put on stage productions, and Senior School stages theatrical plays. Two black box theatres are used for lessons, workshops and rehearsals.\n\nEach spring there is an auditioned musical, alternating between Junior School and Senior School. Recent productions include Seussical Jr, Annie Jr and Romeo and Juliet.',
        media: img('blocks/15958/p/image/romeo-20230221-143911-721.jpg', 'A DCB theatre production'),
        source: page('arts'),
    }),
    card({
        id: 'now-mandarin',
        stage: 'now',
        tags: ['mandarin', 'languages'],
        years: JUNIOR,
        title: 'Mandarin at their level',
        summary: 'Classes from first characters to advanced literacy for native speakers.',
        detail:
            'Junior School students learn Mandarin in classes matched to their level, from their first Chinese characters through to advanced literacy for native speakers.\n\nThe language is used in real settings too: weekly Chinese co-curricular activities, creative projects and Chinese New Year celebrations. Competitions in writing, recitation, picture books and calligraphy give students a chance to show what they can do.',
        media: img('blocks/175040/p/image/chinese-1.jpg', 'Chinese culture activities at DCB'),
        source: page('junior'),
    }),
    card({
        id: 'now-coding',
        stage: 'now',
        tags: ['coding', 'stem', 'robotics', 'games'],
        covers: ['coding', 'robotics', 'game-design'],
        title: 'Coding and computing',
        summary: 'Robotics, game development and computing competitions.',
        detail:
            'Past co-curricular activities include robotics and computer game development. Junior School students also take part in computing events such as BEBRAS, Game Jam and City Hack.\n\nIn Years 10 and 11, Senior School adds bespoke STEM, FutureTech and Creative Media courses designed by DCB’s own educators.',
        media: img('pages/bBrBBFeGHKtsk7OaxtIczadiK17macNSe4k1nRoK.jpeg', 'STEAM learning at DCB'),
        source: page('cca'),
    }),

    // ── Joining and settling in ────────────────
    card({
        id: 'joining-junior',
        stage: 'joining',
        tags: ['belonging', 'wellbeing', 'english'],
        years: JUNIOR,
        title: 'Settling into Junior School',
        summary: 'Houses, friendships and English support for children who need it.',
        detail:
            'The House system gives new children a sense of belonging as they settle in, make friends and take part in House events. Initiatives like Mindful Mornings, and an active parent community, add to that support.\n\nChildren who are new to English are supported by experienced EAL (English as an Additional Language) specialists, so they can build confidence and join in alongside their peers.',
        voice: {
            quote: 'Every child is known, supported and stretched to reach their full potential.',
            who: 'Aidan Stallwood, Head of Junior School',
        },
        media: img('pages/dsc-1273.jpg', 'Junior School students at DCB'),
        source: page('junior'),
    }),
    card({
        id: 'joining-senior',
        stage: 'joining',
        tags: ['belonging', 'wellbeing'],
        years: SENIOR,
        title: 'Settling into Senior School',
        summary: 'Pastoral teams focused on every student feeling they belong.',
        detail:
            'Senior School pastoral teams work so that every student feels a genuine sense of belonging. Students get personalised support from experienced educators, pastoral leaders and university counsellors.\n\nAround the Senior School there are spaces where students can meet, work together or relax between classes.',
        voice: {
            quote: 'We celebrate every student as they make the most of all that DCB offers.',
            who: 'Clare Anderson-Au, Head of Senior School',
        },
        media: img('pages/dcb-2-20260807-102026-313.jpg', 'Senior School students at DCB'),
        source: page('senior'),
    }),

    // ── Developing interests ───────────────────
    card({
        id: 'interests-cca',
        stage: 'interests',
        tags: ['sport', 'art', 'music', 'drama', 'coding', 'robotics', 'debate', 'creativity', 'learning', 'community'],
        covers: ['coding', 'robotics', 'game-design', 'debate'],
        title: 'Over 150 co-curricular activities',
        summary: 'Many student-led, from debating and robotics to orchestra.',
        detail:
            'Each year there are more than 150 co-curricular activities, many of them organised by students. They span academic, creative, debate and public speaking, performing arts, service and action categories.\n\nPast examples include robotics, Model United Nations, debating, entrepreneurship, orchestra, band and choir. Dulwich College Programmes add sports and cultural courses during the week, at weekends and in school breaks.',
        media: img('blocks/139869/p/image/cca-arts.jpg', 'Students in an arts co-curricular activity'),
        source: page('cca'),
    }),
    card({
        id: 'interests-film',
        stage: 'interests',
        tags: ['film', 'art', 'drama', 'creativity', 'coding'],
        title: 'Film and creative media',
        summary: 'A film curriculum, a green screen studio and professional kit.',
        detail:
            'DCB has a dedicated film curriculum, a green screen studio and professional equipment. Students work in teams the way professionals do, making everything from original fiction to public service announcements and films of school trips and events.',
        media: img('blocks/dcb-film-art.jpg', 'Students filming at DCB'),
        source: page('arts'),
    }),
    card({
        id: 'interests-languages',
        stage: 'interests',
        tags: ['mandarin', 'languages', 'english'],
        title: 'Languages across the College',
        summary: 'English as the shared language, and Mandarin as a bridge.',
        detail:
            'English is the shared language of the DCB community, with EAL specialists supporting students who need it. Mandarin is taught as more than an academic subject: DCB describes it as a bridge connecting students to the wider world.',
        media: img('blocks/175054/p/image/chinese-2.jpg', 'Chinese language learning at DCB'),
        source: page('mandarin'),
    }),
    card({
        id: 'interests-competitions',
        stage: 'interests',
        tags: ['learning', 'academics', 'maths', 'writing', 'debate', 'coding', 'stem', 'music', 'art'],
        covers: ['maths', 'writing', 'debate'],
        title: 'Competitions and network events',
        summary: 'From Kangaroo Maths to Planet Hack and the WorldWise Festival of Music.',
        detail:
            'Students can test themselves in competitions such as Kangaroo Maths, the Hong Kong Young Writers Competition and Model United Nations.\n\nAs part of the Education in Motion family of schools, they can also join network-wide events including Planet Hack, Game Jam, the WorldWise Festival of Music and MADD (Music, Art, Drama and Dance).',
        media: img('blocks/160532/p/image/learning-beyond-the-classroom-2.jpg', 'Students at a DCB event beyond the classroom'),
        source: page('beyond'),
    }),

    // ── Beyond the classroom ───────────────────
    card({
        id: 'beyond-trips',
        stage: 'beyond',
        tags: ['beyond', 'outdoors', 'independence'],
        covers: ['outdoors'],
        title: 'Trips and residentials',
        summary: 'Local and international trips, and a residential for every year group.',
        detail:
            'From DUCKS to Senior School, students go on local and international trips, some to deepen academic learning and some to support social and emotional growth. Each year group has residential trips designed to take students out of their comfort zones.\n\nIn Year 9, students can choose to spend a term abroad on the Ignite: Switzerland programme.',
        media: img('blocks/161681/p/image/learning-beyond-the-classroom-3.jpg', 'DCB students on trips and at the Student Leadership Conference'),
        source: page('beyond'),
    }),
    card({
        id: 'beyond-service',
        stage: 'beyond',
        tags: ['community', 'belonging', 'leadership', 'confidence'],
        title: 'Service and global citizenship',
        summary: 'Interact, environmental projects and student-led social impact.',
        detail:
            'Interact is DCB’s largest community service organisation. Students have also worked on environmental sustainability, animal welfare and projects with migrant schools.\n\nIn Junior School, Global Citizenship Leaders plan and run activities for the school community. Older students can launch social impact projects through the award-winning Worldwise Academy.',
        media: img('pages/weixin-image-20240401145451-copy.jpg', 'Sustainability and global citizenship at DCB'),
        source: page('cca'),
    }),

    // ── Growing through school ─────────────────
    card({
        id: 'growing-leadership',
        stage: 'growing',
        tags: ['leadership', 'confidence'],
        title: 'Student leadership',
        summary: 'Over 170 leadership roles in Junior School and around 400 in Senior School.',
        detail:
            'More than 170 Junior School students hold leadership roles, from the Student Council, House Leaders and Class Prefects to the Dulwich Dudes podcast and DCB Buzz magazine. Senior School has around 400 leadership roles, with students leading assemblies, planning events and shaping school life.\n\nEvery student leader has a staff mentor, and Senior School Prefects help train Junior School Prefects.',
        media: img('blocks/141961/p/image/dsc-4606.jpg', 'DCB students'),
        source: page('senior'),
    }),
    card({
        id: 'growing-performing',
        stage: 'growing',
        tags: ['confidence', 'music', 'drama', 'creativity'],
        years: JUNIOR,
        title: 'Confidence on stage',
        summary: 'Concerts, recitals and Young Musician of the Year.',
        detail:
            'Junior School students learn instruments in the curriculum, from recorder and ukulele in the lower years to band and orchestral instruments later on, with drama in Year 6.\n\nThere are many chances to perform: the Christmas Concert, the Sounds of Spring Concert, Founder’s Day, Key Stage 2 Recitals and Young Musician of the Year.',
        media: img('blocks/dfm.jpg', 'A DCB music performance'),
        source: page('junior'),
    }),
    card({
        id: 'growing-wellbeing',
        stage: 'growing',
        tags: ['wellbeing', 'belonging', 'independence'],
        title: 'Wellbeing, for students and parents',
        summary: 'A student wellbeing framework, Parent Academies and Mindful Mornings.',
        detail:
            'DCB works to a student wellbeing framework, supported by the House system. For parents, educators run Parent Academies on understanding and supporting their children, and parents are invited to activities such as Junior School Mindful Mornings.\n\nThe community also has access to Tooled Up Education, an online library of evidence-based parenting resources.',
        media: img('pages/lx-8254.jpg', 'Wellbeing at DCB'),
        source: page('wellbeing'),
    }),
    card({
        id: 'growing-ownership',
        stage: 'growing',
        tags: ['independence', 'creativity', 'learning', 'leadership'],
        title: 'Taking ownership of learning',
        summary: 'Student voice and choice in how they learn.',
        detail:
            'DCB’s approach to learning beyond the classroom is about student agency. Through activities, leadership and projects, students develop social, organisational, creative, technical and speaking skills, and learn to take ownership of their own learning.',
        media: img('pages/jzg11501.jpg', 'Learning beyond the classroom at DCB'),
        source: page('beyond'),
    }),

    // ── Looking ahead ──────────────────────────
    card({
        id: 'ahead-sport',
        stage: 'ahead',
        tags: ['sport', 'volleyball', 'football', 'swimming', 'tennis', 'rugby', 'badminton'],
        title: 'Competitive sport',
        summary: 'Sports teams and competitions through ACAMIS and FOBISIA.',
        detail:
            'Competitive sports are part of the co-curricular programme. DCB is a member of school associations including ACAMIS and FOBISIA (the Federation of British International Schools in Asia), which, with the Dulwich family of schools, open up opportunities in sport, academics, the arts and global citizenship.',
        media: img('blocks/139870/p/image/cca-sports.jpg', 'DCB students playing sport'),
        source: page('cca'),
    }),
    card({
        id: 'ahead-pathways',
        stage: 'ahead',
        tags: ['pathways', 'academics', 'learning'],
        years: [...JUNIOR, ...SENIOR],
        title: 'IGCSE, then IB Diploma or A Levels',
        summary: 'Two world-class pathways in the final years of Senior School.',
        detail:
            'In Years 10 and 11, students take the IGCSE programme, with the option of DCB’s own STEM, FutureTech and Creative Media courses. In Years 12 and 13 they choose between the IB Diploma Programme and A Levels.\n\nAlongside their studies, programmes such as Creativity, Activity, Service (CAS) and after-school activities keep life balanced.',
        media: img('blocks/179043/p/image/dsc-1732.jpg', 'A Senior School science class'),
        source: page('senior'),
    }),
    card({
        id: 'ahead-ucc',
        stage: 'ahead',
        tags: ['pathways', 'independence', 'academics'],
        title: 'University and careers counselling',
        summary: 'Starting in Year 7, with a focus on each student’s best fit.',
        detail:
            'University and careers counselling begins in Year 7, with age-appropriate topics until graduation. Students get personal guidance from counsellors, who share best practice across the Education in Motion schools; Oxbridge preparation runs with other EiM schools and Dulwich College London.\n\nThe aim is the university or path that best fits each student’s interests and goals, whatever the rankings say.',
        media: img('pages/jooo7547-copy.jpg', 'University and careers counselling at DCB'),
        source: page('ucc'),
    }),
]