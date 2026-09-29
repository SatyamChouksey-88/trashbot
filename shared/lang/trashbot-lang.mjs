/*
 * TrashBot "Bolo" — bilingual command parser (Hinglish + English + Devanagari)
 * ---------------------------------------------------------------------------
 * One file, zero dependencies, pure functions, deterministic.
 * It runs in two places:
 *   - the phone browser (the robot serves this file as /lang.mjs), and
 *   - Node (the Cursor MCP agent imports it).
 * The firmware never parses language. It only receives the same JSON API calls
 * the buttons send, and firmware safety still applies to every one of them.
 *
 * Safety rules (enforced by test/properties.test.mjs):
 *   S1  A stop word anywhere => STOP first. Even inside a question, even misspelled.
 *   S2  Negation ("mat", "nahi", "don't") + any action word => STOP, never motion.
 *   S3  Typos / fuzzy matches can only STOP or SUGGEST. They never start motion.
 *   S4  Motion with unknown words, a question, a place name or several numbers => ask first.
 *   S5  Ambiguous (left AND right, clean AND move, info AND action) => clarify chips.
 *   S6  Every number is clamped. Reverse is limited more (no rear sensor).
 *   S7  Learned phrases (aliases) never contain safety words and never override them.
 * Short version: "Galat samjha toh ruk jayega. Kabhi galat chalega nahi."
 */

export const LANG_VERSION = '1.0.0';

export const INTENTS = Object.freeze([
  'STOP', 'ESTOP', 'ESTOP_RESET', 'CLEAN', 'MOVE', 'TURN', 'SCOOP', 'PHOTO', 'STATUS', 'HEALTH',
  'BATTERY', 'REPORT', 'MISTAKES', 'MARK_KEEP', 'MARK_TRASH', 'HELP', 'LANG', 'REPEAT',
]);
export const MOTION_INTENTS = Object.freeze(['CLEAN', 'MOVE', 'TURN', 'SCOOP']);
export const INFO_INTENTS = Object.freeze(['HELP', 'LANG', 'BATTERY', 'REPORT', 'MISTAKES', 'HEALTH', 'STATUS', 'PHOTO']);

const INTENT_SET = new Set(INTENTS);
const MOTION = new Set(MOTION_INTENTS);
const CHAINABLE = new Set(['MOVE', 'TURN', 'SCOOP', 'PHOTO', 'STATUS', 'BATTERY']);
const ALIAS_ALLOWED = new Set(['CLEAN', 'MOVE', 'TURN', 'SCOOP', 'PHOTO', 'STATUS', 'HEALTH', 'BATTERY', 'REPORT', 'MISTAKES', 'HELP']);
const REPEATABLE = new Set(['CLEAN', 'MOVE', 'TURN', 'SCOOP', 'PHOTO', 'STATUS', 'HEALTH', 'BATTERY', 'REPORT', 'MISTAKES']);

// ---------------------------------------------------------------------------
// Limits. Text commands are stricter than the raw API. Firmware still enforces
// its own hard limits on top of these, so a bug here can never exceed them.
// ---------------------------------------------------------------------------
export const LIMITS = Object.freeze({
  move: Object.freeze({ defaultCm: 10, smallCm: 5, largeCm: 25, maxForwardCm: 50, maxBackCm: 20 }),
  turn: Object.freeze({ defaultDeg: 45, smallDeg: 20, largeDeg: 90, uturnDeg: 180, maxDeg: 180 }),
  speed: Object.freeze({ normal: 40, slow: 25, fast: 60, min: 10, max: 80 }),
  clean: Object.freeze({ defaultItems: 5, maxItems: 20, defaultTimeS: 180, minTimeS: 10, maxTimeS: 600 }),
  sequenceMaxSteps: 3,
  pendingTtlMs: 20000,
  alias: Object.freeze({ maxCount: 50, maxPhraseChars: 40, maxTokens: 6, maxSteps: 3 }),
  maxInputChars: 300,
});

