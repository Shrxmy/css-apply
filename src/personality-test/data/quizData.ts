import { Question, CommitteeName } from "../types/quiz";

// All your constants (COMMITTEES, questions, committeeFitReasons, etc.) go here.

export const COMMITTEES: CommitteeName[] = [
  "Academics",
  "Community Development",
  "Creatives & Technical",
  "Documentation",
  "External Affairs",
  "Finance",
  "Logistics",
  "Publicity",
  "Sports & Talent",
  "Technology Development",
];

export const questions: Question[] = [
  {
    id: 1,
    text: "I often find myself thinking about color schemes, fonts, and layouts for posters or social media posts to create a visual material.",
    dominant: "Creatives & Technical",
    average: ["Publicity", "Documentation"],
    less: ["Technology Development"],
  },
  {
    id: 2,
    text: "My friends would describe me as the 'planner' of the group, organizing the schedule, venue, and physical needs for a trip or get-together.",
    dominant: "Logistics",
    average: ["External Affairs"],
    less: ["Sports & Talent"],
  },
  {
    id: 3,
    text: "I'm fascinated by new technologies and how they can be used to improve how an organization operates.",
    dominant: "Technology Development",
    average: ["Academics"],
    less: ["Logistics"],
  },
  {
    id: 4,
    text: "I get a sense of satisfaction from a perfectly balanced budget and ensuring every transaction is transparently recorded.",
    dominant: "Finance",
    average: ["Logistics"],
    less: ["Academics"],
  },
  {
    id: 5,
    text: "I love the energy of a live performance, a big game, or any event with a large, enthusiastic audience.",
    dominant: ["Sports & Talent", "Documentation"],
    average: ["Publicity", "Creatives & Technical"],
    less: ["Community Development"],
  },
  {
    id: 6,
    text: "I'm the person who takes out their phone to capture the perfect group photo or a memorable moment at an event.",
    dominant: "Documentation",
    average: ["Publicity", "Sports & Talent"],
    less: ["Creatives & Technical"],
  },
  {
    id: 7,
    text: "I enjoy mentoring and guiding other people to help them grow into future leaders.",
    dominant: "Academics",
    average: ["Community Development"],
    less: ["External Affairs", "Sports & Talent"],
  },
  {
    id: 8,
    text: "When I use a well-designed website or app, my first thought is about how it was built and the logic behind it.",
    dominant: "Technology Development",
    average: ["Creatives & Technical"],
    less: ["Academics"],
  },
  {
    id: 9,
    text: "I'm careful about keeping track of things and making sure they’re returned in good condition.",
    dominant: "Logistics",
    average: ["Finance"],
    less: ["Creatives & Technical"],
  },
  {
    id: 10,
    text: "I am competitive and enjoy activities that involve strategy, teamwork, and a clear winner.",
    dominant: ["Community Development", "Sports & Talent"],
    average: ["Academics"],
    less: ["Logistics"],
  },
  {
    id: 11,
    text: "The idea of building a complete visual identity for a project logo, colors, and theme from scratch is appealing to me.",
    dominant: "Creatives & Technical",
    average: ["External Affairs"],
    less: ["Finance"],
  },
  {
    id: 12,
    text: "I'm comfortable starting conversations with new people, especially if it's to represent my group or organization.",
    dominant: "External Affairs",
    average: ["Publicity"],
    less: ["Community Development"],
  },
  {
    id: 13,
    text: "I am drawn to learning about academic subjects in-depth, even if they aren't directly related to my required courses.",
    dominant: "Academics",
    average: ["Technology Development"],
    less: ["Community Development"],
  },
  {
    id: 14,
    text: "I love being behind the scenes like coordinating people and keeping the event running smoothly.",
    dominant: "Logistics",
    average: ["Community Development"],
    less: ["Documentation"],
  },
  {
    id: 15,
    text: "I believe providing outlets for expression like sports, music, or art is essential for a balanced community.",
    dominant: "Sports & Talent",
    average: [
      "External Affairs",
      "Creatives & Technical",
      "Documentation",
      "Publicity",
    ],
    less: ["Finance"],
  },
  {
    id: 16,
    text: "When a message needs to be shared, I focus on finding the exact right words for caption or announcement to make it engaging.",
    dominant: ["Publicity", "External Affairs"],
    average: ["Documentation"],
    less: [],
  },
  {
    id: 17,
    text: "I am most motivated when my work directly contributes to the well-being and growth of our community members.",
    dominant: "Community Development",
    average: ["Sports & Talent"],
    less: ["External Affairs", "Academics"],
  },
  {
    id: 18,
    text: "I often think, ‘There has to be a smarter way to do this,’ and I enjoy building a tool or script to solve that inefficiency.",
    dominant: "Technology Development",
    average: ["Logistics"],
    less: ["Community Development"],
  },
  {
    id: 19,
    text: "I am comfortable with the responsibility of handling money and keeping precise records.",
    dominant: "Finance",
    average: ["Logistics"],
    less: ["External Affairs"],
  },
  {
    id: 20,
    text: "When I'm at an event, I notice the sound quality, the lighting, and how smoothly the technical aspects are running.",
    dominant: "Creatives & Technical",
    average: ["Logistics"],
    less: ["Technology Development"],
  },
  {
    id: 21,
    text: "I like making sure everything looks and sounds consistent so people recognize the brand.",
    dominant: ["Publicity", "Creatives & Technical"],
    average: ["External Affairs", "Technology Development"],
  },
  {
    id: 22,
    text: "I enjoy organizing events that bring people together and build bonds.",
    dominant: "Community Development",
    average: ["Sports & Talent", "Logistics", "Documentation"],
  },
  {
    id: 23,
    text: "I find it rewarding to explain a difficult concept to someone and help them finally understand it through a tutorial or study session.",
    dominant: "Academics",
    average: ["Community Development"],
    less: ["Technology Development", "Finance"],
  },
  {
    id: 24,
    text: "When I plan a hangout with friends, I first think about the budget and who to invite.",
    dominant: "External Affairs",
    average: ["Finance"],
    less: ["Logistics"],
  },
  {
    id: 25,
    text: "I enjoy helping organize training, workshops, or tournaments that develop people’s practical skills and passions.",
    dominant: "Sports & Talent",
    average: ["Community Development"],
    less: ["Technology Development"],
  },
  {
    id: 26,
    text: "When I see a great graphic design or a beautiful poster, I get inspired to create something artistic myself.",
    dominant: "Creatives & Technical",
    average: ["Documentation"],
    less: ["Publicity"],
  },
  {
    id: 27,
    text: "Before planning a project, I think it's critical to first gather feedback from members to understand what they truly need.",
    dominant: "Community Development",
    average: ["Academics"],
    less: ["Documentation"],
  },
  {
    id: 28,
    text: "The idea of a competitive hackathon or a programming contest excites me.",
    dominant: "Technology Development",
    average: ["Academics"],
    less: ["Sports & Talent"],
  },
  {
    id: 29,
    text: "I'm good at finding and sourcing the physical materials or supplies needed for a project, ensuring we have everything on time.",
    dominant: "Logistics",
    average: ["Finance", "External Affairs"],
    less: ["Technology Development"],
  },
  {
    id: 30,
    text: "When it comes to fundraising, I tend to brainstorm ideas that are not just profitable but also fun and engaging for participants.",
    dominant: "Finance",
    average: ["Community Development", "Sports & Talent"],
  },
  {
    id: 31,
    text: "I believe a picture is worth a thousand words, and I enjoy telling a complete story through a series of photos or a video.",
    dominant: "Documentation",
    average: ["Creatives & Technical", "Publicity"],
  },
  {
    id: 32,
    text: "I am good at negotiating and formally representing a group's interests to an outside party, like a sponsor or another organization.",
    dominant: "External Affairs",
    average: ["Finance", "Publicity"],
    less: ["Logistics"],
  },
  {
    id: 33,
    text: "I’m the person my friends come to for help with their computer problems or tech-related questions.",
    dominant: "Technology Development",
    average: [],
    less: ["Logistics", "Academics"],
  },
  {
    id: 34,
    text: "I enjoy making a budget tracker to see where money comes from and where it goes.",
    dominant: "Finance",
    average: ["Logistics"],
    less: ["External Affairs", "Creatives & Technical"],
  },
  {
    id: 35,
    text: "After an event, I feel a responsibility to organize raw photos and edit videos into a polished final album or highlight reel.",
    dominant: "Documentation",
    average: ["Technology Development"],
    less: ["Logistics"],
  },
  {
    id: 36,
    text: "I enjoy looking for opportunities by writing proposals and connecting with companies",
    dominant: "External Affairs",
    average: ["Finance"],
    less: ["Publicity"],
  },
  {
    id: 37,
    text: "I enjoy researching a complex topic and summarizing it into an easy-to-understand presentation or article for others.",
    dominant: "Academics",
    average: ["Community Development"],
    less: ["Sports & Talent"],
  },
  {
    id: 38,
    text: "I enjoy organizing photos and records so we don’t lose our group’s memories",
    dominant: "Documentation",
    average: ["Logistics"],
    less: ["Community Development"],
  },
  {
    id: 39,
    text: "I enjoy analyzing social media engagement (likes, shares, comments) to understand what content performs best.",
    dominant: "Publicity",
    average: ["Finance", "Technology Development"],
    less: ["External Affairs", "Academics"],
  },
  {
    id: 40,
    text: "I enjoy planning posts to get the right attention at the right time.",
    dominant: "Publicity",
    average: ["Creatives & Technical", "External Affairs"],
    less: ["Finance"],
  },
];

