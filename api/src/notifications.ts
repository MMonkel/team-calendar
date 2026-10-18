import { EmailClient } from "@azure/communication-email";
import { ManagedIdentityCredential } from "@azure/identity";
import { ADMINS, type AnyRequest, fmtRange, type Person, typeLabel } from "shared";
import { emailForPerson } from "./teamEmails.js";

/**
 * E-mailnotificaties via Azure Communication Services, met de managed identity
 * van de Container App. Zonder ACS_ENDPOINT (lokaal, of zolang het maildomein
 * nog niet geverifieerd is) wordt er niets verstuurd en alleen gelogd.
 *
 * Versturen gebeurt na het antwoord aan de browser en een mislukte mail breekt
 * nooit de aanvraag zelf: fouten worden alleen gelogd.
 */
const endpoint = process.env.ACS_ENDPOINT;
const from = process.env.MAIL_FROM;
const appUrl = process.env.APP_URL || "https://teams.monkel.com";

const client = endpoint && from
  ? new EmailClient(endpoint, new ManagedIdentityCredential({ clientId: process.env.AZURE_CLIENT_ID }))
  : null;

interface Mail {
  to: Person;
  subject: string;
  lines: string[];
}

async function send({ to, subject, lines }: Mail) {
  const address = emailForPerson(to);
  if (!address) {
    console.warn(`Geen e-mailadres voor ${to} in TEAM_EMAILS; mail '${subject}' niet verstuurd.`);
    return;
  }
  if (!client || !from) {
    console.log(`[mail niet verstuurd, geen ACS_ENDPOINT] aan ${to}: ${subject}`);
    return;
  }
  const text = [...lines, "", appUrl].join("\n");
  const poller = await client.beginSend({
    senderAddress: from,
    recipients: { to: [{ address, displayName: to }] },
    content: { subject, plainText: text, html: toHtml(lines) },
  });
  const result = await poller.pollUntilDone();
  if (result.status !== "Succeeded") {
    console.error(`Mail aan ${to} mislukt (${result.status}): ${result.error?.message ?? "onbekend"}`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function toHtml(lines: string[]): string {
  const body = lines.map((l) => (l === "" ? "<br>" : `<div>${escapeHtml(l)}</div>`)).join("\n");
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${body}
<p><a href="${escapeHtml(appUrl)}">Open de Team S-planning</a></p></div>`;
}

/** Beschrijving van een aanvraag in één regel, zoals in de app. */
function describe(r: AnyRequest): string {
  if (r.type === "move") return `${typeLabel(r)}: ${fmtRange(r.origFrom, r.origTo)} naar ${fmtRange(r.from, r.to)}`;
  if (r.type === "revert") return `${typeLabel(r)}: ${fmtRange(r.origFrom, r.origTo)}`;
  return `${typeLabel(r)}: ${fmtRange(r.from, r.to)}`;
}

function fireAndForget(mails: Mail[]) {
  for (const mail of mails) {
    send(mail).catch((err) => console.error(`Mail aan ${mail.to} mislukt:`, err));
  }
}

/** Nieuwe aanvraag: naar de admins, behalve als de aanvrager zelf admin is. */
export function notifyNewRequest(r: AnyRequest) {
  const subject = `Nieuwe aanvraag van ${r.person}: ${describe(r)}`;
  const lines = [
    `${r.person} heeft een nieuwe aanvraag ingediend.`,
    "",
    describe(r),
    ...(r.shortNotice ? ["Let op: dit is op korte termijn."] : []),
    ...(r.note.trim() ? [`Toelichting: ${r.note.trim()}`] : []),
    "",
    "Je kunt hem beoordelen onder 'Te beoordelen'.",
  ];
  fireAndForget(ADMINS.filter((a) => a !== r.person).map((to) => ({ to, subject, lines })));
}

/** Beslissing over een aanvraag: naar de aanvrager, behalve als die zelf heeft beslist. */
export function notifyDecision(r: AnyRequest) {
  if (!r.reviewedBy || r.reviewedBy === r.person) return;
  const approved = r.status === "approved";
  const subject = `Je aanvraag is ${approved ? "goedgekeurd" : "afgekeurd"}: ${describe(r)}`;
  const lines = [
    `Hoi ${r.person},`,
    "",
    `${r.reviewedBy} heeft je aanvraag ${approved ? "goedgekeurd" : "afgekeurd"}.`,
    "",
    describe(r),
    ...(!approved && r.comment?.trim() ? [`Reden: ${r.comment.trim()}`] : []),
  ];
  fireAndForget([{ to: r.person, subject, lines }]);
}
