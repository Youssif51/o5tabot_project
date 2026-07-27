import fs from 'fs';

const content = fs.readFileSync('d:/Work/o5tabot_project/o5tabot_project/src/context/AppContext.jsx', 'utf8');
const lines = content.split('\n');

let start = -1;
let end = -1;

lines.forEach((line, idx) => {
  if (line.includes('confirmDepositRefund =') || line.includes('confirmDepositAndRefund =')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
