# Seeded-defect check for engine/src/evaluator/evaluate.ts. Applies each defect to the file one at a time, runs the suite, and restores the file.
# Usage: python3 scripts/seeded-defects.py out.json   (run on a clean, disposable checkout; an interrupt could leave a defect in place, so check `git diff` after)

import json, subprocess, sys, shutil, pathlib

ENGINE = pathlib.Path(__file__).resolve().parent.parent
TARGET = ENGINE / 'src/evaluator/evaluate.ts'
ORIG = TARGET.read_text()
OUT = pathlib.Path(sys.argv[1])

# (id, class, description, old, new). class: FALSE_PASS = can turn a case that must be fail/unknown into pass; OTHER = wrong output otherwise.
D = [
 ('D01','FALSE_PASS','unknown files no longer make the state unknown', "else if (unknownFiles.length > 0) state = 'unknown';", "else if (false) state = 'unknown';"),
 ('D02','FALSE_PASS','a repo with no evaluable files can pass', "else if (filesEvaluated === 0) {", "else if (false) {"),
 ('D03','FALSE_PASS','a file whose scan throws is dropped, not unknown', "} catch {\n      unknownFiles.push({ path: file.path, reason: 'parse-error' });\n    }", "} catch {\n    }"),
 ('D04','FALSE_PASS','symlinks are not unknown', "if (file.status === 'symlink') return 'symlink';", ""),
 ('D05','FALSE_PASS','too-large files are not unknown', "if (file.status === 'too-large') return 'too-large';", ""),
 ('D06','FALSE_PASS','binary file under a source extension is ignored', "if (file.status === 'binary') return ext === '' ? 'ignore' : 'unreadable';", "if (file.status === 'binary') return 'ignore';"),
 ('D07','FALSE_PASS','unreadable status is not unknown', "if (file.status !== 'ok') return 'unreadable';", ""),
 ('D08','FALSE_PASS','unsupported languages are not unknown', "return SOURCE_EXT.has(ext) ? undefined : 'unsupported-language';", "return undefined;"),
 ('D09','FALSE_PASS','minified files are not unknown', "if (looksMinified(file.path, file.content)) return 'minified';", ""),
 ('D10','FALSE_PASS','minified threshold raised to 99%', "const MINIFIED_LONG_LINE_SHARE = 0.5;", "const MINIFIED_LONG_LINE_SHARE = 0.99;"),
 ('D11','FALSE_PASS','catalog files are not marked unknown', "if (looksLikeCatalog(file.path, file.content as string)) unknownFiles.push({ path: file.path, reason: 'catalog' });", ""),
 ('D12','FALSE_PASS','catalog needs 60 ids instead of 6', "const CATALOG_MIN_IDS = 6;", "const CATALOG_MIN_IDS = 60;"),
 ('D13','FALSE_PASS','every file in a subdirectory is excluded', "segments.slice(0, -1).some((s) => card.exclusions.dirs.includes(s))", "segments.length > 1"),
 ('D14','OTHER','unknown files are not sorted (ordering/determinism)', "unknownFiles.sort((a, b) => compare(a.path, b.path));", ""),
 ('D15','OTHER','generated-file header is never recognised', ".slice(0, 5)", ".slice(0, 0)"),
 ('D16','OTHER','generated files are scanned', "if (looksGenerated(file.content)) return 'generated';", ""),
 ('D17','FALSE_PASS','no finding is ever reported', "if (!providerId || allowlist.includes(providerId)) return;", "if (!providerId || true) return;"),
 ('D18','OTHER','allowlist is ignored (everything flagged)', "if (!providerId || allowlist.includes(providerId)) return;", "if (!providerId) return;"),
 ('D19','FALSE_PASS','exact package name no longer matches', "if (spec === name || spec.startsWith(`${name}/`)) return card.registry.packages[name];", "if (spec.startsWith(`${name}/`)) return card.registry.packages[name];"),
 ('D20','FALSE_PASS','trailing-dot host evades host rule', ".toLowerCase().replace(/\\.$/, '')", ".toLowerCase()"),
 ('D21','OTHER','model literal digit/hyphen precision gate removed', "if (!m || !/[0-9-]/.test(m[2])) return undefined;", "if (!m) return undefined;"),
 ('D22','FALSE_PASS','model prefix case-sensitive (OpenAI/gpt-4 evades)', "return own(card.registry.gatewayPrefixes, m[1].toLowerCase());", "return own(card.registry.gatewayPrefixes, m[1]);"),
 ('D23','OTHER','property keys are scanned as model literals', "if (isLiteral(node) && !claimed.has(node) && !isPropertyName(node)) {", "if (isLiteral(node) && !claimed.has(node)) {"),
 ('D24','FALSE_PASS','providerId-suffixed names no longer count', "const PROVIDER_KEY = /provider(id)?$/;", "const PROVIDER_KEY = /provider$/;"),
 ('D25','FALSE_PASS','provider property value is case-sensitive', "const id = node.text.toLowerCase();", "const id = node.text;"),
 ('D26','FALSE_PASS','||= assignment no longer examined', "  ts.SyntaxKind.BarBarEqualsToken,\n", ""),
 ('D27','FALSE_PASS','ternary branches no longer looked through', "(ts.isConditionalExpression(parent) && parent.condition !== child)", "false"),
 ('D28','FALSE_PASS','template URLs not examined', "else if (ts.isTemplateExpression(node) && TEMPLATE_HOST_HEAD.test(node.head.text)) {", "else if (false) {"),
 ('D29','FALSE_PASS','template-literal model ids to constructors not examined', "isLiteral(arg) ? arg.text : arg && ts.isTemplateExpression(arg) ? arg.head.text : undefined", "isLiteral(arg) ? arg.text : undefined"),
 ('D30','FALSE_PASS','import type nodes not examined', "if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && isLiteral(node.argument.literal)) {", "if (false) {"),
 ('D31','OTHER','left side of && counts as a provider value', "!(parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && parent.left === child)", "true"),
 ('D32','FALSE_PASS','gateway prefix at index 0 accepted / prefix check off by one', "return slash > 0 ? own(", "return slash >= 0 ? own("),
 ('D33','OTHER','declared-constructor args no longer claimed (duplicate findings)', "if (arg) claimed.add(arg);", ""),
 ('D34','FALSE_PASS','require() calls no longer examined', "const isRequire = name === 'require' || name === 'require.resolve';", "const isRequire = false;"),
 ('D35','FALSE_PASS','export-from specifiers not examined', "if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && isLiteral(node.moduleSpecifier)) {", "if (ts.isImportDeclaration(node) && isLiteral(node.moduleSpecifier)) {"),
]

results = []
try:
    for did, cls, desc, old, new in D:
        n = ORIG.count(old)
        if n != 1:
            results.append({'id': did, 'class': cls, 'desc': desc, 'status': 'NOT_APPLIED', 'matches': n})
            OUT.write_text(json.dumps(results, indent=1))
            continue
        TARGET.write_text(ORIG.replace(old, new))
        p = subprocess.run(['npx', 'vitest', 'run', '--bail', '1', '--reporter', 'dot'], cwd=ENGINE, capture_output=True, text=True, timeout=600)
        out = p.stdout + p.stderr
        status = 'KILLED' if p.returncode != 0 else 'SURVIVED'
        first = ''
        for l in out.splitlines():
            if ' FAIL ' in l or 'Error:' in l:
                first = l.strip()[:200]
                break
        results.append({'id': did, 'class': cls, 'desc': desc, 'status': status, 'first_failure': first})
        OUT.write_text(json.dumps(results, indent=1))
        print(did, status, flush=True)
finally:
    TARGET.write_text(ORIG)
print('DONE', flush=True)
