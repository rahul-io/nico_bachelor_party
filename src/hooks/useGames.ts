"use client";

import { useSWRConfig } from "swr";
import type { GamesBoard, GamesMe } from "@/lib/games/board";
import { usePolled } from "./usePolled";
import { useIdentity } from "./useProfile";

export const GAMES_ME = "/api/games/me";
export const GAMES_BOARD = "/api/games";

/** This person's balance, notices, Bartender's Choice order and curses. */
export function useGamesMe() {
  const identity = useIdentity();
  return usePolled<GamesMe>(identity ? GAMES_ME : null).data;
}

/** Open wagers, Snitch Line reports, active curses and prices. */
export function useGamesBoard() {
  return usePolled<GamesBoard>(GAMES_BOARD).data;
}

/** Refetches everything a game action can change. */
export function useRefreshGames() {
  const { mutate } = useSWRConfig();
  return () =>
    Promise.all([GAMES_ME, GAMES_BOARD, "/api/leaderboard", "/api/points", "/api/posts"].map((key) => mutate(key)));
}
