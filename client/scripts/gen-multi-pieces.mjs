import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve('client/public/pieces/cburnett');
const outDir = path.resolve('client/public/pieces/multi');
fs.mkdirSync(outDir, { recursive: true });

const PALETTES = {
  red: { fill: '#e04848', stroke: '#220808', detail: '#fff5f5' },
  blue: { fill: '#3b82f6', stroke: '#08182e', detail: '#f0f7ff' },
  yellow: { fill: '#eab308', stroke: '#281d04', detail: '#281d04' },
  green: { fill: '#22c55e', stroke: '#062410', detail: '#f0fdf4' },
  dead: { fill: '#7c828d', stroke: '#23262d', detail: '#d4d8df' },
};

const ROLES = ['P', 'N', 'B', 'R', 'Q', 'K'];

for (const [colorName, pal] of Object.entries(PALETTES)) {
  for (const role of ROLES) {
    const raw = fs.readFileSync(path.join(srcDir, `w${role}.svg`), 'utf8');
    const tinted = raw
      .replace(/#fff(fff)?\b/gi, '__FILL__')
      .replace(/#000(000)?\b/gi, pal.stroke)
      .replace(/__FILL__/g, pal.fill);
    fs.writeFileSync(path.join(outDir, `${colorName}${role}.svg`), tinted, 'utf8');
  }
}

console.log('Generated 30 multi piece SVGs in client/public/pieces/multi');
