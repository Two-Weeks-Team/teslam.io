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
 * What is kept from that posture is the discipline, not the claim. Registration
 * holds an address, a self-reported car, a region and a consent record — no
 * coordinate, no VIN, no phone number — and `/privacy` lists the absences as
 * plainly as the presences.
 *
 * That inventory is registration's, and stops being the whole site's the moment
 * a car is linked: `0004_vehicle_vin.sql` stores a VIN, because Fleet Telemetry
 * identifies a vehicle by nothing else. `/privacy` still says a VIN is not
 * received "어느 단계에서도" and that sentence is being revised by its owner —
 * it is legal text, and it is the one place where this repository currently
 * says something the database contradicts.
 *
 * Overridable so a preview deployment can talk to the preview Worker.
 */
export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "https://api.teslam.io";

/** Reachable by a person, not a support queue. */
export const CONTACT_EMAIL = "hello@teslam.io";
