import type { UserRecord } from "@/lib/users";

// Builds and sends the weekly digest email. This is a deliberate placeholder
// for v1 (see plan doc): it recaps the user's saved preferences and links to
// search each retailer directly, rather than fabricating specific deals or
// prices. Real scraping of Expedia/Costco Travel/Thomas Cook would violate
// their terms of service and is not implemented.
//
// Upgrade path: swap this function's body for a call into
// lib/travelAgent.ts's runAgentLoop()/TOOLS, restricting the web_search
// tool's allowed_domains to the three retailer domains, without changing
// this function's UserRecord -> email-content signature.

const RETAILERS = [
  { label: "Expedia", url: "https://www.expedia.com" },
  { label: "Costco Travel", url: "https://www.costcotravel.com" },
  { label: "Thomas Cook", url: "https://www.thomascook.com" },
];

function siteUrl(): string {
  return process.env.SITE_URL || "https://agent-demo-jet.vercel.app";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function destinationBlurb(user: UserRecord): string {
  const { interests, budget } = user.profile;
  const parts: string[] = [];
  if (interests) parts.push(`your interest in ${interests}`);
  if (budget) parts.push(`a budget around ${budget}`);
  if (parts.length === 0) {
    return "Start your search below, then add more preferences to your profile for better matches.";
  }
  return `Based on ${parts.join(" and ")}, here's where to start looking.`;
}

export function buildDigestEmail(user: UserRecord): {
  subject: string;
  html: string;
  text: string;
} {
  const profileUrl = `${siteUrl()}/profile`;
  const { destinations } = user.profile;

  const subject =
    destinations.length > 0
      ? `Your weekly Wanderlust digest: ${destinations.map((d) => d.destination).join(", ")}`
      : "Your weekly Wanderlust digest";

  const retailerLinksHtml = RETAILERS.map(
    (r) =>
      `<a href="${r.url}" style="color:#c1602e;text-decoration:none;font-weight:600;">${r.label}</a>`
  ).join(' <span style="color:#e4dcc8;">&middot;</span> ');
  const retailerLinksText = RETAILERS.map((r) => `${r.label}: ${r.url}`).join("\n");

  const blurb = destinationBlurb(user);

  const destinationCardsHtml =
    destinations.length > 0
      ? destinations
          .map(
            (d) => `
      <tr>
        <td style="padding:20px 0;border-top:1px solid #e4dcc8;">
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:18px;color:#241f1a;">
            ${escapeHtml(d.destination)}
          </p>
          <p style="margin:0 0 10px;font-size:13px;color:#6b6157;">${escapeHtml(d.timeframe)}</p>
          <p style="margin:0 0 12px;font-size:14px;color:#4a4038;">${escapeHtml(blurb)}</p>
          <p style="margin:0;font-size:14px;">${retailerLinksHtml}</p>
        </td>
      </tr>`
          )
          .join("")
      : `
      <tr>
        <td style="padding:20px 0;">
          <p style="margin:0 0 12px;font-size:14px;color:#4a4038;">
            You haven't saved any destinations yet. Add a few to your profile and next week's
            digest will be built around them.
          </p>
          <p style="margin:0;">
            <a href="${profileUrl}" style="color:#c1602e;font-weight:600;">Add destinations &rarr;</a>
          </p>
        </td>
      </tr>`;

  const destinationCardsText =
    destinations.length > 0
      ? destinations
          .map(
            (d) =>
              `${d.destination} (${d.timeframe})\n${blurb}\n${retailerLinksText}`
          )
          .join("\n\n")
      : `You haven't saved any destinations yet. Add a few at ${profileUrl}`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#faf6ef;font-family:'Work Sans',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fffdf8;border:1px solid #e4dcc8;border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#9c4a22;font-weight:600;">
                  Wanderlust Travel
                </p>
                <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:#241f1a;">
                  Your weekly travel digest
                </h1>
                <p style="margin:0 0 8px;font-size:14px;color:#4a4038;">Hi ${escapeHtml(user.name)},</p>
                <p style="margin:0;font-size:13px;color:#6b6157;line-height:1.6;">
                  This is a digest of your saved preferences, not live deals &mdash; search each
                  site yourself using the details below.
                </p>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${destinationCardsHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;border-top:1px solid #e4dcc8;">
                <p style="margin:0;font-size:12px;color:#6b6157;">
                  Manage your preferences or turn off weekly emails at
                  <a href="${profileUrl}" style="color:#c1602e;">${profileUrl.replace(/^https?:\/\//, "")}</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Wanderlust Travel — Your weekly travel digest

Hi ${user.name},

This is a digest of your saved preferences, not live deals — search each
site yourself using the details below.

${destinationCardsText}

---
Manage your preferences or turn off weekly emails: ${profileUrl}
`;

  return { subject, html, text };
}

export async function sendDigestEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY or RESEND_FROM_EMAIL is not set.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend request failed (${res.status}): ${body}`);
  }
}
