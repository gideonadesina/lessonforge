const ABSTRACT_WORDS = new Set([
  "about",
  "activity",
  "activities",
  "and",
  "approach",
  "basic",
  "basics",
  "classroom",
  "clear",
  "colorful",
  "concept",
  "contact",
  "detailed",
  "diagram",
  "education",
  "educational",
  "example",
  "examples",
  "for",
  "friendly",
  "guide",
  "image",
  "including",
  "introduction",
  "introductory",
  "label",
  "labeled",
  "labelled",
  "learning",
  "lesson",
  "main",
  "non",
  "noncontact",
  "of",
  "photo",
  "picture",
  "relating",
  "relationship",
  "safe",
  "show",
  "showing",
  "simple",
  "slide",
  "student",
  "students",
  "teacher",
  "teachers",
  "the",
  "theme",
  "to",
  "understand",
  "understanding",
  "visual",
  "with",
]);

const PHRASE_QUERIES: Array<[RegExp, string]> = [
  [/\bnon[-\s]?contact\s+sports?\b/, "swimming pool"],
  [/\bcontact\s+sports?\b/, "football stadium"],
  [/\b(democracy|election|voting|government)\b/, "voting ballot"],
  [/\bsolar\s+system\b/, "solar system"],
  [/\bdna|genetics?\b/, "DNA strand"],
  [/\bphotosynthesis\b/, "green leaf"],
  [/\bcell\s+structure|plant\s+cell|animal\s+cell\b/, "microscope cells"],
  [/\batomic\s+structure|atoms?\b/, "atom model"],
  [/\belectricity|current\s+electricity\b/, "electric circuit"],
  [/\bclimate\s+change\b/, "melting glacier"],
  [/\bmap\s+reading|longitude|latitude\b/, "world map"],
  [/\bsupply\s+and\s+demand|market\s+structure|inflation\b/, "market stall"],
  [/\bquadratic|algebra|equation\b/, "math graph"],
  [/\bfractions?\b/, "fraction circles"],
  [/\btrigonometry\b/, "triangle ruler"],
  [/\bcivic\s+education\b/, "voting ballot"],
[/\bhome\s+economics?\b/, "kitchen cooking"],
[/\bsocial\s+studies?\b/, "community people"],
[/\bagric(ultural)?\s+science\b/, "farm crops"],
[/\bbasic\s+science\b/, "science experiment"],
[/\bbasic\s+technology\b/, "workshop tools"],
[/\bcreative\s+arts?\b/, "art supplies"],
[/\bmusic\b/, "musical instruments"],
[/\bnational\s+values\b/, "nigerian flag"],
[/\bpre[-\s]?voc(ational)?\b/, "workshop tools"],
[/\bsecurity\s+education\b/, "safety sign"],
[/\byoruba|igbo|hausa\b/, "african culture"],
[/\bnigerian?\s+language\b/, "african culture"],
[/\benglish\s+language|comprehension\b/, "open book"],
[/\bliterature\b/, "open book"],
[/\boral\s+english\b/, "microphone"],
[/\bcrs|christian\s+religious\b/, "bible cross"],
[/\birs|islamic\s+religious\b/, "mosque"],
[/\bgovernment\s+studies?\b/, "government building"],
[/\becono(mics)?\b/, "market stall"],
[/\bbook\s+keeping|accounting\b/, "accounting books"],
[/\bcommerce\b/, "market stall"],
[/\bdata\s+processing\b/, "computer keyboard"],
[/\bfurther\s+math(s)?\b/, "math graph"],
[/\bintegration|differentiation|calculus\b/, "math graph"],
[/\bstatistics?\b/, "bar chart"],
[/\bnutrition|food\s+and\s+nutrition\b/, "healthy food"],
[/\banatomy|human\s+body\b/, "human body diagram"],
[/\bwaste\s+management|sanitation\b/, "recycling bin"],
[/\benvironment(al)?\s+science\b/, "green nature"],
[/\bsoil\s+science\b/, "soil hands"],
[/\banimal\s+husbandry\b/, "farm animals"],
[/\bcrop\s+production\b/, "farm crops"],
[/\bfisheries\b/, "fishing boat"],
[/\bforestry\b/, "forest trees"],
[/\bwoodwork\b/, "woodwork tools"],
[/\bmetal\s+work\b/, "metal tools"],
[/\belectronics?\b/, "electric circuit"],
[/\bauto\s+mechanics?\b/, "car engine"],
[/\bbricklaying|building\s+construction\b/, "brick wall"],
[/\bplumbing\b/, "water pipes"],
[/\btailoring|fashion\s+design\b/, "sewing machine"],
[/\btyping|keyboarding\b/, "computer keyboard"],
[/\bshorthand\b/, "writing notepad"],
[/\boffice\s+practice\b/, "office desk"],
[/\bmarketing\b/, "market stall"],
[/\bentrepreneurship\b/, "business meeting"],
[/\bfinancial\s+literacy\b/, "money coins"],
[/\bphysical\s+health|health\s+education\b/, "healthy lifestyle"],
[/\bdrug\s+abuse|substance\b/, "no drugs sign"],
[/\bfamily\s+life\b/, "family together"],
[/\bsex\s+education\b/, "health education"],
[/\bfirst\s+aid\b/, "first aid kit"],
[/\broad\s+safety\b/, "traffic light"],
[/\bfire\s+safety\b/, "fire extinguisher"],
];

