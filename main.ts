// The One-Line Cat Joke That Lands
// make.fun bounty u-aldy998-the-one-line-cat-joke-that-lands-a7b18262
//
// What this program does, in one paragraph: it holds fourteen hand-written
// one-line jokes about cats, ranks them with a small deterministic scorer
// built directly on the judge's published brief, and writes the winner to
// $MAKEFUN_OUTPUT_DIR/entry.txt (fallback: /output/entry.txt) with no
// trailing newline. The gate the sealed scorer applies is baked in here as
// a hard check: the output must be UTF-8 text of 1 to 200 characters, a
// single line, not only white space, with no leading or trailing
// whitespace. The program reads the file back after writing it and refuses
// to exit cleanly unless the bytes on disk are exactly the chosen line and
// pass the gate. Run it twice and the output is byte-for-byte identical:
// there is no clock, no randomness, no network, no environment input
// beyond the output directory, and the candidate order is fixed.
//
// How the judge brief drives the scorer, in the brief's own order:
//   1. Is a one-line joke about cats, with a setup and a turn that lands
//      (weight 0.35). A line needs a cat doing something concrete up front
//      and a pivot in its second half that reframes what just happened.
//   2. Makes you laugh out loud on the first read (weight 0.25). Vivid,
//      see-it-in-your-head nouns plus an absurd escalation or a voice.
//   3. Turns on a surprise, a misdirection or a fresh angle, not a pun
//      you have heard many times before (weight 0.20). Fresh reframings
//      score; any tired cat pun (purr-fect, meow, litter-ally and friends)
//      collapses this to almost nothing.
//   4. Says everything it needs in a few words, no padding, no wind-up,
//      no explanation after the punchline (weight 0.10). The sweet spot
//      is roughly 90 to 150 characters.
//   5. Feels like a joke a person would actually retell to a friend the
//      same day (weight 0.10). An everyday scene, plain words, and a
//      punchline that lands on the last word.
// A +0.05 landing bonus rewards a punchline that sits in the final clause.
// Ties break toward the shorter line, then toward the earlier candidate,
// so the pick is fully deterministic.
//
// Why these jokes and not the obvious ones: the brief explicitly punishes
// a pun you have heard many times before, so every candidate below avoids
// the whole tired shelf (no purr-fect, no cat-astrophe, no litter-ally,
// no meow jokes, no "feline fine"). Instead each one takes an ordinary
// cat behaviour everyone recognises — knocking things off tables, sitting
// on keyboards, stealing warm chairs, screaming at 3 a.m. — and reframes
// it through a human institution: a second opinion, a promotion, a
// performance review, an eviction, a landlord, a stand-up meeting, a
// hunger strike, a CEO takeover. The humour comes from the reframe, not
// from the word "cat" wearing a pun costume.
//
// Node 22+, standard library only, no network, fully deterministic.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The sealed gate: 1 to 200 characters, a single line, not only whitespace.
const MAX_CHARS = 200;
const MIN_CHARS = 1;

// Weights in the judge brief's own order. They sum to 1.00; the landing
// bonus sits on top and can push a perfect line to 1.05.
const WEIGHT_SETUP_TURN = 0.35;
const WEIGHT_LAUGH = 0.25;
const WEIGHT_SURPRISE = 0.2;
const WEIGHT_BREVITY = 0.1;
const WEIGHT_RETELLABLE = 0.1;
const LANDING_BONUS = 0.05;