export const committeeFitReasons: Record<CommitteeName, string> = {
  Academics:
    "Your results reveal a true passion for learning and an incredible talent for making tough ideas click for others. You are not just a student, you are a mentor, a guide, and an inspiration. You believe growth is the path to success, making you the perfect leader to run tutorials, spark curiosity, and empower your peers to reach their full potential.",
  "Community Development":
    "You are a natural connector and the heartbeat of every group you join. With your empathy and vision for togetherness, you thrive on creating spaces where everyone feels included and supported. You turn a group into a family, and your ability to bring people together makes you the ultimate community-builder.",
  "Creatives & Technical":
    "You have both the eye and the execution, the artist and the engineer in one. Whether you are designing a poster that wows or setting up an event that runs flawlessly, you thrive on making visions a reality. You are essential to shaping the identity of the organization, bringing color, style, and innovation to everything we do.",
  Documentation:
    "You know that moments fade, but memories live forever when captured beautifully. Your gift for photography, videography, and storytelling makes you the keeper of our history. You transform simple events into unforgettable stories that everyone can look back on with pride.",
  "External Affairs":
    "You are bold, confident, and charismatic, a natural ambassador. You shine in networking, building partnerships, and unlocking opportunities that elevate the entire organization. With you as the face of the group, we do not just make connections, we create lasting alliances.",
  Finance:
    "Numbers are your superpower. Your precision and sense of responsibility make you the perfect guardian of our resources. You see finance as more than balancing budgets, you see it as fueling dreams. Thanks to you, projects turn from ideas into reality, powered by your careful planning and oversight.",
  Logistics:
    "You are the ultimate problem-solver who thrives on planning and execution. To you, details are not tedious, they are exciting challenges waiting to be mastered. From materials to schedules, you make sure every moving part fits together seamlessly. You are the reason everything works.",
  Publicity:
    "You are a storyteller with impact. You know how to craft a message that not only informs but excites, inspires, and engages. You understand branding, buzz, and what makes people pay attention. You are the voice of the organization, and your words and strategies get the world talking.",
  "Sports & Talent":
    "Energy, passion, and teamwork drive you forward. You believe in the power of friendly competition, creativity, and performance to build unity and joy. You turn events into celebrations of talent, giving every member a chance to shine.",
  "Technology Development":
    "You are the innovator, the builder, and the forward-thinker. You do not just use technology, you explore it, improve it, and create with it. Your vision pushes the organization to grow smarter and more efficient, shaping the future with every tool you build.",
};

