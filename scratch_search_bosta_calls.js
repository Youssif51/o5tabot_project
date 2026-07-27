import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

walkDir('d:/Work/o5tabot_project/o5tabot_project/src', (filePath) => {
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('manage-bosta-delivery') || content.includes('bostaDeliveryId')) {
      console.log(`Found in: ${filePath}`);
    }
  }
});
