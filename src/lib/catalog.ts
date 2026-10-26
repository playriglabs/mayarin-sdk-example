import data from "../data/games.json";
import type { Game } from "./types";

const games = data as Game[];

export const getGames = () => games;
export const getGame = (slug: string) => games.find((g) => g.slug === slug);
