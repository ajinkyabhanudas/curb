# Seeded-defect check for the snapshot, hashing, canonical-JSON, scan and obligation code (CURB-44). Applies one defect at a time, runs the suite, restores the file.
# Usage: python3 scripts/seeded-defects-other-paths.py out.json   (run on a disposable checkout; an interrupt could leave a defect in place, so check `git diff`)

import json, subprocess, sys, pathlib

ENGINE = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1])

SNAP = 'src/snapshot/snapshot.ts'
HASH = 'src/schema/hashing.ts'
CANON = 'src/schema/canonical.ts'
SCAN = 'src/scan.ts'
OBL = 'src/obligation/obligation.ts'

# (id, class, file, description, old, new)
# FALSE_PASS: can turn a case that must be fail/unknown/error into pass. INTEGRITY: breaks tamper evidence or hash determinism. OTHER: wrong output otherwise.
D = [
 ('S01','OTHER',SNAP,'.git is no longer always skipped', "new Set(['.git', ...(options.skipDirs ?? [])])", "new Set([...(options.skipDirs ?? [])])"),
 ('S02','FALSE_PASS',SNAP,'symlinks are dropped silently', "if (entry.isSymbolicLink()) {", "if (false) {"),
 ('S03','OTHER',SNAP,'raw size pre-check removed', "if (info.size > 2 * maxBytes) return tooLarge();", ""),
 ('S04','OTHER',SNAP,'normalized size cap removed', "if (Buffer.byteLength(content) > maxBytes) return tooLarge();", ""),
 ('S05','FALSE_PASS',SNAP,'NUL-byte binary detection broken', "raw.subarray(0, 8192).includes(0)", "raw.subarray(0, 8192).includes(255)"),
 ('S06','INTEGRITY',SNAP,'newlines no longer normalised in content', "const content = normalizeNewlines(raw.toString('utf8'));", "const content = raw.toString('utf8');"),
 ('S07','FALSE_PASS',SNAP,'a read failure becomes an ok empty file', "size: Buffer.byteLength(content), content };\n  } catch {\n    return { path: relPath, status: 'unreadable', sha256: null, size: 0, content: null };", "size: Buffer.byteLength(content), content };\n  } catch {\n    return { path: relPath, status: 'ok', sha256: sha256(''), size: 0, content: '' };"),
 ('S08','INTEGRITY',SNAP,'tree hash ignores skipped directories', "    skippedDirs,\n  });", "    skippedDirs: [],\n  });"),
 ('S09','INTEGRITY',SNAP,'tree hash ignores file status', "path: f.path, status: f.status, sha256: f.sha256, size: f.size", "path: f.path, sha256: f.sha256, size: f.size"),
 ('S10','INTEGRITY',SNAP,'files are not sorted', "files.sort((a, b) => compare(a.path, b.path));", ""),
 ('S11','INTEGRITY',SNAP,'retargeting a symlink no longer changes the tree hash', "status: 'symlink', sha256: sha256(target), size: 0", "status: 'symlink', sha256: null, size: 0"),
 ('S12','OTHER',SNAP,'excluded directories are scanned', "if (skip.has(entry.name)) skippedDirs.push(relPath);", "if (false) skippedDirs.push(relPath);"),
 ('S13','OTHER',SNAP,'a file over twice the cap is read anyway', "if (info.size > 2 * maxBytes) return tooLarge();", "if (info.size > 200 * maxBytes) return tooLarge();"),
 ('H01','INTEGRITY',HASH,'a lone CR is no longer normalised', "s.replace(/\\r\\n?/g, '\\n')", "s.replace(/\\r\\n/g, '\\n')"),
 ('H02','INTEGRITY',HASH,'string comparison uses locale order', "return a < b ? -1 : a > b ? 1 : 0;", "return a.localeCompare(b);"),
 ('H03','INTEGRITY',HASH,'finding id ignores the matched text', ", matched: p.matched });", " });"),
 ('H04','INTEGRITY',HASH,'finding id ignores the rule version', "ruleVersion: p.ruleVersion, path", "path"),
 ('C01','INTEGRITY',CANON,'object keys are not sorted before hashing', "for (const key of Object.keys(source).sort()) {", "for (const key of Object.keys(source)) {"),
 ('C02','INTEGRITY',CANON,'non-integer numbers are accepted', "    if (!Number.isInteger(value)) throw new Error(`canonicalize: non-integer number ${value}`);\n", ""),
 ('C03','INTEGRITY',CANON,'unsafe integers are accepted', "    if (!Number.isSafeInteger(value)) throw new Error(`canonicalize: unsafe integer ${value}`);\n", ""),
 ('C04','INTEGRITY',CANON,'class instances are accepted as plain objects', "if (proto !== Object.prototype && proto !== null) {", "if (false) {"),
 ('N01','FALSE_PASS',SCAN,'scan no longer verifies the obligation id', "  verifyObligation(obligation);\n", ""),
 ('N02','FALSE_PASS',SCAN,'a different card version is accepted', "obligation.policyCardId !== card.id || obligation.policyCardVersion !== card.version", "obligation.policyCardId !== card.id"),
 ('N03','FALSE_PASS',SCAN,'a different agreement is accepted', "if (obligation.agreementTextSha256 !== agreement.textSha256) {\n    throw new Error('obligation does not match the supplied agreement');", "if (false) {\n    throw new Error('obligation does not match the supplied agreement');"),
 ('N04','FALSE_PASS',SCAN,'an undecided obligation is scanned', "if (obligation.applicability !== 'applies' && obligation.applicability !== 'not-applicable') {", "if (false) {"),
 ('N05','FALSE_PASS',SCAN,'an evaluator exception reports pass', "outcome = { state: 'error', findings: [], unknownFiles: [], filesEvaluated: 0, notes: ['evaluator-exception'] };", "outcome = { state: 'pass', findings: [], unknownFiles: [], filesEvaluated: 0, notes: ['evaluator-exception'] };"),
 ('N06','INTEGRITY',SCAN,'TypeScript version dropped from the evaluator identity', "`${EVALUATOR_VERSION}+typescript-${ts.version}`", "`${EVALUATOR_VERSION}`"),
 ('N07','OTHER',SCAN,'.git no longer listed in the exclusions', "...['.git', ...card.exclusions.dirs]", "...[...card.exclusions.dirs]"),
 ('N08','FALSE_PASS',SCAN,'not-applicable obligations still run the evaluator but report its result', "if (obligation.applicability === 'not-applicable') {", "if (false) {"),
 ('O01','INTEGRITY',OBL,'a tampered obligation id is accepted', "if (hashOf(input) !== id) throw new Error('obligation id does not match its content (tampered or edited)');", ""),
 ('O02','FALSE_PASS',OBL,'the quote is not checked against the agreement text', "if (agreement.text.slice(start, end) !== input.quote) {", "if (false) {"),
 ('O03','FALSE_PASS',OBL,'an applying obligation may have an empty allowlist', "input.applicability === 'applies' && input.allowlist.length === 0", "false"),
 ('O04','FALSE_PASS',OBL,'unknown allowlist ids are accepted', "const unknown = input.allowlist.filter((p) => !known.includes(p));", "const unknown: string[] = [];"),
 ('O05','OTHER',OBL,'duplicate allowlist ids are accepted', "if (dup !== undefined) throw new Error(`allowlist contains a duplicate provider: ${dup}`);", ""),
 ('O06','FALSE_PASS',OBL,'a blank approver is accepted', "if (input.approver.trim() === '') throw new Error('a named approver is required');", ""),
 ('O07','OTHER',OBL,'an empty range is accepted', "end <= start", "end < start"),
 ('O08','FALSE_PASS',OBL,'confirm accepts another card version', "if (input.policyCardId !== card.id || input.policyCardVersion !== card.version) {", "if (input.policyCardId !== card.id) {"),
 ('O09','OTHER',OBL,'approvedAt need not be ISO 8601', "!ISO_8601.test(input.approvedAt) ||", ""),
 ('O10','INTEGRITY',OBL,'parse does not compare the stored id', "if (result.id !== id) throw new Error('obligation id does not match its content (tampered or edited)');", ""),
 ('O11','OTHER',OBL,'an empty quote is accepted', "if (input.quote.trim() === '') throw new Error('quote must not be empty');", ""),
]

results = []
originals = {}
try:
    for did, cls, f, desc, old, new in D:
        path = ENGINE / f
        if f not in originals:
            originals[f] = path.read_text()
        orig = originals[f]
        n = orig.count(old)
        if n != 1:
            results.append({'id': did, 'class': cls, 'file': f, 'desc': desc, 'status': 'NOT_APPLIED', 'matches': n})
            OUT.write_text(json.dumps(results, indent=1))
            print(did, 'NOT_APPLIED', n, flush=True)
            continue
        path.write_text(orig.replace(old, new))
        try:
            p = subprocess.run(['npx', 'vitest', 'run', '--bail', '1', '--reporter', 'dot'], cwd=ENGINE, capture_output=True, text=True, timeout=900)
            status = 'KILLED' if p.returncode != 0 else 'SURVIVED'
        except subprocess.TimeoutExpired:
            status = 'TIMEOUT'
        finally:
            path.write_text(orig)
        results.append({'id': did, 'class': cls, 'file': f, 'desc': desc, 'status': status})
        OUT.write_text(json.dumps(results, indent=1))
        print(did, status, flush=True)
finally:
    for f, o in originals.items():
        (ENGINE / f).write_text(o)
print('DONE', flush=True)