// A candidate is one hand-written joke plus a note on how it is built:
// what the setup is, where the turn sits, and what fresh angle it takes.
// The note is documentation for a human reader; the scorer never reads
// it, only the text, so a note cannot flatter a weak line into winning.
interface Candidate {
  id: string;
  text: string;
  note: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "gravity",
    // Setup: the most famous cat crime, told straight. Turn: the em dash
    // hands the crime to gravity, which apparently needed a second opinion.
    // Fresh angle: the cat as a peer reviewer of physics, not a vandal.
    text: "My cat knocked my glass off the table, looked me dead in the eye, and waited — apparently gravity needed a second opinion.",
    note: "Setup is the knock; turn reframes it as peer review of gravity.",
  },
  {
    id: "promotion",
    // Setup: cat on the keyboard during a work call, a scene every remote
    // worker knows. Turn: she got promoted, and the reason is the one
    // thing she never does — corporate filler language.
    text: "My cat sat on my keyboard during a work call and got promoted, because unlike me she never once said let's circle back.",
    note: "Setup is the keyboard sit; turn is a promotion earned by silence.",
  },
  {
    id: "review",
    // Setup: the dead mouse at 3 a.m., the classic unwanted gift. Turn:
    // it was never a gift at all, it was a performance review, and the
    // scores are slipping. The joke upgrades the cat to middle management.
    text: "My cat brings me dead mice at 3 a.m. — not as gifts, as performance reviews, and frankly my scores are slipping.",
    note: "Setup is the mouse gift; turn reframes it as a performance review.",
  },
  {
    id: "eviction",
    // Setup: two seconds away from a warm chair. Turn: the chair is gone
    // and the language is legal — the fastest eviction in history, served
    // by a tenant who pays nothing. The absurdity is the legal framing.
    text: "I stood up for two seconds and the cat took my warm chair: the fastest eviction in history, executed by a creature who pays no rent.",
    note: "Setup is the stolen chair; turn frames it as a legal eviction.",
  },
  {
    id: "landlord",
    // Setup: a reasonable human argument, rent, delivered to a cat. Turn:
    // the slow blink, translated — in cat, that is the sound of a landlord
    // laughing. The power dynamic flips in the last clause.
    text: "I explained to my cat that I pay the rent; she blinked slowly, which in cat is the sound of a landlord laughing.",
    note: "Setup is the rent argument; turn translates the blink as laughter.",
  },
  {
    id: "standup",
    // Setup: ignored all day, then the midnight mouse drop. Turn: it is
    // not playtime, it is a stand-up meeting nobody agreed to. Office
    // language lands on a creature that has never held a job.
    text: "My cat ignores me all day, then at midnight drops her toy mouse at my feet and stares: it is not playtime, it is a stand-up meeting I never agreed to.",
    note: "Setup is the midnight mouse drop; turn calls it a stand-up meeting.",
  },
  {
    id: "love-bite",
    // Setup: the bite-then-lick, the most confusing cat gesture there is.
    // Turn: a translation, and the translation itself contradicts itself —
    // I love you, but also, no. The punchline is the comma before "no".
    text: "My cat's love language is biting my hand and then licking it, which I believe translates to I love you, but also, no.",
    note: "Setup is the bite-then-lick; turn translates it into a contradiction.",
  },
];

const MORE_CANDIDATES: Candidate[] = [
  {
    id: "hunger-strike",
    // Setup: the vet says the cat is overweight. Turn: the cat responds
    // with a campaign of shelf-clearing, and the owner chooses the most
    // generous possible reading — a hunger strike, not a tantrum. The
    // joke is the owner negotiating with the evidence in real time.
    text: "The vet said my cat is overweight, so now she knocks things off shelves all day, which I choose to read as a hunger strike and not a tantrum.",
    note: "Setup is the vet verdict; turn reframes vandalism as protest.",
  },
  {
    id: "alarm-clock",
    // Setup: the 3 a.m. scream, every cat owner's alarm. Turn: the alarm
    // clock has fur and no snooze button. One image, no wind-up, and the
    // punchline is a household object with a design flaw.
    text: "My cat screams at 3 a.m. every single night, which is how I learned my alarm clock has fur and no snooze button.",
    note: "Setup is the nightly scream; turn reveals the alarm clock has fur.",
  },
  {
    id: "ceo",
    // Setup: the plant is on the floor. Turn: the cat is sitting in the
    // soil like a tiny CEO surveying the company she just acquired. The
    // takeover metaphor makes the mess feel deliberate and corporate.
    text: "The cat knocked the plant over, then sat in the spilled soil like a tiny CEO surveying the company she just acquired.",
    note: "Setup is the fallen plant; turn promotes the cat to acquiring CEO.",
  },
  {
    id: "butler",
    // Setup: the cat drinks from my glass, never her bowl. Turn: in her
    // mind I am the butler and the bowl is for peasants. Class satire in
    // one line, and the insult lands on the owner, which is the funnier
    // direction — the cat is not the butt of the joke, I am.
    text: "My cat only drinks from my glass, never her bowl, because in her mind I am the butler and the bowl is for peasants.",
    note: "Setup is the stolen glass; turn demotes the owner to butler.",
  },
  {
    id: "wardrobe",
    // Setup: caught watching me sleep from the top of the wardrobe. Turn:
    // the rent is the least she could pay for the show. The creepiness
    // of being watched flips into a billing dispute, which is funnier
    // than being scared of it.
    text: "I caught my cat watching me sleep from the top of the wardrobe, and honestly the rent is the least she could pay for the show.",
    note: "Setup is the wardrobe watch; turn bills the cat for the show.",
  },
  {
    id: "box",
    // Setup: a ninety-dollar bed, ignored, and the box it came in, slept
    // in. Turn: the accounting flips — I bought a box and the bed was a
    // free gift. Every cat owner has lived this exact transaction.
    text: "I bought my cat a ninety-dollar bed and she sleeps in the box it came in, which means I bought a box and the bed was a free gift.",
    note: "Setup is the ignored bed; turn re-prices the purchase as a box.",
  },
  {
    id: "corner",
    // Setup: an hour staring at an empty corner. Turn: either ghosts are
    // real or she is middle management and the wall is her report. Two
    // explanations, both worse than the staring, and the office one wins
    // because it makes the cat boringly bureaucratic instead of spooky.
    text: "My cat stares at the empty corner for an hour every night, so either ghosts are real or she is middle management and the wall is her report.",
    note: "Setup is the corner stare; turn offers ghosts or middle management.",
  },
];

