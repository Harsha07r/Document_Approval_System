/**
 * Compile-time exhaustiveness guard. If a new enum member is added to a
 * discriminated union (e.g. DocumentStatus) and a switch over it forgets
 * to handle it, this call site fails to typecheck instead of throwing at
 * runtime in production.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

export function isExpired(date: Date): boolean {
  return date.getTime() <= Date.now();
}
