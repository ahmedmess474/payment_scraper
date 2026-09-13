function parseIsoDate(value, label) {
  const match = value && String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const err = new Error(`${label} must be in YYYY-MM-DD format, got: ${value ?? '(missing)'}`);
    err.statusCode = 400;
    throw err;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  // new Date() silently rolls invalid values into the next month/day (e.g.
  // 2026-02-30 -> March 2) instead of rejecting them — reading the parts
  // back out catches that here, instead of it reaching the portal's own
  // date dropdowns and failing with a much less useful error.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    const err = new Error(`${label} is not a real calendar date: ${value}`);
    err.statusCode = 400;
    throw err;
  }

  return { year, month, day };
}

function toComparableDate({ year, month, day }) {
  return new Date(year, month - 1, day);
}

module.exports = { parseIsoDate, toComparableDate };
