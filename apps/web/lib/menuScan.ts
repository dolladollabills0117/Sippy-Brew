import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { cleanScannedMenu, COFFEE_CATEGORIES, type ScannedMenuResult } from "@sippy/core";
import { z } from "zod";
import { AppError, badRequest } from "./http";

/**
 * Menu from a photo: Claude reads a photo of the shop's menu board or printed menu and returns
 * the drinks it sees. cleanScannedMenu (packages/core) then drops food and unpriced items and
 * normalizes prices and categories. Nothing is saved here: the shop reviews every item first.
 *
 * Needs ANTHROPIC_API_KEY on the server.
 */

const MenuSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("Drink name exactly as written on the menu"),
      size: z.string().nullable().describe('Size as written, e.g. "12 oz", "Small", "Large"; null if none is shown'),
      price: z.number().nullable().describe("Price in US dollars, e.g. 4.75; null if none is shown"),
      category: z.enum([...COFFEE_CATEGORIES, "food", "other"]).describe("espresso drinks, brewed coffee, cold coffee, specialty drinks; food or other for anything else"),
    }),
  ),
});

const SYSTEM = `You read photos of coffee shop menus and list every item on them.

- One entry per item and size: if a drink has several sizes with different prices, list each size separately with its own price.
- Copy names as written. Don't invent items, sizes or prices; use null for anything you can't read.
- Mark pastries, sandwiches and other food as "food", and non-coffee items such as merchandise as "other".
- Only use prices that are clearly attached to the item.`;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export async function scanMenuPhoto(input: { image?: string; mediaType?: string }): Promise<ScannedMenuResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError(503, "SCAN_UNAVAILABLE", "Menu photos aren't set up yet. Add items by hand for now.");
  const data = (input.image ?? "").replace(/^data:[^;]+;base64,/, "");
  const mediaType = input.mediaType as MediaType;
  if (!data || !MEDIA_TYPES.includes(mediaType)) throw badRequest("BAD_IMAGE", "Upload a JPEG, PNG, WebP or GIF photo of your menu.");
  if (Buffer.byteLength(data, "base64") > MAX_IMAGE_BYTES) throw badRequest("IMAGE_TOO_LARGE", "That photo is too large. Try one under 5 MB.");

  try {
    const response = await anthropic().beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // If the request is declined, the API retries it on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(MenuSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: "List the items on this menu." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new AppError(422, "SCAN_FAILED", "We couldn't read that menu. Try a clearer, straight-on photo, or add items by hand.");
    }
    return cleanScannedMenu(response.parsed_output.items);
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new AppError(429, "SCAN_BUSY", "Lots of menus being read right now. Try again in a minute.");
    if (e instanceof Anthropic.APIError) throw new AppError(502, "SCAN_FAILED", "We couldn't read that menu right now. Try again, or add items by hand.");
    throw e;
  }
}
