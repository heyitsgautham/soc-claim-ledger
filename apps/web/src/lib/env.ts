// Settings the server reads from the environment. A variable set to an empty string, as
// `LEDGER_DATA_DIR=` in a copied .env file leaves it, counts as unset, so the default holds.

export function setting(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

/** The examiner ID stamped on verdicts and report exports. */
export function examinerId(): string {
  return setting("LEDGER_EXAMINER", "EX-02");
}
