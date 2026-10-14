// engine/src/evaluator/evaluate.ts
import path from 'node:path';
import ts from 'typescript';
import { own, type PolicyCard } from '../policy/card.ts';
import { compareStrings as compare, findingId } from '../schema/hashing.ts';
import type { Finding, ResultState, UnknownFile, UnknownReason } from '../schema/types.ts';
import type { Snapshot, SnapshotFile } from '../snapshot/snapshot.ts';

// Bump on any change to what is flagged or reported unknown: diff refuses to compare results across versions.
export const EVALUATOR_VERSION = '0.4.0';

// Only SOURCE_EXT files are analyzed. IGNORABLE_EXT names non-code file types that are never scanned; it is the
// single source of truth for that list (the card and docs repeat it). Every other extension is unknown
// (`unsupported-language`, or `unreadable` when its content is binary), so an unlisted language can never read as a pass.
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
export const IGNORABLE_EXT = new Set(
  [
    'md', 'markdown', 'txt', 'rst', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env', 'lock', 'log',
    'csv', 'tsv', 'xml', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp', 'tiff', 'woff', 'woff2',
    'ttf', 'otf', 'eot', 'pdf', 'zip', 'gz', 'tar', 'tgz', 'map', 'css', 'scss', 'sass', 'less', 'sql', 'graphql',
    'gql', 'prisma', 'mdc',
    // suffix-like extensions, as in .env.local or config.example
    'local', 'example', 'sample', 'template', 'dist',
    // compiled and media artifacts that are binary in practice
    'wasm', 'node', 'so', 'dll', 'dylib', 'exe', 'bin', 'jar', 'class', 'o', 'a', 'pyc', 'db', 'sqlite', 'sqlite3',
    'mp3', 'mp4', 'mov', 'webm', 'ogg', 'wav', 'flac', 'avi', 'psd', 'icns', 'heic',
  ].map((e) => `.${e}`),
);
const MAX_LINE_LENGTH = 1000;
// A file is minified when more than this share of its bytes sits in lines longer than MAX_LINE_LENGTH.
const MINIFIED_LONG_LINE_SHARE = 0.5;
// A whole-literal model identifier: `<prefix>/<slug>`, with the slug free of further slashes.
const MODEL_ID = /^([^/]+)\/([a-z0-9][a-z0-9._:-]*)$/i;
// Any `scheme://` literal is a candidate URL; new URL() then decides whether it has a hostname.
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const TEMPLATE_HOST_HEAD = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+[/?#]/i;

export interface EvaluationInput {
  snapshot: Snapshot;
  card: PolicyCard;
  allowlist: string[];
}

export interface EvaluationOutput {
  state: ResultState;
  findings: Finding[];
  unknownFiles: UnknownFile[];
  filesEvaluated: number;
  notes: string[];
}

export function evaluate(
  { snapshot, card, allowlist }: EvaluationInput,
  scanFileFn: typeof scanFile = scanFile, // test-only seam: lets tests make one file's scan throw
): EvaluationOutput {
  const findings = new Map<string, Finding>();
  const unknownFiles: UnknownFile[] = [];
  let filesEvaluated = 0;

  for (const file of snapshot.files) {
    if (isExcluded(file.path, card)) continue;
    const ext = path.posix.extname(file.path).toLowerCase();
    const skip = classify(file, ext);
    if (skip === 'ignore') continue;
    if (skip) {
      unknownFiles.push({ path: file.path, reason: skip });
      continue;
    }
    // One file that breaks the parser or the walk becomes unknown for that file; it never zeroes out the repo.
    try {
      const problem = fileProblem(file);
      if (problem) {
        unknownFiles.push({ path: file.path, reason: problem });
        continue;
      }
      const found = scanFileFn(file.path, file.sha256 as string, file.content as string, card, allowlist);
      for (const finding of found) findings.set(finding.id, finding);
      filesEvaluated++;
    } catch {
      unknownFiles.push({ path: file.path, reason: 'parse-error' });
    }
  }

  const sorted = [...findings.values()].sort(
    (a, b) =>
      compare(a.evidence.path, b.evidence.path) || a.evidence.start - b.evidence.start || compare(a.id, b.id),
  );
  unknownFiles.sort((a, b) => compare(a.path, b.path));

  const notes: string[] = [];
  let state: ResultState;
  if (sorted.length > 0) state = 'fail';
  else if (unknownFiles.length > 0) state = 'unknown';
  else if (filesEvaluated === 0) {
    state = 'unknown';
    notes.push('no-evaluable-files');
  } else state = 'pass';

  return { state, findings: sorted, unknownFiles, filesEvaluated, notes };
}

function isExcluded(filePath: string, card: PolicyCard): boolean {
  const segments = filePath.split('/');
  const base = segments[segments.length - 1];
  return card.exclusions.files.includes(base) || segments.slice(0, -1).some((s) => card.exclusions.dirs.includes(s));
}

/**
 * Decide what happens to a snapshot entry before analysis: 'ignore', an unknown reason, or undefined (analyze it).
 * A symlink can hide source whatever its name, so it is always unknown. Ignorable types are never analyzed, so their
 * size or readability does not matter. Binary content (a NUL byte near the start, which includes UTF-16 text) is
 * skipped only when the file has no extension; under any other extension it may be a script and is unknown.
 * Known conservative case: an over-cap extensionless file is never read, so it is unknown (too-large) even though the
 * same file under the cap would be skipped as binary.
 */
function classify(file: SnapshotFile, ext: string): UnknownReason | 'ignore' | undefined {
  if (file.status === 'symlink') return 'symlink';
  if (IGNORABLE_EXT.has(ext)) return 'ignore';
  if (file.status === 'binary') return ext === '' ? 'ignore' : 'unreadable';
  if (file.status === 'too-large') return 'too-large';
  if (file.status !== 'ok') return 'unreadable';
  if (ext === '') return file.content?.replace(/^\uFEFF/, '').startsWith('#!') ? 'unsupported-language' : 'ignore';
  return SOURCE_EXT.has(ext) ? undefined : 'unsupported-language';
}

function fileProblem(file: SnapshotFile): UnknownReason | undefined {
  if (file.status !== 'ok' || file.content === null || file.sha256 === null) return 'unreadable';
  if (looksMinified(file.path, file.content)) return 'minified';
  if (looksGenerated(file.content)) return 'generated';
  if (hasParseError(file.path, file.content)) return 'parse-error';
  return undefined;
}

// One long line (an SVG path, a class string) does not make a file minified; most of its bytes being in long lines does.
// In a .tsx/.jsx file, single-line JSX attribute strings (SVG path data in `d="..."`) are markup data, not code, so
// their bytes do not count towards the long-line share. Every other string still counts, so a bundle stays minified.
function looksMinified(filePath: string, content: string): boolean {
  if (/\.min\.(js|mjs|cjs)$/.test(filePath)) return true;
  const total = Buffer.byteLength(content, 'utf8');
  if (total === 0) return false;
  const lines = content.split('\n');
  let long = 0;
  for (const line of lines) {
    if (line.length > MAX_LINE_LENGTH) long += Buffer.byteLength(line, 'utf8');
  }
  if (long <= total * MINIFIED_LONG_LINE_SHARE) return false;
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.tsx' && ext !== '.jsx') return true;
  return long - jsxAttributeBytesOnLongLines(filePath, content) > total * MINIFIED_LONG_LINE_SHARE;
}

function jsxAttributeBytesOnLongLines(filePath: string, content: string): number {
  const kind = filePath.toLowerCase().endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX;
  const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, false, kind);
  let bytes = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const start = node.initializer.getStart(source);
      const text = content.slice(start, node.initializer.end);
      // Lines are split on \n only, as in looksMinified: TypeScript also breaks lines on U+2028 and U+2029.
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = content.indexOf('\n', start);
      const lineLength = (lineEnd === -1 ? content.length : lineEnd) - lineStart;
      if (!text.includes('\n') && lineLength > MAX_LINE_LENGTH) bytes += Buffer.byteLength(text, 'utf8');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return bytes;
}

