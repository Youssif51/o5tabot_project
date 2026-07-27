import fs from 'fs';

const content = fs.readFileSync('d:/Work/o5tabot_project/o5tabot_project/src/components/orders/DepositConfirmList.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('handleConfirmDepositAndRefund') || line.includes('confirmDepositAndRefund')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
