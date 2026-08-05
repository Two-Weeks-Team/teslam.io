import { Archivo, IBM_Plex_Mono } from "next/font/google";

/**
 * Two latin faces, and no Korean webfont at all.
 *
 * A subsetted Korean face is still hundreds of kilobytes, and this page is
 * mostly figures — the money is better spent on the numbers rendering
 * instantly. Korean falls to Pretendard where it is installed (common on
 * Korean machines) and to the platform UI face otherwise; see `--font-sans`
 * in globals.css.
 *
 * Archivo carries a width axis, which is what lets the headline run slightly
 * condensed without a second file.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
  preload: true,
});

/** Every figure, label and readout on the page. */
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: true,
});

/** Every font variable, for the <html> className. */
export const fontVars = [archivo.variable, plexMono.variable].join(" ");
