#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const REQUIRED_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME'];
const DEFAULT_ENV_FILES = ['.env.local', '.env', '.env.example'];

function parseArgs(argv) {
  const options = { file: null, verbose: false };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--file' && argv[i + 1]) {
      options.file = argv[i + 1];
      i += 1;
      continue;
    }
    if (current.startsWith('--file=')) {
      options.file = current.split('=')[1];
      continue;
    }
    if (current === '--verbose') {
      options.verbose = true;
    }
  }
  return options;
}

function resolveEnvPath(preferredFile) {
  const searchOrder = preferredFile ? [preferredFile] : DEFAULT_ENV_FILES;
  for (const candidate of searchOrder) {
    const fullPath = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }
  return null;
}

function validateConfig(envMap) {
  const missingKeys = REQUIRED_KEYS.filter((key) => !envMap[key] || envMap[key].trim().length === 0);
  const invalidKeys = [];

  if (envMap.SMTP_PORT && Number.isNaN(Number(envMap.SMTP_PORT))) {
    invalidKeys.push('SMTP_PORT (must be a number)');
  }
  if (envMap.SMTP_FROM_EMAIL && !envMap.SMTP_FROM_EMAIL.includes('@')) {
    invalidKeys.push('SMTP_FROM_EMAIL (must be a valid email address)');
  }

  return { missingKeys, invalidKeys };
}

(function main() {
  const { file, verbose } = parseArgs(process.argv.slice(2));
  const envPath = resolveEnvPath(file);

  if (!envPath) {
    console.warn('No env file found (.env.local/.env/.env.example). Skipping email config check.');
    process.exit(0);
  }

  if (verbose) {
    console.log(`Checking email configuration in ${path.relative(process.cwd(), envPath)}`);
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath));
  const { missingKeys, invalidKeys } = validateConfig(parsed);

  if (missingKeys.length || invalidKeys.length) {
    if (missingKeys.length) {
      console.error(`Missing email config keys: ${missingKeys.join(', ')}`);
    }
    if (invalidKeys.length) {
      console.error(`Invalid email config values: ${invalidKeys.join(', ')}`);
    }
    process.exit(1);
  }

  console.log(`Email configuration looks good in ${path.relative(process.cwd(), envPath)}`);
})();
