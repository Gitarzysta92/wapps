import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const json = (filename) => JSON.parse(readFileSync(filename, 'utf8'));

export function inspectAngularPackage(directory, expectedName) {
  directory = path.resolve(directory);
  const manifest = json(path.join(directory, 'package.json'));
  if (manifest.name !== expectedName)
    throw new Error('Package identity mismatch');
  const files = new Set();
  let angularDeclarations = 0;
  let esmFiles = 0;
  let declarationFiles = 0;

  function visit(relative, declaration = false) {
    const filename = path.resolve(directory, relative);
    if (!filename.startsWith(directory + path.sep)) {
      throw new Error(`Relative import leaves package: ${relative}`);
    }
    if (files.has(filename)) return;
    files.add(filename);
    if (!statSync(filename).isFile())
      throw new Error(`Missing file: ${relative}`);
    const source = ts.createSourceFile(
      filename,
      readFileSync(filename, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      declaration ? ts.ScriptKind.TS : ts.ScriptKind.JS
    );
    if (source.parseDiagnostics.length)
      throw new Error(`Invalid syntax: ${relative}`);
    if (declaration) declarationFiles++;
    else {
      esmFiles++;
      if (
        !source.statements.some(
          (node) =>
            ts.isImportDeclaration(node) ||
            ts.isExportDeclaration(node) ||
            ts.isExportAssignment(node) ||
            node.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
            )
        )
      ) {
        throw new Error(`Bundle is not an ES module: ${relative}`);
      }
    }
    function walk(node) {
      if (!declaration && ts.isCallExpression(node)) {
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'
        ) {
          throw new Error(`CommonJS require in ES module: ${relative}`);
        }
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          /^\u0275\u0275ngDeclare(?:Component|Directive|Injectable|Pipe|NgModule)$/.test(
            node.expression.name.text
          )
        ) {
          angularDeclarations++;
        }
      }
      if (
        !declaration &&
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 'exports' ||
          (node.expression.text === 'module' && node.name.text === 'exports'))
      ) {
        throw new Error(`CommonJS export in ES module: ${relative}`);
      }
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword
          ? node.arguments[0]
          : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
          ? node.argument.literal
          : undefined;
      if (
        specifier &&
        ts.isStringLiteral(specifier) &&
        specifier.text.startsWith('.')
      ) {
        const target = path.resolve(path.dirname(filename), specifier.text);
        const stem = target
          .replace(/\.(?:mjs|js)$/, '')
          .replace(/\.d\.ts$/, '');
        const candidates = declaration
          ? [stem + '.d.ts', path.join(stem, 'index.d.ts')]
          : [target];
        const resolved =
          candidates.find((candidate) => existsSync(candidate)) ||
          candidates[0];
        visit(path.relative(directory, resolved), declaration);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }

  if (!manifest.module || !(manifest.typings || manifest.types)) {
    throw new Error('Missing module or declaration entrypoint');
  }
  visit(manifest.module);
  visit(manifest.typings || manifest.types, true);
  if (!angularDeclarations)
    throw new Error('No partial Angular declarations in reachable bundles');
  return {
    name: expectedName,
    esmFiles,
    declarationFiles,
    angularDeclarations,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.length === 1 && args[0] === '--all';
  if (!all && (args.length !== 2 || args[0] !== '--project')) {
    throw new Error(
      'Usage: node tools/readiness/check-angular-packages.mjs --all | --project <nx-project>'
    );
  }
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
  );
  const { createProjectGraphAsync } = await import('@nx/devkit');
  const graph = await createProjectGraphAsync();
  if (!all && !graph.nodes[args[1]])
    throw new Error(`Unknown project: ${args[1]}`);
  const projects = new Set();
  function collect(name) {
    if (projects.has(name) || !graph.nodes[name]) return;
    projects.add(name);
    for (const dependency of graph.dependencies[name] || [])
      collect(dependency.target);
  }
  if (all) Object.keys(graph.nodes).forEach(collect);
  else collect(args[1]);
  const results = [];
  const errors = [];
  for (const name of [...projects].sort()) {
    const project = graph.nodes[name].data;
    const build = project.targets?.build;
    if (build?.executor !== '@nx/angular:package') continue;
    try {
      const configPath = path.resolve(root, build.options.project);
      const config = json(configPath);
      const sourceManifest = json(
        path.join(root, project.root, 'package.json')
      );
      const output = path.resolve(path.dirname(configPath), config.dest);
      results.push({
        project: name,
        output: path.relative(root, output),
        ...inspectAngularPackage(output, sourceManifest.name),
      });
    } catch (error) {
      errors.push({ project: name, error: error.message });
    }
  }
  if (!results.length && !errors.length)
    throw new Error('No Angular packages found');
  console.log(
    JSON.stringify(
      {
        project: all ? 'all' : args[1],
        packagesChecked: results.length + errors.length,
        results,
        errors,
      },
      null,
      2
    )
  );
  if (errors.length) process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
