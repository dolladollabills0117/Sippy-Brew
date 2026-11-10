import { describe, expect, it } from "vitest";
import { foodProblemInCustomization, foodProblemInMenuItem, looksLikeFood, validateMenuItem, validateModifierGroups } from "../src";

describe("No food whatsoever: menu items", () => {
  const blocked = [
    "Apples", "Apple", "Banana", "Fresh Fruit Cup", "Mixed Berries", "Strawberries", "Dragonfruit", "Dragon Fruit",
    "Chocolate Chip Cookie", "Cookies", "Blueberry Muffin", "Croissant", "Bagel", "Avocado Toast", "Breakfast Sandwich",
    "Egg Bites", "Banana Bread", "Cinnamon Roll", "Granola Bar", "Yogurt Parfait", "Cheese Danish", "Brownie", "Brownies",
    "Pastries", "Ice Cream", "Almonds", "Peanut Butter Cup Bite", "Pumpkin Bread", "Oatmeal", "Chips",
  ];
  for (const name of blocked) {
    it(`refuses "${name}"`, () => {
      expect(foodProblemInMenuItem(name)).toMatch(/looks like food/);
      expect(looksLikeFood(name)).toBe(true);
      expect(validateMenuItem({ name, size: "1", priceCents: 400, category: "specialty" })).toMatchObject({ ok: false, field: "name" });
    });
  }

  const allowed = [
    "Latte", "Oat Latte", "Cortado", "Toasted Hazelnut Latte", "Apple Cider", "Dragonfruit Refresher", "Strawberry Matcha",
    "Peach Iced Tea", "Cookie Butter Latte", "Pumpkin Spice Latte", "Banana Bread Cold Brew", "Orange Mocha", "Lemonade",
    "Coconut Cold Brew", "Honey Lavender Latte", "Dirty Chai", "Affogato", "Almond Milk Latte", "Barista's Choice Espresso",
  ];
  for (const name of allowed) {
    it(`allows the drink "${name}"`, () => {
      expect(foodProblemInMenuItem(name)).toBeNull();
    });
  }
});

describe("No food whatsoever: customizations must say what they are", () => {
  it("refuses bare food add-ons", () => {
    for (const name of ["Cookie", "Apples", "Dragonfruit", "Strawberries", "Chocolate chip cookie", "Vanilla ice cream", "Almonds", "Croissant"]) {
      expect(foodProblemInCustomization(name)).toMatch(/Say what it is/);
    }
    expect(foodProblemInCustomization("Dragonfruit")).toContain('"Dragonfruit topping"');
  });

  it("allows labelled drink ingredients", () => {
    for (const name of ["Cookie syrup", "Dragonfruit topping", "Strawberry puree", "Almond milk", "Coconut milk", "Hazelnut syrup", "Cheese foam", "Pumpkin cold foam", "Caramel drizzle", "Oat milk", "Extra shot", "Vanilla"]) {
      expect(foodProblemInCustomization(name)).toBeNull();
    }
  });

  it("applies when a shop saves customizations", () => {
    const g = (name: string) => [{ id: "g", name: "Add-ons", required: false, maxSelect: 1, options: [{ id: "o", name, priceCents: 75 }] }];
    expect(validateModifierGroups(g("Apples"))).toMatchObject({ ok: false });
    expect(validateModifierGroups(g("Apple syrup"))).toEqual({ ok: true });
  });
});