// The full field, in fixed order. Nothing here is shuffled, sampled or
// reordered at run time: candidate 0 is always judged first.
const ALL_CANDIDATES: Candidate[] = [...CANDIDATES, ...MORE_CANDIDATES];

// ---------------------------------------------------------------------------
// Word lists. These are the scorer's vocabulary, written out in full so a
// reader can see exactly what counts and what does not. All matching is
// case-insensitive and substring-based on the lower-cased line, which is
// deliberate: "performance reviews" should match "performance review",
// and a list entry is a phrase, not a regex, so there is nothing hidden.
// ---------------------------------------------------------------------------

// Pivot words and marks that can carry a turn from setup to punchline.
// A turn that arrives late (in the last 40% of the line) counts double,
// because the brief wants the turn to land, not to leak out early.
const TURN_MARKERS: string[] = [
  " — ",
  "; ",
  ": ",
  "apparently",
  "because",
  "which in cat",
  "which i ",
  "which means",
  "frankly",
  "honestly",
  "so either",
  "so now",
  "it is not",
  "not as gifts",
  "never her bowl",
  "never once",
  "the least",
  "and waited",
  "then sat",
  "then at midnight",
  "then licking",
  "drops her",
];

// Phrases that reframe the cat's behaviour through a human institution:
// work, law, money, management. A reframe is the fresh angle; a line
// with a turn but no reframe is a shrug, not a joke.
const REFRAME_MARKERS: string[] = [
  "second opinion",
  "promoted",
  "performance review",
  "eviction",
  "landlord",
  "stand-up meeting",
  "translates to",
  "hunger strike",
  "alarm clock",
  "ceo",
  "butler",
  "for the show",
  "free gift",
  "middle management",
];

// Concrete nouns the reader can see, hear or picture in one read. The
// laugh criterion is half this list: a joke you can see lands faster
// than one you have to think about.
const CONCRETE_NOUNS: string[] = [
  "glass",
  "table",
  "keyboard",
  "work call",
  "mice",
  "mouse",
  "chair",
  "rent",
  "hand",
  "vet",
  "shelves",
  "alarm clock",
  "plant",
  "soil",
  "bowl",
  "wardrobe",
  "bed",
  "box",
  "corner",
  "wall",
  "eye",
  "feet",
  "night",
];

// Absurd escalations and voice moments: the line doing something a
// straight sentence would not do. This is the other half of the laugh
// criterion — the moment the reader hears the joke instead of reading it.
const ABSURD_MARKERS: string[] = [
  "dead in the eye",
  "screams",
  "tiny ceo",
  "no snooze button",
  "fastest eviction",
  "pays no rent",
  "for peasants",
  "my scores are slipping",
  "i love you, but also, no",
  "surveying the company",
  "staring",
  "honestly",
  "frankly",
];

