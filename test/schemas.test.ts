import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPackShape, updatePackShape } from "../src/schemas.js";

const createPack = z.object(createPackShape);
const updatePack = z.object(updatePackShape);

/**
 * A minimal valid versus (nxn / 1v1) pack: two distinct pools, and every round
 * drawing one random slot from each — the shape the backend requires. See
 * velanto-backend `create-pack.dto.ts` for the authoritative rules.
 */
const VERSUS_PACK = {
  title: "Marvel vs DC",
  description: "Pick a side each round.",
  coverTone: "cyan",
  format: "nxn",
  tags: ["Comics"],
  groups: [
    {
      id: "g1",
      name: "Marvel",
      items: [{ id: "i1", type: "text", title: "Iron Man", value: "2008" }],
    },
    {
      id: "g2",
      name: "DC",
      items: [{ id: "i2", type: "text", title: "Batman", value: "1989" }],
    },
  ],
  rounds: [
    {
      id: "r1",
      slots: [
        { groupId: "g1", mode: "random", count: 2 },
        { groupId: "g2", mode: "random", count: 2 },
      ],
    },
  ],
};

describe("createPackShape.format", () => {
  it("accepts every format the backend supports", () => {
    for (const format of [
      "save_one",
      "sacrifice_one",
      "rank_blind",
      "nxn",
      "1v1",
    ]) {
      const result = createPack.safeParse({ ...VERSUS_PACK, format });
      expect(result.success, `${format} should be accepted`).toBe(true);
    }
  });

  it("rejects a format the backend doesn't have", () => {
    const result = createPack.safeParse({ ...VERSUS_PACK, format: "bracket" });
    expect(result.success).toBe(false);
  });
});

describe("versus packs", () => {
  it("accepts a two-slot round drawing from two distinct pools", () => {
    const result = createPack.safeParse(VERSUS_PACK);
    expect(result.success).toBe(true);
  });

  it("accepts 1v1 drawing exactly one item per side", () => {
    const result = createPack.safeParse({
      ...VERSUS_PACK,
      format: "1v1",
      rounds: [
        {
          id: "r1",
          slots: [
            { groupId: "g1", mode: "random", count: 1 },
            { groupId: "g2", mode: "random", count: 1 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("updatePackShape.format", () => {
  it("accepts every supported format, and stays optional", () => {
    for (const format of [
      "save_one",
      "sacrifice_one",
      "rank_blind",
      "nxn",
      "1v1",
    ]) {
      expect(updatePack.safeParse({ id: "p1", format }).success).toBe(true);
    }
    expect(updatePack.safeParse({ id: "p1" }).success).toBe(true);
  });
});
