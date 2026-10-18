import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const normalized = (value) => value.split(path.sep).join('/');
const isPortal = (value) => /^apps\/portals\/(?!shared\/)[^/]+\//.test(value);
const isPage = (value) =>
  /^apps\/portals\/[^/]+\/application\/src\/pages\//.test(value);
const isFeatureApplication = (value) =>
  /^apps\/portals\/shared\/features\/[^/]+\/src\/application\//.test(value);
const isAdapter = (value) =>
  value.includes('/infrastructure/') || value.startsWith('libs/adapters/');
const isReusableAccountOrReview = (value) =>
  /^sdk\/features\/(identity\/(core|libs)|review)\//.test(value);
const isDomain = (value) =>
  value.startsWith('libs/domains/') ||
  /^sdk\/features\/[^/]+\/core\//.test(value);

export function dependencyRules(source, target, specifier) {
  const rules = [];
  if (
    isDomain(source) &&
    (/^(@angular\/|@nestjs\/|typeorm(?:\/|$)|mongodb(?:\/|$)|@infrastructure\/)/.test(
      specifier
    ) ||
      target.startsWith('apps/') ||
      target.startsWith('libs/ui/') ||
      target.startsWith('sdk/extras/') ||
      isAdapter(target) ||
      /\/node_modules\/(?:@angular|@nestjs|typeorm|mongodb)\//.test(
        '/' + target
      ))
  )
    rules.push('ARCH001');
  if (
    source.startsWith('libs/ui/') &&
    (target.startsWith('apps/') ||
      target.startsWith('libs/domains/') ||
      target.startsWith('sdk/features/'))
  )
    rules.push('ARCH002');
  if (
    source.startsWith('sdk/kernel/') &&
    (target.startsWith('apps/') ||
      target.startsWith('libs/domains/') ||
      target.startsWith('libs/ui/') ||
      target.startsWith('libs/usecases/') ||
      target.startsWith('libs/adapters/') ||
      target.startsWith('sdk/features/') ||
      target.startsWith('sdk/extras/'))
  )
    rules.push('ARCH003');
  if (source.startsWith('apps/portals/shared/') && isPortal(target))
    rules.push('ARCH004');
  if (isFeatureApplication(source) && isAdapter(target)) rules.push('ARCH005');
  if (isPage(source) && isAdapter(target)) rules.push('ARCH006');
  if (
    source.startsWith('sdk/features/discussion/') &&
    (/^libs\/(domains|usecases|adapters)\//.test(target) ||
      target.startsWith('apps/services/'))
  )
    rules.push('ARCH007');
  if (
    isReusableAccountOrReview(source) &&
    /^(libs\/(domains|usecases|adapters)\/|apps\/)/.test(target)
  )
    rules.push('ARCH009');
  if (
    (source.startsWith('sdk/features/identity/applications/authenticator/') &&
      (/^libs\/(adapters\/account-mysql|usecases\/account)\//.test(target) ||
        target.startsWith('sdk/features/identity/applications/management/'))) ||
    (source.startsWith('sdk/features/identity/applications/management/') &&
      (/^sdk\/features\/identity\/packages\/infrastructure\/(local|firebase)\//.test(
        target
      ) ||
        target.startsWith(
          'sdk/features/identity/applications/authenticator/'
        ) ||
        /^firebase-admin(?:\/|$)/.test(specifier)))
  )
    rules.push('ARCH011');
  return rules;
}

export const ruleDescriptions = {
  ARCH001:
    'Domains must not depend on frameworks, UI, applications, or infrastructure.',
  ARCH002:
    'Generic UI must not depend on portal or domain/feature implementations.',
  ARCH003:
    'The kernel must not depend on product domains, applications, or adapters.',
  ARCH004: 'Shared portal code must not depend on a concrete portal.',
  ARCH005:
    'Feature application code must use ports instead of concrete infrastructure.',
  ARCH006:
    'Pages must use feature services/ports instead of infrastructure adapters.',
  ARCH007:
    'Reusable Discussion must not depend on consumer domains or application implementations.',
  ARCH008:
    'Reusable Discussion must not define consumer target types or interpret their keys.',
  ARCH009:
    'Reusable Identity and Review must not import Wapps contracts, orchestration or adapters.',
  ARCH010:
    'Reusable Identity and Review must not define consumer content kinds, binding fields or provider rosters.',
  ARCH011:
    "Authentication and Identity must cross their service contract, never import each other or access each other's persistence adapters.",
};

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      [
        'node_modules',
        'dist',
        'coverage',
        '.git',
        '__tests__',
        'tests',
      ].includes(entry.name)
    )
      return [];
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    return entry.isFile() &&
      /\.[cm]?tsx?$/.test(filename) &&
      !/\.(?:spec|test|d)\.[cm]?tsx?$/.test(filename) &&
      entry.name !== 'test-setup.ts' &&
      normalized(filename).includes('/src/')
      ? [filename]
      : [];
  });
}

