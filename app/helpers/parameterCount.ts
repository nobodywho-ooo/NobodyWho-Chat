export const parameterCountLabel = (
  parameterCountBillions: number | undefined,
): string | undefined => {
  if (parameterCountBillions === undefined || parameterCountBillions <= 0) {
    return undefined;
  }

  if (parameterCountBillions >= 1) {
    return `${parameterCountBillions}B`;
  }

  // Round to thousands first, then pick the unit from the rounded value.
  // Choosing the unit from the unrounded number instead lets a count just under
  // a million (0.9999M) stay on the "K" branch and render as "1000K".
  const thousands = Math.round(parameterCountBillions * 1_000_000);

  return thousands >= 1000
    ? `${Math.round(thousands / 1000)}M`
    : `${thousands}K`;
};
