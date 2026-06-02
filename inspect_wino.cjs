const fs = require('fs');

try {
  const data = fs.readFileSync('public/WINOILIKIERY.glb');
  const str = data.toString('utf8');
  const matches = str.match(/"name":"([^"]+)"/g);
  if (matches) {
    const unique = [...new Set(matches.map(m => m.split('"')[3]))];
    console.log("Nodes found in WINOILIKIERY:", unique.join(', '));
  } else {
    console.log("No names found or binary format is strictly binary chunk.");
  }
} catch (e) {
  console.log(e);
}
