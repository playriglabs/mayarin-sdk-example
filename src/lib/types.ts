export interface GameField {
  key: "userId" | "zoneId";
  label: string;
  placeholder: string;
  type: "text" | "select";
  /** Input rule for text fields. Default "numeric" (game IDs); "username" for names like Roblox. */
  format?: "numeric" | "username";
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
  checkoutImage: string; // public absolute URL for Mayarin checkout
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
  gameImage: string;
  price: number;
  account: { userId: string; zoneId?: string };
  status: OrderStatus;
  intentId?: string;
  checkoutUrl?: string;
  mock: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Chain = "ethereum-sepolia" | "base-sepolia" | "arbitrum-sepolia" | "polygon-amoy" | "bsc-testnet" | "arc-testnet";
export type Asset = "USDC" | "ETH";
