import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = path.resolve('src');
const slices = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && !['app', 'platform'].includes(entry.name)).map(entry => entry.name);
const errors = [];
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.ts') ? [file] : [];
  });
}
for (const slice of slices) for (const layer of ['domain', 'application', 'infrastructure']) {
  if (!fs.existsSync(path.join(root, slice, layer))) errors.push(`Missing ${slice}/${layer}`);
}
for (const file of walk(root)) {
  const relative = path.relative(root, file);
  const [area, layer] = relative.split(path.sep);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function inspect(node) {
    let specifier;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) specifier = node.moduleSpecifier;
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')) {
      if (!node.arguments[0] || !ts.isStringLiteral(node.arguments[0])) errors.push(`${relative}: nonliteral module import`);
      else specifier = node.arguments[0];
    }
    if (specifier && ts.isStringLiteral(specifier)) {
      const target = specifier.text;
      if (target.startsWith('.')) {
        const [targetArea, targetLayer] = path.relative(root, path.resolve(path.dirname(file), target)).split(path.sep);
        let valid = true;
        if (area === 'platform') valid = targetArea === 'platform';
        if (slices.includes(area)) {
          if (layer === 'domain') valid = targetArea === area && targetLayer === 'domain';
          if (layer === 'application') valid = targetArea === area && ['application','domain'].includes(targetLayer);
          if (layer === 'infrastructure') valid = targetArea === 'platform' || (targetArea === area && ['domain','application','infrastructure'].includes(targetLayer));
        }
        if (!valid) errors.push(`${relative}: forbidden dependency ${target}`);
      } else if (slices.includes(area) && ['domain', 'application'].includes(layer)) {
        errors.push(`${relative}: technical import ${target}`);
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Architecture boundaries passed');