const SPORT_QUERIES: Array<[RegExp, string]> = [
  [/\brugby\b/, "rugby ball"],
  [/\bfootball|soccer\b/, "football stadium"],
  [/\bbasketball\b/, "basketball court"],
  [/\bswimming\b/, "swimming pool"],
  [/\btennis\b/, "tennis racket"],
  [/\bcricket\b/, "cricket bat"],
  [/\bvolleyball\b/, "volleyball court"],
  [/\bboxing\b/, "boxing gloves"],
  [/\btable\s+tennis\b/, "ping pong"],
  [/\bathletics?|running\b/, "running track"],
  [/\bgymnastics?\b/, "gymnastics mat"],
  [/\bbaseball\b/, "baseball bat"],
  [/\bhockey\b/, "hockey stick"],
  [/\bgolf\b/, "golf club"],
  [/\bcycling\b/, "bicycle race"],
  [/\bmartial\s+arts?|karate|judo\b/, "karate practice"],
];

const SUBJECT_FALLBACKS: Array<[RegExp, string]> = [
  [/\bbiology\b/, "microscope cells"],
  [/\bchemistry\b/, "chemistry lab"],
  [/\bphysics\b/, "physics experiment"],
  [/\bgeography\b/, "world map"],
  [/\bgovernment|civic\b/, "voting ballot"],
  [/\bmathematics|math\b/, "math graph"],
  [/\bagric/, "farm crops"],
  [/\bcomputer|ict\b/, "computer keyboard"],
  [/\beconomics|commerce|business\b/, "market stall"],
  [/\bhistory\b/, "historic building"],
  [/\bcivic\b/, "voting ballot"],
[/\bliterature\b/, "open book"],
[/\bcommerce\b/, "market stall"],
[/\baccounting\b/, "accounting books"],
[/\bagric\b/, "farm crops"],
[/\btechnology\b/, "workshop tools"],
[/\barts?\b/, "art supplies"],
[/\bmusic\b/, "musical instruments"],
[/\breligion|crs|irs\b/, "bible cross"],
[/\bhealth\b/, "healthy lifestyle"],
[/\bnutrition\b/, "healthy food"],
[/\bvocational\b/, "workshop tools"],
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/classroom-?safe|classroom-?friendly|educational style/gi, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampQuery(query: string) {
  return query.split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
}

function matchQuery(source: string, entries: Array<[RegExp, string]>) {
  return entries.find(([pattern]) => pattern.test(source))?.[1] ?? "";
}

export function sanitizePexelsQuery(input?: string | null, topic?: string, subject?: string) {
  const source = normalize([input, topic, subject].filter(Boolean).join(" "));
  if (!source) return "classroom";

  const mapped =
    matchQuery(source, SPORT_QUERIES) ||
    matchQuery(source, PHRASE_QUERIES) ||
    matchQuery(normalize(`${topic ?? ""} ${subject ?? ""}`), SUBJECT_FALLBACKS);

  if (mapped) return clampQuery(mapped);

  const words = source
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .filter((word) => !ABSTRACT_WORDS.has(word));

  return clampQuery(words.join(" ")) || clampQuery(topic || subject || "classroom");
}
