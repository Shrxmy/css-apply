/**
 * SWR fetcher with error handling.
 * Used as the default fetcher for all SWR hooks.
 */
export async function swrFetcher(url: string): Promise<unknown> {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error("Failed to fetch");
    (error as Error & { status: number }).status = res.status;
    throw error;
  }

  return res.json();
}
