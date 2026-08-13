/** Single source of truth for the origin. Referenced by metadata, sitemap,
 *  robots, JSON-LD and the machine-readable mirrors. */
export const SITE = "https://teslam.io";

export const BRAND = "teslam.io";

export const REPO = "https://github.com/Two-Weeks-Team/teslam.io";

/**
 * Where the registration API lives.
 *
 * Registration used to point at an external form, and this file used to say
 * the site "collects nothing itself — there is no database to secure". That is
 * no longer true, and pretending otherwise would be the dishonest half of a
 * half-measure: a seat counter can only be real if this origin owns the seats.
 *
 * What is kept from that posture is the discipline, not the claim. The store
 * holds an address, a self-reported car, a region and a consent record — no
 * coordinate, no VIN, no phone number — and `/privacy` lists the absences as
 * plainly as the presences.
 *
 * Overridable so a preview deployment can talk to the preview Worker.
 */
export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "https://api.teslam.io";

/** Reachable by a person, not a support queue. */
export const CONTACT_EMAIL = "hello@teslam.io";
