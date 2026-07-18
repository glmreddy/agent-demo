# whereismymoney

A personal-finance single-page app whose core feature is automatically
classifying credit-card/bank spend into budget categories, then reporting,
planning, and tracking trends on top of that.

No backend of its own — the browser talks directly to Firebase Auth (Google
Sign-In) and Firestore. Every user's data lives under `users/{their-uid}/…`
and is isolated by Firestore security rules.

## Features

- **Google sign-in**, per-user data isolation, session persists across reloads.
- **Auto-classification** of transactions into 13 categories via a data-driven
  keyword engine, with a user-trainable keyword→category override table.
- **Statement import** from a Google Sheets link, a public Drive file link, or
  a Drive folder link (every spreadsheet inside) — or a local file upload.
  Auto-detects date/description/amount (or debit+credit) columns, date format
  (DD/MM vs MM/DD), and sign convention, with a preview + diagnostics before
  anything is written.
- **Dashboard**: FY-scoped stat cards, income-vs-expense trend, monthly
  summary table with running balance, top transactions per month.
- **Reports**: Category × Month expense crosstab, editable income crosstab,
  year-on-year comparison chart.
- **Budget Planner**: per-category allocations, actual-vs-planned progress
  bars, budget-vs-actual chart.
- **Payment Cycles**: recurring EMIs/subscriptions/salaries tracked month over
  month, grouped by category.
- **CSV & JSON export** of everything.

Financial Year = calendar year (Jan–Dec). All currency is USD ($).

## Architecture

Plain HTML5/CSS3/vanilla JS — no framework, no bundler, no build step.
Firebase, Chart.js, and SheetJS are loaded straight from CDNs; the app's own
code is ES modules (`<script type="module">`).

```
index.html                 App shell: nav + one <section> per view
css/styles.css              All styling
js/
  firebase-config.js        Firebase init (placeholder creds — see Setup)
  auth.js                   Google sign-in/out, session listener
  router.js                 View-switch navigation (show/hide + activate hooks)
  app.js                    Entry point — wires everything together
  data/
    categories.js           The 13 categories: id, name, icon, color, keywords
    googleApiConfig.js       Optional Drive API key (folder import only)
  core/
    classifier.js            Pure classify(description, userMappings)
    fy.js                    Financial-Year helpers (Jan–Dec)
    money.js                 $ USD formatting
  store/
    cache.js                 In-memory cache: sync reads, optimistic async writes
  services/
    firestore.js             Thin Firestore access layer (load/write/batch)
  import/
    fetchers.js               Google Sheets/Drive fetch logic
    parser.js                  Column detection, date/amount normalization
    importController.js        fetch -> parse -> preview -> commit orchestration
  reports/
    aggregations.js            Dashboard/report pure aggregation functions
    budgetCompare.js           Budget vs actual pure functions
  charts/
    chartFactory.js            Chart.js create/destroy wrappers + palette
  views/                       One module per screen (dashboard, transactions,
                                reports, budget, payment-cycles, category
                                mapping, import, login, shell)
  utils/                       toast, modal, CSV/JSON export, error handling
test/                          node --test unit tests for the pure-logic core
sample-data/                   Demo statement files (see "Try it" below)
firestore.rules                Per-user security rules
vercel.json                    Static hosting config for this sub-project
```

**Classification precedence** (`js/core/classifier.js`): user mapping table
(case-insensitive substring match, first match wins) → built-in keyword lists
(category array order = precedence) → fallback `other`. Pure function of
`(description, mappingTable)` — same input always yields the same category.

**Import pipeline** (`js/import/parser.js`): analyzes each column's date-like
ratio, numeric ratio, and average text length over a sample of rows; picks
date/description/amount columns by header keyword first, content heuristics
second; disambiguates DD/MM vs MM/DD from the first row with a day > 12;
normalizes sign convention (strips `$`/commas/`Dr`/`Cr`/parentheses, flips by
majority sign when needed); classifies every row; and returns a full preview
+ diagnostics before anything touches Firestore. A parse failure never writes
partial/corrupt data — commit is a separate, explicit step.

## Setup

### 1. Firebase project (required)

