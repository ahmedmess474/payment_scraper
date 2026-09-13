function parseIsoDate(value, label) {
  const match = value && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`--${label} must be in YYYY-MM-DD format, got: ${value ?? '(missing)'}`);
  }
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function toComparableDate({ year, month, day }) {
  return new Date(year, month - 1, day);
}

function parseDateRangeArgs(argv) {
  const raw = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--start') raw.start = argv[++i];
    if (argv[i] === '--end') raw.end = argv[++i];
  }

  const start = parseIsoDate(raw.start, 'start');
  const end = parseIsoDate(raw.end, 'end');

  if (toComparableDate(end) < toComparableDate(start)) {
    throw new Error(
      `--end (${raw.end}) is before --start (${raw.start}) — the range is backwards`
    );
  }

  return { start, end };
}

module.exports = { parseDateRangeArgs };