export const committeeDescriptions: Record<CommitteeName, string[]> = {
  Academics: [
    "Organizes academic tutorials and review sessions for members.",
    "Hosts engaging events like quiz bees and programming contests.",
    "Focuses on enhancing the overall academic environment and growth.",
  ],
  "Community Development": [
    "Plans social projects that foster civic engagement and empowerment.",
    "Organizes events designed to build bonds and improve member well-being.",
    "Acts as the heart of the organization, ensuring a supportive community.",
  ],
  "Creatives & Technical": [
    "Oversees all creative design, from digital graphics to event decor.",
    "Manages technical needs like sound, lighting, and streaming for events.",
    "Shapes the visual and auditory identity of the organization.",
  ],
  Documentation: [
    "Captures all organizational activities through photojournalism and videography.",
    "Preserves memorable moments by creating highlight reels and photo albums.",
    "Tells the story of the organization through compelling visual media.",
  ],
  "External Affairs": [
    "Manages relationships with sponsors, media, and other organizations.",
    "Handles partnerships, public relations, and formal representation.",
    "Seeks out new opportunities and collaborations for the organization.",
  ],
  Finance: [
    "Oversees the organization's budget, expenditures, and revenue streams.",
    "Ensures fiscal responsibility and transparency through meticulous records.",
    "Manages fundraising initiatives to power organizational projects.",
  ],
  Logistics: [
    "Manages and maintains all physical properties and assets of the organization.",
    "Coordinates the physical needs for events, including venues and materials.",
    "Keeps a thorough record of expenses related to activities and assets.",
  ],
  Publicity: [
    "Manages all social media platforms and promotional activities.",
    "Develops marketing strategies to publicize events to target audiences.",
    "Crafts the public voice and brand of the organization.",
  ],
  "Sports & Talent": [
    "Organizes sports tournaments, workshops, and talent shows.",
    "Provides outlets for members to develop and showcase their skills.",
    "Promotes a balanced, active, and expressive community.",
  ],
  "Technology Development": [
    "Spearheads tech projects like the organization's website and internal tools.",
    "Implements new technology to streamline organizational operations.",
    "Organizes tech-focused workshops and training for members.",
  ],
};

