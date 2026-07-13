// Reads every markdown file in knowledge_base/, chunks it by heading,
// embeds each chunk with Voyage AI, and uploads the source files plus a
// combined embeddings index to Vercel Blob storage.
//
// Usage: node scripts/ingest_knowledge_base.mjs
// Requires VOYAGE_API_KEY and BLOB_READ_WRITE_TOKEN in config.env.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, "config.env");
const KB_DIR = path.join(ROOT, "knowledge_base");
const VOYAGE_MODEL = "voyage-3.5";

dotenv.config({ path: ENV_PATH });

function requireEnv(name) {
  const value = (process.env[name] ?? "").trim();
  if (!value || value.startsWith("your-") || value.startsWith("<")) {
    console.error(
      `Missing ${name}. Add a real value to ${ENV_PATH} and try again.`
    );
    process.exit(1);
  }
  return value;
}

// Split a markdown file into chunks on "## " headings. The "# " title (if
// present) is used as the chunk's source label.
function chunkMarkdown(defaultTitle, content) {
  const lines = content.split(/\r?\n/);
  let title = defaultTitle;
  let heading = defaultTitle;
  let buffer = [];
  const chunks = [];

  function flush() {
    const text = buffer.join("\n").trim();
    if (text) chunks.push({ heading, text });
    buffer = [];
  }

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    if (h1) {
      title = h1[1].trim();
      continue;
    }
    if (h2) {
      flush();
      heading = h2[1].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return { title, chunks };
}

async function embedBatch(voyageApiKey, texts) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${voyageApiKey}`,
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts, input_type: "document" }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embeddings request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data.map((entry) => entry.embedding);
}

function upsertEnvVar(envPath, key, value) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    if (content.length && !content.endsWith("\n")) content += "\n";
    content += `${line}\n`;
  }
  fs.writeFileSync(envPath, content);
}

async function main() {
  const voyageApiKey = requireEnv("VOYAGE_API_KEY");
  const blobToken = requireEnv("BLOB_READ_WRITE_TOKEN");

  if (!fs.existsSync(KB_DIR)) {
    console.error(`No knowledge_base directory found at ${KB_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(KB_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.error(`No .md files found in ${KB_DIR}`);
    process.exit(1);
  }

  const index = [];

  for (const file of files) {
    const filePath = path.join(KB_DIR, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const defaultTitle = path.basename(file, ".md");
    const { title, chunks } = chunkMarkdown(defaultTitle, raw);

    if (chunks.length === 0) {
      console.warn(`Skipping ${file}: no content found.`);
      continue;
    }

    console.log(`Embedding ${chunks.length} chunk(s) from ${file}...`);
    const texts = chunks.map(
      (chunk) => `${title} — ${chunk.heading}\n\n${chunk.text}`
    );
    const embeddings = await embedBatch(voyageApiKey, texts);

    chunks.forEach((chunk, i) => {
      index.push({
        id: `${defaultTitle}-${i}`,
        source: title,
        heading: chunk.heading,
        text: chunk.text,
        embedding: embeddings[i],
      });
    });

    console.log(`Uploading source file ${file} to Blob...`);
    await put(`knowledge-base/docs/${file}`, raw, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/markdown",
      token: blobToken,
    });
  }

  console.log(`Uploading combined index (${index.length} chunks) to Blob...`);
  const { url } = await put(
    "knowledge-base/index.json",
    JSON.stringify(index),
    {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token: blobToken,
    }
  );

  upsertEnvVar(ENV_PATH, "KB_INDEX_URL", url);

  console.log("\nDone.");
  console.log(`Knowledge base index URL: ${url}`);
  console.log(`KB_INDEX_URL was written to ${ENV_PATH}.`);
  console.log(
    "Next: add VOYAGE_API_KEY and KB_INDEX_URL as environment variables on the " +
      "Vercel project, then redeploy."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
