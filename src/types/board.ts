export type BoardSpaceKind =
  | "go"
  | "city"
  | "airport"
  | "utility"
  | "tax"
  | "chance"
  | "community-chest"
  | "jail"
  | "free-parking"
  | "go-to-jail";

export type CityColorGroup =
  | "brown"
  | "light-blue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "dark-blue";

export type BaseBoardSpace = {
  index: number;
  name: string;
  kind: BoardSpaceKind;
};

export type CityProperty = BaseBoardSpace & {
  kind: "city";
  country: string;
  colorGroup: CityColorGroup;
  price: number;
  rent: [number, number, number, number, number, number];
  mortgageValue: number;
  houseCost: number;
};

export type AirportProperty = BaseBoardSpace & {
  kind: "airport";
  price: 200;
  rentByOwnedCount: [25, 50, 100, 200];
  mortgageValue: 100;
};

export type UtilityProperty = BaseBoardSpace & {
  kind: "utility";
  price: 150;
  mortgageValue: 75;
  rentRule: string;
};

export type TaxSpace = BaseBoardSpace & {
  kind: "tax";
  amount: number;
};

export type SpecialSpace = BaseBoardSpace & {
  kind:
    | "go"
    | "chance"
    | "community-chest"
    | "jail"
    | "free-parking"
    | "go-to-jail";
};

export type BoardSpace =
  | CityProperty
  | AirportProperty
  | UtilityProperty
  | TaxSpace
  | SpecialSpace;

export type OwnableSpace = CityProperty | AirportProperty | UtilityProperty;

export type GridPlacement = {
  gridColumn: string;
  gridRow: string;
};