// ---------------------------------------------------------------------------
// Lexicon. Every entry is ONE token (after normalize). Spelling variants are
// listed explicitly; the skeleton (see skel) also folds repeated letters,
// ph->f, w->v, z->j, q->k. Joined phrases (e.g. "phir se") live in JOINS.
// `en` / `hi` tags drive reply-language detection ("hi" = Hinglish).
// ---------------------------------------------------------------------------
export const LEXICON = Object.freeze({
  stop: {
    en: ['stop', 'stp', 'stap', 'halt', 'hold', 'wait', 'pause', 'freeze', 'switchoff', 'turnoff', 'poweroff'],
    hi: ['ruko', 'rko', 'ruk', 'rukja', 'rukjao', 'rukjaa', 'rukjaye', 'rukiye', 'rukie', 'rukna', 'rukjaiye',
      'thamo', 'tham', 'thaam', 'thamjao', 'thahro', 'thehro', 'thero', 'tehro', 'band', 'bandh', 'bnd',
      'offkaro', 'sojao', 'baithjao',
      'रुको', 'रुक', 'रुकिए', 'रुकें', 'रुकना', 'थमो', 'थम', 'ठहरो', 'बंद'],
  },
  basAlone: { en: ['enough'], hi: ['bas', 'बस'] },
  estop: {
    en: ['estop', 'emergency', 'emergancy', 'emergncy', 'emergensy', 'panic', 'sos'],
    hi: ['bachao', 'bachaao', 'khatra', 'इमरजेंसी', 'बचाओ', 'खतरा'],
  },
  reset: { en: ['reset', 'clear', 'unlock', 'release'], hi: ['hatao', 'hata', 'हटाओ'] },
  negation: {
    en: ['dont', 'not', 'never', 'no', 'nope', 'nah', 'donot', 'dnt', 'didnt', 'cant', 'wont', 'shouldnt'],
    hi: ['mat', 'mt', 'nahi', 'nahin', 'nhi', 'nhin', 'nai', 'nahee', 'मत', 'नहीं', 'नही'],
  },
  // "na" is a softener at the END ("saaf karo na"), a negation elsewhere ("aage na jao").
  softNa: { en: [], hi: ['na', 'naa', 'ना'] },
  yes: {
    en: ['yes', 'yeah', 'yea', 'yep', 'yup', 'ok', 'okay', 'okk', 'okey', 'sure', 'confirm', 'correct', 'alright'],
    hi: ['haan', 'han', 'ha', 'hanji', 'haanji', 'haji', 'ji', 'jee', 'theek', 'thik', 'thek', 'sahi', 'chalega', 'bilkul',
      'हाँ', 'हां', 'हा', 'जी', 'ठीक', 'सही', 'बिल्कुल'],
  },
  no: {
    en: ['no', 'nope', 'nah', 'cancel', 'abort', 'nevermind'],
    hi: ['nahi', 'nahin', 'nhi', 'nai', 'mat', 'chhodo', 'chodo', 'chhod', 'chod', 'rehnedo', 'janedo', 'नहीं', 'मत', 'छोड़ो', 'रहनेदो'],
  },
  cleanWord: {
    en: ['clean', 'cleen', 'clen', 'claen', 'cleaning', 'cleanup', 'sweep', 'tidy'],
    hi: ['saaf', 'saf', 'saff', 'safai', 'safaai', 'saafai', 'safayi', 'safaii', 'jhadu', 'jhaadu', 'jharu', 'jhaaru',
      'साफ', 'सफाई', 'सफ़ाई', 'झाड़ू'],
  },
  trashNoun: {
    en: ['trash', 'garbage', 'rubbish', 'litter', 'waste', 'junk', 'dirt', 'mess'],
    hi: ['kachra', 'kachara', 'kachda', 'kachre', 'kachro', 'kachde', 'kooda', 'kuda', 'koodaa', 'kudaa', 'kude',
      'gandagi', 'gandgi', 'कचरा', 'कचड़ा', 'कचरे', 'कूड़ा', 'कूडा', 'गंदगी'],
  },
  pickupVerb: {
    en: ['pick', 'pickup', 'collect', 'grab', 'remove'],
    hi: ['uthao', 'utha', 'uthalo', 'uthaa', 'uthana', 'uthaiye', 'uthayo', 'uthake', 'hatao', 'hata', 'उठाओ', 'उठा', 'हटाओ'],
  },
  start: {
    en: ['start', 'begin', 'resume', 'continue', 'turnon', 'switchon', 'poweron'],
    hi: ['shuru', 'suru', 'shuroo', 'chalu', 'chaalu', 'jaari', 'jari', 'शुरू', 'चालू', 'जारी'],
  },
  report: {
    en: ['report', 'summary', 'result', 'results', 'score', 'total', 'stats', 'statistics', 'count', 'history'],
    hi: ['hisaab', 'hisab', 'हिसाब', 'रिपोर्ट'],
  },
  countQ: { en: ['howmany'], hi: ['kitna', 'kitne', 'kitni', 'kitnaa', 'कितना', 'कितने', 'कितनी'] },
  collectedWord: {
    en: ['collected', 'picked', 'cleaned'],
    hi: ['uthaye', 'uthaya', 'uthayi', 'uthaaye', 'उठाए', 'उठाया'],
  },
  status: {
    en: ['status', 'state', 'condition', 'update', 'doing'],
    hi: ['haal', 'hal', 'halat', 'haalat', 'kaisa', 'kaisi', 'kaise', 'chalraha', 'ruka', 'ruki', 'ruke', 'स्थिति', 'हाल'],
  },
  health: {
    en: ['health', 'error', 'errors', 'problem', 'problems', 'issue', 'issues', 'diagnostic', 'diagnostics', 'checkup'],
    hi: ['tabiyat', 'tabiyet', 'tabiat', 'sehat', 'dikkat', 'pareshani', 'kharabi', 'तबियत', 'तबीयत', 'सेहत', 'दिक्कत', 'खराबी'],
  },
  battery: {
    en: ['battery', 'batt', 'batery', 'battry', 'battary', 'charge', 'charging'],
    hi: ['betri', 'batri', 'baitri', 'बैटरी', 'चार्ज'],
  },
  mistakes: {
    en: ['mistake', 'mistakes', 'wrong', 'fail', 'failed', 'failure', 'why'],
    hi: ['galti', 'galtiyan', 'galtiyaan', 'galtiya', 'gadbad', 'garbar', 'gadbadi', 'kyun', 'kyu', 'kyon', 'kyoon',
      'गलती', 'गलतियां', 'गड़बड़', 'क्यों'],
  },
  photo: {
    en: ['photo', 'photos', 'pic', 'pics', 'picture', 'pictures', 'image', 'snap', 'snapshot', 'camera', 'cam',
      'show', 'look', 'view', 'yousee'],
    hi: ['tasveer', 'tasvir', 'dikhao', 'dikha', 'dikh', 'dikhaao', 'dikhana', 'dekho', 'dekh', 'dekhna', 'dekhiye',
      'khicho', 'khincho', 'kheencho', 'फोटो', 'तस्वीर', 'दिखाओ', 'दिखा', 'देखो', 'देख', 'खींचो'],
  },
  langEn: { en: ['english', 'eng'], hi: ['angrezi', 'angreji', 'अंग्रेजी', 'अंग्रेज़ी', 'इंग्लिश'] },
  langHi: { en: [], hi: ['hinglish', 'hindi', 'हिंदी', 'हिन्दी', 'हिंग्लिश'] },
  help: {
    en: ['help', 'commands', 'command', 'guide', 'options', 'menu'],
    hi: ['madad', 'madat', 'sahayata', 'मदद', 'हेल्प'],
  },
  useWord: { en: ['use'], hi: [] },
  forward: {
    en: ['forward', 'forwards', 'fwd', 'fw', 'frwd', 'ahead', 'straight', 'front'],
    hi: ['aage', 'aagey', 'agey', 'aagay', 'agay', 'aange', 'seedha', 'sidha', 'sidhe', 'seedhe', 'samne', 'saamne', 'samane',
      'आगे', 'सीधा', 'सीधे', 'सामने'],
  },
  back: {
    en: ['back', 'backward', 'backwards', 'reverse', 'rev', 'behind'],
    hi: ['peeche', 'piche', 'pichhe', 'peechhe', 'peechey', 'pichey', 'pichhey', 'ulta', 'ulte', 'पीछे', 'उल्टा'],
  },
  left: {
    en: ['left', 'lft', 'leftside'],
    hi: ['baaye', 'baayen', 'baayein', 'bayen', 'baen', 'baye', 'bayi', 'baayi', 'bayein', 'बाएं', 'बाएँ', 'बायें', 'बाईं', 'लेफ्ट'],
  },
  right: {
    en: ['right', 'rite', 'rigt', 'rigth', 'ryt', 'rightside'],
    hi: ['daaye', 'daayen', 'daayein', 'dayen', 'daen', 'daye', 'dayi', 'daayi', 'daahine', 'dahine', 'dayein',
      'दाएं', 'दाएँ', 'दायें', 'दाईं', 'राइट'],
  },
  uturn: { en: ['uturn', 'yuturn'], hi: ['palat', 'palto', 'palte', 'paltao', 'पलट', 'पलटो'] },
  turnVerb: {
    en: ['turn', 'rotate', 'spin', 'turning'],
    hi: ['ghumo', 'ghoomo', 'ghum', 'ghoom', 'ghuma', 'ghumao', 'ghumaao', 'ghumana', 'ghoomna', 'mudo', 'mud', 'modo',
      'mod', 'muro', 'mur', 'mudna', 'घूमो', 'घुमाओ', 'मुड़ो', 'मुड़', 'घूम'],
  },
  moveVerb: {
    en: ['move', 'go', 'drive', 'come', 'proceed', 'travel'],
    hi: ['chalo', 'chal', 'chalao', 'chalaao', 'chalna', 'jao', 'ja', 'jaao', 'jaiye', 'jaaiye', 'jana', 'jaana', 'badho',
      'badh', 'badhao', 'aao', 'aaiye', 'aana', 'चलो', 'चल', 'जाओ', 'जा', 'जाना', 'बढ़ो', 'आओ', 'आना'],
  },
  // "wapas aao", "hato": direction unclear -> always ask.
  wapas: { en: [], hi: ['wapas', 'vapas', 'vaapas', 'waapas', 'wapis', 'vapis', 'hat', 'hato', 'hatjao', 'hatja', 'वापस', 'हटो', 'हट'] },
  scoopNoun: {
    en: ['scoop', 'scooper', 'spoon', 'dustpan', 'shovel', 'arm', 'pan', 'bucket'],
    hi: ['belcha', 'belche', 'chammach', 'chamach', 'स्कूप', 'बेलचा', 'चम्मच'],
  },
  tipWord: { en: ['tip', 'dump'], hi: [] },
  scoopDown: { en: ['down', 'lower', 'drop'], hi: ['neeche', 'niche', 'nichey', 'nichay', 'neechay', 'नीचे'] },
  scoopUp: { en: ['up', 'raise', 'lift', 'carry'], hi: ['upar', 'uppar', 'oopar', 'upr', 'ऊपर', 'उपर'] },
  scoopTip: {
    en: ['tip', 'dump', 'empty', 'pour', 'unload'],
    hi: ['khali', 'khaali', 'daalo', 'dalo', 'daal', 'phenko', 'fenko', 'खाली', 'डालो', 'फेंको'],
  },
  scoopCycle: { en: ['test', 'cycle', 'demo', 'check'], hi: ['jaanch', 'janch', 'जांच'] },
  qtySmall: {
    en: ['little', 'bit', 'slightly', 'small', 'tiny', 'abit'],
    hi: ['thoda', 'thora', 'thodasa', 'thorasa', 'thodi', 'thori', 'zara', 'jara', 'jra', 'halka', 'थोड़ा', 'थोड़ी', 'ज़रा', 'जरा'],
  },
  qtyLarge: {
    en: ['more', 'lot', 'far', 'big', 'much', 'lots'],
    hi: ['zyada', 'jyada', 'jada', 'jyaada', 'bahut', 'bohot', 'bohat', 'bahot', 'door', 'dur', 'ज़्यादा', 'ज्यादा', 'बहुत', 'दूर'],
  },
  qtyFull: { en: ['full', 'complete', 'whole', 'fully'], hi: ['pura', 'poora', 'puri', 'poori', 'pure', 'पूरा', 'पूरी'] },
  speedSlow: {
    en: ['slow', 'slowly', 'gently', 'carefully', 'slower', 'slowdown'],
    hi: ['dheere', 'dhire', 'dheeme', 'dhime', 'aaram', 'aram', 'aahista', 'ahista', 'धीरे', 'आराम'],
  },
  speedFast: {
    en: ['fast', 'quick', 'quickly', 'faster', 'rapid', 'speedup', 'hurry'],
    hi: ['tez', 'tezi', 'jaldi', 'jldi', 'fatafat', 'तेज', 'तेज़', 'जल्दी'],
  },
  repeat: { en: ['again', 'repeat'], hi: ['dobara', 'dubara', 'doobara', 'firse', 'दोबारा'] },
  pointer: {
    en: ['this', 'that', 'it', 'these', 'those'],
    hi: ['ye', 'yeh', 'yah', 'isko', 'isse', 'ise', 'is', 'iss', 'wo', 'woh', 'vo', 'voh', 'usko', 'use', 'uss', 'us',
      'यह', 'ये', 'इसे', 'इसको', 'वो', 'वह', 'उसे', 'उसको'],
  },
  keepWord: {
    en: ['keep', 'mine', 'important', 'precious', 'valuable'],
    hi: ['mera', 'meri', 'hamara', 'hamari', 'rakho', 'rakh', 'zaroori', 'jaruri', 'zaruri', 'मेरा', 'मेरी', 'रखो', 'ज़रूरी', 'जरूरी'],
  },
  isWord: { en: ['is', 'its', 'was', 'are'], hi: ['hai', 'h', 'he', 'hain', 'hei', 'tha', 'thi', 'है', 'हैं', 'था', 'थी'] },
  pastWord: {
    en: ['did', 'finished'],
    hi: ['kiya', 'kiye', 'kardiya', 'krdiya', 'diya', 'kia', 'gaya', 'gayi', 'gaye', 'hogaya', 'किया', 'गया', 'गई'],
  },
  imperative: {
    en: ['please', 'pls', 'plz'],
    hi: ['karo', 'kro', 'kar', 'kardo', 'krdo', 'kariye', 'kijiye', 'karein', 'karen', 'karna', 'krna', 'karni', 'karne',
      'karlo', 'karle', 'karwao', 'karao', 'do', 'dijiye', 'dedo', 'de', 'chahiye', 'chaiye', 'करो', 'कर', 'करें', 'कीजिए', 'दो', 'चाहिए'],
  },
  location: {
    en: ['near', 'beside', 'under', 'next', 'corner', 'side', 'below', 'underneath', 'besides'],
    hi: ['paas', 'pass', 'nazdeek', 'nazdik', 'najdik', 'kone', 'kona', 'taraf', 'kinare', 'baju', 'bagal', 'andar', 'bahar',
      'पास', 'नज़दीक', 'नजदीक', 'कोने', 'तरफ', 'अंदर', 'बाहर'],
  },
  locationNoun: {
    en: ['sofa', 'couch', 'bed', 'table', 'chair', 'kitchen', 'wall', 'bathroom', 'balcony', 'bedroom', 'desk', 'cupboard'],
    hi: ['darwaza', 'darwaja', 'darvaja', 'almari', 'almirah', 'palang', 'kursi', 'mez', 'meza', 'deewar', 'diwar', 'rasoi',
      'सोफा', 'बेड', 'मेज़', 'मेज', 'कुर्सी', 'दरवाज़ा', 'दरवाजा', 'किचन', 'दीवार'],
  },
  unitCm: {
    en: ['cm', 'cms', 'centimeter', 'centimeters', 'centimetre', 'centimetres', 'senti', 'sentimeter'],
    hi: ['सेमी', 'सेंटीमीटर'],
  },
  unitM: { en: ['m', 'meter', 'meters', 'metre', 'metres', 'mtr'], hi: ['mitar', 'मीटर'] },
  unitInch: { en: ['inch', 'inches'], hi: ['इंच'] },
  unitFt: { en: ['ft', 'feet', 'foot'], hi: ['फीट', 'फुट'] },
  unitStep: { en: ['step', 'steps'], hi: ['kadam', 'kadm', 'कदम'] },
  unitDeg: { en: ['deg', 'degree', 'degrees', 'degre', 'dgree'], hi: ['digri', 'digree', 'डिग्री'] },
  unitRound: { en: ['round', 'rounds', 'circle', 'rotation', 'rotations'], hi: ['chakkar', 'chakar', 'चक्कर'] },
  unitSec: { en: ['s', 'sec', 'secs', 'second', 'seconds'], hi: ['sekand', 'सेकंड'] },
  unitMin: { en: ['min', 'mins', 'minute', 'minutes'], hi: ['minat', 'mint', 'मिनट'] },
  unitItems: {
    en: ['item', 'items', 'piece', 'pieces', 'thing', 'things', 'object', 'objects'],
    hi: ['cheez', 'cheeze', 'cheezein', 'cheezen', 'chiz', 'chize', 'chizen', 'kachre', 'चीज़', 'चीज', 'चीजें', 'कचरे'],
  },
  unitTimes: { en: ['times', 'time'], hi: ['baar', 'bar', 'बार'] },
  // Question starters / modals: a question with motion => ask before moving.
  qStart: { en: ['can', 'could', 'will', 'would', 'should', 'shall', 'may'], hi: ['kya', 'kyaa', 'क्या'] },
  qModal: {
    en: [],
    hi: ['sakte', 'sakta', 'sakti', 'sakoge', 'paoge', 'paaoge', 'karoge', 'karogi', 'kroge', 'jaoge', 'chaloge', 'doge',
      'loge', 'uthaoge', 'sakenge'],
  },
  separator: { en: ['then'], hi: ['phir', 'fir', 'tab', 'फिर'] },
  // Picking an option by position (only meaningful while a question is pending).
  ordinal: { en: ['first', 'second', 'third', 'fourth'], hi: ['pehla', 'pahla', 'pehle', 'doosra', 'dusra', 'dusara', 'teesra', 'tisra', 'chautha', 'पहला', 'दूसरा', 'तीसरा'] },
  filler: {
    en: ['the', 'a', 'an', 'to', 'and', 'now', 'just', 'robot', 'trashbot', 'bot', 'tb', 'kindly', 'can', 'could', 'you', 'u',
      'will', 'would', 'me', 'my', 'for', 'of', 'on', 'at', 'by', 'with', 'some', 'all', 'room', 'floor', 'here', 'there',
      'than', 'them', 'they', 'their', 'does', 'did', 'am', 'be', 'i', 'we', 'let', 'lets', 'your', 'hey', 'hi', 'hello',
      'so', 'also', 'too', 'very', 'really', 'sir', 'bro', 'buddy', 'dear', 'thanks', 'thank', 'thx', 'what', 'whats',
      'which', 'where', 'when', 'how', 'who', 'should', 'shall', 'may', 'might', 'must', 'need', 'want', 'wanna', 'gonna',
      'like', 'into', 'onto', 'from', 'till', 'until', 'upto', 'over', 'area', 'place', 'spot', 'way', 'direction',
      'towards', 'toward', 'in', 'out', 'switch', 'rightnow', 'rightaway', 'immediately', 'asap', 'check', 'tell', 'give',
      'get', 'take', 'make', 'do', 'please', 'pls', 'plz', 'plis', 'everything', 'everywhere', 'around', 'about', 'level',
      'mode', 'reply', 'answer', 'speak', 'talk', 'say', 'write', 'type', 'e', 'any', 'option', 'number', 'choice', 'max',
      'maximum', 'upto'],
    hi: ['karo', 'kro', 'kar', 'karke', 'kardo', 'krdo', 'kr', 'kariye', 'kijiye', 'karna', 'karne', 'karenge', 'karunga',
      'karega', 'kare', 'karein', 'karen', 'do', 'de', 'dena', 'dijiye', 'dedo', 'dijie', 'lo', 'le', 'lelo', 'lena',
      'lijiye', 'bhai', 'bhaiya', 'yaar', 'yar', 'ji', 'jee', 'abhi', 'ab', 'to', 'toh', 'hai', 'hain', 'ho', 'hua', 'hui',
      'huye', 'gaya', 'gayi', 'gaye', 'hogaya', 'ke', 'ka', 'ki', 'ko', 'se', 'me', 'mein', 'main', 'mai', 'mujhe', 'mere',
      'par', 'pe', 'wala', 'wali', 'vala', 'vali', 'wale', 'aur', 'bhi', 'sab', 'saara', 'sara', 'saari', 'sari', 'kamra',
      'kamre', 'ghar', 'zameen', 'jameen', 'farsh', 'idhar', 'udhar', 'yahan', 'yaha', 'wahan', 'waha', 'vahan', 'jahan',
      'raha', 'rahe', 'rahi', 'rha', 'rhe', 'rhi', 'tum', 'aap', 'tu', 'apna', 'apni', 'apne', 'ekdam', 'turant', 'accha',
      'acha', 'achha', 'kuch', 'koi', 'tak', 'liye', 'batao', 'bata', 'bataiye', 'bolo', 'bol', 'suno', 'sun', 'baad',
      'jab', 'kahan', 'kab', 'kaun', 'dabba', 'dabbe', 'dibba', 'bin', 'dustbin', 'hoon', 'hun', 'hu', 'hota', 'hoti',
      'kaam', 'wajah', 'ek', 'chahiye', 'chaiye', 'please', 'aaj', 'lagao', 'lagaao', 'laga', 'maro', 'maar', 'dono', 'karu', 'karun', 'karoon',
      'करो', 'कर', 'दो', 'दे', 'लो', 'ले', 'भाई', 'यार', 'जी', 'अभी', 'अब', 'तो', 'है', 'हैं', 'हो', 'के', 'का', 'की', 'को',
      'से', 'में', 'और', 'भी', 'सब', 'कमरा', 'घर', 'इधर', 'यहां', 'तुम', 'आप', 'बताओ', 'रहा', 'रहे', 'रही', 'गया', 'गई',
      'हूं', 'एक', 'जल्दी'],
  },
});

