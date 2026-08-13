import type { GenesisContent } from "@/content/ko/genesis";

export const genesis: GenesisContent = {
  meta: {
    title: "Genesis 500 registration — teslam.io",
    description:
      "Pre-registration for a seat in the Genesis 500 cohort. Email and a self-reported car; no location, no VIN.",
  },
  eyebrow: "Phase 0 — pre-registration",
  title: "One of five hundred",
  lede: "The service has not started. What this does is hold your place in the order of invitations when the closed beta opens, and it promises nothing beyond that.",
  seatsLabel: "Seats confirmed so far",
  countStale: "The count could not be loaded — the figure below is not current",
  ofSeats: "of 500",

  form: {
    emailLabel: "Email",
    emailHint: "We send a confirmation. No seat is held until you answer it.",
    modelLabel: "Model",
    trimLabel: "Trim",
    regionLabel: "Where you mostly drive",
    kmLabel: "Distance per month",
    kmHint: "A rough band is fine. It is used only to check the reward model against a real distribution.",
    choose: "Select",
    consentTerms: "I agree to the terms of use",
    consentPrivacy: "I agree to the collection and use of my personal information",
    consentMarketing: "Send me product news by email",
    consentMarketingHint: "Optional. Declining does not affect your seat.",
    submit: "Claim a seat",
    submitting: "Sending",
  },

  notCollected: {
    title: "What is not asked for",
    items: [
      "Location of any kind — no coordinates, no routes, no driving history",
      "Vehicle identification number — binding happens later, through Tesla's own authorisation",
      "Phone number, postal address, date of birth",
      "Payment details — registration costs nothing",
    ],
  },

  errors: {
    invalid: "Please check the form again.",
    rateLimited: "Too many attempts in a short time. Please try again shortly.",
    network: "Could not reach the server. Please try again shortly.",
    fieldMissing: "This is required",
  },

  pending: {
    title: "Check your email",
    body: "A confirmation link is on its way. Opening it assigns your seat number. Until then no seat is held.",
    resend: "If it does not arrive, submit the same address again and a fresh link is sent.",
  },

  already: {
    title: "You already have a seat",
    body: "This address has already been confirmed. If you have lost your seat number, write to hello@teslam.io and we will tell you.",
  },

  confirm: {
    meta: {
      title: "Seat confirmed — teslam.io",
      description: "Your Genesis 500 placement.",
    },
    working: "Confirming",
    seatTitle: "Your seat is confirmed",
    seatLabel: "Seat number",
    seatOf: "of 500",
    waitlistTitle: "You are on the waiting list",
    waitlistLabel: "Position",
    waitlistBody:
      "All five hundred seats are taken. If one is given up, we work down this list in order.",
    nameplate: "Registered vehicle",
    share: "Copy the link to your seat",
    shareCopied: "Copied",
    backHome: "Go to the board",
    failedTitle: "That link did not work",
    failedBody:
      "It has either been used already or expired. Submit the same address again and a fresh link is sent.",
    notToken: "Please arrive here through the confirmation link.",
  },

  disclaimer:
    "DRV and TSLM have not been issued. A seat holds no monetary value and cannot be transferred or sold. Registration costs nothing, and any message asking you for money in our name is not from us.",
};