function looksGenerated(content: string): boolean {
  return content
    .split('\n')
    .slice(0, 5)
    .some((l) => /@generated|auto-?generated|do not edit/i.test(l));
}

// transpileModule cannot emit a declaration file (it throws "Output generation failed"), so declaration
// files are checked under the matching non-declaration name; syntax rules are the same for both.
function diagnosticsName(filePath: string): string {
  return filePath.replace(/\.d(\.[^./]+)?\.([mc]?ts)$/i, '$1.$2');
}

function hasParseError(filePath: string, content: string): boolean {
  const out = ts.transpileModule(content, {
    fileName: diagnosticsName(filePath),
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext, allowJs: true },
  });
  return (out.diagnostics ?? []).some((d) => d.category === ts.DiagnosticCategory.Error);
}

// Dotted callee path built from the AST, so line breaks, comments and wrapping
// parentheses around the callee do not change the name (getText would keep them).
function calleeName(node: ts.Expression): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) return calleeName(node.expression);
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
    const base = calleeName(node.expression);
    return base === undefined ? undefined : `${base}.${node.name.text}`;
  }
  return undefined;
}

// An object key, interface member name, destructuring key or computed key: a name, not a value.
function isPropertyName(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isComputedPropertyName(parent)) return true;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return true;
  return 'name' in parent && parent.name === node && !ts.isModuleDeclaration(parent);
}