// Number words count only when followed by a unit ("do cm", "aadha chakkar"),
// so fillers like "kar do" / "ek kaam karo" never become numbers.
const NUM_WORDS = Object.freeze({
  ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4, paanch: 5, panch: 5, five: 5, chhe: 6,
  che: 6, six: 6, saat: 7, seven: 7, aath: 8, ath: 8, eight: 8, nau: 9, nine: 9, das: 10, dus: 10, ten: 10, pandrah: 15,
  fifteen: 15, bees: 20, twenty: 20, tees: 30, thirty: 30, chalis: 40, chaalis: 40, forty: 40, pachas: 50, pachaas: 50,
  fifty: 50, nabbe: 90, ninety: 90, sau: 100, hundred: 100, aadha: 0.5, adha: 0.5, half: 0.5, dedh: 1.5, dhai: 2.5,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'दस': 10, 'बीस': 20, 'आधा': 0.5,
});

const UNIT_DEFS = Object.freeze({
  unitCm: { family: 'len', factor: 1 },
  unitM: { family: 'len', factor: 100 },
  unitInch: { family: 'len', factor: 2.54 },
  unitFt: { family: 'len', factor: 30.48 },
  unitStep: { family: 'len', factor: 10 },
  unitDeg: { family: 'deg', factor: 1 },
  unitRound: { family: 'deg', factor: 360, round: true },
  unitSec: { family: 'time', factor: 1 },
  unitMin: { family: 'time', factor: 60 },
  unitItems: { family: 'items', factor: 1 },
  unitTimes: { family: 'times', factor: 1 },
});

const SEP = '‖'; // internal separator token ("uske baad", "and then")

// Answers that pick an option by position ("2", "doosra", "second").
const ORDINALS = Object.freeze({
  pehla: 1, pahla: 1, pehle: 1, first: 1, doosra: 2, dusra: 2, dusara: 2, second: 2, teesra: 3, tisra: 3, third: 3,
  chautha: 4, fourth: 4, 'पहला': 1, 'दूसरा': 2, 'तीसरा': 3,
});
const PICK_FILLER = new Set(['option', 'number', 'num', 'choice', 'wala', 'wali', 'vala', 'vali', 'wale', 'vale', 'ok', 'haan']);

// Two-token phrases joined into one token before matching.
const JOIN_DEFS = [
  [['phir', 'se'], 'firse'], [['फिर', 'से'], 'firse'],
  [['e', 'stop'], 'estop'], [['emergency', 'stop'], 'estop'],
  [['u', 'turn'], 'uturn'], [['you', 'turn'], 'uturn'], [['turn', 'around'], 'uturn'], [['turn', 'back'], 'uturn'],
  [['about', 'turn'], 'uturn'],
  [['pick', 'up'], 'pickup'], [['clean', 'up'], 'cleanup'],
  [['rehne', 'do'], 'rehnedo'], [['jane', 'do'], 'janedo'], [['jaane', 'do'], 'janedo'], [['रहने', 'दो'], 'rehnedo'],
  [['how', 'many'], 'howmany'], [['how', 'much'], 'howmany'],
  [['uske', 'baad'], SEP], [['iske', 'baad'], SEP], [['and', 'then'], SEP], [['after', 'that'], SEP],
  [['इसके', 'बाद'], SEP], [['उसके', 'बाद'], SEP],
  [['do', 'not'], 'dont'], [['never', 'mind'], 'nevermind'],
  [['turn', 'off'], 'turnoff'], [['switch', 'off'], 'switchoff'], [['power', 'off'], 'poweroff'],
  [['off', 'karo'], 'offkaro'], [['off', 'kro'], 'offkaro'], [['off', 'kar'], 'offkaro'], [['off', 'kardo'], 'offkaro'],
  [['turn', 'on'], 'turnon'], [['switch', 'on'], 'switchon'], [['power', 'on'], 'poweron'],
  [['slow', 'down'], 'slowdown'], [['speed', 'up'], 'speedup'], [['hurry', 'up'], 'hurry'],
  [['right', 'now'], 'rightnow'], [['right', 'away'], 'rightaway'], [['all', 'right'], 'alright'],
  [['chal', 'raha'], 'chalraha'], [['chal', 'rha'], 'chalraha'], [['chal', 'rahi'], 'chalraha'], [['चल', 'रहा'], 'chalraha'],
  [['so', 'jao'], 'sojao'], [['so', 'ja'], 'sojao'], [['baith', 'jao'], 'baithjao'],
  [['kar', 'diya'], 'kardiya'], [['kr', 'diya'], 'krdiya'], [['ho', 'gaya'], 'hogaya'], [['कर', 'दिया'], 'kardiya'],
  [['you', 'see'], 'yousee'], [['u', 'see'], 'yousee'],
  [['ek', 'dam'], 'ekdam'], [['a', 'bit'], 'abit'], [['a', 'little'], 'abit'],
];

// ---------------------------------------------------------------------------
// Text normalisation and tokens
// ---------------------------------------------------------------------------

