import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Change this to your exported file
const inputFile = join(__dirname, 'test.json');

const data = JSON.parse(readFileSync(inputFile, 'utf8'));

console.log('// --- Generated from editor JSON ---');

// --- Floor Tiles ---
if (Array.isArray(data.floorTiles)) {
  console.log('const floorTiles = [');
  for (const row of data.floorTiles) {
    const rowStr = JSON.stringify(row);
    console.log(`  ${rowStr},`);
  }
  console.log('];');
  console.log('');
} else {
  // Output an empty/default grid if missing
  console.log('const floorTiles = Array.from({length: 50}, () => Array(20).fill("default"));');
  console.log('');
}

// --- Buildings and Trees ---
console.log('const placedBuildings = [];');
console.log('const treePositions = [];');
console.log('const streetlampPositions = [];');

const TREE_Y_POS = 'TREE_Y_POS'; // Use this as a placeholder for your constant

if (Array.isArray(data.placedObjects)) {
  data.placedObjects.forEach(obj => {
    if (obj.type === 'building') {
      // Output all properties for correct rendering
      console.log(
        `placedBuildings.push({ x: ${obj.position.x}, y: ${obj.position.y}, z: ${obj.position.z}, width: ${obj.dimensions.width}, height: ${obj.dimensions.height}, depth: ${obj.dimensions.depth}, wallTextureKey: '${obj.wallTextureKey}' });`
      );
    } else if (obj.type === 'sprite') {
      if (obj.spriteKey === 'tree') {
        // Use TREE_Y_POS for correct Y
        console.log(
          `treePositions.push(new THREE.Vector3(${obj.position.x}, ${TREE_Y_POS}, ${obj.position.z}));`
        );
      } else if (obj.spriteKey === 'streetlamp') {
        console.log(
          `streetlampPositions.push(new THREE.Vector3(${obj.position.x}, 0.51, ${obj.position.z}));`
        );
      } else {
        console.log(
          `// Unknown sprite type: ${obj.spriteKey} at (${obj.position.x}, 0.51, ${obj.position.z})`
        );
      }
    }
  });
}

console.log('// --- End generated code ---');
console.log('// Paste the above at the top of main.js or your game entry file.');