// The tired shelf. The brief's third criterion explicitly demotes "a pun
// you have heard many times before", and these are exactly those puns:
// the ones on every cat birthday card. Any candidate containing one of
// them collapses on surprise. None of the fourteen candidates above
// contains any of these, which is the point — but the check stays in the
// scorer so the rule is enforced by code, not by trust.
const TIRED_PUNS: string[] = [
  "purr-fect",
  "purrfect",
  "purr",
  "meow",
  "litter-ally",
  "literally the cat",
  "cat-astrophe",
  "catastrophe",
  "feline fine",
  "paws",
  "hiss-terical",
  "meowtain",
  "claw-ful",
  "purr-son",
  "cat-titude",
];

// Fresh angles, one per candidate family. A line earns surprise credit
// for each distinct fresh angle it actually contains, up to a cap, so a
// line cannot farm the criterion by stacking synonyms.
const FRESH_ANGLES: string[] = [
  "second opinion",
  "promoted",
  "performance review",
  "eviction",
  "landlord laughing",
  "stand-up meeting",
  "translates to",
  "hunger strike",
  "no snooze button",
  "tiny ceo",
  "butler",
  "for the show",
  "free gift",
  "middle management",
  "dead in the eye",
  "never once said",
];

// Everyday scene words: the retellability criterion's raw material. A
// joke set in a kitchen, an office call or a bedroom at 3 a.m. is one a
// person can retell to a friend the same day; a joke needing a footnote
// about a niche fandom is not.
const EVERYDAY_SCENE: string[] = [
  "table",
  "work call",
  "3 a.m.",
  "chair",
  "rent",
  "midnight",
  "hand",
  "vet",
  "night",
  "plant",
  "glass",
  "wardrobe",
  "box",
  "corner",
  "keyboard",
  "bowl",
  "bed",
  "shelves",
  "feet",
];

// Words the punchline can land on. The final word of the line is checked
// against this set (after stripping a trailing period): a joke whose last
// word is the twist is retold verbatim, a joke whose last word is filler
// gets paraphrased into something worse.
const PUNCH_ENDINGS: string[] = [
  "opinion",
  "back",
  "slipping",
  "rent",
  "laughing",
  "to",
  "no",
  "tantrum",
  "button",
  "acquired",
  "peasants",
  "show",
  "gift",
  "report",
];

// ---------------------------------------------------------------------------
// Small deterministic helpers. No dates, no randomness, no locale tricks:
// lower-casing is plain ASCII lower-case, and character counts count
// Unicode code points (so an em dash is one character, as the gate counts
// it), never UTF-16 code units and never bytes.
// ---------------------------------------------------------------------------

function charCount(text: string): number {
  return [...text].length;
}

function lower(text: string): string {
  return text.toLowerCase();
}

function countDistinct(haystack: string, needles: string[]): number {
  const low = lower(haystack);
  let found = 0;
  for (const needle of needles) {
    if (low.includes(needle)) {
      found += 1;
    }
  }
  return found;
}

function hasAny(haystack: string, needles: string[]): boolean {
  return countDistinct(haystack, needles) > 0;
}

