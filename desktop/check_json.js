const fs = require('fs');
function check(file) {
    const content = fs.readFileSync(file, 'utf8');
    try {
        const obj = JSON.parse(content);
        console.log(file + ' is valid JSON');
        console.log('Root keys:', Object.keys(obj).length);
    } catch (e) {
        console.error(file + ' ERROR:', e.message);
    }
}
check('./src/locales/es.json');
check('./src/locales/en.json');
