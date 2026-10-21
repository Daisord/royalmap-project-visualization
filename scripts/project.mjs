import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const categories = {
  '01-System': 'system', '02-Planning': 'planning', '03-In-Progress': 'in-progress',
  '04-Completed': 'completed', '05-Development-Log': 'development-log',
};
const statuses = {
  work: { 待處理: 'pending', 進行中: 'in-progress', 待驗證: 'verification', '待 Review': 'review', 待人工驗收: 'human-gate', 完成: 'completed' },
  ac: { 未執行: 'pending', 通過: 'passed', 未通過: 'failed', 需人工驗證: 'manual', 例外已接受: 'accepted-exception' },
  review: { 未執行: 'pending', 通過: 'passed', 需修正: 'changes-requested', 需人工判斷: 'human-decision', 有條件通過: 'conditional' },
  finding: { 待處理: 'open', 已修正: 'resolved', 接受風險: 'accepted-risk', 'Human Gate': 'human-decision' },
  gate: { 無決策: 'pending', Accept: 'accepted', Accepted: 'accepted', Reject: 'rejected', Revise: 'changes-requested' },
};
const clean = value => value?.replaceAll('`', '').trim() || null;
const text = value => typeof value === 'string' && value.trim().length > 0;
const calendarDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const metadata = (body, label) => clean(body.match(new RegExp(`^> ${label}：[ \\t]*(.*)$`, 'm'))?.[1]);
const readJson = async filename => JSON.parse((await readFile(filename, 'utf8')).replace(/^\uFEFF/, ''));