export const committeeImagePaths: Record<CommitteeName, string> = {
  Academics:
    "/assets/css-apply-static-images/assets/committee_test/CSAR_ACADEMICS.webp",
  "Community Development":
    "/assets/css-apply-static-images/assets/committee_test/CSAR_COMMDEV.webp",
  "Creatives & Technical":
    "/assets/css-apply-static-images/assets/committee_test/CSAR_CREATIVES.webp",
  Documentation:
    "/assets/css-apply-static-images/assets/committee_test/CSAR_DOCU.webp",
  "External Affairs":
    "/assets/css-apply-static-images/assets/committee_test/CSAR_EXTERNALS.webp",
  Finance:
    "/assets/css-apply-static-images/assets/committee_test/CSAR_FINANCE.webp",
  Logistics:
    "/assets/css-apply-static-images/assets/committee_test/CSAR_LOGISTICS.webp",
  Publicity:
    "/assets/css-apply-static-images/assets/committee_test/CSAR_PUBLICITY.webp",
  "Sports & Talent":
    "/assets/css-apply-static-images/assets/committee_test/CSAR_SPOTA.webp",
  "Technology Development":
    "/assets/css-apply-static-images/assets/committee_test/CSAR_TECHDEV.webp",
};

export const OPTIONS = [
  { value: 5 },
  { value: 4 },
  { value: 3 },
  { value: 2 },
  { value: 1 },
];

export const SCORE_MAP = {
  5: { dominant: 5, average: 3, less: 1 },
  4: { dominant: 3, average: 1.5, less: 0 },
  3: { dominant: 1, average: 0, less: 0 },
  2: { dominant: -1, average: 0, less: 0 },
  1: { dominant: -2, average: -1, less: 0 },
};

export const QUESTIONS_PER_PAGE = 7;
export const TOTAL_PAGES = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
