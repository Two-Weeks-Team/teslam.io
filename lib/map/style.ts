/**
 * A dark basemap style, written rather than borrowed.
 *
 * The off-the-shelf free styles are all light — positron, liberty, bright — and
 * dropping a white map into this page would have been the single loudest thing
 * on it, fighting a board that is otherwise near-black. Restyling one at runtime
 * means depending on the internals of a file somebody else can change.
 *
 * So this is a small style of our own over OpenFreeMap's vector tiles: a
 * background, water, the road classes that matter at the zooms this map is used
 * at, and labels. It is a fraction of a full cartographic style because the map
 * has one job — show where a drive went — and everything that does not serve
 * that is noise behind the line.
 *
 * Tiles: OpenFreeMap (openfreemap.org), OpenStreetMap data, ODbL. No key, no
 * quota, no billing account. Attribution is required and is rendered by the
 * map's own control.
 */

// Type-only, so nothing from the library reaches the bundle through this file.
import type { StyleSpecification } from "maplibre-gl";

const INK = "#0b1016";
const WATER = "#0e1a24";
const LAND = "#121922";
const ROAD_MINOR = "#1e2733";
const ROAD_MAJOR = "#2a3644";
const ROAD_TRUNK = "#36485a";
const LABEL = "#7c8797";
const LABEL_HALO = "#080c11";

export const OPENFREEMAP_TILES = "https://tiles.openfreemap.org/planet";

/** Required by ODbL, and shown by MapLibre's attribution control. */
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export function darkStyle(): StyleSpecification {
  return {
    version: 8 as const,
    // MapLibre needs somewhere to fetch label fonts from; OpenFreeMap serves
    // the standard Noto set the OSM styles use, which covers Hangul.
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "vector" as const,
        url: OPENFREEMAP_TILES,
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: [
      { id: "bg", type: "background" as const, paint: { "background-color": INK } },
      {
        id: "land",
        type: "fill" as const,
        source: "osm",
        "source-layer": "landcover",
        paint: { "fill-color": LAND, "fill-opacity": 0.5 },
      },
      {
        id: "water",
        type: "fill" as const,
        source: "osm",
        "source-layer": "water",
        paint: { "fill-color": WATER },
      },
      /*
       * Roads, in three weights.
       *
       * Widths are interpolated against zoom rather than fixed: a 2px trunk road
       * at z6 is the whole country's motorway network drawn as a smear, and the
       * same 2px at z16 is invisible next to the route line on top of it.
       */
      {
        id: "road-minor",
        type: "line" as const,
        source: "osm",
        "source-layer": "transportation",
        filter: ["in", "class", "minor", "service", "track"],
        minzoom: 12,
        paint: {
          "line-color": ROAD_MINOR,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 18, 6],
        },
      },
      {
        id: "road-major",
        type: "line" as const,
        source: "osm",
        "source-layer": "transportation",
        filter: ["in", "class", "secondary", "tertiary"],
        minzoom: 9,
        paint: {
          "line-color": ROAD_MAJOR,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 18, 9],
        },
      },
      {
        id: "road-trunk",
        type: "line" as const,
        source: "osm",
        "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk", "primary"],
        paint: {
          "line-color": ROAD_TRUNK,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 18, 12],
        },
      },
      {
        id: "building",
        type: "fill" as const,
        source: "osm",
        "source-layer": "building",
        minzoom: 14,
        paint: { "fill-color": "#161d27", "fill-opacity": 0.7 },
      },
      {
        id: "place-label",
        type: "symbol" as const,
        source: "osm",
        "source-layer": "place",
        filter: ["in", "class", "city", "town", "suburb"],
        layout: {
          "text-field": ["coalesce", ["get", "name:ko"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 14, 15],
        },
        paint: {
          "text-color": LABEL,
          "text-halo-color": LABEL_HALO,
          "text-halo-width": 1.4,
        },
      },
    ],
  };
}
