import { RULES, SUB_TIERS } from "./config";

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
        a: "Not through Sippy Brew. Passes are for coffee drinks only. You can always buy food from the shop directly.",
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
        a: "Tell the shop directly, every time, before you drink anything. Menus, ingredients and allergen information come from the shops and can change. Sippy Brew doesn't prepare food or drinks and can't check ingredients or guarantee that a drink is free of any allergen.",
      },
      {
        q: "What if I can't make it or the shop cancels?",
        a: "Cancel the order in the app before the shop marks it picked up. If an order is cancelled, your pass is returned, as long as it's still the same month (or, for a bonus pass, before it expires).",
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

export const FAQ_FOOTNOTE = "This FAQ is a summary. If anything here differs from our Terms of Service, the Terms apply.";
