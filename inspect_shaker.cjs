const fs = require('fs');
const b = fs.readFileSync('public/shaker-shistoria.glb');

const jsonLen = b.readUInt32LE(12);
const jsonStr = b.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

console.log("=== SHAKER NODES ===");
if (gltf.nodes) {
  gltf.nodes.forEach((n, i) => console.log(`  [${i}] ${n.name || '(unnamed)'}`));
}

console.log("\n=== SHAKER ANIMATIONS ===");
if (gltf.animations) {
  gltf.animations.forEach((a, i) => console.log(`  [${i}] ${a.name || '(unnamed)'}`));
} else {
  console.log("  (none)");
}
