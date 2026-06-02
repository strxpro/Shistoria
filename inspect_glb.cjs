const fs = require('fs');
const b = fs.readFileSync('public/WINOILIKIERY.glb');

// GLB header: magic(4) + version(4) + length(4) + chunk0type+len (8) = JSON chunk
const jsonLen = b.readUInt32LE(12);
const jsonStr = b.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

console.log("=== NODES ===");
if (gltf.nodes) {
  gltf.nodes.forEach((n, i) => console.log(`  [${i}] ${n.name || '(unnamed)'}`));
}

console.log("\n=== ANIMATIONS ===");
if (gltf.animations) {
  gltf.animations.forEach((a, i) => console.log(`  [${i}] ${a.name || '(unnamed)'}`));
}

console.log("\n=== MATERIALS ===");
if (gltf.materials) {
  gltf.materials.forEach((m, i) => console.log(`  [${i}] ${m.name || '(unnamed)'}`));
}