// Split a line into clauses on the marks a one-liner uses to pivot:
// em dash, semicolon, colon, comma. The last clause is where the
// punchline should live; the first clause is where the setup lives.
function splitClauses(text: string): string[] {
  return text
    .split(/—|;|:|,/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function lastClause(text: string): string {
  const clauses = splitClauses(text);
  return clauses.length > 0 ? clauses[clauses.length - 1] : text;
}

function firstClause(text: string): string {
  const clauses = splitClauses(text);
  return clauses.length > 0 ? clauses[0] : text;
}

// Where, as a fraction of the line's length, does the first turn marker
// appear? Returns 1 when there is no turn at all, so "no turn" scores
// as "turn never arrives" rather than as a turn at the start.
function firstTurnPosition(text: string): number {
  const low = lower(text);
  const total = charCount(text);
  let earliest = Number.POSITIVE_INFINITY;
  for (const marker of TURN_MARKERS) {
    const at = low.indexOf(marker);
    if (at >= 0 && at < earliest) {
      earliest = at;
    }
  }
  if (earliest === Number.POSITIVE_INFINITY) {
    return 1;
  }
  return earliest / total;
}

// The final word of the line, lower-cased, with a trailing full stop
// stripped, so "opinion." still counts as the punch word "opinion".
function finalWord(text: string): string {
  const trimmed = text.trim().replace(/[.?!]+$/, "");
  const words = trimmed.split(/\s+/);
  return lower(words.length > 0 ? words[words.length - 1] : "");
}

// ---------------------------------------------------------------------------
// The five scorers, one per judge criterion, in the brief's own order.
// Each returns a number in [0, 1]. Each is written as a small chain of
// named sub-scores with a comment per step, so a reader can audit exactly
// why a line scored what it did — there is no hidden weight anywhere.
// ---------------------------------------------------------------------------

// Criterion 1 — a one-line joke about cats, with a setup and a turn that
// lands (weight 0.35, the heaviest, as the brief orders it first).
//   setup (0.40): the first clause names the cat and a concrete action.
//   turn present (0.30): some pivot marker exists anywhere in the line.
//   turn late (0.15): the first pivot sits in the last 40% of the line,
//     so the turn lands rather than leaking out early.
//   reframe (0.15): the pivot reframes the setup through a human
//     institution, which is what makes the turn a joke instead of a twist.
// A line with no cat at all scores 0 outright: it fails the brief's
// first sentence before any sub-score is read.
function scoreSetupTurn(candidate: Candidate): number {
  const text = candidate.text;
  const low = lower(text);
  if (!low.includes("cat")) {
    return 0;
  }
  const setup = firstClause(text);
  const setupHasCat = lower(setup).includes("cat");
  const setupHasAction = countDistinct(setup, [
    "knocked",
    "sat",
    "brings",
    "took",
    "explained",
    "ignores",
    "biting",
    "said",
    "screams",
    "drinks",
    "watching",
    "bought",
    "stares",
    "stood",
  ]) > 0;
  const setupScore = setupHasCat && setupHasAction ? 0.4 : setupHasCat ? 0.2 : 0;
  const turnScore = hasAny(text, TURN_MARKERS) ? 0.3 : 0;
  const position = firstTurnPosition(text);
  const lateScore = position >= 0.6 ? 0.15 : position >= 0.4 ? 0.08 : 0;
  const reframeScore = hasAny(text, REFRAME_MARKERS) ? 0.15 : 0;
  return setupScore + turnScore + lateScore + reframeScore;
}

// Criterion 2 — makes you laugh out loud on the first read (weight 0.25).
//   vividness (0.50): distinct concrete nouns the reader can picture,
//     four or more earns full marks, each noun worth an eighth.
//   absurdity (0.50): distinct absurd or voice markers, three or more
//     earns full marks; a line with no escalation at all is clever at
//     best, and clever only smiles.
// A line under 60 characters cannot earn full vividness: it has not had
// room to stage anything worth laughing at.
function scoreLaugh(candidate: Candidate): number {
  const text = candidate.text;
  const nouns = countDistinct(text, CONCRETE_NOUNS);
  const vivid = Math.min(0.5, nouns * 0.125);
  const absurd = countDistinct(text, ABSURD_MARKERS);
  const absurdScore = Math.min(0.5, absurd * (0.5 / 3));
  const shortPenalty = charCount(text) < 60 ? 0.1 : 0;
  return Math.max(0, vivid + absurdScore - shortPenalty);
}

// Criterion 3 — surprise, misdirection or a fresh angle, not a pun you
// have heard many times before (weight 0.20).
//   fresh angles (0.70): each distinct fresh angle is worth 0.35, capped
//     at two — a joke needs one strong surprise, not a pile of them.
//   misdirection (0.30): the line explicitly negates its first reading
//     ("not as gifts", "it is not playtime", "not a tantrum", "never her
//     bowl"), which is misdirection in plain sight.
//   tired pun (collapse): any tired pun in the line drops the whole
//     criterion to 0.10. The brief says a heard-it-before pun loses; the
//     scorer makes losing hurt.
function scoreSurprise(candidate: Candidate): number {
  const text = candidate.text;
  if (hasAny(text, TIRED_PUNS)) {
    return 0.1;
  }
  const angles = countDistinct(text, FRESH_ANGLES);
  const angleScore = Math.min(0.7, angles * 0.35);
  const misdirection = countDistinct(text, [
    "not as gifts",
    "it is not playtime",
    "not a tantrum",
    "never her bowl",
    "not as",
    "it is not",
    "but also, no",
    "which i choose to read",
  ]) > 0;
  const misdirectionScore = misdirection ? 0.3 : 0;
  return angleScore + misdirectionScore;
}

// Criterion 4 — says everything it needs in a few words, no padding, no
// wind-up, no explanation after the punchline (weight 0.10).
//   sweet spot (1.00): 90 to 150 characters, the length of a joke told
//     in one breath.
//   long (down to 0.40): 151 to 200 characters, losing a tenth per ten
//     characters past 150 — padding is taxed, not banned, because a
//     longer line can still land if every word earns its place.
//   short (0.60): under 90 characters — terse is good, but a one-liner
//     that short has usually skipped its setup.
//   post-punchline explanation (halved): a line that keeps explaining
//     after its punch word ("which means", "which is how", "in other
//     words") has already told the joke twice.
function scoreBrevity(candidate: Candidate): number {
  const text = candidate.text;
  const length = charCount(text);
  let base: number;
  if (length >= 90 && length <= 150) {
    base = 1;
  } else if (length > 150) {
    base = Math.max(0.4, 1 - (length - 150) * 0.01);
  } else {
    base = 0.6;
  }
  const explainsAfter = hasAny(lower(lastClause(text)), [
    "which means",
    "which is how",
    "in other words",
  ]);
  return explainsAfter ? base * 0.5 : base;
}

// Criterion 5 — feels like a joke a person would actually retell to a
// friend the same day (weight 0.10).
//   everyday scene (0.50): distinct everyday scene words, four or more
//     earns full marks — retellable jokes happen in kitchens and offices,
//     not in footnotes.
//   plain words (0.25): no word longer than 12 letters and no word a
//     friend would stumble over; the longest word in every candidate is
//     "performance" at 11 letters, so this is a guard rail, not a hurdle.
//   punch ending (0.25): the final word is a punch word, so the joke
//     ends on the twist and the retelling ends where the original did.
function scoreRetellable(candidate: Candidate): number {
  const text = candidate.text;
  const scene = countDistinct(text, EVERYDAY_SCENE);
  const sceneScore = Math.min(0.5, scene * 0.125);
  const words = text.split(/\s+/);
  const longest = words.reduce((max, word) => Math.max(max, charCount(word)), 0);
  const plainScore = longest <= 12 ? 0.25 : 0.1;
  const endingScore = PUNCH_ENDINGS.includes(finalWord(text)) ? 0.25 : 0;
  return sceneScore + plainScore + endingScore;
}

// The landing bonus: +0.05 when the final clause itself contains a
// reframe or an absurd marker, i.e. the punchline is doing the work in
// the last breath of the line, not three clauses earlier. It is a bonus,
// never a penalty, and it is the only thing that can lift a line above
// 1.00.
function landingBonus(candidate: Candidate): number {
  const tail = lastClause(candidate.text);
  if (hasAny(tail, REFRAME_MARKERS) || hasAny(tail, ABSURD_MARKERS)) {
    return LANDING_BONUS;
  }
  return 0;
}

interface ScoredCandidate {
  candidate: Candidate;
  setupTurn: number;
  laugh: number;
  surprise: number;
  brevity: number;
  retellable: number;
  bonus: number;
  total: number;
  length: number;
}

function scoreCandidate(candidate: Candidate, index: number): ScoredCandidate {
  const setupTurn = scoreSetupTurn(candidate);
  const laugh = scoreLaugh(candidate);
  const surprise = scoreSurprise(candidate);
  const brevity = scoreBrevity(candidate);
  const retellable = scoreRetellable(candidate);
  const bonus = landingBonus(candidate);
  const total =
    setupTurn * WEIGHT_SETUP_TURN +
    laugh * WEIGHT_LAUGH +
    surprise * WEIGHT_SURPRISE +
    brevity * WEIGHT_BREVITY +
    retellable * WEIGHT_RETELLABLE +
    bonus;
  void index;
  return {
    candidate,
    setupTurn,
    laugh,
    surprise,
    brevity,
    retellable,
    bonus,
    total,
    length: charCount(candidate.text),
  };
}

// ---------------------------------------------------------------------------
// The gate, exactly as the sealed scorer states it: UTF-8 text of 1 to
// 200 characters, not only white space. This program adds two stricter
// checks of its own — exactly one line, and no leading or trailing
// whitespace — because a line with a stray newline or a trailing space
// is a line that was not finished properly, and the brief wants one line.
// ---------------------------------------------------------------------------

function gateFailures(text: string): string[] {
  const failures: string[] = [];
  const length = charCount(text);
  if (length < MIN_CHARS) {
    failures.push(`too short: ${length} characters, minimum is ${MIN_CHARS}`);
  }
  if (length > MAX_CHARS) {
    failures.push(`too long: ${length} characters, maximum is ${MAX_CHARS}`);
  }
  if (text.trim().length === 0) {
    failures.push("only white space");
  }
  if (text.includes("\n") || text.includes("\r")) {
    failures.push("more than one line");
  }
  if (text !== text.trim()) {
    failures.push("leading or trailing whitespace");
  }
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 && ch !== "\t") {
      failures.push("control character in text");
      break;
    }
  }
  return failures;
}

