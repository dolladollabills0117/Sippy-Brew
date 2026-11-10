import { RULES, SITE, SUB_TIERS } from "./config";

/**
 * Member FAQ, shown in the demo and on /faq. Plain-language summary; the Terms of Service
 * control. Draft copy for legal review (docs/OPEN_DECISIONS.md) before launch.
 */
export interface FaqItem {
  q: string;
  a: string;
}
export interface FaqSection {
  title: string;
  items: readonly FaqItem[];
}

const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const house = SUB_TIERS.find((s) => s.id === "decaf")!;
const specialty = SUB_TIERS.find((s) => s.id === "double_shot")!;

export const FAQ: readonly FaqSection[] = [
  {
    title: "The basics",
    items: [
      {
        q: "What is Sippy Brew?",
        a: "A monthly coffee pass you can use at participating local coffee shops. You set your coffee budget once, order ahead in the app, and pick up at the counter. We're a membership and ordering service, not a coffee shop.",
      },
      {
        q: "How does a Daily Pass work?",
        a: `Each pass covers one order on one day, at one shop, up to your plan's daily amount: ${money(house.maxPassValueCents)} on ${house.name}, ${money(specialty.maxPassValueCents)} on ${specialty.name}. You can use one pass per day.`,
      },
      {
        q: "What if my order costs more than my pass covers?",
        a: "The app shows you the exact difference (the overage) before you place the order, and you have to confirm it. It's charged to your card when the shop hands over your order, at the shop's menu prices, and it goes to the shop. If you have a bonus pass, you can choose to put it toward the overage: it covers up to your daily amount and you pay only what's left.",
      },
      {
        q: "Do unused passes roll over?",
        a: `No. Monthly passes reset on your renewal date and unused ones expire. Bonus passes from the Neighborhood Passport and referrals are the exception: each lasts ${RULES.bonusPassLifetimeDays} days from the day you earn it.`,
      },
      {
        q: "Is this a discount?",
        a: "No. Sippy Brew is a way to budget the coffee you already buy and to discover local shops. How much value you get depends on how many passes you use and what you order. We don't promise savings.",
      },
      {
        q: "Can I order food?",
        a: "No. Sippy Brew is drinks only, so passes never cover food. You can always buy food from the shop directly. If a shop offers you food through Sippy Brew, let us know.",
      },
    ],
  },
  {
    title: "Your orders",
    items: [
      {
        q: "Who makes my coffee?",
        a: "The coffee shop. Participating shops are independent businesses, not owned or run by Sippy Brew. Each shop is responsible for its drinks, ingredients, prices, service, staff and premises.",
      },
      {
        q: "Something went wrong with my order. Who do I contact?",
        a: "Contact the coffee shop that made it. They're the only ones who can remake a drink, fix a mistake or sort out a wait. Your order screen shows the shop's name and address. Sippy Brew isn't responsible for the quality of a drink, mistakes in an order, orders that weren't made or received, or wait times.",
      },
      {
        q: "I have an allergy or dietary need. Is my drink safe?",
        a: "Add it in the Allergies box when you order, so the shop sees an allergy notice with your order, and tell the barista at pickup too, every time, before you drink anything. Menus, ingredients and allergen information come from the shops and can change. Sippy Brew doesn't prepare food or drinks and can't check ingredients or guarantee that a drink is free of any allergen.",
      },
      {
        q: "What if I can't make it or the shop cancels?",
        a: "Contact the shop as soon as you can. Only the shop can cancel an order, and only before it marks the order as being prepared. If it does, your pass is returned, as long as it's still the same month (or, for a bonus pass, before it expires). Once the shop has started making it, it can't be cancelled, and if you don't pick it up it counts as not picked up.",
      },
      {
        q: "What happens if I don't pick up my order?",
        a: `If you don't pick up your order, the shop can mark it as not picked up starting ${RULES.noShowGraceMinutes} minutes after your pickup time. It isn't refunded: the pass stays used, any overage you confirmed is charged, and the shop is paid for the drink it made. We'll send you a reminder when that happens.`,
      },
      {
        q: "Can shops change their prices?",
        a: "Yes. Prices are set by each shop and can change at any time. Shops must update their Sippy Brew menu when their prices change; that's how you're told. The app always shows the shop's current price before you order, and recently changed items are marked \"price updated\".",
      },
      {
        q: "Can I still earn the shop's own rewards points?",
        a: "Usually, yes. Give the shop your loyalty number or card at pickup like you normally would. Those programs belong to the shops and follow their rules.",
      },
    ],
  },
  {
    title: "Billing",
    items: [
      {
        q: "Can I change my pass?",
        a: "Any time. A change takes effect at the start of your next month; this month stays as it is. Moving up from House to Specialty mid-month is the one exception: you pay the monthly difference and it applies right away.",
      },
      {
        q: "Can I cancel?",
        a: "Yes, any time from your account. Your pass keeps working until the end of the month you've paid for, and then it stops renewing.",
      },
      {
        q: "Do you give refunds?",
        a: "Monthly payments aren't refunded for unused passes or partial months, except where the law requires it. If you think you were charged by mistake, contact us and we'll look into it.",
      },
      {
        q: "Is my card information safe?",
        a: "Payments are handled by Stripe. Your card number is entered on Stripe's secure page; Sippy Brew never sees or stores it.",
      },
      {
        q: "Can prices or plans change?",
        a: "Yes. If we change the price of your plan, we'll tell you before it applies, and you can change or cancel before then.",
      },
    ],
  },
  {
    title: "Rewards",
    items: [
      {
        q: "How does the Neighborhood Passport work?",
        a: `Pick up orders at ${RULES.passportShopsForFreePass} different participating shops and you earn a free day pass. A visit counts when the shop scans your pickup code.`,
      },
      {
        q: "What's the Grand Tour?",
        a: `Visit every participating shop and earn ${RULES.grandTourFreeMonths} months of your plan free. It switches on once more than ${RULES.grandTourMinShops - 1} shops have joined. Shops count once they've been live for ${RULES.grandTourShopMinLiveDays} days.`,
      },
      {
        q: "How do referrals work?",
        a: `Share your link. When ${RULES.referralFriendsNeeded} friends join with it and pay for their first month, you get ${RULES.referralBonusPasses} bonus passes. You can't refer yourself.`,
      },
      {
        q: "Anything else I should know about rewards?",
        a: "Bonus passes and free months have no cash value and can't be sold, transferred or exchanged for money. Bonus passes need an active pass to use. We can change or end rewards programs, and we can remove rewards earned through fraud or abuse.",
      },
    ],
  },
  {
    title: "Privacy",
    items: [
      {
        q: "How do you use my location?",
        a: `Only to show participating shops near you, and only if you allow it. You can turn it off any time in your phone or browser settings. Searches stay within ${RULES.maxRadiusMiles} miles to keep it local.`,
      },
    ],
  },
];

