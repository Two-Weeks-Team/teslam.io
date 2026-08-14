import { describe, expect, it } from "vitest";
import { carCells, carMesh, PLANNED_TOTAL, FRONT_AXLE_T, REAR_AXLE_T } from "@/lib/car";
import { SEATS } from "@/lib/genesis";

/**
 * The car, checked against the car.
 *
 * Every number in lib/car.ts is a published dimension divided by 2347, which
 * means the geometry can be checked rather than looked at. It was looked at for
 * a long time first, and looking is how a hatchback with a long bonnet got
 * shipped as a saloon with a short one: the eye accepts a shape that is wrong
 * in a way it has no reference for.
 */
describe("the cohort car", () => {
  const cells = carCells();
  const mesh = carMesh();

  it("is exactly one cell per seat", () => {
    expect(cells).toHaveLength(SEATS);
    expect(PLANNED_TOTAL).toBe(SEATS);
    // Ordinals are 1..500 with no gaps: cell n lights when seat n is confirmed,
    // so a gap is a seat that can never light.
    expect(cells.map((c) => c.seat)).toEqual(
      Array.from({ length: SEATS }, (_, i) => i + 1),
    );
  });

  it("has the published proportions", () => {
    const ys = cells.map((c) => c.y);
    const zs = cells.map((c) => Math.abs(c.z));

    // 1443 mm tall on a 4694 mm car, normalised so the length spans 2.
    expect(Math.max(...ys)).toBeCloseTo(0.615, 3);
    // 1849 mm wide: the widest half-section, give or take the arch flare.
    expect(Math.max(...zs)).toBeGreaterThan(0.37);
    expect(Math.max(...zs)).toBeLessThan(0.4);
    // 2875 mm between the axles.
    expect(2 * (FRONT_AXLE_T - REAR_AXLE_T)).toBeCloseTo(1.225, 3);
    // And the overhangs are not equal — the rear is the longer one.
    expect(1 - FRONT_AXLE_T).toBeLessThan(REAR_AXLE_T);
  });

  it("keeps the tyres inside the bodywork", () => {
    let tyre = 0;
    let body = 0;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const z = Math.abs(mesh.positions[i + 2]);
      if (mesh.material[i / 3] > 0.5) tyre = Math.max(tyre, z);
      else body = Math.max(body, z);
    }
    // Flush, not proud and not sunk: a wheel standing outside the arch reads as
    // a hot rod, and one buried inside it disappears the moment the underbody
    // is closed. Both happened.
    expect(tyre).toBeLessThanOrEqual(body);
    expect(tyre).toBeGreaterThan(body - 0.03);
  });

  it("closes the underbody, so the far wheels cannot be seen through it", () => {
    // A floor at ground clearance rather than at the rocker. With the body
    // stopping at the rocker there was a 390 mm slot down the length of the
    // car and the figure came out with four wheels in a row.
    let lowestBody = 9;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      if (mesh.material[i / 3] > 0.5) continue;
      const t = (mesh.positions[i] + 1) / 2;
      // Away from the arches and the bumpers, where the floor is flat.
      if (Math.abs(t - FRONT_AXLE_T) < 0.13 || Math.abs(t - REAR_AXLE_T) < 0.13) continue;
      if (t < 0.12 || t > 0.88) continue;
      lowestBody = Math.min(lowestBody, mesh.positions[i + 1]);
    }
    expect(lowestBody).toBeLessThan(0.08);
  });

  it("cuts an arch that clears the tyre at both axles", () => {
    // The arch has to lift the body above 0.298, where the tyre tops out.
    for (const axle of [FRONT_AXLE_T, REAR_AXLE_T]) {
      let lowest = 9;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        if (mesh.material[i / 3] > 0.5) continue;
        const t = (mesh.positions[i] + 1) / 2;
        if (Math.abs(t - axle) > 0.01) continue;
        lowest = Math.min(lowest, mesh.positions[i + 1]);
      }
      expect(lowest, `the arch at ${axle.toFixed(2)} shaves the tyre`).toBeGreaterThan(0.298);
    }
  });

  it("puts glass only in the cabin, never on the boot or the bonnet", () => {
    for (let i = 0; i < mesh.positions.length; i += 3) {
      if (mesh.glass[i / 3] < 0.2) continue;
      const t = (mesh.positions[i] + 1) / 2;
      // The window line was computed as a fraction of each section's own
      // height, which makes the top of every section the top of the car — so
      // the boot lid and the bonnet came out as windows and the beltline ran
      // from bumper to bumper like a racing stripe.
      expect(t, "glass outside the A- and C-pillars").toBeGreaterThan(0.19);
      expect(t).toBeLessThan(0.81);
      expect(mesh.positions[i + 1], "glass below the beltline").toBeGreaterThan(0.4);
    }
  });

  it("builds a mesh an index buffer can address", () => {
    expect(mesh.indices.length % 3).toBe(0);
    expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length / 3);
    expect(Math.max(...mesh.indices)).toBeLessThan(65536);
    for (const a of [mesh.positions, mesh.normals, mesh.glass, mesh.material]) {
      expect([...a].every(Number.isFinite)).toBe(true);
    }
    // One glass value and one material value per vertex.
    expect(mesh.glass.length).toBe(mesh.positions.length / 3);
    expect(mesh.material.length).toBe(mesh.positions.length / 3);
  });
});
