import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  createPackShape,
  updatePackShape,
  REPORT_STATUSES,
  REPORT_TYPES,
} from "../src/schemas.js";

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

describe("createPackShape.draft", () => {
  it("accepts an optional draft flag", () => {
    expect(createPack.parse({ ...VERSUS_PACK, draft: true }).draft).toBe(true);
  });

  it("is optional (a pack with no draft flag is valid)", () => {
    expect(createPack.parse(VERSUS_PACK).draft).toBeUndefined();
  });

  it("is also accepted on update", () => {
    expect(updatePack.parse({ id: "p1", draft: false }).draft).toBe(false);
  });
});

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

  // A single-pool matchup (both slots reference ONE group) is a valid shape —
  // the MCP schema is structural, so it forwards this to the backend, which
  // hands each side disjoint items and caps rounds by the pool size.
  it("accepts a single-pool round (both slots the same group)", () => {
    const result = createPack.safeParse({
      ...VERSUS_PACK,
      groups: [
        {
          id: "g1",
          name: "Heroes",
          items: [
            { id: "i1", type: "text", title: "Iron Man", value: "2008" },
            { id: "i2", type: "text", title: "Batman", value: "1989" },
          ],
        },
      ],
      rounds: [
        {
          id: "r1",
          slots: [
            { groupId: "g1", mode: "random", count: 1 },
            { groupId: "g1", mode: "random", count: 1 },
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

/**
 * velanto-backend#250: a slot may name its pool (`groupId`) or ask for one at
 * play time (`groupMode: "random"`). The API validates authoritatively — these
 * only check the MCP can express both shapes, since a schema that rejects a
 * valid pack stops an agent building one at all.
 */
describe("slot pool mode", () => {
  const withSlots = (slots: unknown[]) => ({
    ...VERSUS_PACK,
    rounds: [{ id: "r1", slots }],
  });

  it("accepts a slot that names no pool when groupMode is random", () => {
    const result = createPack.safeParse(
      withSlots([
        { groupMode: "random", mode: "random", count: 1 },
        { groupMode: "random", mode: "random", count: 1 },
      ]),
    );
    expect(result.success).toBe(true);
  });

  it("accepts one random side against one named pool", () => {
    const result = createPack.safeParse(
      withSlots([
        { groupId: "g1", mode: "random", count: 1 },
        { groupMode: "random", mode: "random", count: 1 },
      ]),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a slot that neither names a pool nor asks for one", () => {
    const result = createPack.safeParse(
      withSlots([{ mode: "random", count: 1 }]),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a random-pool slot that also names a pool", () => {
    const result = createPack.safeParse(
      withSlots([
        { groupMode: "random", groupId: "g1", mode: "random", count: 1 },
      ]),
    );
    expect(result.success).toBe(false);
  });

  // An item id only means something inside a known pool.
  it("rejects a random-pool slot that pins items", () => {
    const result = createPack.safeParse(
      withSlots([{ groupMode: "random", mode: "manual", itemIds: ["i1"] }]),
    );
    expect(result.success).toBe(false);
  });

  it("still accepts the historic shape, with groupMode absent", () => {
    expect(createPack.safeParse(VERSUS_PACK).success).toBe(true);
  });
});

/**
 * The moderation filters were free strings documented with an example status
 * of 'open' — a value the backend has never had (REPORT_STATUSES is new /
 * reviewing / closed). An agent that believed the description filtered on
 * nothing. Typed here so the mirror can't drift silently again.
 */
describe("report filters", () => {
  it("mirrors the backend's report statuses exactly", () => {
    expect([...REPORT_STATUSES]).toEqual(["new", "reviewing", "closed"]);
    // 'open' is what the tool used to document. It has never been a status.
    expect(REPORT_STATUSES).not.toContain("open");
  });

  it("mirrors the backend's report types exactly", () => {
    expect([...REPORT_TYPES]).toEqual(["pack", "user", "round"]);
  });
});
