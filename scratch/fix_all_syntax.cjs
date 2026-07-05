const fs = require('fs');
const files = [
    'd:/Work/o5tabot_project/o5tabot_project/src/components/common/Sidebar.jsx', 
    'd:/Work/o5tabot_project/o5tabot_project/src/components/store/UserManagement.jsx'
];
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const backslash = String.fromCharCode(92);
    const backtick = String.fromCharCode(96);
    const dollar = String.fromCharCode(36);
    
    // Replace \` with `
    content = content.split(backslash + backtick).join(backtick);
    
    // Replace \$ with $
    content = content.split(backslash + dollar).join(dollar);
    
    fs.writeFileSync(file, content);
}
console.log("Files fixed!");