/** Normalise raw text: NFC, lowercase, Devanagari digits, punctuation → spaces. */
export function normalize(text) {
  let s = typeof text === 'string' ? text : String(text ?? '');
  if (s.length > LIMITS.maxInputChars) s = s.slice(0, LIMITS.maxInputChars);
  s = s.normalize('NFC');
  s = s.replace(/[​-‍⁠﻿]/g, '');
  s = s.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
  s = s.replace(/ँ/g, 'ं'); // chandrabindu → anusvara (हाँ → हां)
  s = s.toLowerCase();
  s = s.replace(/[‘’`´']/g, ''); // don't → dont
  s = s.replace(/°/g, ' deg ');
  s = s.replace(/(\p{L})-(?=\p{L})/gu, '$1'); // e-stop → estop, u-turn → uturn
  s = s.replace(/(\d)\.(\d)/g, '$1\u0001$2'); // keep decimals
  s = s.replace(/(\d)(?=\p{L})/gu, '$1 ').replace(/(\p{L}|\p{M})(?=\d)/gu, '$1 '); // 20cm → 20 cm
  s = s.replace(/[^\p{L}\p{M}\p{N}\u0001\s]/gu, ' ');
  s = s.replace(/\u0001/g, '.');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Spelling skeleton for Latin tokens: ph→f, w→v, z→j, q→k, fold repeated letters. */
function skel(tok) {
  if (tok === SEP || !/^[a-z]+$/.test(tok)) return tok;
  return tok.replace(/ph/g, 'f').replace(/w/g, 'v').replace(/z/g, 'j').replace(/q/g, 'k').replace(/(.)\1+/g, '$1');
}

const JOINS = JOIN_DEFS.map(([pat, out]) => [pat.map((w) => skel(normalize(w))), out === SEP ? SEP : skel(normalize(out))]);

function lexTokens(text) {
  const norm = normalize(text);
  if (!norm) return [];
  let toks = norm.split(' ').map((raw) => ({ raw, sk: skel(raw) }));
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    let joined = null;
    if (i + 1 < toks.length) {
      for (const [pat, rep] of JOINS) {
        if (toks[i].sk === pat[0] && toks[i + 1].sk === pat[1]) { joined = rep; break; }
      }
    }
    if (joined !== null) {
      out.push({ raw: `${toks[i].raw} ${toks[i + 1].raw}`, sk: joined });
      i++;
    } else {
      out.push(toks[i]);
    }
  }
  toks = out;
  return toks;
}

/** Tokens (skeleton form) exactly as the parser sees them. Useful for debugging and tests. */
export function tokenize(text) {
  return lexTokens(text).map((t) => (t.sk === SEP ? '|' : t.sk));
}

// ---------------------------------------------------------------------------
// Index built once at load
// ---------------------------------------------------------------------------
const S = {}; // concept → Set(skeleton)
const TOKEN_LANG = new Map(); // skeleton → Set('en' | 'hi')
const KNOWN = new Set();
export const LEXICON_ERRORS = [];

for (const [concept, byLang] of Object.entries(LEXICON)) {
  const set = new Set();
  for (const lang of ['en', 'hi']) {
    for (const w of byLang[lang] || []) {
      const n = normalize(w);
      if (!n || n.includes(' ')) { LEXICON_ERRORS.push(`${concept}.${lang}: "${w}" is not one token`); continue; }
      const s = skel(n);
      set.add(s);
      KNOWN.add(s);
      if (!TOKEN_LANG.has(s)) TOKEN_LANG.set(s, new Set());
      TOKEN_LANG.get(s).add(lang);
    }
  }
  S[concept] = set;
}
const NUM_WORD_MAP = new Map(Object.entries(NUM_WORDS).map(([w, v]) => [normalize(w), v]));
for (const w of NUM_WORD_MAP.keys()) KNOWN.add(skel(w));
KNOWN.add(SEP);

const UNIT_OF = new Map();
for (const [concept, def] of Object.entries(UNIT_DEFS)) for (const s of S[concept]) UNIT_OF.set(s, def);

// Loanwords Hinglish speakers use as-is: they don't decide the reply language.
const NEUTRAL = new Set(['photo', 'pic', 'camera', 'battery', 'status', 'report', 'help', 'left', 'right', 'scoop', 'ok',
  'okay', 'stop', 'robot', 'trashbot', 'bot', 'mode', 'update', 'check', 'test', 'start', 'reset', 'error', 'problem',
  'health', 'total', 'score', 'speed', 'emergency', 'estop', 'sofa', 'bed', 'table', 'kitchen', 'please', 'plz', 'pls',
  'sir', 'bro', 'uturn', 'u', 'e', 'fast', 'slow', 'command', 'commands', 'dustbin', 'bin'].map((w) => skel(w)));
const UNIT_CONCEPTS = Object.keys(UNIT_DEFS);

const SAFETY_CONCEPTS = ['stop', 'estop', 'basAlone', 'negation', 'softNa', 'yes', 'no', 'separator'];
const EASY = new Set([...S.filler, ...S.imperative]); // ignorable words

const isLatin = (t) => /^[a-z]+$/.test(t);
const STOP_FUZZY = [...S.stop].filter((t) => isLatin(t) && t.length >= 4);
const NEG_FUZZY = [...S.negation].filter((t) => isLatin(t) && t.length >= 4);
const CONTENT_CONCEPTS = ['cleanWord', 'trashNoun', 'pickupVerb', 'start', 'report', 'status', 'health', 'battery',
  'mistakes', 'photo', 'langEn', 'langHi', 'help', 'forward', 'back', 'left', 'right', 'uturn', 'turnVerb', 'moveVerb',
  'wapas', 'scoopNoun', 'tipWord', 'scoopDown', 'scoopUp', 'scoopTip', 'scoopCycle', 'qtySmall', 'qtyLarge', 'qtyFull',
  'speedSlow', 'speedFast', 'repeat', 'keepWord', 'location', 'locationNoun'];
const SAFETY_TOKENS = new Set(['stop', 'estop', 'basAlone', 'negation', 'softNa', 'yes', 'no'].flatMap((c) => [...S[c]]));
const FUZZY_TARGETS = [...new Set(CONTENT_CONCEPTS.flatMap((c) => [...S[c]]))]
  .filter((t) => isLatin(t) && t.length >= 3 && !EASY.has(t) && !SAFETY_TOKENS.has(t));
// Words that may follow a softening "na" ("chalo na jaldi", "karo na yaar").
const SOFT_OK = new Set([...EASY, ...S.speedSlow, ...S.speedFast, ...S.qtySmall, ...S.qtyLarge, ...S.yes]);

/** Damerau-Levenshtein (optimal string alignment) with an early cut-off. */
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

const isNumberTok = (t) => /^\d+(\.\d+)?$/.test(t);
const isUnknown = (t) => !KNOWN.has(t.sk) && !isNumberTok(t.sk) && !NUM_WORD_MAP.has(t.raw);

function nearOne(t, targets, max) {
  let best = null;
  let bestD = max + 1;
  for (const c of targets) {
    const dd = editDistance(t, c, max);
    if (dd < bestD) { bestD = dd; best = c; }
  }
  return bestD <= max ? best : null;
}

function nearAll(t, targets, max) {
  let bestD = max + 1;
  let out = [];
  for (const c of targets) {
    const dd = editDistance(t, c, max);
    if (dd < bestD) { bestD = dd; out = [c]; } else if (dd === bestD) out.push(c);
  }
  return bestD <= max ? out : [];
}

function isFuzzyStop(tok) {
  return isUnknown(tok) && isLatin(tok.sk) && tok.sk.length >= 4 && nearOne(tok.sk, STOP_FUZZY, 1) !== null;
}

function negationInfo(toks) {
  let neg = false;
  let fuzzy = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (S.negation.has(t.sk)) { neg = true; continue; }
    if (S.softNa.has(t.sk)) {
      const rest = toks.slice(i + 1);
      if (!rest.every((x) => SOFT_OK.has(x.sk))) neg = true;
      continue;
    }
    if (isUnknown(t) && isLatin(t.sk) && t.sk.length >= 4 && nearOne(t.sk, NEG_FUZZY, 1) !== null) { neg = true; fuzzy = true; }
  }
  return { neg, fuzzy };
}

function detectLang(toks, opts) {
  if (opts.lang === 'en' || opts.lang === 'hi') return opts.lang;
  let hi = 0;
  let en = 0;
  for (const t of toks) {
    if (/[ऀ-ॿ]/.test(t.sk)) { hi++; continue; }
    if (NEUTRAL.has(t.sk) || UNIT_OF.has(t.sk)) continue;
    const l = TOKEN_LANG.get(t.sk);
    if (!l) continue;
    if (l.has('hi') && !l.has('en')) hi++;
    else if (l.has('en') && !l.has('hi')) en++;
  }
  if (hi > 0) return 'hi';
  if (en > 0) return 'en';
  return opts.lastLang === 'en' ? 'en' : 'hi';
}

// ---------------------------------------------------------------------------
// Steps and parameter sanitising (also used for aliases and pending answers)
// ---------------------------------------------------------------------------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mkStep = (intent, params = {}) => ({ intent, params });

function speedFrom(params) {
  const v = Number(params?.speed);
  return Number.isFinite(v) ? clamp(Math.round(v), LIMITS.speed.min, LIMITS.speed.max) : LIMITS.speed.normal;
}

/** Validate + clamp one step. Returns a clean copy or null. */
export function sanitizeStep(step, allowed = INTENT_SET) {
  if (!step || typeof step !== 'object' || !INTENT_SET.has(step.intent) || !allowed.has(step.intent)) return null;
  const p = step.params && typeof step.params === 'object' ? step.params : {};
  switch (step.intent) {
    case 'MOVE': {
      if (p.direction !== 'forward' && p.direction !== 'back') return null;
      const d = Number(p.distance_cm);
      if (!Number.isFinite(d) || d <= 0) return null;
      const max = p.direction === 'forward' ? LIMITS.move.maxForwardCm : LIMITS.move.maxBackCm;
      return mkStep('MOVE', { direction: p.direction, distance_cm: clamp(Math.round(d), 1, max), speed: speedFrom(p) });
    }
    case 'TURN': {
      if (p.direction !== 'left' && p.direction !== 'right') return null;
      const g = Number(p.degrees);
      if (!Number.isFinite(g) || g <= 0) return null;
      return mkStep('TURN', { direction: p.direction, degrees: clamp(Math.round(g), 1, LIMITS.turn.maxDeg), speed: speedFrom(p) });
    }
    case 'SCOOP':
      return ['down', 'carry', 'tip', 'cycle'].includes(p.action) ? mkStep('SCOOP', { action: p.action }) : null;
    case 'CLEAN': {
      const it = Number(p.max_items ?? LIMITS.clean.defaultItems);
      const ts = Number(p.max_time_s ?? LIMITS.clean.defaultTimeS);
      if (!Number.isFinite(it) || !Number.isFinite(ts)) return null;
      return mkStep('CLEAN', {
        max_items: clamp(Math.round(it), 1, LIMITS.clean.maxItems),
        max_time_s: clamp(Math.round(ts), LIMITS.clean.minTimeS, LIMITS.clean.maxTimeS),
      });
    }
    case 'LANG':
      return p.lang === 'en' || p.lang === 'hi' ? mkStep('LANG', { lang: p.lang }) : null;
    default:
      return mkStep(step.intent, {});
  }
}

function sanitizeSteps(steps, allowed = INTENT_SET) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const out = [];
  for (const s of steps) {
    const c = sanitizeStep(s, allowed);
    if (!c) return null;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Quantities: numbers + units
// ---------------------------------------------------------------------------
function extractQuantities(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const next = toks[i + 1];
    const unit = next ? UNIT_OF.get(next.sk) || null : null;
    let v = null;
    if (isNumberTok(t.sk)) v = parseFloat(t.sk);
    else if (NUM_WORD_MAP.has(t.raw) && unit) v = NUM_WORD_MAP.get(t.raw);
    if (v !== null && Number.isFinite(v)) {
      out.push({ value: v, unit, idx: i });
      if (unit) i++;
      continue;
    }
    // A round unit on its own ("chakkar lagao") means one round.
    const own = UNIT_OF.get(t.sk);
    if (own && own.round && !(i > 0 && (isNumberTok(toks[i - 1].sk) || NUM_WORD_MAP.has(toks[i - 1].raw)))) {
      out.push({ value: 1, unit: own, idx: i });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Segment parser (one command, no "phir/then")
// ---------------------------------------------------------------------------
const INFO_ORDER = ['HELP', 'LANG', 'BATTERY', 'REPORT', 'MISTAKES', 'HEALTH', 'STATUS', 'PHOTO'];

function detectInfo(H, toks) {
  const firstIs = (w) => toks.some((t) => t.sk === skel(w));
  if (H('help') || (H('useWord') && (firstIs('kaise') || firstIs('how')))) return { step: mkStep('HELP'), consumes: ['useWord'] };
  if (H('langEn') && !H('langHi')) return { step: mkStep('LANG', { lang: 'en' }), consumes: [] };
  if (H('langHi') && !H('langEn')) return { step: mkStep('LANG', { lang: 'hi' }), consumes: [] };
  if (H('battery')) return { step: mkStep('BATTERY'), consumes: ['countQ'] };
  const cleanish = H('trashNoun') || H('collectedWord') || H('unitItems') || H('pickupVerb') || H('cleanWord');
  if (H('report') || (H('countQ') && cleanish)) {
    return { step: mkStep('REPORT'), consumes: ['countQ', 'trashNoun', 'collectedWord', 'unitItems', 'pickupVerb', 'cleanWord', 'pastWord', 'isWord'] };
  }
  if (H('mistakes')) {
    return { step: mkStep('MISTAKES'), consumes: ['trashNoun', 'collectedWord', 'pickupVerb', 'cleanWord', 'negation', 'softNa', 'pastWord', 'status', 'isWord'] };
  }
  if (H('health')) return { step: mkStep('HEALTH'), consumes: [] };
  if (H('status')) return { step: mkStep('STATUS'), consumes: [] };
  if (H('photo')) return { step: mkStep('PHOTO'), consumes: ['trashNoun'] };
  return null;
}

function turnStep(H, qty, notes, vars) {
  const dirL = H('left');
  const dirR = H('right');
  const direction = dirR && !dirL ? 'right' : 'left';
  const degQ = qty.filter((q) => q.unit && q.unit.family === 'deg');
  const bare = qty.filter((q) => !q.unit);
  let deg;
  if (degQ.length) deg = degQ[0].value * degQ[0].unit.factor;
  else if (bare.length) deg = bare[0].value;
  else if (H('uturn')) deg = LIMITS.turn.uturnDeg;
  else if (H('qtyFull')) deg = dirL || dirR ? LIMITS.turn.largeDeg : LIMITS.turn.uturnDeg;
  else if (H('qtySmall')) deg = LIMITS.turn.smallDeg;
  else if (H('qtyLarge')) deg = LIMITS.turn.largeDeg;
  else deg = LIMITS.turn.defaultDeg;
  if (degQ.length + bare.length > 1) notes.push('multiple_numbers');
  deg = Math.round(deg);
  if (deg <= 0) return null;
  if (deg > LIMITS.turn.maxDeg) {
    notes.push('clamped');
    vars.clamp = { asked: deg, max: LIMITS.turn.maxDeg, unit: 'deg' };
    deg = LIMITS.turn.maxDeg;
  }
  return mkStep('TURN', { direction, degrees: deg, speed: speedWord(H) });
}

function moveStep(H, qty, notes, vars) {
  const direction = H('forward') && !H('back') ? 'forward' : 'back';
  const lenQ = qty.filter((q) => q.unit && q.unit.family === 'len');
  const bare = qty.filter((q) => !q.unit);
  let cm;
  if (lenQ.length) cm = lenQ[0].value * lenQ[0].unit.factor;
  else if (bare.length) cm = bare[0].value;
  else if (H('qtySmall')) cm = LIMITS.move.smallCm;
  else if (H('qtyLarge') || H('qtyFull')) cm = LIMITS.move.largeCm;
  else cm = LIMITS.move.defaultCm;
  if (lenQ.length + bare.length > 1) notes.push('multiple_numbers');
  cm = Math.round(cm);
  if (cm <= 0) return null;
  const max = direction === 'forward' ? LIMITS.move.maxForwardCm : LIMITS.move.maxBackCm;
  if (cm > max) {
    notes.push('clamped');
    vars.clamp = { asked: cm, max, unit: 'cm' };
    cm = max;
  }
  if (direction === 'back') notes.push('back_no_sensor');
  return mkStep('MOVE', { direction, distance_cm: cm, speed: speedWord(H) });
}

function speedWord(H) {
  if (H('speedSlow')) return LIMITS.speed.slow;
  if (H('speedFast')) return LIMITS.speed.fast;
  return LIMITS.speed.normal;
}

function cleanStep(H, qty, notes, vars) {
  const itemsQ = qty.filter((q) => q.unit && q.unit.family === 'items');
  const timeQ = qty.filter((q) => q.unit && q.unit.family === 'time');
  const bare = qty.filter((q) => !q.unit);
  let items = itemsQ.length ? itemsQ[0].value : bare.length ? bare[0].value : LIMITS.clean.defaultItems;
  let secs = timeQ.length ? timeQ[0].value * timeQ[0].unit.factor : LIMITS.clean.defaultTimeS;
  items = Math.round(items);
  secs = Math.round(secs);
  if (items <= 0 || secs <= 0) return null;
  if (items > LIMITS.clean.maxItems) {
    notes.push('clamped');
    vars.clamp = { asked: items, max: LIMITS.clean.maxItems, unit: 'items' };
    items = LIMITS.clean.maxItems;
  }
  if (secs > LIMITS.clean.maxTimeS) {
    notes.push('clamped');
    vars.clamp = { asked: secs, max: LIMITS.clean.maxTimeS, unit: 's' };
    secs = LIMITS.clean.maxTimeS;
  }
  secs = Math.max(secs, LIMITS.clean.minTimeS);
  if (H('location') || H('locationNoun')) notes.push('location_ignored');
  return mkStep('CLEAN', { max_items: items, max_time_s: secs });
}

/**
 * Detect an action (motion) in the segment. Returns null when there is none.
 * Result: { kind, steps?, suggestions?, replyKey? }
 */
function detectAction(H, toks, qty, notes, vars) {
  const cleanish = H('cleanWord') || H('trashNoun') || H('pickupVerb');
  const dirMove = H('forward') || H('back');
  const hasRound = qty.some((q) => q.unit && q.unit.round);
  const dirTurn = H('left') || H('right') || H('uturn') || hasRound;

  // Statements such as "saaf hai" / "kachra reh gaya" / "floor is clean" => no motion.
  // English imperatives start with the verb ("clean it, the floor is dirty"); Hindi puts it at the end.
  const firstIsCleanVerb = toks.length > 0 && (S.cleanWord.has(toks[0].sk) || S.pickupVerb.has(toks[0].sk)) &&
    (TOKEN_LANG.get(toks[0].sk) || new Set()).has('en');
  if ((H('isWord') || H('pastWord')) && cleanish && !H('imperative') && !H('pickupVerb') && !firstIsCleanVerb && !dirMove && !dirTurn) {
    return { kind: 'info', replyKey: 'statement_noted' };
  }

  // Scoop commands need the word "scoop" (or tip/dump) so "palat jao" stays a turn.
  if (H('scoopNoun') || H('tipWord')) {
    const acts = [];
    if (H('scoopTip') || H('tipWord') || (H('scoopNoun') && H('uturn'))) acts.push('tip');
    if (H('scoopDown')) acts.push('down');
    if (H('scoopUp')) acts.push('carry');
    if (H('scoopCycle')) acts.push('cycle');
    const uniq = [...new Set(acts)];
    if (uniq.length > 1) return { kind: 'clarify', suggestions: uniq.map((a) => [mkStep('SCOOP', { action: a })]) };
    if (uniq.length === 1) return { kind: 'command', steps: [mkStep('SCOOP', { action: uniq[0] })] };
    if (!cleanish) return { kind: 'command', steps: [mkStep('SCOOP', { action: 'cycle' })] };
  }

  const turnS = () => turnStep(H, qty, notes, vars);
  const moveS = () => moveStep(H, qty, notes, vars);

  if (cleanish && (dirMove || dirTurn)) {
    const other = dirTurn ? turnS() : moveS();
    const c = cleanStep(H, qty.filter((q) => !q.unit || q.unit.family === 'items' || q.unit.family === 'time'), [], {});
    return { kind: 'clarify', suggestions: [[c], [other]].filter((s) => s[0]) };
  }
  if (cleanish) {
    const c = cleanStep(H, qty, notes, vars);
    return c ? { kind: 'command', steps: [c] } : null;
  }

  if (dirTurn && dirMove) {
    const tq = qty.filter((q) => !q.unit || q.unit.family === 'deg');
    const mq = qty.filter((q) => q.unit && q.unit.family === 'len');
    const t = turnStep(H, tq.length > 1 ? tq.slice(0, 1) : tq, [], {});
    const m = moveStep(H, mq, [], {});
    const firstTurn = toks.findIndex((x) => S.left.has(x.sk) || S.right.has(x.sk) || S.uturn.has(x.sk));
    const firstMove = toks.findIndex((x) => S.forward.has(x.sk) || S.back.has(x.sk));
    const seq = firstTurn <= firstMove ? [t, m] : [m, t];
    return { kind: 'clarify', suggestions: [[t], [m], seq].filter((s) => s.every(Boolean)) };
  }
  if (H('left') && H('right')) {
    const l = mkStep('TURN', { direction: 'left', degrees: LIMITS.turn.defaultDeg, speed: speedWord(H) });
    const r = mkStep('TURN', { direction: 'right', degrees: LIMITS.turn.defaultDeg, speed: speedWord(H) });
    return { kind: 'clarify', suggestions: [[l], [r]] };
  }
  if (H('forward') && H('back')) {
    return {
      kind: 'clarify',
      suggestions: [
        [mkStep('MOVE', { direction: 'forward', distance_cm: LIMITS.move.defaultCm, speed: speedWord(H) })],
        [mkStep('MOVE', { direction: 'back', distance_cm: LIMITS.move.defaultCm, speed: speedWord(H) })],
      ],
    };
  }
  const place = H('location') || H('locationNoun');
  if (place && (dirTurn || dirMove)) notes.push('location_ignored');
  if (dirTurn) {
    const lenQ = qty.filter((q) => q.unit && q.unit.family === 'len');
    if (lenQ.length && (H('left') || H('right'))) {
      // "left 20 cm" on a two-wheel robot = turn 90°, then drive.
      const dir = H('right') ? 'right' : 'left';
      const t90 = mkStep('TURN', { direction: dir, degrees: LIMITS.turn.largeDeg, speed: speedWord(H) });
      const fwd = sanitizeStep(mkStep('MOVE', { direction: 'forward', distance_cm: lenQ[0].value * lenQ[0].unit.factor, speed: speedWord(H) }));
      const tDef = mkStep('TURN', { direction: dir, degrees: LIMITS.turn.defaultDeg, speed: speedWord(H) });
      return { kind: 'clarify', suggestions: [[t90, fwd], [tDef]].filter((s) => s.every(Boolean)) };
    }
    const t = turnS();
    return t ? { kind: 'command', steps: [t] } : { kind: 'unknown', replyKey: 'bad_number' };
  }
  if (dirMove) {
    const m = moveS();
    return m ? { kind: 'command', steps: [m] } : { kind: 'unknown', replyKey: 'bad_number' };
  }
  if (H('turnVerb')) {
    if (H('qtyFull')) {
      return { kind: 'command', steps: [mkStep('TURN', { direction: 'left', degrees: LIMITS.turn.uturnDeg, speed: speedWord(H) })] };
    }
    const degQ = qty.filter((q) => !q.unit || q.unit.family === 'deg');
    const g = degQ.length ? Math.round(degQ[0].value * (degQ[0].unit ? degQ[0].unit.factor : 1)) : LIMITS.turn.defaultDeg;
    const d = clamp(g > 0 ? g : LIMITS.turn.defaultDeg, 1, LIMITS.turn.maxDeg);
    return {
      kind: 'clarify',
      replyKey: 'clarify_turn',
      suggestions: [
        [mkStep('TURN', { direction: 'left', degrees: d, speed: speedWord(H) })],
        [mkStep('TURN', { direction: 'right', degrees: d, speed: speedWord(H) })],
      ],
    };
  }
  if (H('wapas')) {
    return {
      kind: 'clarify',
      suggestions: [
        [mkStep('MOVE', { direction: 'back', distance_cm: LIMITS.move.defaultCm, speed: speedWord(H) })],
        [mkStep('TURN', { direction: 'left', degrees: LIMITS.turn.uturnDeg, speed: speedWord(H) })],
      ],
    };
  }
  if (H('moveVerb') && place) return { kind: 'info', replyKey: 'cant_navigate' };
  if (H('moveVerb')) {
    const lenQ = qty.filter((q) => !q.unit || q.unit.family === 'len');
    const cm = lenQ.length ? Math.round(lenQ[0].value * (lenQ[0].unit ? lenQ[0].unit.factor : 1)) : LIMITS.move.defaultCm;
    const f = sanitizeStep(mkStep('MOVE', { direction: 'forward', distance_cm: cm > 0 ? cm : LIMITS.move.defaultCm, speed: speedWord(H) }));
    const b = sanitizeStep(mkStep('MOVE', { direction: 'back', distance_cm: cm > 0 ? cm : LIMITS.move.defaultCm, speed: speedWord(H) }));
    return { kind: 'clarify', replyKey: 'clarify_move', suggestions: [[f], [b]] };
  }
  if (H('start')) {
    const c = cleanStep(H, qty, notes, vars);
    return c ? { kind: 'confirm', suggestions: [[c]], replyKey: 'confirm_clean' } : { kind: 'unknown', replyKey: 'bad_number' };
  }
  return null;
}

function parseSegment(toks, ctx) {
  const notes = [];
  const vars = {};
  const unknownWords = toks.filter(isUnknown).map((t) => t.raw);
  const baseH = (c) => toks.some((t) => S[c].has(t.sk));
  const info = detectInfo(baseH, toks);
  const consumed = new Set(info ? info.consumes : []);
  const H = (c) => !consumed.has(c) && baseH(c);
  const qty = extractQuantities(toks);
  if (qty.some((q) => q.unit && q.unit.family === 'times')) notes.push('times_ignored');
  const rawNeg = negationInfo(toks);
  const neg = consumed.has('negation') ? { neg: false, fuzzy: false } : rawNeg;
  const res = (o) => ({ steps: [], suggestions: [], notes, vars, unknownWords, ...o, replyKey: o.replyKey || (o.kind === 'command' ? 'doing' : o.kind) });

  const pointer = H('pointer');
  const motionWords = H('forward') || H('back') || H('left') || H('right') || H('uturn') || H('turnVerb') || H('moveVerb') ||
    H('scoopNoun') || H('tipWord') || H('unitRound') || H('wapas');

  // 1) Corrections — they also stop the robot (it may be chasing that object).
  if (!info) {
    const keep =
      (H('trashNoun') && neg.neg && !H('pickupVerb') && !motionWords) ||
      (pointer && H('keepWord')) ||
      (pointer && neg.neg && (H('pickupVerb') || H('cleanWord')));
    if (keep) return res({ kind: 'command', steps: [mkStep('STOP'), mkStep('MARK_KEEP')], replyKey: 'mark_keep' });
    if (pointer && H('trashNoun') && H('isWord') && !neg.neg && !motionWords && !H('pickupVerb') && !H('cleanWord')) {
      return res({ kind: 'command', steps: [mkStep('MARK_TRASH')], replyKey: 'mark_trash' });
    }
  }

  // 2) Negation + any action word => STOP (never motion).
  const actionWords = motionWords || H('cleanWord') || H('pickupVerb') || H('start') || H('repeat') || H('wapas');
  if (rawNeg.neg && actionWords) {
    if (rawNeg.fuzzy) notes.push('fuzzy_negation');
    return res({ kind: 'command', steps: [mkStep('STOP')], replyKey: 'negation_stop' });
  }
  if (neg.neg && info) return res({ kind: 'info', replyKey: 'ok_not_doing' });
  // Negation with nothing actionable ("nah 20 cm") => never suggest motion.
  if (neg.neg) return res({ kind: 'info', replyKey: 'ok_not_doing' });

  // 3) Action detection (ignores words the info intent consumed).
  const action = detectAction(H, toks, qty, notes, vars);

  if (info && action && (action.kind === 'command' || action.kind === 'confirm' || action.kind === 'clarify')) {
    const actOptions = action.kind === 'clarify' ? action.suggestions : action.kind === 'confirm' ? action.suggestions : [action.steps];
    return res({ kind: 'clarify', suggestions: [[info.step], ...actOptions].slice(0, 4), replyKey: 'clarify' });
  }
  if (info) return res({ kind: 'command', steps: [info.step], replyKey: 'info_ack' });
  if (action) return res({ ...action });

  // 4) Repeat ("dobara", "phir se")
  if (H('repeat')) return res({ kind: 'repeat' });

  // 5) Only a quantity ("20 cm", "90 degree") => ask which way.
  const lenQ = qty.filter((q) => q.unit && q.unit.family === 'len');
  const degQ = qty.filter((q) => q.unit && q.unit.family === 'deg');
  if (lenQ.length === 1 && !degQ.length) {
    const cm = lenQ[0].value * lenQ[0].unit.factor;
    const f = sanitizeStep(mkStep('MOVE', { direction: 'forward', distance_cm: cm, speed: LIMITS.speed.normal }));
    const b = sanitizeStep(mkStep('MOVE', { direction: 'back', distance_cm: cm, speed: LIMITS.speed.normal }));
    if (f && b) return res({ kind: 'clarify', suggestions: [[f], [b]], replyKey: 'clarify_move' });
  }
  if (degQ.length === 1 && !lenQ.length) {
    const g = degQ[0].value * degQ[0].unit.factor;
    const l = sanitizeStep(mkStep('TURN', { direction: 'left', degrees: g, speed: LIMITS.speed.normal }));
    const r = sanitizeStep(mkStep('TURN', { direction: 'right', degrees: g, speed: LIMITS.speed.normal }));
    if (l && r) return res({ kind: 'clarify', suggestions: [[l], [r]], replyKey: 'clarify_turn' });
  }

  // 6) Unknown → maybe a typo. Suggest (never execute) the corrected command.
  if (!ctx.noFuzzy && unknownWords.length) {
    const idx = toks.findIndex((t) => isUnknown(t) && isLatin(t.sk) && t.sk.length >= 3);
    if (idx >= 0) {
      const t0 = toks[idx];
      const cands = nearAll(t0.sk, FUZZY_TARGETS, t0.sk.length >= 6 ? 2 : 1).slice(0, 6);
      const found = [];
      const seen = new Set();
      for (const c of cands) {
        const fixed = toks.map((t, i) => (i === idx ? { raw: c, sk: c } : t));
        const again = parseSegment(fixed, { ...ctx, noFuzzy: true });
        const opts = again.kind === 'command' ? [again.steps] : again.kind === 'confirm' || again.kind === 'clarify' ? again.suggestions : [];
        for (const o of opts) {
          if (!o.length || o.some((s) => s.intent === 'STOP' || s.intent === 'ESTOP' || s.intent === 'MARK_KEEP')) continue;
          const k = JSON.stringify(o);
          if (!seen.has(k)) { seen.add(k); found.push(o); }
        }
      }
      if (found.length) {
        return res({ kind: 'clarify', suggestions: found.slice(0, 3), replyKey: 'did_you_mean', notes: [...notes, 'did_you_mean'] });
      }
    }
  }
  return res({ kind: 'unknown', replyKey: 'unknown' });
}

// ---------------------------------------------------------------------------
// Public: parseCommand
// ---------------------------------------------------------------------------
function coreKey(toks) {
  return toks.filter((t) => !EASY.has(t.sk) && !S.softNa.has(t.sk)).map((t) => t.sk).join(' ');
}

function globalSafety(toks) {
  const has = (c) => toks.some((t) => S[c].has(t.sk));
  if (has('estop')) {
    if (has('reset') && !negationInfo(toks).neg) {
      return { kind: 'confirm', suggestions: [[mkStep('ESTOP_RESET')]], replyKey: 'confirm_estop_reset', notes: [] };
    }
    return { kind: 'command', steps: [mkStep('ESTOP')], replyKey: 'estop', notes: [] };
  }
  if (has('stop')) return { kind: 'command', steps: [mkStep('STOP')], replyKey: 'stop', notes: [] };
  if (has('basAlone') && toks.every((t) => S.basAlone.has(t.sk) || EASY.has(t.sk) || S.pastWord.has(t.sk) || S.softNa.has(t.sk))) {
    return { kind: 'command', steps: [mkStep('STOP')], replyKey: 'stop', notes: [] };
  }
  const fz = toks.find(isFuzzyStop);
  if (fz) return { kind: 'command', steps: [mkStep('STOP')], replyKey: 'stop', notes: ['fuzzy_stop'], vars: { word: fz.raw } };
  return null;
}

function splitSegments(toks) {
  const segs = [];
  let cur = [];
  for (const t of toks) {
    if (t.sk === SEP || S.separator.has(t.sk)) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push(t);
  }
  if (cur.length) segs.push(cur);
  return segs;
}

function isQuestion(raw, toks) {
  if (/[?？]/.test(raw)) return true;
  if (toks.length && S.qStart.has(toks[0].sk)) return true;
  return toks.some((t) => S.qModal.has(t.sk));
}

function gateMotion(r, ctx) {
  if (r.kind !== 'command' || !r.steps.some((s) => MOTION.has(s.intent))) return r;
  const reasons = [];
  if (r.unknownWords && r.unknownWords.length) reasons.push('unknown_words');
  if (ctx.question) reasons.push('question');
  if (r.notes.includes('location_ignored')) reasons.push('location');
  if (r.notes.includes('multiple_numbers')) reasons.push('numbers');
  if (!reasons.length) return r;
  return { ...r, kind: 'confirm', suggestions: [r.steps], steps: [], replyKey: 'confirm', notes: [...r.notes, ...reasons.map((x) => `ask_${x}`)] };
}

/**
 * Parse one message. Never throws (see parseCommandStrict for the throwing version used in tests).
 * @param {string} text
 * @param {object} [opts] { lang: 'auto'|'en'|'hi', lastLang, aliases, pending: {suggestions, at}, now, lastSteps }
 */
export function parseCommand(text, opts = {}) {
  try {
    return parseCommandStrict(text, opts);
  } catch (e) {
    const lang = opts && (opts.lang === 'en' || opts.lang === 'hi') ? opts.lang : 'hi';
    return finish({ kind: 'unknown', replyKey: 'unknown', notes: ['internal_error'] }, lang, []);
  }
}

export function parseCommandStrict(text, opts = {}) {
  opts = opts && typeof opts === 'object' ? opts : {};
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const raw = typeof text === 'string' ? text : String(text ?? '');
  const toks = lexTokens(raw);
  const lang = detectLang(toks, opts);
  const done = (o) => finish(o, lang, toks);

  if (toks.length === 0) return done({ kind: 'empty', replyKey: 'empty' });

  // S1 — safety words win over everything, including pending questions and aliases.
  const g = globalSafety(toks);
  if (g) return done(g);

  // Answers to a pending confirm/clarify.
  const onlyOf = (sets) => toks.every((t) => EASY.has(t.sk) || sets.some((c) => S[c].has(t.sk))) && toks.some((t) => sets.some((c) => S[c].has(t.sk)));
  const onlyYes = onlyOf(['yes']);
  const onlyNo = onlyOf(['no', 'negation', 'softNa']);
  const pending = opts.pending && Array.isArray(opts.pending.suggestions) ? opts.pending : null;
  const fresh = pending && Number.isFinite(pending.at) && now - pending.at >= 0 && now - pending.at <= LIMITS.pendingTtlMs;
  if (pending && fresh) {
    // "2" / "doosra" / "option 2" picks that option.
    const content = toks.filter((t) => !EASY.has(t.sk) && !PICK_FILLER.has(t.raw));
    if (content.length === 1) {
      const k = isNumberTok(content[0].sk) ? Number(content[0].sk) : ORDINALS[content[0].raw];
      if (Number.isInteger(k) && k >= 1 && k <= pending.suggestions.length) {
        const steps = sanitizeSteps(pending.suggestions[k - 1]);
        if (steps) return done({ kind: 'command', steps, replyKey: 'doing', notes: ['confirmed', 'picked'] });
      }
    }
    if (onlyYes) {
      if (pending.suggestions.length === 1) {
        const steps = sanitizeSteps(pending.suggestions[0]);
        if (steps) return done({ kind: 'command', steps, replyKey: 'doing', notes: ['confirmed'] });
      }
      return done({ kind: 'clarify', suggestions: pending.suggestions.map((s) => sanitizeSteps(s)).filter(Boolean), replyKey: 'pick_one' });
    }
    if (onlyNo) return done({ kind: 'cancelled', replyKey: 'cancelled' });
  } else if (onlyYes) {
    if (!pending && isQuestion(raw, toks)) return done({ kind: 'command', steps: [mkStep('STATUS')], replyKey: 'info_ack' });
    return done({ kind: 'info', replyKey: pending ? 'confirm_expired' : 'no_pending' });
  }
  // "nahi nahi" / "cancel" with nothing pending => stop (fail-safe).
  if (onlyNo) return done({ kind: 'command', steps: [mkStep('STOP')], replyKey: 'stop', notes: ['no_word_stop'] });

  const ctx = { question: isQuestion(raw, toks), noFuzzy: false };

  // Learned phrases (after safety words; their validation forbids safety words anyway).
  if (Array.isArray(opts.aliases) && opts.aliases.length) {
    const key = coreKey(toks);
    if (key) {
      for (const a of opts.aliases) {
        if (!a || typeof a.phrase !== 'string') continue;
        if (coreKey(lexTokens(a.phrase)) !== key) continue;
        const steps = sanitizeSteps(a.steps, ALIAS_ALLOWED);
        if (!steps) continue;
        const r = gateMotion({ kind: 'command', steps, replyKey: 'doing', notes: ['alias'], vars: { phrase: a.phrase }, unknownWords: [] }, ctx);
        return done(r);
      }
    }
  }

  const segs = splitSegments(toks);
  if (segs.length === 0) return done({ kind: 'unknown', replyKey: 'unknown' });
  if (segs.length > LIMITS.sequenceMaxSteps) {
    return done({ kind: 'info', replyKey: 'sequence_too_long', vars: { max: LIMITS.sequenceMaxSteps } });
  }

  const parts = segs.map((s) => parseSegment(s, ctx));

  if (parts.length === 1) {
    const p = parts[0];
    if (p.kind === 'repeat') {
      const last = sanitizeSteps(opts.lastSteps || []);
      const rep = last && last.every((s) => REPEATABLE.has(s.intent)) ? last : null;
      if (!rep) return done({ kind: 'info', replyKey: 'repeat_nothing' });
      return done(gateMotion({ kind: 'command', steps: rep, replyKey: 'doing', notes: ['repeat'], unknownWords: p.unknownWords }, ctx));
    }
    return done(gateMotion(p, ctx));
  }

  // Sequences ("20 cm aage phir left ghumo"): all parts must be clear, or nothing runs.
  const stopPart = parts.find((p) => p.kind === 'command' && p.steps.some((s) => s.intent === 'STOP'));
  if (stopPart) return done(stopPart);
  const badIdx = parts.findIndex((p) => p.kind !== 'command' && p.kind !== 'confirm');
  if (badIdx >= 0) {
    return done({ kind: 'unknown', replyKey: 'sequence_part_unclear', vars: { part: badIdx + 1 }, unknownWords: parts[badIdx].unknownWords });
  }
  const steps = [];
  let needConfirm = false;
  const notes = [];
  const unknownWords = [];
  for (const p of parts) {
    const ps = p.kind === 'confirm' ? p.suggestions[0] : p.steps;
    if (p.kind === 'confirm') needConfirm = true;
    steps.push(...ps);
    notes.push(...p.notes);
    unknownWords.push(...p.unknownWords);
  }
  if (!steps.every((s) => CHAINABLE.has(s.intent))) return done({ kind: 'info', replyKey: 'sequence_not_allowed' });
  if (steps.length > LIMITS.sequenceMaxSteps) {
    return done({ kind: 'info', replyKey: 'sequence_too_long', vars: { max: LIMITS.sequenceMaxSteps } });
  }
  const combined = { kind: 'command', steps, replyKey: 'doing', notes: [...new Set(notes), 'sequence'], unknownWords, vars: {} };
  const gated = gateMotion(combined, ctx);
  if (needConfirm && gated.kind === 'command') {
    return done({ ...gated, kind: 'confirm', suggestions: [steps], steps: [], replyKey: 'confirm' });
  }
  return done(gated);
}

function finish(o, lang, toks) {
  // Defence in depth: drop any option that contains an invalid step.
  const okList = (l) => Array.isArray(l) && l.length > 0 && l.every((x) => x && INTENT_SET.has(x.intent));
  const r = {
    kind: o.kind,
    steps: o.kind === 'command' && okList(o.steps) ? o.steps : [],
    suggestions: o.kind === 'confirm' || o.kind === 'clarify' ? (o.suggestions || []).filter(okList) : [],
    lang,
    reply: { key: o.replyKey || o.kind, vars: o.vars || {} },
    replyText: '',
    notes: [...new Set(o.notes || [])],
    unknownWords: o.unknownWords || [],
    stopFirst: false,
    tokens: toks.map((t) => (t.sk === SEP ? '|' : t.sk)),
  };
  if (r.kind === 'command' && r.steps.length === 0) {
    r.kind = 'unknown';
    r.reply.key = 'unknown';
  }
  if ((r.kind === 'confirm' || r.kind === 'clarify') && r.suggestions.length === 0) {
    r.kind = 'unknown';
    r.reply.key = 'unknown';
  }
  r.stopFirst = r.steps.length > 0 && (r.steps[0].intent === 'STOP' || r.steps[0].intent === 'ESTOP');
  r.replyText = renderReply(r);
  return r;
}

// ---------------------------------------------------------------------------
// API adapter — the exact HTTP calls a step maps to (same for phone UI and agent)
// ---------------------------------------------------------------------------
/**
 * @param {object} step
 * @param {{turnLeftSign?: 1|-1, label?: string}} [opts] turnLeftSign: sign of `degrees` that turns LEFT in the firmware.
 */
export function toApiCalls(step, opts = {}) {
  const s = sanitizeStep(step);
  if (!s) return [];
  const sign = opts.turnLeftSign === -1 ? -1 : 1;
  const p = s.params;
  switch (s.intent) {
    case 'STOP': return [{ method: 'POST', path: '/api/stop' }];
    case 'ESTOP': return [{ method: 'POST', path: '/api/estop' }];
    case 'ESTOP_RESET': return [{ method: 'POST', path: '/api/estop/reset' }];
    case 'CLEAN': return [{ method: 'POST', path: '/api/clean', body: { max_items: p.max_items, max_time_s: p.max_time_s, label: opts.label || 'bolo' } }];
    case 'MOVE': return [{ method: 'POST', path: '/api/move', body: { distance_cm: p.direction === 'forward' ? p.distance_cm : -p.distance_cm, speed: p.speed } }];
    case 'TURN': return [{ method: 'POST', path: '/api/turn', body: { degrees: (p.direction === 'left' ? 1 : -1) * sign * p.degrees, speed: p.speed } }];
    case 'SCOOP': return [{ method: 'POST', path: '/api/scoop', body: { action: p.action } }];
    case 'PHOTO': return [{ method: 'GET', path: '/api/photo' }];
    case 'STATUS':
    case 'BATTERY': return [{ method: 'GET', path: '/api/status' }];
    case 'HEALTH': return [{ method: 'GET', path: '/api/health' }];
    case 'REPORT': return [{ method: 'GET', path: '/api/mission/current' }, { method: 'GET', path: '/api/mission/history' }];
    case 'MISTAKES': return [{ method: 'GET', path: '/api/mistakes' }];
    case 'MARK_KEEP': return [{ method: 'POST', path: '/api/mistakes/flag', body: { note: 'user: not trash (bolo)' } }];
    case 'MARK_TRASH': return [{ method: 'POST', path: '/api/mistakes/flag', body: { note: 'user: this is trash (bolo)' } }];
    default: return []; // HELP, LANG, REPEAT are handled by the caller.
  }
}

// ---------------------------------------------------------------------------
// Aliases ("learned phrases") — confirm-to-learn
// ---------------------------------------------------------------------------
/** Matching key of a phrase: two phrases with the same key are the same alias ("chotu lag jao" = "chotu lag jao bhai"). */
export function aliasKey(phrase) {
  return coreKey(lexTokens(typeof phrase === 'string' ? phrase : ''));
}

export function validateAlias(alias, opts = {}) {
  const fail = (reason) => ({ ok: false, reason });
  const phrase = alias && typeof alias.phrase === 'string' ? alias.phrase.trim().replace(/\s+/g, ' ') : '';
  if (!phrase) return fail('empty');
  if ([...phrase].length > LIMITS.alias.maxPhraseChars) return fail('too_long');
  const toks = lexTokens(phrase);
  if (toks.length === 0) return fail('empty');
  if (toks.length > LIMITS.alias.maxTokens) return fail('too_long');
  if (toks.some((t) => t.sk === SEP || SAFETY_CONCEPTS.some((c) => S[c].has(t.sk))) || globalSafety(toks)) {
    return fail('contains_safety_word');
  }
  if (negationInfo(toks).neg) return fail('contains_safety_word');
  const key = coreKey(toks);
  if (!key) return fail('empty');
  const parsed = parseCommandStrict(phrase, { lang: 'hi' });
  if (parsed.kind === 'command' || parsed.kind === 'info') return fail('already_understood');
  if (!Array.isArray(alias.steps) || alias.steps.length < 1 || alias.steps.length > LIMITS.alias.maxSteps) return fail('bad_steps');
  const steps = [];
  for (const s of alias.steps) {
    if (!s || !ALIAS_ALLOWED.has(s.intent)) return fail('not_allowed');
    const c = sanitizeStep(s, ALIAS_ALLOWED);
    if (!c) return fail('bad_steps');
    steps.push(c);
  }
  const existing = Array.isArray(opts.existing) ? opts.existing : [];
  const replaced = existing.some((a) => a && typeof a.phrase === 'string' && coreKey(lexTokens(a.phrase)) === key);
  if (!replaced && existing.length >= LIMITS.alias.maxCount) return fail('too_many');
  return { ok: true, alias: { phrase, steps }, replaced };
}

// ---------------------------------------------------------------------------
// Replies (English + Hinglish)
// ---------------------------------------------------------------------------
export const I18N = Object.freeze({
  empty: { en: "Type a command, e.g. 'clean the room' or 'stop'.", hi: "Command likho, jaise 'kachra saaf karo' ya 'ruko'." },
  stop: { en: 'Stopping.', hi: 'Ruk gaya.' },
  estop: { en: 'EMERGENCY STOP — motors off. Reset only from the phone app.', hi: 'EMERGENCY STOP — motor band. Reset sirf phone app se hoga.' },
  confirm_estop_reset: { en: 'Clear the emergency stop? Check the area is safe first.', hi: 'Emergency stop hataun? Pehle dekh lo ki aas-paas safe hai.' },
  doing: { en: 'OK: {what}.', hi: 'Theek hai: {what}.' },
  info_ack: { en: 'Checking: {what}…', hi: 'Dekh raha hoon: {what}…' },
  unit_cm: { en: 'cm', hi: 'cm' },
  unit_deg: { en: 'degrees', hi: 'degree' },
  unit_items: { en: 'items', hi: 'kachre' },
  unit_s: { en: 'seconds', hi: 'second' },
  confirm: { en: 'Should I do this: {what}?', hi: 'Kya main ye karun: {what}?' },
  confirm_clean: { en: 'Start cleaning? ({what})', hi: 'Safai shuru karun? ({what})' },
  clarify: { en: 'Not sure what you meant. Pick one:', hi: 'Poora samajh nahi aaya. Inme se chuno:' },
  clarify_move: { en: 'Which way — forward or back?', hi: 'Kidhar jaun — aage ya peeche?' },
  clarify_turn: { en: 'Left or right?', hi: 'Left ya right?' },
  did_you_mean: { en: 'Did you mean:', hi: 'Kya aapka matlab ye tha:' },
  pick_one: { en: 'There are several options — tap one, or type it more clearly.', hi: 'Kai options hain — ek pe tap karo, ya thoda saaf likho.' },
  unknown: { en: "Sorry, I didn't understand. Type 'help' to see commands.", hi: "Maaf karna, samajh nahi aaya. Commands dekhne ke liye 'help' likho." },
  bad_number: { en: "That number doesn't work. Try e.g. 'forward 20 cm'.", hi: "Ye number nahi chalega. Aise likho: '20 cm aage'." },
  cancelled: { en: 'OK, cancelled.', hi: 'Theek hai, cancel.' },
  no_pending: { en: 'Yes to what? Please type the command.', hi: 'Kis baat ka haan? Command likho.' },
  confirm_expired: { en: 'That question expired. Please say it again.', hi: 'Wo sawaal purana ho gaya. Dobara bolo.' },
  negation_stop: { en: "You said 'don't' — so I'm not moving. Stopped.", hi: "Aapne 'mat/nahi' bola — isliye nahi chalunga. Ruk gaya." },
  ok_not_doing: { en: "OK, I won't.", hi: 'Theek hai, nahi karunga.' },
  statement_noted: { en: "Noted. To start cleaning, say 'clean'.", hi: "Theek hai. Safai karwani ho to 'saaf karo' bolo." },
  mark_keep: { en: "Got it — that's NOT trash. Stopped, and noted it so I learn.", hi: 'Samajh gaya — ye kachra NAHI hai. Ruk gaya, aur note kar liya taaki seekh sakun.' },
  mark_trash: { en: "Noted: that is trash. Say 'clean' to pick it up.", hi: "Note kiya: ye kachra hai. Uthane ke liye 'saaf karo' bolo." },
  help: {
    en: "Try: 'clean the room', 'stop', 'forward 20 cm', 'turn left 90', 'take a photo', 'battery', 'report'.",
    hi: "Aise bolo: 'kachra saaf karo', 'ruko', '20 cm aage', '90 left ghumo', 'photo lo', 'battery kitni hai', 'hisaab batao'.",
  },
  lang_set: { en: "OK, I'll reply in English.", hi: 'Theek hai, ab Hinglish me baat karunga.' },
  repeat_nothing: { en: 'Nothing to repeat yet.', hi: 'Abhi dobara karne ko kuch nahi hai.' },
  sequence_too_long: { en: 'Max {max} steps in one command.', hi: 'Ek command me max {max} steps.' },
  sequence_not_allowed: {
    en: "Only move, turn, scoop, photo, status and battery can be chained with 'then'.",
    hi: "'phir' se sirf move, turn, scoop, photo, status aur battery jod sakte ho.",
  },
  sequence_part_unclear: { en: "I didn't understand part {part}. Nothing was done.", hi: 'Part {part} samajh nahi aaya. Kuch nahi kiya.' },
  note_clamped: { en: '(Limit is {max} {unit} per command.)', hi: '(Ek command me max {max} {unit}.)' },
  note_back: { en: '(No rear sensor — reverse is limited.)', hi: '(Peeche sensor nahi hai — isliye reverse kam.)' },
  cant_navigate: {
    en: "I can't go to places by name yet. Say e.g. 'forward 20 cm' or 'turn left'.",
    hi: "Main abhi jagah ke naam se nahi ja sakta. Aise bolo: '20 cm aage' ya 'left ghumo'.",
  },
  note_location_move: { en: "(I can't find places by name — this is just a plain move.)", hi: '(Jagah ka naam nahi pehchanta — ye bas seedha move hai.)' },
  note_location: { en: "I can't find places by name yet — I'll clean from where I am.", hi: 'Main abhi jagah ka naam nahi pehchanta — jahan hoon wahin se saaf karunga.' },
  note_unknown: { en: "Didn't understand: {words}.", hi: 'Ye words samajh nahi aaye: {words}.' },
  note_fuzzy_stop: { en: "(Read '{word}' as stop.)", hi: "('{word}' ko ruko samjha.)" },
  note_alias: { en: "(Learned phrase: '{phrase}')", hi: "(Yaad kiya hua phrase: '{phrase}')" },
  note_times: { en: "(Repeat counts aren't supported — doing it once.)", hi: '(Kitni baar — ye abhi support nahi; ek baar karunga.)' },
  note_numbers: { en: '(I saw more than one number — please check.)', hi: '(Ek se zyada number dikhe — check kar lo.)' },
  status_value: { en: 'State: {state}, mode: {mode}. Clear ahead: {distance} cm.', hi: 'Haal: {state}, mode: {mode}. Aage {distance} cm khali.' },
  status_estop: { en: 'EMERGENCY STOP is active. Reset it from the phone app.', hi: 'EMERGENCY STOP laga hua hai. Phone app se reset karo.' },
  battery_value: { en: 'Battery: {volts} V.', hi: 'Battery: {volts} V.' },
  battery_off: { en: 'Battery monitor is off (not wired).', hi: 'Battery monitor band hai (wire nahi hai).' },
  health_value: { en: 'Health: {overall}.', hi: 'Health: {overall}.' },
  report_value: { en: 'Mission {id}: {collected} collected, {failed} failed, {skipped} skipped.', hi: 'Mission {id}: {collected} uthaye, {failed} fail, {skipped} chhode.' },
  report_none: { en: 'No missions yet.', hi: 'Abhi tak koi mission nahi hua.' },
  mistakes_value: { en: '{count} recent mistakes saved. Open the Mistakes panel to see them.', hi: '{count} recent galtiyan save hain. Mistakes panel me dekho.' },
  mistakes_none: { en: 'No recent mistakes.', hi: 'Abhi koi galti save nahi hai.' },
  photo_value: { en: 'Photo taken. Detections: {count}.', hi: 'Photo le li. Detections: {count}.' },
  err_busy: { en: "I'm busy cleaning. Say 'stop' first.", hi: "Abhi safai chal rahi hai. Pehle 'ruko' bolo." },
  err_estop: { en: 'Emergency stop is active. Reset it from the phone app first.', hi: 'Emergency stop laga hai. Pehle phone app se reset karo.' },
  err_offline: { en: "Can't reach the robot. Is it on and on the same WiFi?", hi: 'Robot se connection nahi hai. Kya wo ON hai aur same WiFi pe hai?' },
  err_unauthorized: { en: 'The robot rejected the token.', hi: 'Robot ne token reject kiya.' },
  err_bad_request: { en: 'The robot rejected that command (out of range).', hi: 'Robot ne command reject kiya (limit se bahar).' },
  err_camera: { en: 'Camera is unavailable right now.', hi: 'Camera abhi available nahi hai.' },
  err_not_supported: { en: "This robot firmware doesn't have that feature yet.", hi: 'Is robot firmware me ye feature abhi nahi hai.' },
  err_readonly: { en: 'Read-only mode: I can look, but not move.', hi: 'Read-only mode: dekh sakta hoon, chal nahi sakta.' },
  dry_run: { en: 'DRY RUN — I would: {what}. The robot will NOT move.', hi: 'DRY RUN — main ye karta: {what}. Robot NAHI chalega.' },
  estop_reset_phone_only: { en: 'For safety, the emergency stop can only be reset from the phone app.', hi: 'Safety ke liye emergency stop sirf phone app se reset hoga.' },
  alias_offer: { en: "Should I remember '{phrase}' for this next time?", hi: "Agli baar ke liye '{phrase}' yaad rakhun?" },
  alias_saved: { en: "Learned: '{phrase}' now means {what}.", hi: "Yaad kar liya: '{phrase}' ka matlab ab {what}." },
  alias_rejected: { en: "Can't learn that phrase: {why}.", hi: 'Ye phrase yaad nahi kar sakta: {why}.' },
  alias_why_empty: { en: 'it is empty', hi: 'phrase khaali hai' },
  alias_why_too_long: { en: 'it is too long', hi: 'phrase bahut lamba hai' },
  alias_why_contains_safety_word: { en: 'it contains a safety word (stop / no / yes)', hi: 'isme safety word hai (ruko / nahi / haan)' },
  alias_why_already_understood: { en: 'I already understand it', hi: 'ye to main pehle se samajhta hoon' },
  alias_why_bad_steps: { en: 'the command is not valid', hi: 'command sahi nahi hai' },
  alias_why_not_allowed: { en: 'that command cannot be learned', hi: 'ye command yaad nahi karwaya ja sakta' },
  alias_why_too_many: { en: 'the list is full (max 50)', hi: 'list full hai (max 50)' },
  alias_unsupported: { en: "The robot firmware doesn't support learned phrases yet.", hi: 'Robot firmware me abhi learned phrases ka support nahi hai.' },
});
export const I18N_KEYS = Object.freeze(Object.keys(I18N));

/** Translate a key with {vars}. Unknown keys return the key itself. */
export function t(key, vars = {}, lang = 'hi') {
  const e = I18N[key];
  if (!e) return key;
  const s = e[lang === 'en' ? 'en' : 'hi'];
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

const SCOOP_TXT = {
  en: { down: 'scoop down', carry: 'scoop up (carry)', tip: 'tip the scoop into the bin', cycle: 'scoop test cycle' },
  hi: { down: 'scoop neeche', carry: 'scoop upar (carry)', tip: 'scoop palat ke dabbe me', cycle: 'scoop test' },
};

/** Short human description of one step. */
export function describeStep(step, lang = 'hi') {
  const L = lang === 'en' ? 'en' : 'hi';
  const p = (step && step.params) || {};
  const sp = p.speed === LIMITS.speed.slow ? (L === 'en' ? ', slowly' : ', dheere') : p.speed === LIMITS.speed.fast ? (L === 'en' ? ', fast' : ', tez') : '';
  const mins = Math.round(((p.max_time_s || 0) / 60) * 10) / 10;
  const txt = {
    MOVE: L === 'en' ? `${p.direction === 'back' ? 'back' : 'forward'} ${p.distance_cm} cm${sp}` : `${p.distance_cm} cm ${p.direction === 'back' ? 'peeche' : 'aage'}${sp}`,
    TURN: p.degrees === 180
      ? (L === 'en' ? `turn around (180° ${p.direction})${sp}` : `palat jao (180° ${p.direction})${sp}`)
      : (L === 'en' ? `turn ${p.direction} ${p.degrees}°${sp}` : `${p.degrees}° ${p.direction} ghumo${sp}`),
    SCOOP: SCOOP_TXT[L][p.action] || 'scoop',
    CLEAN: L === 'en' ? `start cleaning (max ${p.max_items} items, ${mins} min)` : `safai shuru (max ${p.max_items} kachre, ${mins} min)`,
    STOP: L === 'en' ? 'stop' : 'ruko',
    ESTOP: 'EMERGENCY STOP',
    ESTOP_RESET: L === 'en' ? 'reset the emergency stop' : 'emergency stop hatao',
    PHOTO: L === 'en' ? 'take a photo' : 'photo lo',
    STATUS: L === 'en' ? 'show status' : 'haal batao',
    HEALTH: L === 'en' ? 'health check' : 'health check',
    BATTERY: L === 'en' ? 'battery level' : 'battery kitni hai',
    REPORT: L === 'en' ? 'mission report' : 'mission ka hisaab',
    MISTAKES: L === 'en' ? 'recent mistakes' : 'recent galtiyan',
    MARK_KEEP: L === 'en' ? 'mark it as NOT trash' : "'kachra nahi' note karo",
    MARK_TRASH: L === 'en' ? 'mark it as trash' : "'kachra hai' note karo",
    HELP: L === 'en' ? 'show commands' : 'commands dikhao',
    LANG: p.lang === 'en' ? (L === 'en' ? 'reply in English' : 'English me baat') : (L === 'en' ? 'reply in Hinglish' : 'Hinglish me baat'),
    REPEAT: L === 'en' ? 'repeat the last command' : 'pichla command dobara',
  };
  return txt[step && step.intent] || '';
}

export function describeSteps(steps, lang = 'hi') {
  return (steps || []).map((s) => describeStep(s, lang)).join(lang === 'en' ? ', then ' : ', phir ');
}

function renderReply(r) {
  const L = r.lang;
  const v = r.reply.vars || {};
  const extra = [];
  if (r.notes.includes('clamped') && v.clamp) extra.push(t('note_clamped', { max: v.clamp.max, unit: t(`unit_${v.clamp.unit}`, {}, L) }, L));
  if (r.notes.includes('back_no_sensor')) extra.push(t('note_back', {}, L));
  if (r.notes.includes('location_ignored')) {
    const st = r.kind === 'command' ? r.steps : r.suggestions[0] || [];
    extra.push(t(st.some((x) => x.intent === 'CLEAN') ? 'note_location' : 'note_location_move', {}, L));
  }
  if (r.notes.includes('times_ignored')) extra.push(t('note_times', {}, L));
  if (r.notes.includes('ask_numbers')) extra.push(t('note_numbers', {}, L));
  if (r.unknownWords.length && (r.kind === 'confirm' || r.kind === 'unknown')) extra.push(t('note_unknown', { words: r.unknownWords.join(', ') }, L));
  if (r.notes.includes('fuzzy_stop') && v.word) extra.push(t('note_fuzzy_stop', { word: v.word }, L));
  if (r.notes.includes('alias') && v.phrase) extra.push(t('note_alias', { phrase: v.phrase }, L));
  let main;
  switch (r.kind) {
    case 'command':
      if (r.steps.length === 1 && r.steps[0].intent === 'LANG') main = t('lang_set', {}, r.steps[0].params.lang);
      else if (r.steps.length === 1 && r.steps[0].intent === 'HELP') main = t('help', {}, L);
      else if (r.reply.key === 'info_ack') main = t('info_ack', { what: describeSteps(r.steps, L) }, L);
      else if (r.reply.key === 'doing') main = t('doing', { what: describeSteps(r.steps, L) }, L);
      else main = t(r.reply.key, v, L);
      break;
    case 'confirm':
      main = t(r.reply.key === 'confirm_clean' || r.reply.key === 'confirm_estop_reset' ? r.reply.key : 'confirm', { what: describeSteps(r.suggestions[0], L) }, L);
      break;
    case 'clarify':
      main = `${t(r.reply.key || 'clarify', v, L)} ${r.suggestions.map((s, i) => `(${i + 1}) ${describeSteps(s, L)}`).join('  ')}`;
      break;
    default:
      main = t(r.reply.key, v, L);
  }
  return [main, ...extra].join(' ').trim();
}

/** Turn robot JSON into a one-line answer for info intents. */
export function formatInfo(intent, data, lang = 'hi') {
  const d = data || {};
  switch (intent) {
    case 'STATUS':
      if (d.estop) return t('status_estop', {}, lang);
      return t('status_value', { state: d.state ?? '?', mode: d.mode ?? '?', distance: d.distance_cm ?? '?' }, lang);
    case 'BATTERY':
      return d.battery_v === null || d.battery_v === undefined ? t('battery_off', {}, lang) : t('battery_value', { volts: Number(d.battery_v).toFixed(2) }, lang);
    case 'HEALTH':
      return t('health_value', { overall: d.overall ?? '?' }, lang);
    case 'REPORT': {
      const m = d.current && d.current.mission_id ? d.current : Array.isArray(d.history) && d.history.length ? d.history[d.history.length - 1] : null;
      if (!m) return t('report_none', {}, lang);
      return t('report_value', { id: m.mission_id, collected: m.items_collected ?? 0, failed: m.items_failed ?? 0, skipped: m.items_skipped ?? 0 }, lang);
    }
    case 'MISTAKES': {
      const n = Array.isArray(d) ? d.length : Array.isArray(d.mistakes) ? d.mistakes.length : 0;
      return n ? t('mistakes_value', { count: n }, lang) : t('mistakes_none', {}, lang);
    }
    case 'PHOTO':
      return t('photo_value', { count: Array.isArray(d.detections) ? d.detections.length : 0 }, lang);
    default:
      return '';
  }
}

/** Map an HTTP status (or 'offline') to a friendly message. */
export function formatError(status, lang = 'hi', body = null) {
  if (status === 'offline' || status === 0) return t('err_offline', {}, lang);
  if (status === 401) return t('err_unauthorized', {}, lang);
  if (status === 400) return t('err_bad_request', {}, lang);
  if (status === 503) return t('err_camera', {}, lang);
  if (status === 404) return t('err_not_supported', {}, lang);
  if (status === 409) {
    const msg = body && typeof body.error === 'string' ? body.error.toLowerCase() : '';
    return msg.includes('estop') ? t('err_estop', {}, lang) : t('err_busy', {}, lang);
  }
  return t('unknown', {}, lang);
}

// ---------------------------------------------------------------------------
// Examples — used for docs/COMMANDS.md and tested to parse as listed
// ---------------------------------------------------------------------------
export const EXAMPLES = Object.freeze([
  { intent: 'STOP', hi: ['ruko', 'ruk jao', 'bas karo', 'band karo', 'रुको'], en: ['stop', 'wait', 'hold on'] },
  { intent: 'ESTOP', hi: ['emergency', 'bachao'], en: ['emergency stop', 'e-stop'] },
  { intent: 'CLEAN', hi: ['kachra saaf karo', 'safai shuru karo', '3 kachre uthao', '2 minute saaf karo', 'कचरा साफ करो'], en: ['clean the room', 'pick up the trash', 'clean 3 items'] },
  { intent: 'MOVE', hi: ['20 cm aage chalo', 'thoda peeche', 'dheere aage jao', 'आगे 20 सेमी'], en: ['forward 20 cm', 'go back a little', 'move ahead slowly'] },
  { intent: 'TURN', hi: ['90 degree left ghumo', 'thoda right mudo', 'palat jao'], en: ['turn left 90', 'turn right a bit', 'u-turn'] },
  { intent: 'SCOOP', hi: ['scoop neeche karo', 'scoop upar karo', 'scoop khali karo'], en: ['scoop down', 'lift the scoop', 'dump the scoop'] },
  { intent: 'PHOTO', hi: ['photo lo', 'kya dikh raha hai'], en: ['take a photo', 'what do you see'] },
  { intent: 'STATUS', hi: ['kya haal hai', 'status batao'], en: ['status', 'what are you doing'] },
  { intent: 'BATTERY', hi: ['battery kitni hai'], en: ['battery level'] },
  { intent: 'REPORT', hi: ['kitna kachra uthaya', 'hisaab batao'], en: ['report', 'how many did you collect'] },
  { intent: 'MISTAKES', hi: ['kya galti hui', 'kyun ruka'], en: ['what went wrong', 'show mistakes'] },
  { intent: 'HEALTH', hi: ['tabiyat kaisi hai', 'koi dikkat hai'], en: ['health check', 'any problems'] },
  { intent: 'MARK_KEEP', hi: ['ye kachra nahi hai', 'ye mera hai', 'isko mat uthao'], en: ['this is not trash', 'that is mine', "don't pick this up"] },
  { intent: 'MARK_TRASH', hi: ['ye kachra hai', 'ye bhi kachra hai'], en: ['this is trash'] },
  { intent: 'HELP', hi: ['madad', 'madad chahiye'], en: ['help', 'commands'] },
  { intent: 'LANG', hi: ['hinglish me bolo'], en: ['reply in english'] },
  { intent: 'REPEAT', hi: ['dobara', 'phir se'], en: ['again', 'repeat'] },
]);
