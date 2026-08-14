/**
 * Who made the car.
 *
 * The body on the Genesis panel is somebody else's mesh under a Creative
 * Commons Attribution licence, and attribution is the condition of that
 * licence rather than a courtesy — so it is a constant the page cannot render
 * without, in one place, used both beside the model and in the footer.
 *
 * Worth saying plainly: a CC-BY grant covers the uploader's own work in the
 * mesh. It is not, and cannot be, a licence to Tesla's design rights in the
 * vehicle — nobody but Tesla can give that. teslam.io draws the car this
 * community drives, is not affiliated with Tesla, Inc., and says so on every
 * page.
 *
 * Fill this in when the file lands. `scripts/build-car.mjs` does not know who
 * made its input and must not guess.
 */
export const CAR_CREDIT = {
  text: "차량 3D 모델",
  author: "—",
  href: "https://creativecommons.org/licenses/by/4.0/",
  licence: "CC BY 4.0",
} as const;
