// Simple UTF-8 validator for a file, prints first N issues with context
// Usage: node scripts/check-utf8.js <absolute-or-relative-path>

const fs = require('fs');
const path = require('path');

function isContinuationByte(b) {
  return (b & 0b1100_0000) === 0b1000_0000;
}

function validateUTF8(buffer) {
  const issues = [];
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    if (b <= 0x7F) continue; // ASCII
    let expected = 0;
    if ((b & 0b1110_0000) === 0b1100_0000) {
      expected = 1; // 2-byte sequence total 2, so 1 continuation
    } else if ((b & 0b1111_0000) === 0b1110_0000) {
      expected = 2; // 3-byte sequence
    } else if ((b & 0b1111_1000) === 0b1111_0000) {
      expected = 3; // 4-byte sequence
    } else {
      issues.push({ offset: i, byte: b, reason: 'Invalid start byte' });
      continue;
    }
    let ok = true;
    for (let j = 1; j <= expected; j++) {
      const k = i + j;
      if (k >= buffer.length) {
        issues.push({ offset: i, byte: b, reason: 'Truncated sequence at EOF' });
        i = k - 1; // move to end
        ok = false;
        break;
      }
      const cb = buffer[k];
      if (!isContinuationByte(cb)) {
        issues.push({ offset: k, byte: cb, reason: 'Bad trailing UTF-8 byte (not 10xxxxxx)', start: i, startByte: b });
        // continue scanning from here
        i = k - 1;
        ok = false;
        break;
      }
    }
    if (ok) {
      i += expected; // skip continuation bytes on success
    }
  }
  return issues;
}

function hex(n) {
  return '0x' + n.toString(16).toUpperCase().padStart(2, '0');
}

function context(buf, center, radius = 16) {
  const start = Math.max(0, center - radius);
  const end = Math.min(buf.length, center + radius);
  const slice = buf.slice(start, end);
  return Array.from(slice).map(b => hex(b)).join(' ');
}

(function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/check-utf8.js <file>');
    process.exit(1);
  }
  const file = path.resolve(process.cwd(), target);
  const buf = fs.readFileSync(file);
  const issues = validateUTF8(buf);
  if (issues.length === 0) {
    console.log('OK: No UTF-8 issues in', file);
  } else {
    console.log(`Found ${issues.length} UTF-8 issue(s) in ${file}`);
    issues.slice(0, 20).forEach((iss, idx) => {
      console.log(`#${idx + 1}`, {
        offset: iss.offset,
        byte: hex(iss.byte),
        reason: iss.reason,
        start: iss.start,
        startByte: iss.startByte != null ? hex(iss.startByte) : undefined,
      });
      console.log('Context:', context(buf, iss.offset));
    });
    if (issues.length > 20) console.log('... (truncated)');
  }
})();
