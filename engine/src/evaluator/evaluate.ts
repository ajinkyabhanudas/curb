// engine/src/evaluator/evaluate.ts
import path from 'node:path';
import ts from 'typescript';
import { own, type PolicyCard } from '../policy/card.ts';
import { canonicalize } from '../schema/canonical.ts';
import { sha256 } from '../schema/hash.ts';
import type { Finding, ResultState, UnknownFile, UnknownReason } from '../schema/types.ts';
import type { Snapshot, SnapshotFile } from '../snapshot/snapshot.ts';

export const EVALUATOR_VERSION = '0.1.0';

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const OTHER_LANG_EXT = new Set(['.py', '.go', '.rs', '.java', '.rb', '.php', '.cs', '.kt', '.swift']);
const MAX_LINE_LENGTH = 1000;

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

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function evaluate({ snapshot, card, allowlist }: EvaluationInput): EvaluationOutput {
  const findings = new Map<string, Finding>();
  const unknownFiles: UnknownFile[] = [];
  let filesEvaluated = 0;

  for (const file of snapshot.files) {
    if (isExcluded(file.path, card)) continue;
    const ext = path.posix.extname(file.path).toLowerCase();
    if (OTHER_LANG_EXT.has(ext)) {
      unknownFiles.push({ path: file.path, reason: 'unsupported-language' });
      continue;
    }
    if (!SOURCE_EXT.has(ext)) continue;
    const problem = fileProblem(file);
    if (problem) {
      unknownFiles.push({ path: file.path, reason: problem });
      continue;
    }
    for (const finding of scanFile(file.path, file.sha256 as string, file.content as string, card, allowlist)) {
      findings.set(finding.id, finding);
    }
    filesEvaluated++;
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

function fileProblem(file: SnapshotFile): UnknownReason | undefined {
  if (file.status === 'too-large') return 'too-large';
  if (file.status !== 'ok' || file.content === null || file.sha256 === null) return 'unreadable';
  if (looksMinified(file.path, file.content)) return 'minified';
  if (looksGenerated(file.content)) return 'generated';
  if (hasParseError(file.path, file.content)) return 'parse-error';
  return undefined;
}

function looksMinified(filePath: string, content: string): boolean {
  return /\.min\.(js|mjs|cjs)$/.test(filePath) || content.split('\n').some((l) => l.length > MAX_LINE_LENGTH);
}

function looksGenerated(content: string): boolean {
  return content
    .split('\n')
    .slice(0, 5)
    .some((l) => /@generated|auto-?generated|do not edit/i.test(l));
}

function hasParseError(filePath: string, content: string): boolean {
  const out = ts.transpileModule(content, {
    fileName: filePath,
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

function scanFile(filePath: string, fileSha: string, content: string, card: PolicyCard, allowlist: string[]): Finding[] {
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.ESNext, true);
  const lines = content.split('\n');
  const out: Finding[] = [];

  function packageProvider(spec: string): string | undefined {
    for (const name of Object.keys(card.registry.packages)) {
      if (spec === name || spec.startsWith(`${name}/`)) return card.registry.packages[name];
    }
    return undefined;
  }

  function hostProvider(text: string): string | undefined {
    if (!/^https?:\/\//i.test(text)) return undefined;
    try {
      return own(card.registry.hosts, new URL(text).hostname.toLowerCase());
    } catch {
      return undefined;
    }
  }

  function gatewayProvider(text: string): string | undefined {
    const slash = text.indexOf('/');
    return slash > 0 ? own(card.registry.gatewayPrefixes, text.slice(0, slash)) : undefined;
  }

  function check(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral, providerId: string | undefined, what: string) {
    if (!providerId || allowlist.includes(providerId)) return;
    const start = node.getStart(sf);
    const end = node.getEnd();
    const { line, character } = sf.getLineAndCharacterOfPosition(start);
    out.push({
      id: sha256(
        canonicalize({ ruleId: card.id, ruleVersion: card.version, path: filePath, start, end, matched: node.text }),
      ),
      ruleId: card.id,
      ruleVersion: card.version,
      severity: card.severity,
      providerId,
      matched: node.text,
      evidence: {
        path: filePath,
        fileSha256: fileSha,
        start,
        end,
        line: line + 1,
        column: character + 1,
        excerpt: (lines[line] ?? '').trim().slice(0, 160),
        reason: `${what} "${node.text}" resolves to provider "${providerId}", which is not in the allowlist`,
      },
    });
  }

  const isLiteral = (n: ts.Node | undefined): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
    n !== undefined && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

  function visit(node: ts.Node): void {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && isLiteral(node.moduleSpecifier)) {
      check(node.moduleSpecifier, packageProvider(node.moduleSpecifier.text), 'import of package');
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const arg = node.arguments[0];
      if (isLiteral(arg)) {
        const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
        if (isRequire || callee.kind === ts.SyntaxKind.ImportKeyword) {
          check(arg, packageProvider(arg.text), 'load of package');
        } else if (card.modelConstructors.includes(calleeName(callee) ?? '')) {
          check(arg, gatewayProvider(arg.text), 'model identifier');
        }
      }
    }
    if (ts.isExternalModuleReference(node) && isLiteral(node.expression)) {
      check(node.expression, packageProvider(node.expression.text), 'import of package');
    }
    if (isLiteral(node)) check(node, hostProvider(node.text), 'URL');
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return out;
}
