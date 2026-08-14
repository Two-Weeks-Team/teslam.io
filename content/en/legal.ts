import type { LegalContent } from "@/content/ko/legal";

/**
 * English mirror of the legal pages. The Korean module is the source of truth
 * for structure; this file must match it key for key, which
 * `tests/content-parity.test.ts` enforces.
 */
export const legal: LegalContent = {
  backToHome: "Back to the board",
  navPrivacy: "Privacy",
  navTerms: "Terms",

  privacy: {
    meta: {
      title: "Privacy Policy — teslam.io",
      description:
        "What teslam.io collects at Genesis 500 registration, what it deliberately does not, and when it is deleted.",
    },
    title: "Privacy Policy",
    updatedLabel: "Effective",
    updated: "2026-08-13",
    lede: "teslam.io asks for the minimum needed to hold a Genesis 500 seat. Location data and vehicle identification numbers are not covered by this policy at any stage, because they are never collected.",
    sections: [
      {
        h: "1. What is collected",
        p: "Registration asks for the following. Every value is typed in by you; nothing is read automatically from a vehicle or a device.",
        items: [
          "Email address — to confirm registration, report your seat, and send the closed-beta invitation",
          "Vehicle model and trim — to understand the shape of the cohort. Self-reported and not verified",
          "Region — for density figures. A province-level choice, not a coordinate",
          "Monthly distance band — to check the reward model against a real distribution. A band, not a measurement",
          "Consent flags and the time they were given — the record that consent was obtained",
        ],
      },
      {
        h: "2. What is not collected",
        p: "None of the following is requested at registration. If a later stage genuinely needs one, it will be disclosed and consented to separately at that time.",
        items: [
          "Location of any kind — coordinates, routes, driving history",
          "Vehicle identification number — vehicle binding happens later, and only through Tesla's official authorisation",
          "Phone number, postal address, date of birth, national identification number",
          "Payment details — registration involves no transaction of any kind",
          "Your IP address — used momentarily to throttle abusive requests, never stored",
        ],
      },
      {
        h: "3. How it is used",
        p: "Only for the purposes below. There is no advertising profile, and nothing is sold to anyone.",
        items: [
          "Assigning a Genesis 500 seat and telling you the result",
          "Sending the closed-beta invitation",
          "Counting registrations by region — published only in a form that identifies nobody",
          "Sending product news, but only if you separately opted in to receive it",
        ],
      },
      {
        h: "4. What appears publicly",
        p: "The figures on the front page are aggregates. A seat number, region and vehicle model may appear anonymously in a recent-registrations list, but email addresses and any combination that would identify a person never leave through a public route.",
      },
      {
        h: "5. Retention and deletion",
        items: [
          "Deleted six months after the closed-beta invitation if you never respond",
          "Deleted without delay if you ask to withdraw",
          "If the service is abandoned, everything is deleted within thirty days of that being announced",
          "Deletion is performed so that recovery is not possible",
        ],
      },
      {
        h: "6. Processors",
        p: "The following providers process data on our behalf, each limited to what their service requires.",
        items: [
          "Cloudflare, Inc. — storage and transport of registration records",
          "Vercel Inc. — website hosting",
          "Google LLC — confirmation and notification email, via Google Workspace",
        ],
      },
      {
        h: "7. Disclosure to third parties",
        p: "Personal information is not shared with third parties. A lawful request from a criminal investigation authority, made through proper process, may be answered — and even then, nothing beyond the scope of the request is handed over.",
      },
      {
        h: "8. Sensitive and pseudonymised data",
        p: "No sensitive category is collected — beliefs, union membership, political opinion, health, sexual life, genetic data, criminal record. There is therefore nothing that could be disclosed and no opt-out for you to make. No pseudonymised data is generated or processed. Should either become necessary, this policy is amended first and consent is asked for separately.",
      },
      {
        h: "9. Automatic collection",
        // Rewritten when the board grew a sign-in. The previous sentence was
        // "no cookies", which the session cookie made false. A strictly
        // necessary cookie is exempt from consent, not from disclosure.
        p: "No analytics of any kind, no advertising identifier, no visitor-tracking script, and no local storage. This is verified in code: a test fails the build if a tracking tool is ever added.",
        items: [
          "Browsing sets no cookie at all.",
          "Signing in to the board sets exactly one (tsl_session). It keeps you signed in and does nothing else — it tracks no behaviour and is shared with nobody.",
          "It is HttpOnly, so no script can read it; it expires after 30 days, and signing out deletes it from your browser and from our database at once.",
          "It is strictly necessary to provide the service, so it is not subject to separate consent. To refuse it, do not sign in — reading the board needs no account.",
        ],
      },
      {
        h: "10. Rights of users and legal guardians",
        p: "You may exercise the following at any time. Write to the address below and we will act on it and tell you the outcome.",
        items: [
          "Access your own record",
          "Correct anything that is wrong",
          "Delete it and withdraw your registration",
          "Halt processing",
          "Withdraw marketing consent — your seat is unaffected",
          "Personal data of children under 14 is not collected. If any is found to have been collected in error it is deleted without delay, and a legal guardian may exercise the rights above on the child's behalf",
        ],
      },
      {
        h: "11. Safeguards",
        items: [
          "Everything in transit is encrypted",
          "Confirmation tokens are stored only as hashes, never in the clear",
          "The operator's export route requires separate authentication",
          "Collecting less in the first place is treated as the primary safeguard",
        ],
      },
      {
        h: "12. Data protection officer",
        p: "The point of contact responsible for personal data handling and for any grievance arising from it. Under article 31(2) of the Personal Information Protection Act, while no separate officer is designated, the representative of the operating body is the officer.",
        items: [
          "Team: teslam.io operations",
          "Contact: hello@teslam.io",
          "A person reads and answers. This is not an automated queue",
        ],
      },
      {
        h: "13. Changes to this policy",
        p: "Any change is posted here with its effective date before it takes effect, never backdated. A change that widens what is collected or how it is used will be sent to existing registrants individually, and consent will be asked for again.",
      },
    ],
  },

  terms: {
    meta: {
      title: "Terms of Use — teslam.io",
      description:
        "What Genesis 500 registration is and is not. It promises no token and no goods.",
    },
    title: "Terms of Use",
    updatedLabel: "Effective",
    updated: "2026-08-13",
    lede: "These terms cover Genesis 500 registration on teslam.io. The most important clause comes first — registration promises no token and no goods.",
    sections: [
      {
        h: "1. What registration is",
        p: "Registering for Genesis 500 secures your place in the order of invitations when the service opens. A seat number records that position and carries nothing beyond it.",
      },
      {
        h: "2. What registration does not promise",
        p: "To be unambiguous. This paragraph is the substance of these terms.",
        items: [
          "DRV and TSLM have not been issued. Registration is not a promise to sell or distribute either",
          "A seat holds no monetary value and cannot be transferred or sold",
          "Registration costs nothing. Any message asking you for money is not from us",
          "Reward figures shown on this site are output from a design model, not a guarantee of payment",
          "The service may never launch. If that happens, records are deleted and the fact is announced",
        ],
      },
      {
        h: "3. Relationship with Tesla",
        p: "teslam.io is an independent community project, neither affiliated with nor endorsed by Tesla, Inc. Vehicle data will be connected at a later stage only through the route Tesla officially provides, and only with the vehicle owner's own authorisation.",
      },
      {
        h: "4. Conditions of registration",
        items: [
          "Register with an email address you actually use — no seat is assigned until you answer the confirmation",
          "Duplicate registrations intended to hold several seats may be cancelled",
          "Vehicle details are not verified. Any mismatch is settled later, when a real vehicle is bound",
        ],
      },
      {
        h: "5. Withdrawal",
        p: "Write to hello@teslam.io at any time and your registration is withdrawn and the record deleted. No reason is required. You may register again afterwards, though the seat number will be reassigned by the order at that later moment.",
      },
      {
        h: "6. Operator's powers",
        p: "Registrations made fraudulently, generated in bulk by automation, or using someone else's email may be cancelled without notice. Seats are not reclaimed for any other reason.",
      },
      {
        h: "7. Changes to the service",
        p: "The design and the schedule may change. Changes to reward rules, phase plans or the number of seats are posted here and sent to registrants. A change that disadvantages registrants takes effect no sooner than thirty days after it is announced.",
      },
      {
        h: "8. Limits of responsibility",
        p: "Information offered during registration is provided as it stands. We are not responsible for decisions or expectations formed from the model figures shown on the site. Responsibility for harm caused by intent or gross negligence is not limited.",
      },
      {
        h: "9. Governing law",
        p: "These terms are governed by the law of the Republic of Korea. Disputes are heard in the court having jurisdiction under its Civil Procedure Act.",
      },
      {
        h: "10. Contact",
        p: "Questions about these terms go to hello@teslam.io.",
      },
    ],
  },
};