function* markdownLines(content) {
  let fence = null;
  for (const raw of content.toString('utf8').match(/[^\n]*\n|[^\n]+$/g) || []) {
    const line = raw.replace(/\r?\n$/, '');
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
    }
    yield { raw, heading: !marker && !fence ? line.match(/^(#{1,6}) (.+)$/) : null };
  }
}

export function sourceHash(relativePath, content) {
  let body = content;
  if (relativePath === 'README.md') {
    // Exclude real bookkeeping headings, never examples inside fenced code.
    let excluded = false;
    const kept = [];
    for (const { raw, heading } of markdownLines(content)) {
      if (heading?.[1] === '##') excluded = heading[2] === '視覺化呈現（啟用時保留）';
      if (!excluded) kept.push(raw);
    }
    body = kept.join('');
  }
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

async function within(root, relativePath) {
  assert(text(relativePath) && !relativePath.includes('\\'), 'Source paths must use /');
  assert(!path.posix.isAbsolute(relativePath) && !/^[a-z]+:/i.test(relativePath), 'Absolute paths and URLs are not allowed');
  assert(relativePath.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe path');
  const target = path.resolve(root, relativePath);
  let ancestor = root;
  for (const part of relativePath.split('/')) {
    ancestor = path.join(ancestor, part);
    assert(!(await lstat(ancestor)).isSymbolicLink(), 'Symbolic links are not supported');
  }
  const resolved = await realpath(target);
  const relative = path.relative(root, resolved);
  assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Path escapes document root');
  assert(!(await lstat(target)).isSymbolicLink(), 'Symbolic links are not supported');
  return resolved;
}

async function scan(root) {
  const files = ['README.md'];
  async function walk(directory) {
    const entries = await readdir(await within(root, directory), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      assert(!entry.isSymbolicLink(), `Symbolic link in sources: ${directory}/${entry.name}`);
      if (entry.isDirectory()) await walk(`${directory}/${entry.name}`);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(`${directory}/${entry.name}`);
    }
  }
  for (const directory of Object.keys(categories)) {
    try { await walk(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return files.sort();
}

export async function capture(directory, extras = []) {
  const root = await realpath(directory);
  const files = await scan(root);
  const sources = [], documents = [], issues = [];
  for (const relativePath of [...new Set([...files, ...extras])].sort()) {
    assert(!relativePath.startsWith('06-Visualization/'), 'Derived outputs cannot be sources');
    const bytes = await readFile(await within(root, relativePath));
    const body = bytes.toString('utf8');
    const rawId = metadata(body, '文件識別碼');
    const documentId = rawId && /^[A-Za-z][A-Za-z0-9-]*$/.test(rawId) ? rawId : null;
    sources.push({ document_id: documentId, path: relativePath, sha256: sourceHash(relativePath, bytes) });
    if (!files.includes(relativePath)) continue;
    const title = clean([...markdownLines(body)].find(item => item.heading?.[1] === '#')?.heading[2]) || path.posix.basename(relativePath);
    const source = { path: relativePath, section: body.includes(`# ${title}`) ? title : 'file' };
    documents.push({ document_id: documentId, title,
      document_type: relativePath === 'README.md' ? 'index' : categories[relativePath.split('/')[0]],
      source_status: metadata(body, '文件狀態'),
      updated_at: metadata(body, '最後更新日期') || metadata(body, '完成日期'), source });
    if (!documentId) issues.push({ message: '缺少穩定文件識別碼，不能可靠關聯工作。', source });
  }
  return { contract_version: 1, project: path.basename(root), generated_at: new Date().toISOString(),
    sources, documents, coverage: { work_units: 'not-extracted', note: '尚未依來源整理 Work Unit、AC、Review 與 Human Gate。' },
    work_units: null, issues };
}

export async function validate(directory, snapshot) {
  const root = await realpath(directory);
  assert(snapshot.contract_version === 1, 'Unsupported contract_version');
  assert(text(snapshot.project), 'Missing project');
  assert(text(snapshot.generated_at) && /(?:Z|[+-]\d\d:\d\d)$/.test(snapshot.generated_at) && Number.isFinite(Date.parse(snapshot.generated_at)), 'Invalid generated_at');
  assert(Array.isArray(snapshot.sources) && Array.isArray(snapshot.documents) && Array.isArray(snapshot.issues), 'Missing source, document or issue arrays');
  const paths = snapshot.sources.map(item => item.path);
  assert(new Set(paths).size === paths.length, 'Duplicate source path');
  const current = await capture(root, paths);
  assert.deepEqual(snapshot.sources, current.sources, 'Source set or content changed; recapture and review');
  assert.deepEqual(snapshot.documents, current.documents, 'Document metadata differs from sources');
  const docs = new Map();
  for (const doc of snapshot.documents) {
    if (doc.document_id === null) continue;
    assert(!docs.has(doc.document_id), `Duplicate document ID: ${doc.document_id}`);
    docs.set(doc.document_id, doc);
  }
  const headings = new Map();
  for (const item of snapshot.sources) {
    const body = await readFile(await within(root, item.path), 'utf8');
    headings.set(item.path, new Set([...markdownLines(body)].filter(item => item.heading).map(item => item.heading[2].trim())));
  }
  function source(value) {
    assert(value && headings.has(value.path) && text(value.section), 'Invalid source reference');
    assert(value.section === 'file' || headings.get(value.path).has(value.section), `Source section not found: ${value.path} / ${value.section}`);
  }
  for (const issue of snapshot.issues) { assert(text(issue.message), 'Empty issue'); source(issue.source); }
  function issueFor(location) {
    assert(snapshot.issues.some(issue => issue.source.path === location.path), `Missing issue for unknown data: ${location.path}`);
  }
  for (const item of current.issues) issueFor(item.source);
  function evidence(items) {
    assert(Array.isArray(items), 'Evidence must be an array');
    for (const item of items) { assert(text(item.summary), 'Missing evidence summary'); source(item.source); }
  }
  function state(item, kind) {
    assert(item && text(item.status), `Missing ${kind} state`);
    source(item.source);
    if (item.status === 'unknown') { issueFor(item.source); return; }
    assert(statuses[kind][item.source_status] === item.status, `Status does not match source value: ${kind}`);
  }
  const coverage = snapshot.coverage;
  assert(coverage && ['not-extracted', 'partial', 'complete'].includes(coverage.work_units) && text(coverage.note), 'Invalid coverage');
  if (coverage.work_units === 'not-extracted') assert(snapshot.work_units === null, 'Unextracted work_units must be null');
  else assert(Array.isArray(snapshot.work_units), 'Extracted work_units must be an array');
  const ids = new Set(), acIds = new Set(), findingsById = new Map(), sharedScopes = new Map();
  for (const unit of snapshot.work_units || []) {
    assert(docs.has(unit.document_id) && text(unit.local_id) && text(unit.title), 'Invalid Work Unit identity');
    assert(unit.id === `${unit.document_id}/${unit.local_id}` && !ids.has(unit.id), 'Duplicate or invalid Work Unit key');
    ids.add(unit.id);
    assert(unit.source.path === docs.get(unit.document_id).source.path, 'Work Unit source must be its owning document');
    state(unit, 'work');
    assert(unit.acceptance_criteria === null || Array.isArray(unit.acceptance_criteria), 'Invalid AC collection');
    if (unit.acceptance_criteria === null || unit.review === null || unit.human_gate === null) issueFor(unit.source);
    for (const ac of unit.acceptance_criteria || []) {
      const key = `${unit.document_id}/${ac.id}`;
      assert(text(ac.id) && !acIds.has(key), 'Duplicate or missing AC ID'); acIds.add(key);
      state(ac, 'ac'); evidence(ac.evidence);
      if (['passed', 'accepted-exception'].includes(ac.status)) assert(ac.evidence.length, 'AC requires evidence');
    }
    if (unit.review !== null) {
      const review = unit.review;
      state(review, 'review'); evidence(review.evidence);
      assert([unit.id, `document:${unit.document_id}`].includes(review.scope), 'Invalid Review scope');
      if (['passed', 'conditional'].includes(review.status)) assert(review.evidence.length, 'Review requires evidence');
      assert(review.findings === null || Array.isArray(review.findings), 'Invalid findings');
      if (review.findings === null) issueFor(review.source);
      const localFindingIds = new Set();
      for (const finding of review.findings || []) {
        const key = `${unit.document_id}/${finding.id}`;
        assert(text(finding.id) && !localFindingIds.has(key), 'Duplicate or missing Finding ID'); localFindingIds.add(key);
        if (findingsById.has(key)) assert.deepEqual(finding, findingsById.get(key), 'Conflicting shared Finding');
        findingsById.set(key, finding);
        assert(['Critical', 'Major', 'Minor', 'Decision'].includes(finding.severity) && text(finding.summary), 'Invalid Finding');
        state(finding, 'finding'); evidence(finding.evidence);
        if (finding.status === 'accepted-risk') assert(finding.evidence.length, 'Accepted risk requires evidence');
      }
    }
    if (unit.human_gate !== null) {
      const gate = unit.human_gate;
      state(gate, 'gate');
      assert([unit.id, `document:${unit.document_id}`].includes(gate.scope), 'Invalid Human Gate scope');
      if (['accepted', 'rejected', 'changes-requested'].includes(gate.status)) {
        assert(text(gate.decision_by) && text(gate.note) && text(gate.decision_at) &&
          /^\d{4}-\d{2}-\d{2}(?:T.*(?:Z|[+-]\d\d:\d\d))?$/.test(gate.decision_at) &&
          calendarDate(gate.decision_at.slice(0, 10)) && Number.isFinite(Date.parse(gate.decision_at)), 'Decision requires person, date and note');
      }
    }
    for (const kind of ['review', 'human_gate']) {
      const item = unit[kind];
      if (!item?.scope.startsWith('document:')) continue;
      const key = `${kind}/${item.scope}`;
      if (sharedScopes.has(key)) assert.deepEqual(item, sharedScopes.get(key), `Conflicting shared ${kind}`);
      sharedScopes.set(key, item);
    }
    if (unit.status === 'completed') {
      assert(unit.acceptance_criteria?.length && unit.acceptance_criteria.every(ac => ['passed', 'accepted-exception'].includes(ac.status)), 'Completed work requires verified AC');
      assert(['passed', 'conditional'].includes(unit.review?.status) && Array.isArray(unit.review.findings), 'Completed work requires Review');
      assert(unit.review.findings.every(f => !['Critical', 'Major'].includes(f.severity) || ['resolved', 'accepted-risk'].includes(f.status)), 'Unresolved major Finding');
      assert(unit.human_gate?.status === 'accepted', 'Completed work requires Human Gate acceptance');
    }
  }
  return snapshot;
}

export async function render(snapshot) {
  const template = await readFile(new URL('../assets/dashboard.html', import.meta.url), 'utf8');
  const json = JSON.stringify(snapshot).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  return template.replace('/*SNAPSHOT_JSON*/null', () => json);
}

async function outputDirectory(root, relativePath) {
  let current = root;
  for (const part of relativePath.split('/')) {
    current = path.join(current, part);
    await mkdir(current).catch(error => { if (error.code !== 'EEXIST') throw error; });
    assert((await lstat(current)).isDirectory() && !(await lstat(current)).isSymbolicLink(), 'Unsafe output directory');
    await within(root, path.relative(root, current).split(path.sep).join('/'));
  }
  return current;
}

async function atomicWrite(filename, content) {
  try { assert((await lstat(filename)).isFile() && !(await lstat(filename)).isSymbolicLink(), 'Unsafe output target'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, filename);
}

export async function build(directory, draft) {
  const root = await realpath(directory);
  const snapshot = { ...draft, generated_at: new Date().toISOString() };
  await validate(root, snapshot);
  const html = await render(snapshot);
  // Recheck after rendering so source edits during generation do not silently pass.
  await validate(root, snapshot);
  const destination = await outputDirectory(root, '06-Visualization/data');
  await atomicWrite(path.join(destination, 'project-snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n');
  await atomicWrite(path.join(destination, '..', 'index.html'), html);
  return path.join(root, '06-Visualization', 'index.html');
}

async function main() {
  const [command, directory, ...rest] = process.argv.slice(2);
  assert(directory && ['capture', 'build', 'check'].includes(command), 'Usage: node scripts/project.mjs capture ROOT [EVIDENCE ...] | build ROOT DRAFT.json | check ROOT');
  if (command === 'capture') console.log(JSON.stringify(await capture(directory, rest), null, 2));
  if (command === 'build') {
    assert(rest.length === 1, 'build requires one draft JSON');
    console.log(await build(directory, await readJson(rest[0])));
  }
  if (command === 'check') {
    assert(rest.length === 0, 'check accepts only ROOT');
    const root = await realpath(directory);
    const snapshot = await readJson(await within(root, '06-Visualization/data/project-snapshot.json'));
    await validate(root, snapshot);
    const html = await readFile(await within(root, '06-Visualization/index.html'), 'utf8');
    assert(html === await render(snapshot), 'Dashboard HTML differs from snapshot or template; rebuild');
    console.log('Source, snapshot and HTML validation passed. Semantic review is still required.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
