export type CardCategory =
  | "advance-go"
  | "advance-to"
  | "advance-nearest-airport"
  | "advance-nearest-utility"
  | "go-back-3"
  | "go-to-jail"
  | "collect-bank"
  | "pay-bank"
  | "collect-each-player"
  | "pay-each-player"
  | "get-out-of-jail-free"
  | "repairs";

export type CardDeckType = "chance" | "community-chest";

export type CardDefinition = {
  id: string;
  deck: CardDeckType;
  text: string;
  category: CardCategory;
  amount?: number;
  targetSpaceIndex?: number;
  houseRepairCost?: number;
  hotelRepairCost?: number;
};

export const chanceCards: CardDefinition[] = [
  {
    id: "chance-1",
    deck: "chance",
    text: "Advance to GO. Collect $200.",
    category: "advance-go",
  },
  {
    id: "chance-2",
    deck: "chance",
    text: "Take a trip to JFK Airport. If you pass GO, collect $200.",
    category: "advance-to",
    targetSpaceIndex: 5,
  },
  {
    id: "chance-3",
    deck: "chance",
    text: "Advance to Heathrow Airport. If you pass GO, collect $200.",
    category: "advance-to",
    targetSpaceIndex: 15,
  },
  {
    id: "chance-4",
    deck: "chance",
    text: "Advance token to the nearest Airport. If unowned, you may buy it. If owned, pay double rent.",
    category: "advance-nearest-airport",
  },
  {
    id: "chance-5",
    deck: "chance",
    text: "Advance token to the nearest Airport. If unowned, you may buy it. If owned, pay double rent.",
    category: "advance-nearest-airport",
  },
  {
    id: "chance-6",
    deck: "chance",
    text: "Advance to the nearest Utility. If unowned, you may buy it. If owned, throw dice and pay 10 times the amount thrown.",
    category: "advance-nearest-utility",
  },
  {
    id: "chance-7",
    deck: "chance",
    text: "Bank pays you dividend of $50.",
    category: "collect-bank",
    amount: 50,
  },
  {
    id: "chance-8",
    deck: "chance",
    text: "Get Out of Jail Free. This card may be kept until needed or traded.",
    category: "get-out-of-jail-free",
  },
  {
    id: "chance-9",
    deck: "chance",
    text: "Go Back 3 Spaces.",
    category: "go-back-3",
  },
  {
    id: "chance-10",
    deck: "chance",
    text: "Go to Jail. Go directly to Jail. Do not pass GO. Do not collect $200.",
    category: "go-to-jail",
  },
  {
    id: "chance-11",
    deck: "chance",
    text: "Make general repairs on all your properties. For each house pay $25. For each hotel pay $100.",
    category: "repairs",
    houseRepairCost: 25,
    hotelRepairCost: 100,
  },
  {
    id: "chance-12",
    deck: "chance",
    text: "Pay poor tax of $15.",
    category: "pay-bank",
    amount: 15,
  },
  {
    id: "chance-13",
    deck: "chance",
    text: "Advance to New York. If you pass GO, collect $200.",
    category: "advance-to",
    targetSpaceIndex: 39,
  },
  {
    id: "chance-14",
    deck: "chance",
    text: "You have been elected Chairman of the Board. Pay each player $50.",
    category: "pay-each-player",
    amount: 50,
  },
  {
    id: "chance-15",
    deck: "chance",
    text: "Your building loan matures. Collect $150.",
    category: "collect-bank",
    amount: 150,
  },
  {
    id: "chance-16",
    deck: "chance",
    text: "Advance to London. If you pass GO, collect $200.",
    category: "advance-to",
    targetSpaceIndex: 34,
  },
];

export const communityChestCards: CardDefinition[] = [
  {
    id: "cc-1",
    deck: "community-chest",
    text: "Advance to GO. Collect $200.",
    category: "advance-go",
  },
  {
    id: "cc-2",
    deck: "community-chest",
    text: "Bank error in your favor. Collect $200.",
    category: "collect-bank",
    amount: 200,
  },
  {
    id: "cc-3",
    deck: "community-chest",
    text: "Doctor's fees. Pay $50.",
    category: "pay-bank",
    amount: 50,
  },
  {
    id: "cc-4",
    deck: "community-chest",
    text: "From sale of stock, you get $50.",
    category: "collect-bank",
    amount: 50,
  },
  {
    id: "cc-5",
    deck: "community-chest",
    text: "Get Out of Jail Free. This card may be kept until needed or traded.",
    category: "get-out-of-jail-free",
  },
  {
    id: "cc-6",
    deck: "community-chest",
    text: "Go to Jail. Go directly to Jail. Do not pass GO. Do not collect $200.",
    category: "go-to-jail",
  },
  {
    id: "cc-7",
    deck: "community-chest",
    text: "Grand Opera Night — Collect $50 from every player for opening night seats.",
    category: "collect-each-player",
    amount: 50,
  },
  {
    id: "cc-8",
    deck: "community-chest",
    text: "Holiday fund matures. Receive $100.",
    category: "collect-bank",
    amount: 100,
  },
  {
    id: "cc-9",
    deck: "community-chest",
    text: "Income tax refund. Collect $20.",
    category: "collect-bank",
    amount: 20,
  },
  {
    id: "cc-10",
    deck: "community-chest",
    text: "It is your birthday. Collect $10 from every player.",
    category: "collect-each-player",
    amount: 10,
  },
  {
    id: "cc-11",
    deck: "community-chest",
    text: "Life insurance matures. Collect $100.",
    category: "collect-bank",
    amount: 100,
  },
  {
    id: "cc-12",
    deck: "community-chest",
    text: "Pay hospital fees of $100.",
    category: "pay-bank",
    amount: 100,
  },
  {
    id: "cc-13",
    deck: "community-chest",
    text: "Pay school fees of $150.",
    category: "pay-bank",
    amount: 150,
  },
  {
    id: "cc-14",
    deck: "community-chest",
    text: "Receive $25 consultancy fee.",
    category: "collect-bank",
    amount: 25,
  },
  {
    id: "cc-15",
    deck: "community-chest",
    text: "You are assessed for street repairs. $40 per house. $115 per hotel.",
    category: "repairs",
    houseRepairCost: 40,
    hotelRepairCost: 115,
  },
  {
    id: "cc-16",
    deck: "community-chest",
    text: "You have won second prize in a beauty contest. Collect $10.",
    category: "collect-bank",
    amount: 10,
  },
  {
    id: "cc-17",
    deck: "community-chest",
    text: "You inherit $100.",
    category: "collect-bank",
    amount: 100,
  },
];
