/** Finds an unused presentation key, including when a form is restored or remounted. */
export function createAvailableMemberRowKey(
  keyPrefix: string,
  existingRowKeys: readonly string[],
): string {
  const occupiedRowKeys = new Set(existingRowKeys);
  let rowNumber = 0;
  while (occupiedRowKeys.has(`${keyPrefix}-${rowNumber}`)) {
    rowNumber += 1;
  }
  return `${keyPrefix}-${rowNumber}`;
}
