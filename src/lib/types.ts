export interface GameField {
  key: "userId" | "zoneId";
  label: string;
  placeholder: string;
  type: "text" | "select";
  options?: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number; // IDR
  image: string; // currency icon
}

export interface Game {
  slug: string;
  name: string;
  publisher: string;
  currencyName: string;
  image: string;
  banner: string;
  icon: string;
  description: string;
  fields: GameField[];
  products: Product[];
}

export type OrderStatus = "PENDING" | "PAID" | "COMPLETED" | "FAILED" | "EXPIRED";

export interface Order {
  id: string;
  gameSlug: string;
  gameName: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  account: { userId: string; zoneId?: string };
  status: OrderStatus;
  intentId?: string;
  checkoutUrl?: string;
  mock: boolean;
  createdAt: string;
  updatedAt: string;
}
