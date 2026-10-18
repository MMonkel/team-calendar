import type { NextFunction, Request, Response } from "express";
import { isAdmin, isPerson, type Person } from "shared";
import { personForEmail } from "../teamEmails.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Person;
    }
  }
}

/**
 * Lokaal (APP_ENV niet gezet of "local") draait er geen Container Apps-auth
 * voor de app, dus kies je wie je bent met de personenkiezer, die de
 * 'x-user'-header zet. In Azure wordt die header genegeerd: daar telt alleen
 * de login via Entra ID.
 */
export const devMode = (process.env.APP_ENV ?? "local") === "local";

// Claims waar een e-mailadres in kan staan. Bij gasten (B2B) is 'upn' de
// #EXT#-vorm en staat het echte adres in 'email' of 'preferred_username'.
const EMAIL_CLAIMS = new Set([
  "email",
  "emails",
  "preferred_username",
  "upn",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
]);

/** E-mailadressen uit de X-MS-CLIENT-PRINCIPAL die Container Apps-auth meestuurt. */
function principalEmails(req: Request): string[] {
  const emails: string[] = [];
  const encoded = req.header("x-ms-client-principal");
  if (encoded) {
    try {
      const principal = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
        claims?: Array<{ typ: string; val: string }>;
      };
      for (const c of principal.claims ?? []) {
        if (EMAIL_CLAIMS.has(c.typ) && c.val) emails.push(c.val);
      }
    } catch {
      // Onleesbare principal: behandelen als niet ingelogd.
    }
  }
  const name = req.header("x-ms-client-principal-name");
  if (name) emails.push(name);
  return emails.map((e) => e.trim().toLowerCase());
}

/** Bepaalt wie er is ingelogd en zet dat op req.user. */
export function resolveUser(req: Request, res: Response, next: NextFunction) {
  if (devMode) {
    const header = req.header("x-user");
    if (!header || !isPerson(header)) {
      res.status(401).json({ error: "unauthenticated", message: "Header 'x-user' ontbreekt of is onbekend." });
      return;
    }
    req.user = header;
    next();
    return;
  }

  const emails = principalEmails(req);
  if (emails.length === 0) {
    res.status(401).json({ error: "unauthenticated", message: "Niet ingelogd." });
    return;
  }
  const person = emails.map(personForEmail).find((p): p is Person => p !== undefined);
  if (!person) {
    // Liefst het echte adres tonen, niet de #EXT#-vorm van een gast.
    const shown = emails.find((e) => !e.includes("#ext#")) ?? emails[0];
    res.status(403).json({
      error: "not_in_team",
      message: `Je bent ingelogd als ${shown}, maar dat adres hoort niet bij een teamlid.`,
      email: shown,
    });
    return;
  }
  req.user = person;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !isAdmin(req.user)) {
    res.status(403).json({ error: "forbidden", message: "Alleen Alexandra en Marc mogen dit." });
    return;
  }
  next();
}
