function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

/**
 * Catalogue variant prices are rupees per individual unit. Order rows also
 * store rupees per individual unit because quantity * packSize is sent to PHP.
 */
function variantPriceToUnitRupees(priceInput) {
  const unitPrice = positiveNumber(priceInput);
  if (!unitPrice) return 0;
  return Math.round((unitPrice + Number.EPSILON) * 100) / 100;
}

module.exports = {
  variantPriceToUnitRupees,
  variantPackPriceToUnitRupees: variantPriceToUnitRupees,
};
