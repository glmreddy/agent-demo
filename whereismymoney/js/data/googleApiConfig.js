// ---------------------------------------------------------------------------
// Optional Google Cloud API key, used ONLY for Google Drive *folder* imports
// (enumerating the files inside a publicly-shared folder via the Drive API
// v3 files.list endpoint). Google Sheets links and single Drive file links
// work without this key, via public export/download URLs.
//
// See README.md → "Google Drive folder import (optional)" for setup steps.
// Leave as null to disable folder import (Sheets + single-file import still
// work fully without it).
// ---------------------------------------------------------------------------
export const GOOGLE_API_KEY = "AIzaSyCNGIU92V6xRy4VHSPgdgvrwqKPshQHEjY";
