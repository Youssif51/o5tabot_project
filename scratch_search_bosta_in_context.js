import fs from 'fs';

const content = fs.readFileSync('d:/Work/o5tabot_project/o5tabot_project/src/context/AppContext.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('manage-bosta-delivery')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