function formatScore(value: number): string {
  return value.toFixed(3);
}

function main(): void {
  // Score every candidate in fixed order, then rank: highest total
  // first, ties toward the shorter line, then toward the earlier
  // candidate. The sort comparator is total order, so the ranking is
  // the same on every machine and every run.
  const scored = ALL_CANDIDATES.map((candidate, index) =>
    scoreCandidate(candidate, index),
  );
  const ranked = [...scored].sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    return ALL_CANDIDATES.indexOf(a.candidate) - ALL_CANDIDATES.indexOf(b.candidate);
  });

  // Gate every candidate before ranking matters: a line that cannot
  // pass the gate cannot win, however funny the scorer thinks it is.
  for (const entry of scored) {
    const failures = gateFailures(entry.candidate.text);
    if (failures.length > 0) {
      throw new Error(
        `candidate ${entry.candidate.id} fails the gate: ${failures.join("; ")}`,
      );
    }
  }

  // Print the full table so a human can audit the pick: every line, its
  // five criterion scores, its bonus, its total and its length.
  console.log("candidate | setup | laugh | surpr | brev | retel | bonus | total | chars");
  for (const entry of ranked) {
    console.log(
      `${entry.candidate.id.padEnd(13)} | ${formatScore(entry.setupTurn)} | ` +
        `${formatScore(entry.laugh)} | ${formatScore(entry.surprise)} | ` +
        `${formatScore(entry.brevity)} | ${formatScore(entry.retellable)} | ` +
        `${formatScore(entry.bonus)} | ${formatScore(entry.total)} | ${entry.length}`,
    );
  }

  const winner = ranked[0];
  console.log(`winner: ${winner.candidate.id} (${winner.length} chars)`);
  console.log(winner.candidate.text);

  // Write the winner with no trailing newline: entry.txt holds the joke
  // and nothing else, exactly as the brief demands ("nothing else in
  // the entry"). The output directory comes from the environment the
  // grader sets; locally it defaults to /output like the template field.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text, "utf8");

  // Read it back and verify byte-for-byte: the file on disk must be
  // exactly the chosen line, and it must pass the gate on its own. A
  // mismatch here is a failure of this program, and it exits loudly
  // rather than handing the grader a file it did not intend.
  const written = readFileSync(outPath, "utf8");
  if (written !== winner.candidate.text) {
    throw new Error("verification failed: entry.txt does not match the chosen line");
  }
  const failures = gateFailures(written);
  if (failures.length > 0) {
    throw new Error(`verification failed: entry.txt fails the gate: ${failures.join("; ")}`);
  }
  console.log(`wrote ${outPath} (${charCount(written)} chars, gate passed)`);
}

main();
