const fs = require('fs');
const buffer = fs.readFileSync('public/shaker-shistoria.glb');
const jsonLength = buffer.readUInt32LE(12);
const jsonString = buffer.toString('utf8', 20, 20 + jsonLength);
const json = JSON.parse(jsonString);
console.log(json.nodes.map((n, i) => `${i}: ${n.name} (mesh: ${n.mesh})`).join('\n'));
