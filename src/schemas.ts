import { z } from "zod";

/**
 * Input shapes for the pack tools, mirroring the Velanto backend's create-pack
 * DTO (pools-and-rounds model). The API validates authoritatively and this
 * server relays any rejection, but keeping these faithful means the AI builds
 * valid packs first time.
 *
 * All five formats share one shape — pools (`groups`) plus `rounds` of `slots`.
 * They differ only in the per-round slot rules, described on `format` below:
 * elimination formats draw a single slot per round, versus formats pit two
 * pools against each other. Those rules can't be expressed in the raw shape MCP
 * registers tools with, so they live in the field descriptions, and the backend
 * enforces them for real (see its `create-pack.dto.ts`).
 */

/** Category tags a pack can carry, mirrored from the backend PACK_TAGS. */
export const PACK_TAGS = [
  "Anime", "Movies", "Music", "Sports", "Football", "Basketball", "Wrestling",
  "Food", "Gaming", "Board Games", "Comics", "Sci-Fi", "Fantasy", "Horror",
  "TV", "Cartoons", "Books", "Fashion", "Cars", "History", "Mythology",
  "Nature", "Animals", "Technology", "Science", "Space", "Art", "Travel",
  "Celebrities", "K-pop", "Memes",
] as const;

// An item is one of three types; a youtube item's value must be a video URL.
export const itemSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("text"),
    title: z.string().min(1).max(200),
    value: z.string().min(1).max(1000).describe("The text body."),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("youtube"),
    title: z.string().min(1).max(200),
    value: z.string().url().describe("A YouTube video URL."),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("image"),
    title: z.string().min(1).max(200),
    value: z.string().min(1).describe("An image URL or uploaded media key."),
  }),
]);

// A group is a reusable POOL of items — no draw config of its own (that's a
// per-round slot concern).
export const groupSchema = z.object({
  id: z.string().min(1).describe("Unique id within the pack, e.g. 'g1'."),
  name: z.string().min(1).max(100),
  items: z.array(itemSchema).min(1),
});

// A slot draws from one group: 'random' draws `count` items; 'manual' shows the
// explicit ordered `itemIds`.
export const slotSchema = z.object({
  groupId: z.string().min(1).describe("Id of the group this slot draws from."),
  mode: z.enum(["random", "manual"]),
  count: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("How many items to draw — required when mode is 'random'."),
  itemIds: z
    .array(z.string().min(1))
    .optional()
    .describe("Explicit item ids to show — required when mode is 'manual'."),
});

export const roundSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(100).optional().describe("Optional round label."),
  slots: z
    .array(slotSchema)
    .min(1)
    .describe(
      "Elimination formats (save_one, sacrifice_one, rank_blind): exactly 1 " +
        "slot. Versus formats (nxn, 1v1): exactly 2 slots — one per side.",
    ),
});

/** The format enum, shared by create and update so they can't drift apart. */
const formatSchema = z
  .enum(["save_one", "sacrifice_one", "rank_blind", "nxn", "1v1"])
  .describe(
    "How the pack plays, which fixes the shape of every round. " +
      "save_one / sacrifice_one / rank_blind: each round has exactly 1 slot " +
      "drawing 2-8 items. " +
      "nxn / 1v1: each round has exactly 2 slots, one per side, and both must " +
      "use mode 'random'. The two slots must reference two DIFFERENT groups. " +
      "Each round is its own independent matchup — different rounds may pit " +
      "different group pairs, in any order (e.g. round 1 boys vs girls, round " +
      "2 heroes vs villains). " +
      "nxn draws 1-8 items per side; 1v1 must draw exactly 1 per side.",
  );

/** The create-pack input as a Zod raw shape (for tool registration). */
export const createPackShape = {
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  coverTone: z
    .string()
    .min(1)
    .describe("A cover accent tone, e.g. 'cyan', 'violet', 'green', 'amber'."),
  coverImageKey: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Storage key of a custom cover image, from upload_image with kind 'cover'. Omit to use the coverTone gradient.",
    ),
  format: formatSchema,
  language: z
    .string()
    .optional()
    .describe("ISO 639-1 code, e.g. 'en'. Defaults to the account's language."),
  tags: z.array(z.enum(PACK_TAGS)).max(10).describe("Category tags."),
  groups: z.array(groupSchema).min(1),
  rounds: z.array(roundSchema).min(1),
} as const;

/** Update-pack input: an id plus any subset of the create fields. */
export const updatePackShape = {
  id: z.string().describe("The id of the pack to update."),
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  coverTone: z.string().min(1).optional(),
  coverImageKey: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Storage key of a custom cover image, from upload_image with kind 'cover'. Omit to keep the coverTone gradient.",
    ),
  format: formatSchema.optional(),
  language: z.string().optional(),
  tags: z.array(z.enum(PACK_TAGS)).max(10).optional(),
  groups: z.array(groupSchema).optional(),
  rounds: z.array(roundSchema).optional(),
} as const;
