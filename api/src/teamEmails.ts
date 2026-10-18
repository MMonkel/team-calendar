import { isPerson, type Person } from "shared";

/**
 * Koppeling e-mailadres ↔ teamlid, uit de env var TEAM_EMAILS (in Azure een
 * Key Vault-secret). Staat bewust niet in de code: de repo is publiek.
 * Formaat: {"Marc": "marc@monkel.com", "Nicole": ["nicole@x.nl", "n@y.nl"]}
 * Bij meerdere adressen kan een teamlid met elk ervan inloggen; mail gaat
 * naar het eerste.
 */
const emailToPerson = new Map<string, Person>();
const personToEmail = new Map<Person, string>();

loadTeamEmails(process.env.TEAM_EMAILS);

function loadTeamEmails(raw: string | undefined) {
  if (!raw) {
    if ((process.env.APP_ENV ?? "local") !== "local") console.error("TEAM_EMAILS ontbreekt: niemand kan inloggen.");
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("TEAM_EMAILS is geen geldige JSON: niemand kan inloggen.");
    return;
  }
  for (const [person, emails] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isPerson(person)) {
      console.error(`TEAM_EMAILS: '${person}' is geen teamlid, overgeslagen.`);
      continue;
    }
    for (const email of Array.isArray(emails) ? emails : [emails]) {
      if (typeof email !== "string") continue;
      const normalized = email.trim().toLowerCase();
      emailToPerson.set(normalized, person);
      if (!personToEmail.has(person)) personToEmail.set(person, normalized);
    }
  }
}

export function personForEmail(email: string): Person | undefined {
  return emailToPerson.get(email.trim().toLowerCase());
}

export function emailForPerson(person: Person): string | undefined {
  return personToEmail.get(person);
}
