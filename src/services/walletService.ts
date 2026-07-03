import type { EarningEntry, WalletSummary } from "@/models/types";
import earningsData from "@/data/earnings.json";
import { clone, delay, randomLatency } from "@/services/mockClient";

/**
 * Parkmitter does not process any payments. This service only tallies the
 * "savings" you made as a driver (parking cheaply vs. commercial lots) and the
 * "profit" you earned as a host from completed bookings on your listed spaces.
 */
const entries = earningsData as unknown as EarningEntry[];

function sum(list: EarningEntry[]): number {
  return list.reduce((total, e) => total + e.amount, 0);
}

/** True if the given ISO date falls within the last `months` months. */
function isWithinMonths(dateISO: string, months: number): boolean {
  const then = new Date(dateISO).getTime();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return then >= cutoff.getTime();
}

/** Aggregated savings + earnings totals for the wallet summary. */
async function getSummary(): Promise<WalletSummary> {
  await delay(randomLatency());
  const savings = entries.filter((e) => e.kind === "saving");
  const earnings = entries.filter((e) => e.kind === "earning");
  const recentSavings = savings.filter((e) => isWithinMonths(e.date, 3));
  const recentEarnings = earnings.filter((e) => isWithinMonths(e.date, 3));
  return {
    savingsLast3Months: sum(recentSavings),
    savingsLifetime: sum(savings),
    earningsLast3Months: sum(recentEarnings),
    earningsLifetime: sum(earnings),
    completedAsDriver: savings.length,
    completedAsHost: earnings.length,
  };
}

/** The full activity feed (savings + earnings), newest first. */
async function getEntries(): Promise<EarningEntry[]> {
  await delay(randomLatency());
  return clone(entries).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export const walletService = {
  getSummary,
  getEntries,
};
