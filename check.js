const fs = require('fs');
let code = fs.readFileSync('d:/workspace/RedditPlus/crawl-results.js', 'utf8');

// Replace chrome.* calls
code = code.replace(/chrome\.runtime\.sendMessage/g, 'window.__r');
code = code.replace(/chrome\.tabs\.getCurrent/g, 'window.__t');
code = code.replace(/chrome\.storage\.local\.get/g, 'window.__s');
code = code.replace(/chrome\.storage\.local\.set/g, 'window.__s2');

// Wrap
const wrappedCode = `(function() { ${code} })()`;

const vm = require('vm');
try {
  vm.createScript(wrappedCode);
  console.log('Syntax OK');
} catch (e) {
  console.log('Error:', e.message);
  console.log('At line:', e.stack.match(/evalmachine.<anonymous>:(\d+)/)?.[1] || 'unknown');
}
