// ---------------------------------------------------------------------------
// The 13 spend categories. Data-driven on purpose (FR-CLS-7): keyword lists
// are plain arrays here, not hard-coded branching logic, so they're easy to
// extend without touching classifier.js.
//
// `color` values 1-8 are the validated 8-hue categorical palette (light
// mode) from the dataviz skill — safe to use as simultaneous chart series.
// Categories 9-13 reuse supplementary tones for badge/icon identity only;
// multi-category charts (>8 series) use a single sequential hue instead of
// per-category color, so these never need to carry chart-series identity.
// Every badge always pairs the color chip with an icon + text label, so
// identity is never color-alone regardless of hue reuse.
//
// Order is significant: it is the built-in-keyword-rule precedence used by
// classifier.js when a description matches more than one category.
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  {
    id: "groceries",
    name: "Groceries",
    icon: "🛒",
    color: "#008300",
    keywords: [
      "costco", "bjs", "bj's", "sams club", "sam's club", "walmart", "target",
      "harris teeter", "kroger", "publix", "aldi", "whole foods", "trader joe",
      "safeway", "food lion", "wegmans", "giant food", "meijer", "winco",
      "bigbasket", "blinkit", "zepto", "dmart", "jiomart", "reliance fresh",
      "instacart", "supermarket", "grocery", "grocers", "kirana", "more supermarket",
    ],
  },
  {
    id: "dining",
    name: "Dining & Food",
    icon: "🍽️",
    color: "#eb6834",
    keywords: [
      "papa johns", "papa john's", "mcdonalds", "mcdonald's", "subway", "swiggy",
      "zomato", "restaurant", "cafe", "coffee", "dominos", "domino's", "kfc",
      "starbucks", "bakery", "pizza", "burger", "chipotle", "wendys", "wendy's",
      "taco bell", "dunkin", "chick-fil-a", "grubhub", "doordash", "uber eats",
      "panera", "diner", "eatery", "bar & grill", "brewery", "food truck",
    ],
  },
  {
    id: "fuel_transport",
    name: "Fuel & Transport",
    icon: "⛽",
    color: "#2a78d6",
    keywords: [
      "gas station", "shell", "chevron", "exxon", "bp ", "circlek", "circle k",
      "harris teeter fuel", "gate ", "quick trip", "quiktrip", "wawa", "sheetz",
      "speedway", "petrol", "diesel", "indian oil", "hpcl", "bharat petroleum",
      "ola", "uber", "rapido", "lyft", "metro transit", "toll", "fastag",
      "irctc", "parking", "dmv", "auto repair", "car wash", "tire",
    ],
  },
  {
    id: "utilities",
    name: "Utilities & Bills",
    icon: "💡",
    color: "#4a3aa7",
    keywords: [
      "duke energy", "dominion", "enbridge", "pg&e", "con edison", "national grid",
      "water bill", "sewer", "electricity", "electric co", "broadband", "comcast",
      "xfinity", "spectrum", "att", "at&t", "verizon fios", "wifi", "internet bill",
      "airtel", "jio", "bsnl", "vodafone", "dth", "recharge", "maintenance fee",
      "hoa fee", "gas bill", "utility",
    ],
  },
  {
    id: "shopping",
    name: "Shopping",
    icon: "🛍️",
    color: "#e87ba4",
    keywords: [
      "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "croma",
      "decathlon", "mall", "best buy", "ikea", "macy's", "macys", "nordstrom",
      "tj maxx", "marshalls", "ross store", "ebay", "etsy", "zara", "h&m",
      "old navy", "gap store", "wayfair", "michaels", "office depot", "staples",
    ],
  },
  {
    id: "health",
    name: "Health & Medical",
    icon: "🏥",
    color: "#e34948",
    keywords: [
      "cvs", "walgreens", "pharmacy", "hospital", "apollo", "medplus", "netmeds",
      "pharmeasy", "1mg", "diagnostic", "clinic", "dental", "dentist", "urgent care",
      "medical center", "labcorp", "quest diagnostics", "optometrist", "vision center",
      "physical therapy", "doctor", "orthodontist", "rite aid",
    ],
  },
  {
    id: "education",
    name: "Education",
    icon: "🎓",
    color: "#1baf7a",
    keywords: [
      "school", "college", "tuition", "udemy", "coursera", "book store",
      "bookstore", "coaching", "university", "student loan servicer", "khan academy",
      "edx", "pearson", "scholastic", "kindergarten", "daycare", "preschool",
    ],
  },
  {
    id: "entertainment",
    name: "Entertainment",
    icon: "🎬",
    color: "#eda100",
    keywords: [
      "netflix", "hotstar", "spotify", "prime video", "disney+", "disney plus",
      "hbo max", "hulu", "youtube premium", "apple music", "pvr", "inox",
      "cinemark", "amc theatres", "regal cinemas", "movie", "game store",
      "steam games", "playstation", "xbox", "event ticket", "ticketmaster",
      "concert", "bowling",
    ],
  },
  {
    id: "insurance_emi",
    name: "Insurance & EMI",
    icon: "📄",
    color: "#3a5a9c",
    keywords: [
      "insurance", "lic ", "premium payment", "emi", "loan payment", "sip ",
      "mutual fund", "policy", "geico", "progressive insurance", "state farm",
      "allstate", "term life", "auto loan", "mortgage payment", "amortization",
    ],
  },
  {
    id: "household",
    name: "Household",
    icon: "🏠",
    color: "#8a5a2b",
    keywords: [
      "rent payment", "plumber", "electrician", "maid service", "repair service",
      "pest control", "laundry", "dry clean", "ac service", "home depot service",
      "handyman", "cleaning service", "landscaping", "lawn care", "furniture",
    ],
  },
  {
    id: "personal_care",
    name: "Personal Care",
    icon: "💅",
    color: "#d16ba5",
    keywords: [
      "salon", "parlour", "parlor", "spa", "grooming", "cosmetics", "skincare",
      "urban company", "barber", "nail bar", "sephora", "ulta beauty", "gym membership",
      "fitness club", "yoga studio",
    ],
  },
  {
    id: "farm",
    name: "Farm",
    icon: "🌾",
    color: "#6b8e23",
    keywords: [
      "lowes", "lowe's", "home depot", "farm supply", "agriculture", "seed co",
      "fertilizer", "tractor", "harvest", "dairy", "poultry", "feed store",
      "irrigation", "livestock", "nursery & garden",
    ],
  },
  {
    id: "other",
    name: "Other",
    icon: "❔",
    color: "#898781",
    keywords: [],
  },
];

export function getCategoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

export const OTHER_CATEGORY_ID = "other";
