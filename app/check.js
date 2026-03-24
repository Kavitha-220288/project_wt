const { execSync } = require('child_process');
const fs = require('fs');

try {
    const output = execSync('netstat -ano').toString();
    fs.writeFileSync('netstat_output.txt', output);
    console.log('Written netstat_output.txt');
} catch (err) {
    fs.writeFileSync('netstat_error.txt', err.toString());
}
