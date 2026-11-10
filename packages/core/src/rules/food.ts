/**
 * No food on Sippy Brew, whatsoever. Shops caught selling food are removed (see FOOD_POLICY).
 *
 * - A menu item whose name mentions a food (apples, cookie, croissant…) is refused unless the
 *   name makes clear it's a drink: "Apple Cider", "Dragonfruit Refresher", "Cookie Butter Latte".
 * - A customization that mentions a food must say what it is: "Cookie syrup", "Dragonfruit
 *   topping", "Strawberry puree", "Almond milk". "Cookie" or "Apples" on their own are refused.
 */

const FOODS = [
  // fruit
  "apple", "apricot", "avocado", "banana", "berry", "blackberry", "blueberry", "cantaloupe", "cherry", "coconut", "cranberry",
  "date", "dragonfruit", "dragon fruit", "fig", "fruit", "grape", "grapefruit", "guava", "kiwi", "lemon", "lime", "lychee", "mango",
  "melon", "orange", "papaya", "passion fruit", "passionfruit", "peach", "pear", "pineapple", "plum", "pomegranate", "raisin",
  "raspberry", "strawberry", "tangerine", "watermelon",
  // vegetables
  "carrot", "celery", "cucumber", "kale", "lettuce", "pepper", "potato", "pumpkin", "spinach", "tomato", "veggie", "vegetable",
  // baked goods and sweets
  "bagel", "bar", "biscotti", "biscuit", "bread", "brownie", "bun", "cake", "candy", "cheesecake", "churro", "cinnamon roll",
  "cookie", "cracker", "crepe", "croffle", "croissant", "cupcake", "danish", "dessert", "donut", "doughnut", "fudge", "gummy",
  "ice cream", "macaron", "macaroon", "madeleine", "marshmallow", "muffin", "pancake", "pastry", "pie", "pretzel", "pudding",
  "roll", "scone", "strudel", "tart", "toast", "truffle", "waffle",
  // meals and snacks
  "bacon", "breakfast", "burger", "burrito", "cheese", "chicken", "chips", "egg", "empanada", "fries", "granola", "ham",
  "hummus", "lunch", "meal", "nachos", "oatmeal", "panini", "parfait", "pizza", "popcorn", "porridge", "quiche", "salad",
  "sandwich", "sausage", "snack", "soup", "sushi", "taco", "turkey", "wrap", "yogurt", "food", "treat", "bite",
  // nuts
  "almond", "cashew", "hazelnut", "macadamia", "nut", "peanut", "pecan", "pistachio", "walnut",
];

/** Words that make a menu item clearly a drink. */
const DRINKS = [
  "affogato", "americano", "au lait", "breve", "brew", "cappuccino", "chai", "cider", "coffee", "cold brew", "cortado", "cubano",
  "drip", "espresso", "flat white", "frappe", "frappuccino", "latte", "lemonade", "macchiato", "matcha", "mocha", "nitro",
  "pour over", "pour-over", "refresher", "ristretto", "smoothie", "tea", "tonic", "café", "cafe",
];

/** Words that make a customization clearly a drink ingredient, not a food. */
const INGREDIENTS = [
  "syrup", "sauce", "drizzle", "topping", "foam", "cold foam", "puree", "purée", "powder", "flavor", "flavour", "extract",
  "milk", "creamer", "cream", "shot", "infusion", "concentrate", "sweetener",
];

const words = (list: string[]) =>
  new RegExp(
    `(^|[^a-z])(${list
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s-]?"))
      .join("|")})(s|es|ies)?(?![a-z])`,
    "i",
  );
const FOOD_RE = words(FOODS);
// "berries", "cherries"…: -y → -ies
const FOOD_IES_RE = /(^|[^a-z])(berr|blackberr|blueberr|cherr|cranberr|raspberr|strawberr|veggi|brownie|pastr|cand)ies(?![a-z])/i;
const DRINK_RE = words(DRINKS);
const INGREDIENT_RE = words(INGREDIENTS);

/** The food word in a name, if any ("Apples" → "Apples"). */
export function foodWordIn(name: string): string | null {
  const m = FOOD_RE.exec(name) ?? FOOD_IES_RE.exec(name);
  return m ? m[0].replace(/^[^a-z]/i, "") : null;
}

/** A menu item that reads like food and doesn't name a drink. */
export function looksLikeFood(name: string): boolean {
  return Boolean(foodWordIn(name)) && !DRINK_RE.test(name);
}

/** Why a menu item name isn't allowed, or null if it's fine. */
export function foodProblemInMenuItem(name: string): string | null {
  const food = foodWordIn(name);
  if (!food || DRINK_RE.test(name)) return null;
  return `"${name.trim()}" looks like food, and Sippy Brew is drinks only. If it's a drink, name the drink, like "Apple Cider" or "Dragonfruit Refresher".`;
}

/** Why a customization name isn't allowed, or null if it's fine. */
export function foodProblemInCustomization(name: string): string | null {
  const food = foodWordIn(name);
  // "Ice cream" isn't excused by the word "cream".
  if (!food || INGREDIENT_RE.test(name.replace(/ice[\s-]?cream/gi, ""))) return null;
  return `"${name.trim()}" looks like food. Say what it is, like "${capital(food)} syrup" or "${capital(food)} topping". No food can be sold through Sippy Brew.`;
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Zero tolerance, shown to shops at sign-up, in the merchant FAQ and in the Terms. */
export const FOOD_POLICY =
  "Sippy Brew is drinks only: no food, whatsoever. Flavors and add-ons must be listed as what they are, like \"Cookie syrup\" or \"Dragonfruit topping\". A shop caught selling food through Sippy Brew is removed from the platform, with no exceptions. If it happened by genuine error rather than misrepresentation, the shop can appeal.";
