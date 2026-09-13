const fs = require('fs');
const path = require('path');
const config = require('../config');

function pad(n) {
  return String(n).padStart(2, '0');
}

function makeRunId() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `run-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}

function createRunLogger() {
  const runId = makeRunId();
  const logDir = path.join(config.dataDir, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `${runId}.jsonl`);
  const counters = {};

  function write(entry) {
    const line = JSON.stringify({ ts: new Date().toISOString(), runId, ...entry });
    fs.appendFileSync(logFile, line + '\n', 'utf-8');
  }

  function bump(key) {
    counters[key] = (counters[key] || 0) + 1;
  }

  function log(step, status, extra = {}) {
    bump(`${step}.${status}`);
    const durationPart = typeof extra.durationMs === 'number' ? ` (${extra.durationMs}ms)` : '';
    console.log(`[${runId}] ${step} — ${status}${durationPart}`);
    write({ step, status, ...extra });
  }

  function startStep(step) {
    const startedAt = Date.now();
    return (status, extra = {}) => {
      log(step, status, { ...extra, durationMs: Date.now() - startedAt });
    };
  }

  function summary() {
    console.log(`\n[${runId}] run summary:`);
    for (const [key, count] of Object.entries(counters)) {
      console.log(`  ${key}: ${count}`);
    }
    write({ step: 'run', status: 'summary', counters });
  }

  return { runId, logFile, log, startStep, summary, counters };
}

module.exports = { createRunLogger };
