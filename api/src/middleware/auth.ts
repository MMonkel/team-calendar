import type { NextFunction, Request, Response } from "express";
import { isAdmin, isPerson, type Person } from "shared";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Person;
    }
  }
}

/**
 * Bepaalt wie er is ingelogd.
 *
 * TODO Entra ID: dit is nu een placeholder die de gebruiker vertrouwt op zijn
 * woord via de 'x-user' header. Voor productie vervang je dit door:
 *   1. de frontend laat MSAL een id-token voor deze API ophalen;
 *   2. hier valideer je dat token tegen Azure AD's JWKS-endpoint
 *      (bijv. met de 'jose' of 'passport-azure-ad' package) en lees je de
 *      naam of het e-mailadres uit de token-claims;
 *   3. je koppelt die claim aan een van de vaste teamleden (of breidt het
 *      team-bestand in shared/src/team.ts uit met een e-mailadres per
 *      persoon zodat de koppeling niet op de weergavenaam hoeft te steunen).
 * Zolang dat niet is aangesloten, is dit puur voor ontwikkeling: iedereen
 * die de header kan zetten, kan zich voordoen als wie dan ook.
 */
export function resolveUser(req: Request, res: Response, next: NextFunction) {
  const header = req.header("x-user");
  if (!header || !isPerson(header)) {
    res.status(401).json({ error: "unauthenticated", message: "Header 'x-user' ontbreekt of is onbekend." });
    return;
  }
  req.user = header;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !isAdmin(req.user)) {
    res.status(403).json({ error: "forbidden", message: "Alleen Alexandra en Marc mogen dit." });
    return;
  }
  next();
}