export function auditArchitecture(root = workspaceRoot) {
  root = path.resolve(root);
  const configFile = path.join(root, 'tsconfig.base.json');
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, '\n')
    );
  const parsed = ts.convertCompilerOptionsFromJson(
    config.config.compilerOptions ?? {},
    root
  );
  if (parsed.errors.length)
    throw new Error(
      parsed.errors
        .map((error) =>
          ts.flattenDiagnosticMessageText(error.messageText, '\n')
        )
        .join('\n')
    );

  const files = ['apps', 'libs', 'sdk']
    .flatMap((directory) => {
      const absolute = path.join(root, directory);
      return ts.sys.directoryExists(absolute) ? sourceFiles(absolute) : [];
    })
    .sort();
  if (!files.length)
    throw new Error('No application, library, or SDK source files found.');

  const options = { ...parsed.options, noEmit: true };
  const program = ts.createProgram(files, options);
  const checker = program.getTypeChecker();
  const relative = (filename) => normalized(path.relative(root, filename));
  const resolutionCache = ts.createModuleResolutionCache(
    root,
    (name) => name,
    options
  );
  const findings = new Map();

  for (const filename of files) {
    const sourceFile = program.getSourceFile(filename);
    if (!sourceFile)
      throw new Error(`TypeScript did not load ${relative(filename)}`);
    const source = relative(filename);
    const record = (node, specifier, target) => {
      const position = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile)
      );
      for (const rule of dependencyRules(source, target, specifier)) {
        const finding = {
          rule,
          file: source,
          line: position.line + 1,
          specifier,
          target,
        };
        findings.set(`${rule}:${source}:${position.line}:${target}`, finding);
      }
    };
    const inspectModule = (node, moduleSpecifier) => {
      if (!moduleSpecifier || !ts.isStringLiteralLike(moduleSpecifier)) return;
      const specifier = moduleSpecifier.text;
      const resolved = ts.resolveModuleName(
        specifier,
        filename,
        options,
        ts.sys,
        resolutionCache
      ).resolvedModule;
      record(
        node,
        specifier,
        resolved ? relative(resolved.resolvedFileName) : specifier
      );

      // Resolve named exports through barrels so an adapter cannot hide behind a public alias.
      if (!(isPage(source) || isFeatureApplication(source))) return;
      const inspectSymbol = (name) => {
        let symbol = checker.getSymbolAtLocation(name);
        if (!symbol) return;
        if (symbol.flags & ts.SymbolFlags.Alias)
          symbol = checker.getAliasedSymbol(symbol);
        for (const declaration of symbol.declarations ?? []) {
          record(
            node,
            specifier,
            relative(declaration.getSourceFile().fileName)
          );
        }
      };
      if (ts.isImportDeclaration(node)) {
        if (node.importClause?.name) inspectSymbol(node.importClause.name);
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) inspectSymbol(element.name);
        }
      }
    };
    const visit = (node) => {
      if (
        isReusableAccountOrReview(source) &&
        ((ts.isStringLiteralLike(node) &&
          [
            'application',
            'article',
            'suite',
            'applications',
            'articles',
            'suites',
            'discussions',
            'editorial',
            'discussion',
            'applicationId',
            'discussionId',
            'targetKind',
          ].includes(node.text)) ||
          (ts.isIdentifier(node) &&
            [
              'applicationId',
              'discussionId',
              'targetKind',
              'FAVORITE_KINDS',
              'ACCOUNT_EXPORT_SOURCES',
              'ACCOUNT_ERASURE_PARTICIPANTS',
            ].includes(node.text)))
      ) {
        const position = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile)
        );
        findings.set(`ARCH010:${source}:${position.line}:${node.text}`, {
          rule: 'ARCH010',
          file: source,
          line: position.line + 1,
          specifier: node.text,
          target: 'consumer-owned binding or provider plan',
        });
      }
      if (
        source.startsWith('sdk/features/discussion/') &&
        ((ts.isStringLiteralLike(node) &&
          ['article', 'application'].includes(node.text)) ||
          (ts.isIdentifier(node) &&
            ['subjectKind', 'targetKind', 'DiscussionTarget'].includes(
              node.text
            )))
      ) {
        const position = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile)
        );
        findings.set(`ARCH008:${source}:${position.line}:${node.text}`, {
          rule: 'ARCH008',
          file: source,
          line: position.line + 1,
          specifier: node.text,
          target: 'consumer-owned binding key',
        });
      }
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        inspectModule(node, node.moduleSpecifier);
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      ) {
        inspectModule(node, node.moduleReference.expression);
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require'))
      ) {
        inspectModule(node, node.arguments[0]);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  const violations = [...findings.values()].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.rule.localeCompare(b.rule) ||
      a.target.localeCompare(b.target)
  );
  return {
    filesScanned: files.length,
    counts: Object.fromEntries(
      Object.keys(ruleDescriptions).map((rule) => [
        rule,
        violations.filter((finding) => finding.rule === rule).length,
      ])
    ),
    violations,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--json'))
      throw new Error(
        'Usage: node tools/readiness/check-architecture.mjs [--json]'
      );
    const result = auditArchitecture();
    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const finding of result.violations) {
        console.log(
          `${finding.file}:${finding.line} ${finding.rule} ${finding.specifier} -> ${finding.target}`
        );
      }
      console.log(
        `Scanned ${result.filesScanned} source files; ${result.violations.length} boundary violations.`
      );
    }
    process.exitCode = result.violations.length ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
