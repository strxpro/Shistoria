const fs = require('fs');

try {
  const data = fs.readFileSync('public/WINOILIKIERY.glb');
  const str = data.toString('utf8');
  
  // Let's just find the JSON chunk
  const jsonStart = str.indexOf('{"asset"');
  if (jsonStart !== -1) {
    let jsonEnd = str.indexOf(' BIN');
    if (jsonEnd === -1) {
       // Just find a reasonable end
       for(let i = jsonStart + 10; i < str.length; i++) {
         if (str.substring(i, i+6) === '  BIN\x00') {
            jsonEnd = i;
            break;
         }
       }
    }
    
    // Fallback: simple curly brace matching
    if (jsonEnd === -1) {
      let braces = 0;
      for (let i = jsonStart; i < str.length; i++) {
        if (str[i] === '{') braces++;
        if (str[i] === '}') {
          braces--;
          if (braces === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
    }
    
    if (jsonEnd !== -1) {
      const jsonStr = str.substring(jsonStart, jsonEnd).trim();
      const gltf = JSON.parse(jsonStr);
      console.log("Nodes:");
      gltf.nodes.forEach((n, i) => {
        console.log(`[${i}] ${n.name || 'unnamed'}`);
      });
    }
  } else {
    console.log("Could not find JSON chunk");
  }
} catch (e) {
  console.log(e);
}
