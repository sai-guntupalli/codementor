/** Minimal editor stubs — never pre-fill the solution. */

const LANGUAGE_STUBS: Record<string, string> = {
  python: "# Write your solution below\n\n",
  sql: "-- Write your query below\n\n",
};

export function getStarterCode(language: string): string {
  return LANGUAGE_STUBS[language.toLowerCase()] ?? "# Write your code below\n\n";
}
