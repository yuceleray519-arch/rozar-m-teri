const fs = require('fs');
const glob = require('glob'); // Need to use standard fs since glob might not be installed, wait I'll use recursive readdir
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  // We want to replace `await <var>.json()` with `await <var>.json().catch(() => ({}))`
  // but only if it doesn't already have .catch
  content = content.replace(/await ([a-zA-Z0-9_]+)\.json\(\)(?!\.catch)/g, 'await $1.json().catch(() => ({}))');
  fs.writeFileSync(file, content);
});
console.log("Done");
