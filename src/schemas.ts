import { z } from "zod";

/**
 * Input shapes for the pack tools, mirroring the Velanto backend's create-pack
 * DTO (pools-and-rounds model). The API validates authoritatively and this
 * server relays any rejection, but keeping these faithful means the AI builds
 * valid packs first time.
 *
 * Coverage: the "groups + rounds" elimination formats — `save_one`,
 * `sacrifice_one`, `rank_blind`. The category formats (`nxn`, `1v1`) are not
 * modelled by this tool version.
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
  slots: z.array(slotSchema).min(1),
});

/** The create-pack input as a Zod raw shape (for tool registration). */
export const createPackShape = {
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  coverTone: z
    .string()
    .min(1)
    .describe("A cover accent tone, e.g. 'cyan', 'violet', 'green', 'amber'."),
  format: z
    .enum(["save_one", "sacrifice_one", "rank_blind"])
    .describe("The elimination format."),
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
  format: z.enum(["save_one", "sacrifice_one", "rank_blind"]).optional(),
  language: z.string().optional(),
  tags: z.array(z.enum(PACK_TAGS)).max(10).optional(),
  groups: z.array(groupSchema).optional(),
  rounds: z.array(roundSchema).optional(),
} as const;