export function scanFile(filePath: string, fileSha: string, content: string, card: PolicyCard, allowlist: string[]): Finding[] {
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.ESNext, true);
  const lineStarts = sf.getLineStarts();
  const out: Finding[] = [];

  function packageProvider(spec: string): string | undefined {
    for (const name of Object.keys(card.registry.packages)) {
      if (spec === name || spec.startsWith(`${name}/`)) return card.registry.packages[name];
    }
    return undefined;
  }

  function hostProvider(text: string): string | undefined {
    if (!SCHEME.test(text)) return undefined;
    try {
      return own(card.registry.hosts, new URL(text).hostname.toLowerCase().replace(/\.$/, ''));
    } catch {
      return undefined;
    }
  }

  function gatewayProvider(text: string): string | undefined {
    const slash = text.indexOf('/');
    return slash > 0 ? own(card.registry.gatewayPrefixes, text.slice(0, slash).toLowerCase()) : undefined;
  }

  // A literal model id anywhere: the slug must hold a digit or hyphen, so paths such as google/fonts are not flagged.
  function modelLiteralProvider(text: string): string | undefined {
    const m = MODEL_ID.exec(text);
    if (!m || !/[0-9-]/.test(m[2])) return undefined;
    return own(card.registry.gatewayPrefixes, m[1].toLowerCase());
  }

  function check(node: ts.Node, text: string, providerId: string | undefined, what: string) {
    if (!providerId || allowlist.includes(providerId)) return;
    const start = node.getStart(sf);
    const end = node.getEnd();
    const { line, character } = sf.getLineAndCharacterOfPosition(start);
    out.push({
      id: findingId({ ruleId: card.id, ruleVersion: card.version, path: filePath, start, end, matched: text }),
      ruleId: card.id,
      ruleVersion: card.version,
      severity: card.severity,
      providerId,
      matched: text,
      evidence: {
        path: filePath,
        fileSha256: fileSha,
        start,
        end,
        line: line + 1,
        column: character + 1,
        excerpt: content.slice(lineStarts[line], lineStarts[line + 1] ?? content.length).trim().slice(0, 160),
        reason: `${what} "${text}" resolves to provider "${providerId}", which is not in the allowlist`,
      },
    });
  }

  const isLiteral = (n: ts.Node | undefined): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
    n !== undefined && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

  // Literals the model-literal check must not look at: module names (the package rule owns them) and declared-constructor
  // arguments (the constructor check owns them, so it keeps its reason and there is one finding per literal). A parent
  // is visited before its children, so these are recorded before the literal itself is reached.
  const claimed = new Set<ts.Node>();

  function visit(node: ts.Node): void {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && isLiteral(node.moduleSpecifier)) {
      claimed.add(node.moduleSpecifier);
      check(node.moduleSpecifier, node.moduleSpecifier.text, packageProvider(node.moduleSpecifier.text), 'import of package');
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const arg = node.arguments[0];
      const name = calleeName(callee);
      const isRequire = name === 'require' || name === 'require.resolve';
      if (isLiteral(arg) && (isRequire || callee.kind === ts.SyntaxKind.ImportKeyword)) {
        claimed.add(arg);
        check(arg, arg.text, packageProvider(arg.text), 'load of package');
      } else if (card.modelConstructors.includes(name ?? '')) {
        // Only the template head is known; a prefix must be fully inside it (`openai/${m}`).
        const text = isLiteral(arg) ? arg.text : arg && ts.isTemplateExpression(arg) ? arg.head.text : undefined;
        if (arg) claimed.add(arg);
        if (text !== undefined && arg) check(arg, text, gatewayProvider(text), 'model identifier');
      }
    }
    // typeof import('pkg') and import('pkg').T in type positions
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && isLiteral(node.argument.literal)) {
      const lit = node.argument.literal;
      claimed.add(lit);
      check(lit, lit.text, packageProvider(lit.text), 'import of package');
    }
    if (ts.isExternalModuleReference(node) && isLiteral(node.expression)) {
      claimed.add(node.expression);
      check(node.expression, node.expression.text, packageProvider(node.expression.text), 'import of package');
    }
    if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) claimed.add(node.name);
    if (isLiteral(node) && !claimed.has(node) && !isPropertyName(node)) {
      check(node, node.text, modelLiteralProvider(node.text), 'model identifier literal');
    }
    if (isLiteral(node)) check(node, node.text, hostProvider(node.text), 'URL');
    // A template URL counts only when the head fixes the whole host: it continues past the host with / ? or #
    // (`https://api.openai.com/${x}`, `https://api.openai.com?k=${k}`).
    else if (ts.isTemplateExpression(node) && TEMPLATE_HOST_HEAD.test(node.head.text)) {
      check(node, node.head.text, hostProvider(node.head.text), 'URL');
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return out;
}
