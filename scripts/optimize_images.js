// scripts/optimize_images.js
// Robust image optimizer: reads static/images/originals/*.{jpg,png,webp}
// produces static/images/<name>.webp and <name>-thumb.webp and regenerates static/ads.json
// More logging and resilient error handling.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const originalsDir = path.join(repoRoot, 'static', 'images', 'originals');
const outDir = path.join(repoRoot, 'static', 'images');
const adsJsonPath = path.join(repoRoot, 'static', 'ads.json');

function ensure(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isImageFile(name) {
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

async function processImage(file) {
  const ext = path.extname(file).toLowerCase();
  const name = path.basename(file, ext);
  const inPath = path.join(originalsDir, file);
  const outFull = path.join(outDir, `${name}.webp`);
  const outThumb = path.join(outDir, `${name}-thumb.webp`);
  // read meta if exists
  const metaPath = path.join(originalsDir, `${name}.json`);
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try {
      const raw = fs.readFileSync(metaPath, 'utf8');
      meta = JSON.parse(raw);
    } catch (e) {
      console.warn(`[WARN] Could not parse metadata ${metaPath}: ${e.message}`);
      meta = {};
    }
  } else {
    console.log(`[INFO] No metadata for ${file} (expected ${name}.json) — using defaults.`);
  }

  // verify input exists and size
  const stat = fs.statSync(inPath);
  if (!stat || stat.size < 16) throw new Error('file too small or unreadable');

  // generate images
  await sharp(inPath)
    .rotate() // auto-orient
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outFull);

  await sharp(inPath)
    .rotate()
    .resize({ width: 300, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toFile(outThumb);

  return {
    name: meta.name || name,
    description: meta.description || '',
    location: meta.location || '',
    category: meta.category || '',
    contact: meta.contact || '',
    code: meta.code || '',
    image: `images/${name}.webp`,
    thumb: `images/${name}-thumb.webp`
  };
}

async function main() {
  try {
    ensure(outDir);
    if (!fs.existsSync(originalsDir)) {
      console.log(`[INFO] Originals directory does not exist: ${originalsDir}`);
      console.log('[INFO] Nothing to process. Exiting with success (0).');
      // ensure ads.json exists (empty)
      if (!fs.existsSync(adsJsonPath)) fs.writeFileSync(adsJsonPath, '[]', 'utf8');
      return 0;
    }

    const files = fs.readdirSync(originalsDir).filter(isImageFile);
    console.log(`[INFO] Found ${files.length} image(s) in ${originalsDir}`);

    const ads = [];
    for (const f of files) {
      try {
        console.log(`[INFO] Processing ${f} ...`);
        const entry = await processImage(f);
        ads.push(entry);
        console.log(`[OK] Processed ${f} -> ${entry.image}`);
      } catch (err) {
        console.error(`[ERROR] Failed to process ${f}: ${err.message}`);
        // continue with other files
      }
    }

    // Sort by name for deterministic output
    ads.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    // Write minified JSON to reduce size (recommended by you)
    fs.writeFileSync(adsJsonPath, JSON.stringify(ads), 'utf8');
    console.log(`[OK] Wrote ${ads.length} ad(s) to ${adsJsonPath}`);
    return 0;
  } catch (err) {
    console.error('[FATAL] Unexpected error:', err && err.stack ? err.stack : err);
    return 2;
  }
}

(async () => {
  const code = await main();
  process.exit(code);
})();
