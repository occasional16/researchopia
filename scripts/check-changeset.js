#!/usr/bin/env node
const { execSync } = require('child_process');

function getGitStatus() {
  try {
    return execSync('git status --porcelain', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Failed to read git status. Make sure you are inside the repository.');
    process.exit(1);
  }
}

function extractPath(line) {
  if (!line || line.length < 4) {
    return '';
  }
  const rawPath = line.slice(3);
  if (rawPath.includes('->')) {
    const parts = rawPath.split('->');
    return parts[parts.length - 1].trim();
  }
  return rawPath.trim();
}

(function main() {
  const entries = getGitStatus();
  const changedPackages = new Set();
  let hasChangeset = false;

  entries.forEach((line) => {
    const filePath = extractPath(line);
    if (!filePath) {
      return;
    }

    if (filePath.startsWith('packages/')) {
      const [, pkgName] = filePath.split('/');
      if (pkgName) {
        changedPackages.add(pkgName);
      }
    }

    if (filePath.startsWith('.changeset/') && filePath.endsWith('.md') && !filePath.includes('README')) {
      hasChangeset = true;
    }
  });

  if (changedPackages.size > 0 && !hasChangeset) {
    console.error('Changes detected in packages without a corresponding changeset.');
    console.error(`Affected packages: ${Array.from(changedPackages).join(', ')}`);
    console.error('Run "npm run changeset" to record the release note.');
    process.exit(1);
  }

  console.log('Changeset check passed.');
})();
