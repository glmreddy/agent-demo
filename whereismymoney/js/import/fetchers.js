import { GOOGLE_API_KEY } from "../data/googleApiConfig.js";

/** @returns {'sheet'|'drive-file'|'drive-folder'|'unknown'} */
export function detectSourceType(url) {
  const u = String(url || "");
  if (/docs\.google\.com\/spreadsheets/.test(u)) return "sheet";
  if (/drive\.google\.com\/drive\/folders\//.test(u)) return "drive-folder";
  if (/drive\.google\.com\/(file\/d\/|open\?id=|uc\?.*id=)/.test(u)) return "drive-file";
  return "unknown";
}

function extractId(url, patterns) {
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

async function assertNotHtmlInterstitial(response, contextLabel) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error(
      `${contextLabel} returned a web page instead of file data. Make sure it's shared as "Anyone with the link" and, for large Drive files, try a Sheets link instead.`
    );
  }
}

/** Google Sheets: public CSV export, no API key needed. */
export async function fetchGoogleSheetCsv(url) {
  const id = extractId(url, [/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/]);
  if (!id) throw new Error("Couldn't find a spreadsheet ID in that URL.");
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  let response;
  try {
    response = await fetch(exportUrl);
  } catch (err) {
    throw new Error("Couldn't reach Google Sheets. Check your connection, or that the sheet is shared publicly.");
  }
  if (!response.ok) {
    throw new Error(`Google Sheets returned an error (HTTP ${response.status}). Make sure the sheet is shared "Anyone with the link".`);
  }
  await assertNotHtmlInterstitial(response, "The Sheets export link");

  const text = await response.text();
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new Error('That Sheets link isn\'t publicly viewable. Share it as "Anyone with the link → Viewer" and try again.');
  }
  return { text, filename: `Sheet ${id}` };
}

/** Single public Drive file: direct download, no API key needed for small files. */
export async function fetchDriveFile(url) {
  const id = extractId(url, [/\/file\/d\/([a-zA-Z0-9-_]+)/, /[?&]id=([a-zA-Z0-9-_]+)/]);
  if (!id) throw new Error("Couldn't find a file ID in that Drive URL.");

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
  let response;
  try {
    response = await fetch(downloadUrl);
  } catch (err) {
    throw new Error("Couldn't reach Google Drive. Check your connection, or that the file is shared publicly.");
  }
  if (!response.ok) {
    throw new Error(`Google Drive returned an error (HTTP ${response.status}). Make sure the file is shared "Anyone with the link".`);
  }
  await assertNotHtmlInterstitial(response, "The Drive download link");

  const bytes = await response.arrayBuffer();
  // Large/unscanned files serve an HTML "can't scan for viruses" interstitial
  // instead of the file — sniff the first bytes as a second check beyond
  // Content-Type, since Drive doesn't always set it accurately.
  const head = new TextDecoder().decode(bytes.slice(0, 15)).toLowerCase();
  if (head.includes("<!doctype") || head.includes("<html")) {
    throw new Error("That file is too large for a direct Drive download link. Try a Google Sheets link, or a smaller export, instead.");
  }
  return { bytes, filename: `Drive file ${id}` };
}

/** Drive folder: enumerate spreadsheet files inside via the Drive API (requires an API key). */
export async function fetchDriveFolderFiles(url) {
  const id = extractId(url, [/\/drive\/folders\/([a-zA-Z0-9-_]+)/]);
  if (!id) throw new Error("Couldn't find a folder ID in that Drive URL.");

  if (!GOOGLE_API_KEY) {
    return { notConfigured: true, files: [] };
  }

  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    `'${id}' in parents and trashed = false`
  )}&key=${GOOGLE_API_KEY}&fields=files(id,name,mimeType)`;

  const response = await fetch(listUrl);
  if (!response.ok) {
    throw new Error(`Couldn't list the folder's contents (HTTP ${response.status}). Make sure the folder is shared "Anyone with the link" and the API key is valid.`);
  }
  const data = await response.json();
  const spreadsheetMimes = new Set([
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ]);
  const files = (data.files || []).filter((f) => spreadsheetMimes.has(f.mimeType));

  return {
    notConfigured: false,
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      isGoogleSheet: f.mimeType === "application/vnd.google-apps.spreadsheet",
    })),
  };
}

/** Fetches one file found inside a Drive folder listing. */
export async function fetchDriveFolderFile(file) {
  if (file.isGoogleSheet) {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${file.id}/export?format=csv`;
    const response = await fetch(exportUrl);
    if (!response.ok) throw new Error(`Couldn't export "${file.name}" (HTTP ${response.status}).`);
    return { text: await response.text(), filename: file.name };
  }
  const mediaUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GOOGLE_API_KEY}`;
  const response = await fetch(mediaUrl);
  if (!response.ok) throw new Error(`Couldn't download "${file.name}" (HTTP ${response.status}).`);
  const bytes = await response.arrayBuffer();
  return { bytes, filename: file.name };
}
