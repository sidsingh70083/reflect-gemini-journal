export interface PromptCategoryGroup {
  id: string;
  name: string;
  emoji: string;
  description: string;
  prompts: string[];
  key?: string;
  label?: string;
}

export const STARTER_PROMPTS_BY_THEME: PromptCategoryGroup[] = [
  {
    id: 'deep-introspection',
    name: 'Deep Introspection',
    emoji: '🌊',
    description: 'Unspoken truths, outgrown patterns, and quiet feelings',
    prompts: [
      "What is a quiet grief or disappointment I haven't yet given myself permission to name?",
      "What belief about who I am am I beginning to outgrow?",
      "What am I secretly pretending not to know right now?",
      "What part of me is feeling tired, and what is it asking for?",
      "If my heart could speak one unedited sentence today, what would it say?",
      "What was the emotional weather of my day, and what caused the sudden change in winds?",
      "Where in my life am I waiting for someone else to give me permission?",
      "What is an expectation I placed on myself today that I need to gently put down?",
      "What thought kept circling back to me when I was trying to focus on something else?",
      "What is a truth about my current season of life that I am resisting?",
    ],
  },
  {
    id: 'sensory-somatic',
    name: 'Sensory & Body',
    emoji: '🌿',
    description: 'Grounding in physical senses, textures, and bodily presence',
    prompts: [
      "Describe the atmosphere of a single moment today through light, texture, or temperature.",
      "Where in my physical body am I holding tension right now, and what happens if I exhale into it?",
      "What was the most soothing sound or sensory detail I encountered today?",
      "How did my body react to the conversations I had today? When did my posture contract or relax?",
      "If today had a specific flavor or scent, what would it be and why?",
      "What did my feet touch, my hands hold, or my eyes linger upon that felt comforting?",
      "Close your eyes for three deep breaths: what is the very first physical sensation you notice?",
      "What physical boundary did my body ask for today that I honored or overlooked?",
    ],
  },
  {
    id: 'paradoxes-complexity',
    name: 'Paradoxes & Tension',
    emoji: '⚖️',
    description: 'Navigating contradictory feelings and gray areas',
    prompts: [
      "What are two conflicting emotions I felt at the very same time today?",
      "What is something that is simultaneously exciting and terrifying to me right now?",
      "Where am I feeling both deeply grateful and quietly overwhelmed?",
      "What is an area of my life where I want to say 'yes' with my head but my gut says 'no'?",
      "What feels like a weakness today that might secretly be protecting me?",
      "How am I balancing who I was yesterday with who I am becoming tomorrow?",
      "What is a situation where there is no villain, just two people with different needs?",
    ],
  },
  {
    id: 'subversive-gratitude',
    name: 'Subtle Gratitude',
    emoji: '✨',
    description: 'Moving beyond clichés to notice ordinary wonders',
    prompts: [
      "What is an ordinary, unsung convenience or tiny luxury that made existing easier today?",
      "Who made my day 1% lighter without them even realizing they did so?",
      "What is something broken, imperfect, or unfinished that I can appreciate right now?",
      "What is a difficult season from my past that I am now quietly thankful has passed?",
      "What object in this room has quietly served me for years without receiving praise?",
      "What piece of art, music, or phrase comforted me when nothing else could?",
      "What is a mistake I made recently that taught me something tender about myself?",
    ],
  },
  {
    id: 'inner-child-grace',
    name: 'Inner Child & Grace',
    emoji: '🌱',
    description: 'Gentle reparenting, playfulness, and unconditional self-compassion',
    prompts: [
      "What did seven-year-old me need to hear that I can whisper to myself right now?",
      "Where in my week do I need less strict discipline and much more playful curiosity?",
      "If a dear friend experienced everything I went through today, what compassion would I offer them?",
      "What silly, unessential thing brought a spark of joy or a smirk to my face recently?",
      "In what way did I protect or advocate for myself today?",
      "What is something I did today purely because I wanted to, not for productivity?",
    ],
  },
  {
    id: 'clarity-decisions',
    name: 'Decisions & Direction',
    emoji: '🧭',
    description: 'Untangling choices, values, and forward motion',
    prompts: [
      "If I completely stripped away what other people expect, what is the obvious next step?",
      "What feels like a giant obstacle today that might just be a stepping stone in disguise?",
      "What is one tiny decision I can make tonight to make tomorrow morning 10% smoother?",
      "What am I tolerating out of habit rather than conscious choice?",
      "If I were 5% braver in the coming days, what conversation would I initiate?",
      "What does 'enough' look like for me today?",
    ],
  },
];