1. Go to the [Firebase Console](https://console.firebase.google.com/) → **Add
   project**.
2. **Build → Authentication → Get started → Sign-in method → Google** → enable it.
3. **Build → Firestore Database → Create database** (start in production
   mode — the security rules below lock it down).
4. **Project settings → General → Your apps → Add app → Web** (`</>`), copy
   the `firebaseConfig` object it gives you.
5. Paste those values into [`js/firebase-config.js`](js/firebase-config.js),
   replacing the `PLACEHOLDER_*` strings.
6. **Firestore Database → Rules**, paste in the contents of
   [`firestore.rules`](firestore.rules), and publish.
7. **Authentication → Settings → Authorized domains** — add your Vercel
   deployment's domain once you have one (localhost is allowed by default).

A Firebase *web* config is not a secret — it's fine to ship in client code.
Data isolation is enforced by the Firestore rules, not by hiding this file.

### 2. Google Drive folder import (optional)

Sheets links and single Drive file links work with **no API key** (they use
public export/download URLs). Only Drive **folder** import (enumerating every
spreadsheet inside a shared folder) needs one:

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select
   a project → **APIs & Services → Library** → enable **Google Drive API**.
2. **APIs & Services → Credentials → Create Credentials → API key**.
3. Restrict it (recommended): **Application restrictions → Websites**, add
   your domain(s); **API restrictions** → limit to Google Drive API.
4. Paste the key into [`js/data/googleApiConfig.js`](js/data/googleApiConfig.js)
   as `GOOGLE_API_KEY`.

Without this key, folder import shows a clear "needs an API key" message —
everything else works fully.

### 3. Run locally

No build step — any static file server works:

```bash
npx serve .
# or
npm run dev
```

Then open the printed local URL. Until step 1 is done, the login screen
loads fine but Google sign-in will show a clear "Firebase isn't configured
yet" error (FR-AUTH-5) — that's expected.

### 4. Run tests

```bash
npm test
```

Runs `node --test` over the pure-logic core (classifier, parser, aggregations,
budget comparison) — no Firebase or browser needed.

### 5. Deploy to Vercel

This directory is a standalone static app inside a larger git repo (the repo
root hosts an unrelated project). Deploy it as its **own** Vercel project:

1. [Vercel dashboard](https://vercel.com/) → **Add New → Project** → import
   this repository.
2. **Root Directory** → set to `whereismymoney`.
3. Framework Preset → **Other** (no build step — `vercel.json` in this
   folder already disables build/install commands).
4. Deploy. Add the resulting `*.vercel.app` domain to Firebase's Authorized
   domains (Setup step 1.7) so Google sign-in works there too.

## Try it — importing sample statements

[`sample-data/`](sample-data/) has three structurally different statement
files to demo the auto-detection pipeline:

| File | Format | Tests |
|---|---|---|
| `chase_style_credit_card.csv` | Single `Amount` column, MM/DD/YYYY, negative = spend | Sign-flip, credit-drop, blank-row skip |
| `bank_statement_debit_credit.csv` | Separate `Debit`/`Credit` columns, DD/MM/YYYY | Split-column mode, DD/MM disambiguation |
| `amex_style_text_dates.csv` | Text-month dates ("01 Jul '26"), `$`-prefixed amounts, partial `Category` column | Text-date parsing, currency stripping, file-provided category |

In the app: **Import → Expense Import → "…or upload a file"**, pick one of
these, click **Analyze**, review the preview + diagnostics, then **Confirm
Import**. All three classify essentially every row without any manual column
mapping. To test the Google-link path instead, upload one of these files to a
Google Sheet or Drive folder shared "Anyone with the link" and paste that URL
in instead of using the file picker.

## Data model

```
users/{userId}/expenses/{id}         { id, date, description, amount, category, type:"expense", sourceId }
users/{userId}/income/{id}           { id, date, description, amount, type:"income", sourceId }
users/{userId}/category_mapping/{id} { id, keyword, category }
users/{userId}/config/settings       { budgets: {...}, incomeData: {...}, paymentCycles: {...} }
```

See [`firestore.rules`](firestore.rules) for the per-user access rules.

## Known limitations

- Very large Drive files can trigger Google's "can't scan for viruses"
  interstitial instead of a direct download — the app detects this and asks
  for a Sheets link or smaller export instead, rather than parsing garbage.
- Drive folder import needs the optional API key (see Setup §2); without it,
  Sheets and single-file imports still work fully.
- No offline support — writes happen against a live Firestore connection.
