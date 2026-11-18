/**
 * Starting package data. PRICES AND BENEFITS ARE SAMPLES for testing; the owner must
 * replace them in Admin → Packages (each package shows "Unconfirmed" until saved).
 * Main-tier benefit lists hold only what that tier ADDS; the site shows
 * "Everything in <lower tier>, plus:".
 */
export const SEED_PACKAGES = [
  {
    slug: "emerald", name: "Emerald", kind: "MAIN", rank: 1, annualFeeKes: 35000, finish: "emerald", ribbon: "", sortOrder: 1,
    tagline: "The natural first step into the club.",
    benefits: [
      "Personal membership card and member number",
      "Priority reservations in the dining room and on the verandah",
      "10% off food for you and one guest",
      "Invitations to members' evenings",
      "A birthday dessert with the chef's compliments",
    ],
  },
  {
    slug: "bronze", name: "Bronze", kind: "MAIN", rank: 2, annualFeeKes: 60000, finish: "bronze", ribbon: "", sortOrder: 2,
    tagline: "For the regular at the Highlander Bar.",
    benefits: [
      "15% off food for you and up to two guests",
      "Reserved tables at Ladies Night and Cigar Night",
      "A bottle of house wine each quarter",
    ],
  },
  {
    slug: "silver", name: "Silver", kind: "MAIN", rank: 3, annualFeeKes: 95000, finish: "silver", ribbon: "", sortOrder: 3,
    tagline: "Hospitality for you and your guests.",
    benefits: [
      "20% off food and 10% off the wine list",
      "Priority booking of the private dining rooms",
      "Two guest passes a month to members-only evenings",
      "Corkage waived on two bottles a month",
    ],
  },
  {
    slug: "gold", name: "Gold", kind: "MAIN", rank: 4, annualFeeKes: 150000, finish: "gold", ribbon: "Most Popular", sortOrder: 4,
    tagline: "The full privileges of the house.",
    benefits: [
      "25% off food and 15% off the wine list",
      "A personal cigar locker in the lounge",
      "Seats at every whisky tasting",
      "One complimentary private dining room hire a year",
      "A dedicated host for your reservations",
    ],
  },
  {
    slug: "platinum", name: "Platinum", kind: "MAIN", rank: 5, annualFeeKes: 300000, finish: "platinum", ribbon: "Most Prestigious", sortOrder: 5,
    tagline: "The highest honour the club bestows.",
    benefits: [
      "30% off food and 20% off the wine list",
      "A personal humidor and reserved whisky shelf",
      "Unlimited guest passes to members' evenings",
      "An annual private dinner for ten, hosted by the chef",
      "Reciprocal access at partner clubs",
      "A direct concierge line",
    ],
  },
  {
    slug: "junior", name: "Junior", kind: "JUNIOR", rank: 0, annualFeeKes: 12000, finish: "junior", ribbon: "", sortOrder: 6,
    tagline: "For young members under 18, managed by a parent or guardian.",
    benefits: [
      "Junior membership card (first name only)",
      "15% off the children's menu",
      "A birthday treat from the pastry kitchen",
      "Invitations to family-friendly club events",
      "Holiday workshops in the gardens",
    ],
  },
  {
    slug: "family", name: "Family / Joint", kind: "FAMILY", rank: 0, annualFeeKes: 180000, finish: "family", ribbon: "", sortOrder: 7, maxLinked: 4,
    tagline: "One primary member plus up to four linked members, renewed in one payment.",
    benefits: [
      "A personal card for every family member, linked to the primary number",
      "20% off food for the whole family",
      "Priority family tables for Sunday lunch",
      "Invitations to family-friendly club events",
      "Members' evenings for the adult members",
      "One renewal date and one payment for the family",
    ],
  },
] as const;

export const SEED_EVENTS = [
  {
    title: "Ladies Night", schedule: "Every Wednesday · from 6 pm", adultOnly: true, membersOnly: false, sortOrder: 1,
    description: "An evening in honour of the ladies of Nairobi: cocktails, music and the warm light of the Highlander Bar. Members enjoy reserved tables.",
  },
  {
    title: "Cigar Night", schedule: "Every Thursday · from 7 pm", adultOnly: true, membersOnly: false, sortOrder: 2,
    description: "Fine cigars, aged spirits and good conversation in the lounge. Gold and Platinum members keep a personal locker.",
  },
  {
    title: "After Dinner at the Highlander Bar", schedule: "Fridays and Saturdays · from 9 pm", adultOnly: true, membersOnly: false, sortOrder: 3,
    description: "When the plates are cleared, the evening moves to the Highlander Bar: single malts, live music and the long Nairobi night.",
  },
  {
    title: "Members' Evenings", schedule: "Monthly · by invitation", adultOnly: true, membersOnly: true, sortOrder: 4,
    description: "Private tastings, chef's tables and seasonal suppers open only to members and their invited guests.",
  },
  {
    title: "Family Sunday in the Gardens", schedule: "Selected Sundays · lunchtime", adultOnly: false, membersOnly: true, sortOrder: 5,
    description: "Long lunches on the lawn among the peacocks, with activities for younger members. Junior and Family members welcome.",
  },
] as const;