export const FAQ_FOOTNOTE = `This FAQ is a summary. If anything here differs from our Terms of Service, the Terms apply. Still have a question? Email ${SITE.supportEmail}.`;

/** Merchant FAQ, shown on the shop side (demo, web /shop/faq, shop app). The merchant agreement controls. */
export const MERCHANT_FAQ: readonly FaqSection[] = [
  {
    title: "Orders",
    items: [
      {
        q: "When should I make a Sippy Brew order?",
        a: `Close to the pickup time. Each order shows "Start at" ${RULES.prepLeadMinutes} minutes before pickup. Making drinks then keeps them fresh and means fewer drinks wasted if a member doesn't show.`,
      },
      {
        q: "What if a member doesn't pick up their order?",
        a: `Mark it "Not picked up" starting ${RULES.noShowGraceMinutes} minutes after the pickup time. The member gets a reminder and Sippy Brew is notified. No-shows aren't refunded: you're paid for the pass just like a pickup, and any overage the member confirmed is charged to them and paid to you.`,
      },
      {
        q: "What's the red ALLERGY NOTICE?",
        a: "The member listed an allergy with their order. Read it before you mark the order as preparing, follow your shop's allergen procedures, and talk to the member at pickup if you have any doubt. If you can't make the order safely, cancel it before you start preparing it, so the member's pass is returned. Your shop is responsible for its ingredients and allergen handling.",
      },
      {
        q: "How do I hand off an order?",
        a: "Scan the member's QR code (or type their 6-character code) at pickup. Codes refresh every 30 seconds and work once, so a screenshot won't work.",
      },
      {
        q: "Can I cancel an order?",
        a: "Yes, but only before you mark it as being prepared, for example if you're out of something or can't make it safely. The member's pass is returned. Once you've marked it preparing it can't be cancelled, so check the order (and any allergy notice) before you start. A no-show can't be cancelled.",
      },
    ],
  },
  {
    title: "Menu and prices",
    items: [
      {
        q: "Can I change my prices?",
        a: "Yes, any time. When your prices change you must update your Sippy Brew menu right away: that's how members are told. Members always see your current Sippy Brew menu price before they order, and changed items are marked \"price updated\". Orders already placed keep the price they were placed at.",
      },
      {
        q: "What's the fastest way to add my menu?",
        a: "Take a photo of your menu board or printed menu. We read the coffee items and prices for you and fill them in; check each one, fix anything that's off, and save. Nothing is added until you confirm it. Food is skipped automatically, since only coffee can be sold through Sippy Brew.",
      },
      {
        q: "Can I sell food?",
        a: "No. Sippy Brew is drinks only: no food, whatsoever. Members can still buy food from you directly, outside Sippy Brew.",
      },
      {
        q: "What happens if my shop sells food through Sippy Brew?",
        a: "Your shop is removed from the platform, with no exceptions. If it happened by genuine error rather than misrepresentation (for example, a topping named so it read like a food item), you can appeal once from your shop dashboard and we'll review it.",
      },
      {
        q: "How do I list fruit toppings or flavors like cookie?",
        a: "Name them for what they are, as part of the drink: \"Cookie syrup\", \"Dragonfruit topping\", \"Strawberry puree\", \"Almond milk\". A drink name works too, like \"Dragonfruit Refresher\". Anything that reads like food on its own, like \"Apples\" or \"Cookie\", can't be saved.",
      },
      {
        q: "Can I offer customizations like oat milk or an extra shot?",
        a: "Yes. Add them to any drink in your menu with your prices. If they push an order over the member's pass, the member confirms and pays the difference, and it goes to you.",
      },
    ],
  },
  {
    title: "Getting paid",
    items: [
      {
        q: "How much do I get paid?",
        a: `You keep ${100 - RULES.commissionBps / 100}% of what each pass covers, including no-shows and bonus passes, plus 100% of overages less card processing. Payouts go to your bank every Monday through Stripe.`,
      },
      {
        q: "Do I pay for card processing?",
        a: "Only on overages, which are charged on your behalf. Sippy Brew covers processing on members' monthly payments.",
      },
    ],
  },
  {
    title: "Your shop",
    items: [
      {
        q: "Who is responsible for the drinks and service?",
        a: "Your shop is. You're an independent business: you make, price and serve your drinks, and you're responsible for ingredients, allergens, food safety, your staff and your premises. Sippy Brew runs the membership, sends you orders and pays you.",
      },
      {
        q: "Can members still earn my loyalty points?",
        a: "Yes. If you have a rewards program, let members give their number or card at pickup like any other customer.",
      },
      {
        q: "How do I pause orders?",
        a: "Turn off \"Accepting orders\" on your Orders screen. Members can still see your shop but can't order until you turn it back on.",
      },
    ],
  },
];

export const MERCHANT_FAQ_FOOTNOTE = `This FAQ is a summary. If anything here differs from your Sippy Brew merchant agreement, the agreement applies. Still have a question? Email ${SITE.supportEmail}.`;
