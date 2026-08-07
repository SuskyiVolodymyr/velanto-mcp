import { describe, expect, it } from "vitest";
import {
  PACK_FORMATS,
  PACK_MODERATION_STATUSES,
  PACK_TAGS,
  REPORT_STATUSES,
  REPORT_TYPES,
} from "../src/schemas.js";

/**
 * Closed-set wire contracts, pinned to explicit literals.
 *
 * These lists are owned by velanto-backend and hand-mirrored here — there is
 * deliberately no shared types package across the three repos. The backend and
 * the frontend already guard their copies of each other this way
 * (`cross-repo-drift.spec.ts` / `cross-repo-drift.test.ts`), so a change on
 * either side fails a test until someone consciously updates the other.
 *
 * This repo had no such guard, and drifted: it went on offering
 * `save_one_friends` for months after the format was retired, and never gained
 * `changes_requested` when moderation did. Neither failed anything — an MCP
 * schema is instructions to a model, so the only symptom was Claude confidently
 * building packs the API then rejected.
 *
 * Updating a list here is fine. Updating it WITHOUT the reciprocal change in
 * velanto-backend is the bug this catches.
 */
describe("wire contracts mirrored from velanto-backend", () => {
  // src/modules/packs/types/format.ts → SUPPORTED_FORMATS
  it("pins the pack formats", () => {
    expect([...PACK_FORMATS]).toEqual([
      "save_one",
      "sacrifice_one",
      "nxn",
      "rank_blind",
      "1v1",
    ]);
  });

  // The room-only sixth format, retired in the multiplayer redesign
  // (velanto-backend#276): its live-claim play became the "Claim" MODE in the
  // universal room model, so it is no longer a format a pack can be authored
  // in. The backend rejects it.
  it("no longer offers the retired save_one_friends format", () => {
    expect(PACK_FORMATS).not.toContain("save_one_friends");
  });

  // src/modules/packs/types/moderation-status.ts → PACK_MODERATION_STATUSES
  it("pins the pack moderation statuses", () => {
    expect([...PACK_MODERATION_STATUSES]).toEqual([
      "draft",
      "pending",
      "approved",
      "changes_requested",
      "rejected",
    ]);
  });

  // src/modules/packs/types/tags.ts → PACK_TAGS
  it("pins the pack tag count, so an added tag is a conscious update", () => {
    expect(PACK_TAGS).toHaveLength(31);
    expect(PACK_TAGS[0]).toBe("Anime");
  });

  // src/modules/reports/types/reasons.ts → REPORT_TYPES
  it("pins the report types", () => {
    expect([...REPORT_TYPES]).toEqual(["pack", "user", "round"]);
  });

  // src/modules/reports/types/status.ts → REPORT_STATUSES
  it("pins the report statuses", () => {
    expect([...REPORT_STATUSES]).toEqual(["new", "reviewing", "closed"]);
  });
});
