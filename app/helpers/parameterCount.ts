export const parameterCountLabel = (
  parameterCountBillions: number | undefined,
): string | undefined => {
  if (parameterCountBillions === undefined || parameterCountBillions <= 0) {
    return undefined;
  }

  if (parameterCountBillions >= 1) {
    return `${parameterCountBillions}B`;
  }

  const millions = parameterCountBillions * 1000;

  return millions >= 1
    ? `${Math.round(millions)}M`
    : `${Math.round(millions * 1000)}K`;
};
