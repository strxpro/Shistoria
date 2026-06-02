// Inspekcja puszka.glb — nazwy węzłów, meshe, UV (TEXCOORD_0), bounding boxy, materiały.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "public", "puszka.glb");
const b = fs.readFileSync(file);

// GLB header: magic(4) version(4) length(4) ; chunk0: length(4) type(4) data
const jsonLen = b.readUInt32LE(12);
const jsonStr = b.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("=== NODES ===");
(gltf.nodes || []).forEach((n, i) => {
  console.log(`node[${i}] name="${n.name}" mesh=${n.mesh} ` +
    (n.translation ? `T=[${n.translation.map(x=>x.toFixed(3))}] ` : "") +
    (n.rotation ? `R=[${n.rotation.map(x=>x.toFixed(3))}] ` : "") +
    (n.scale ? `S=[${n.scale.map(x=>x.toFixed(3))}]` : ""));
});

console.log("\n=== MESHES (primitives + attributes) ===");
(gltf.meshes || []).forEach((m, i) => {
  console.log(`mesh[${i}] name="${m.name}"`);
  (m.primitives || []).forEach((p, j) => {
    const attrs = Object.keys(p.attributes || {}).join(", ");
    const matName = p.material != null && gltf.materials ? gltf.materials[p.material]?.name : "(none)";
    console.log(`   prim[${j}] attrs=[${attrs}] material=${p.material} (${matName})`);
    // bounding from POSITION accessor min/max
    const posAcc = gltf.accessors[p.attributes.POSITION];
    if (posAcc && posAcc.min && posAcc.max) {
      const sz = posAcc.max.map((mx, k) => (mx - posAcc.min[k]).toFixed(3));
      console.log(`        POS min=[${posAcc.min.map(x=>x.toFixed(3))}] max=[${posAcc.max.map(x=>x.toFixed(3))}] size=[${sz}]`);
    }
  });
});

console.log("\n=== MATERIALS ===");
(gltf.materials || []).forEach((m, i) => {
  const pbr = m.pbrMetallicRoughness || {};
  console.log(`mat[${i}] name="${m.name}" baseColorTex=${pbr.baseColorTexture?.index} ` +
    `baseColorFactor=${pbr.baseColorFactor ? "["+pbr.baseColorFactor.map(x=>x.toFixed(2))+"]" : "-"} ` +
    `metallic=${pbr.metallicFactor} rough=${pbr.roughnessFactor}`);
});

console.log("\n=== TEXTURES/IMAGES ===");
console.log("textures:", (gltf.textures || []).length, "images:", (gltf.images || []).length);
(gltf.images || []).forEach((im, i) => console.log(`  image[${i}] name="${im.name}" mime=${im.mimeType} uri=${im.uri || "(buffer)"}`));

console.log("\n=== ANIMATIONS ===");
(gltf.animations || []).forEach((a, i) => {
  console.log(`anim[${i}] name="${a.name}" channels=${a.channels.length}`);
});
