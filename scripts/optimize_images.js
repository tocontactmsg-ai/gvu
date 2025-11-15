// scripts/optimize_images.js
// Run: node scripts/optimize_images.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const originals = path.join(repoRoot, 'static', 'images', 'originals');
const outDir = path.join(repoRoot, 'static', 'images');
const adsJsonPath = path.join(repoRoot, 'static', 'ads.json');

function ensure(dir){ if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

async function processImage(file) {
  const ext = path.extname(file).toLowerCase();
  const name = path.basename(file, ext);
  const inPath = path.join(originals, file);
  const outFull = path.join(outDir, `${name}.webp`);
  const outThumb = path.join(outDir, `${name}-thumb.webp`);
  // read meta if exists
  const metaPath = path.join(originals, `${name}.json`);
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath,'utf8')); } catch(e){ console.warn('bad json for', metaPath); meta = {}; }
  }
  // Use sharp to produce 1200px width (without enlarging) and thumb 300px
  await sharp(inPath).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toFile(outFull);
  await sharp(inPath).resize({ width: 300 }).webp({ quality: 70 }).toFile(outThumb);
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

async function main(){
  ensure(originals);
  ensure(outDir);
  const files = fs.readdirSync(originals).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  const ads = [];
  for(const f of files){
    try{
      console.log('processing', f);
      const entry = await processImage(f);
      ads.push(entry);
    }catch(e){
      console.error('failed', f, e);
    }
  }
  // Sort by name (or you can sort by another metadata field if provided)
  ads.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  fs.writeFileSync(adsJsonPath, JSON.stringify(ads, null, 2), 'utf8');
  console.log(`Wrote ${ads.length} ads to ${adsJsonPath}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
