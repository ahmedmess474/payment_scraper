const { parseIsoDate, toComparableDate } = require('./dates');

function parseDateRangeArgs(argv) {
  const raw = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--start') raw.start = argv[++i];
    if (argv[i] === '--end') raw.end = argv[++i];
  }

  const start = parseIsoDate(raw.start, '--start');
  const end = parseIsoDate(raw.end, '--end');

  if (toComparableDate(end) < toComparableDate(start)) {
    throw new Error(
      `--end (${raw.end}) is before --start (${raw.start}) — the range is backwards`
    );
  }

  return { start, end };
}

module.exports = { parseDateRangeArgs };
