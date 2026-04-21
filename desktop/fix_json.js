const fs = require('fs');
function fix(file) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const obj = JSON.parse(content);
        fs.writeFileSync(file, JSON.stringify(obj, null, 4), 'utf8');
        console.log('Fixed ' + file);
    } catch (e) {
        console.error('Failed to fix ' + file + ': ' + e.message);
    }
}
fix('./src/locales/es.json');
fix('./src/locales/en.json');
