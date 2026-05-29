const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/Szefuncio/.gemini/antigravity/brain/c2ce7ca8-bc9b-430d-a5a5-9d4c86fef346/.system_generated/logs/transcript.jsonl')
});
let pastStep41 = false;
let operations = [];
rl.on('line', (line) => {
  try {
    const step = JSON.parse(line);
    if (step.step_index === 41) {
      pastStep41 = true;
    }
    if (pastStep41 && step.type === 'PLANNER_RESPONSE' && step.tool_calls) {
      step.tool_calls.forEach(tc => {
        if (['replace_file_content', 'multi_replace_file_content'].includes(tc.name)) {
          operations.push({ name: tc.name, args: tc.args });
        }
      });
    }
  } catch(e) {}
});
rl.on('close', () => {
    operations.reverse();
    for (let op of operations) {
        let file = op.args.TargetFile.replace(/"/g, '');
        let content = fs.readFileSync(file, 'utf8');
        if (op.name === 'replace_file_content') {
            const target = op.args.ReplacementContent;
            const replacement = op.args.TargetContent;
            content = content.replace(target, replacement);
        } else if (op.name === 'multi_replace_file_content') {
            let chunks = op.args.ReplacementChunks;
            if (typeof chunks === 'string') chunks = JSON.parse(chunks);
            for (let chunk of chunks) {
                const target = chunk.ReplacementContent;
                const replacement = chunk.TargetContent;
                content = content.replace(target, replacement);
            }
        }
        fs.writeFileSync(file, content, 'utf8');
        console.log('Reverted changes in ' + file);
    }
});