// Flat combined starter pool containing all diverse prompts
export const ALL_RICH_STARTER_PROMPTS: string[] = STARTER_PROMPTS_BY_THEME.flatMap(
  (group) => group.prompts
);

export const LETTER_PROMPTS_BY_THEME: PromptCategoryGroup[] = [
  {
    id: 'time-capsule',
    name: 'Sensory Time Capsule',
    emoji: '⏳',
    description: 'Preserving the exact textures, obsessions, and details of today',
    prompts: [
      "What is your current morning routine, the song stuck in your head, and what is currently worrying you?",
      "Describe the room you are sitting in right now, the weather outside the window, and how you brewed your coffee or tea.",
      "What is a piece of slang, a cultural obsession, or a hobby you currently love that might make your future self smile?",
      "What did you eat today, what books are on your nightstand, and what does your handwriting look like right now?",
      "What is an ordinary problem you are dealing with today that you hope you have completely forgotten about by now?",
    ],
  },
  {
    id: 'questions-to-future-self',
    name: 'Questions to Future You',
    emoji: '💌',
    description: 'Checking in on personal growth, peace, and long-term journeys',
    prompts: [
      "Did the worry that kept me awake this month turn out to matter, or did life untangle itself?",
      "Are you kinder and more patient with yourself now? How did you learn to soften your inner critic?",
      "Did you take that trip, make that leap, or say the words you were terrified to say?",
      "Who are you spending your Sunday mornings with? Do your friendships feel calm and nourishing?",
      "What surprised you most about the road between the day I wrote this and the day you opened it?",
      "Are you giving yourself permission to rest without earning it first?",
    ],
  },
  {
    id: 'anchors-values',
    name: 'Promises & Values Anchor',
    emoji: '⚓',
    description: 'Reminding your future self of core values and boundaries',
    prompts: [
      "What is one boundary you fought hard to establish that you must never surrender again?",
      "If you are currently feeling hurried, remember why we chose depth and presence over speed.",
      "A promise I am making to you today that I hope you haven't broken...",
      "Never forget who stood by you during the quiet, unglamorous seasons of your journey.",
      "If you find yourself chasing validation from strangers, read this to remember who you truly are.",
    ],
  },
  {
    id: 'forgiveness-compassion',
    name: 'Forgiveness & Healing',
    emoji: '🕊️',
    description: 'Letting go of past weight and honoring effort over outcome',
    prompts: [
      "Forgive yourself for whatever didn't go according to plan this year. Here is what we tried our best on...",
      "I release you from having to have everything figured out by this date.",
      "What is an apology you never received that you have hopefully stopped waiting around for?",
      "Celebrate the version of you who wrote this—they were doing the best they could with the tools they had.",
      "Whatever mistake you are currently replaying in your mind, breathe out. You are allowed to be human.",
    ],
  },
  {
    id: 'creative-dreams',
    name: 'Wild Hopes & Growth',
    emoji: '🚀',
    description: 'Daring visions, secret projects, and joyful anticipation',
    prompts: [
      "What is a creative dream or quiet aspiration you are nurturing right now that you haven't told many people about?",
      "Where do you hope to be emotionally, spiritually, or physically by this exact date?",
      "What is something you were too afraid to try when writing this that you hope you've now done?",
      "I hope that by the time you unlock this, you have witnessed something that took your breath away.",
      "Write a love letter to the life you are actively building with each small, invisible daily choice.",
    ],
  },
];

// Ensure key and label are populated on all themes for backward/forward compatibility
STARTER_PROMPTS_BY_THEME.forEach((theme) => {
  if (!theme.key) theme.key = theme.id;
  if (!theme.label) theme.label = theme.name;
});

LETTER_PROMPTS_BY_THEME.forEach((theme) => {
  if (!theme.key) theme.key = theme.id;
  if (!theme.label) theme.label = theme.name;
});

// Flat combined letter prompts pool
export const ALL_RICH_LETTER_PROMPTS: string[] = LETTER_PROMPTS_BY_THEME.flatMap(
  (group) => group.prompts
);

// Aliases for Dear Future Me
export const DEAR_FUTURE_ME_THEMES = LETTER_PROMPTS_BY_THEME;
export const ALL_RICH_FUTURE_LETTER_PROMPTS = ALL_RICH_LETTER_PROMPTS;

// Helper to pick random distinct items
export function getRandomDistinctPrompts(pool: string[], count: number = 3): string[] {
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, pool.length));
}
