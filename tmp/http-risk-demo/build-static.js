const fs = require("fs");
const path = require("path");
const {
  alteredState,
  normalState,
  renderIndex,
  renderPage,
} = require("./server");

const distDir = path.join(__dirname, "dist");

function forStaticIndex(html) {
  return html
    .replace('href="/site?mode=normal"', 'href="./normal.html"')
    .replace('href="/site?mode=altered"', 'href="./altered.html"');
}

function forStaticPage(html) {
  return html.replace('href="/?view=compare"', 'href="./index.html"');
}

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "index.html"), forStaticIndex(renderIndex()));
fs.writeFileSync(path.join(distDir, "normal.html"), forStaticPage(renderPage(normalState)));
fs.writeFileSync(path.join(distDir, "altered.html"), forStaticPage(renderPage(alteredState)));

console.log(`Static demo files written to ${distDir}`);
