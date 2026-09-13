// Algerian/French formatting: space (incl. NBSP) as thousand separator, comma as decimal.
function parseAmount(raw) {
  if (raw == null) return null;
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null;
  return parseFloat(cleaned);
}

// "09/04/2026" (DD/MM/YYYY) -> "2026-04-09"
function parseFrenchDate(raw) {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

module.exports = { parseAmount, parseFrenchDate };
