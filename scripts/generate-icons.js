#!/usr/bin/env node
// Generate extension icons from assets/icon.png
// Run: npm run generate-icons (after npm install)

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SRC = path.join(ASSETS_DIR, 'icon.png');
const SIZES = [16, 32, 48, 128];

if (!fs.existsSync(SRC)) {
  console.error('Error: icon.png not found in assets/');
  console.error('Add your logo as assets/icon.png, then run this script.');
  process.exit(1);
}

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('Error: sharp not found. Run: npm install');
    process.exit(1);
  }

  const img = sharp(SRC);
  for (const size of SIZES) {
    const out = path.join(ASSETS_DIR, `icon${size}.png`);
    await img.clone().resize(size, size).png().toFile(out);
    console.log('Created', out);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
