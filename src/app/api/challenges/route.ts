import { connection } from "next/server";
import { getStore } from "@/lib/store";

/** Active challenges, for guests. */
export async function GET() {
  await connection();
  const challenges = await getStore().listChallenges();
  return Response.json(challenges.filter((challenge) => challenge.active));
}
