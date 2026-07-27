import fs from 'fs';
import path from 'path';

function searchDir(dir, query) {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      searchDir(p, query);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(p, 'utf8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        content.split('\n').forEach((line, idx) => {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            console.log(`${p}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  });
}

searchDir('d:/Work/o5tabot_project/o5tabot_project/src', 'product_variants');
