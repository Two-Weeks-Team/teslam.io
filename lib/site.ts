/** Single source of truth for the origin. Referenced by metadata, sitemap,
 *  robots, JSON-LD and the machine-readable mirrors. */
export const SITE = "https://teslam.io";

export const BRAND = "teslam.io";

export const REPO = "https://github.com/Two-Weeks-Team/teslam.io";

/**
 * Genesis 500 registration. The site stays fully static and collects nothing
 * itself — this points at an external form, so no personal data touches this
 * origin and there is no database to secure. Swap the URL, redeploy, done.
 */
export const WAITLIST_URL = "https://forms.gle/";

/** Reachable by a person, not a support queue. */
export const CONTACT_EMAIL = "hello@teslam.io";
