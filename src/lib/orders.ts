import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Order } from "./types";

// JSON file store (demo only, no DB). Writes are serialized and atomic.
const FILE = join(process.cwd(), "data", "orders.json");
let queue: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<Order[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Order[];
  } catch {
    return [];
  }
}

function mutate<T>(fn: (orders: Order[]) => T): Promise<T> {
  const run = queue.then(async () => {
    const orders = await readAll();
    const result = fn(orders);
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(FILE + ".tmp", JSON.stringify(orders, null, 2));
    await rename(FILE + ".tmp", FILE);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export const getOrder = async (id: string) => (await readAll()).find((o) => o.id === id);

export const createOrder = (order: Order) =>
  mutate((orders) => {
    orders.unshift(order);
    return order;
  });

export const updateOrder = (id: string, patch: Partial<Order>) =>
  mutate((orders) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return undefined;
    Object.assign(order, patch, { updatedAt: new Date().toISOString() });
    return { ...order };
  });
