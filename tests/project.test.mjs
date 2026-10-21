import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, capture, render, sourceHash, validate } from '../scripts/project.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'royalmap-visualization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '03-In-Progress'));
  await writeFile(path.join(root, 'README.md'), '# 範例專案文件索引\n\n> 文件識別碼：DOC-0001\n\n## 文件清單\n\n[工作](03-In-Progress/工作.md)\n\n## 視覺化呈現（啟用時保留）\n\n- 同步狀態：待更新\n');
  await writeFile(path.join(root, '03-In-Progress/工作.md'), '# 登入開發工作單\n\n> 文件識別碼：`DOC-0007`\n> 文件狀態：開發中\n> 最後更新日期：2026-10-21\n\n## Work Unit\n\nWU-01 登入功能：待驗證\n\n## Acceptance Criteria\n\nAC-01 登入後可進入首頁。\n\n## Verification\n\n未執行。\n\n## Review\n\n未執行。\n\n## Human Gate\n\n無決策。\n');
  const snapshot = await capture(root);
  const source = section => ({ path: '03-In-Progress/工作.md', section });
  snapshot.coverage = { work_units: 'complete', note: '範例只含一份工作單，已核對全部工作。' };
  snapshot.work_units = [{ id: 'DOC-0007/WU-01', document_id: 'DOC-0007', local_id: 'WU-01', title: '登入功能',
    source_status: '待驗證', status: 'verification', source: source('Work Unit'),
    acceptance_criteria: [{ id: 'AC-01', source_status: '未執行', status: 'pending', source: source('Acceptance Criteria'), evidence: [] }],
    review: { source_status: '未執行', status: 'pending', scope: 'DOC-0007/WU-01', source: source('Review'), evidence: [], findings: [] },
    human_gate: { source_status: '無決策', status: 'pending', scope: 'DOC-0007/WU-01', source: source('Human Gate'), decision_by: null, decision_at: null, note: null } }];
  return { root, snapshot, source };
}

test('capture retains unextracted work as null and ignores derived files', async t => {
  const { root } = await fixture(t);
  await mkdir(path.join(root, '06-Visualization'));
  await writeFile(path.join(root, '06-Visualization', 'fake.md'), 'not a source');
  const snapshot = await capture(root);
  assert.equal(snapshot.documents.length, 2);
  assert.equal(snapshot.work_units, null);
  assert.equal(snapshot.documents.find(d => d.document_id === 'DOC-0007').source_status, '開發中');
  await validate(root, snapshot);
});

test('build writes matching standalone HTML and JSON without changing Markdown', async t => {
  const { root, snapshot } = await fixture(t);
  const before = await readFile(path.join(root, 'README.md'));
  const output = await build(root, snapshot);
  const stored = JSON.parse(await readFile(path.join(root, '06-Visualization/data/project-snapshot.json'), 'utf8'));
  const html = await readFile(output, 'utf8');
  const embedded = html.match(/<script id="snapshot" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(embedded), stored);
  assert.deepEqual(await readFile(path.join(root, 'README.md')), before);
  await validate(root, stored);
  await build(root, snapshot); // Existing generated outputs can be replaced.
});

test('source modification, addition, move and deletion all invalidate the snapshot', async t => {
  for (const change of ['modify', 'add', 'move', 'delete']) {
    const { root, snapshot } = await fixture(t);
    const filename = path.join(root, '03-In-Progress/工作.md');
    if (change === 'modify') await writeFile(filename, (await readFile(filename, 'utf8')) + '\n新增需求\n');
    if (change === 'add') await writeFile(path.join(root, '03-In-Progress/新工作.md'), '# 新工作\n');
    if (change === 'move') { await writeFile(path.join(root, '03-In-Progress/新位置.md'), await readFile(filename)); await rm(filename); }
    if (change === 'delete') await rm(filename);
    await assert.rejects(() => validate(root, snapshot));
  }
});

test('index bookkeeping alone does not invalidate; later headings remain hashed', () => {
  const text = '# 索引\r\n## 視覺化呈現（啟用時保留）\r\n待更新\r\n## 決策\r\n正式內容\r\n';
  assert.equal(sourceHash('README.md', text), sourceHash('README.md', text.replace('待更新', '已同步')));
  assert.notEqual(sourceHash('README.md', text), sourceHash('README.md', text.replace('正式內容', '已變更')));
  const fenced = '~~~markdown\n## 視覺化呈現（啟用時保留）\n待更新\n~~~\n';
  assert.notEqual(sourceHash('README.md', fenced), sourceHash('README.md', fenced.replace('待更新', '已變更')));
});

test('completed claims need AC, Review and Human Gate evidence', async t => {
  const { root, snapshot, source } = await fixture(t);
  const unit = snapshot.work_units[0];
  unit.status = 'completed'; unit.source_status = '完成';
  await assert.rejects(() => validate(root, snapshot), /verified AC/);
  const evidence = [{ summary: '範例驗證結果及指令', source: source('Verification') }];
  Object.assign(unit.acceptance_criteria[0], { source_status: '通過', status: 'passed', evidence });
  await assert.rejects(() => validate(root, snapshot), /requires Review/);
  Object.assign(unit.review, { source_status: '通過', status: 'passed', evidence });
  await assert.rejects(() => validate(root, snapshot), /Human Gate/);
  Object.assign(unit.human_gate, { source_status: 'Accept', status: 'accepted', decision_by: '範例審查人', decision_at: '2026-10-21', note: '範例決策' });
  await validate(root, snapshot);
  unit.human_gate.decision_at = '2026-02-31';
  await assert.rejects(() => validate(root, snapshot), /Decision requires/);
});

test('unknown states retain the claim and require an issue', async t => {
  const { root, snapshot, source } = await fixture(t);
  snapshot.work_units[0].source_status = '待處理／完成';
  snapshot.work_units[0].status = 'unknown';
  await assert.rejects(() => validate(root, snapshot), /Missing issue/);
  snapshot.issues.push({ message: '來源未選定單一工作狀態', source: source('Work Unit') });
  await validate(root, snapshot);
});

test('duplicate document IDs and duplicate Work Units are rejected', async t => {
  const { root, snapshot } = await fixture(t);
  snapshot.work_units.push(structuredClone(snapshot.work_units[0]));
  await assert.rejects(() => validate(root, snapshot), /Work Unit key/);
  await writeFile(path.join(root, '03-In-Progress/重複.md'), '# 重複\n> 文件識別碼：DOC-0007\n');
  await assert.rejects(async () => validate(root, await capture(root)), /Duplicate document ID/);
});

test('major unresolved findings prevent completion', async t => {
  const { root, snapshot, source } = await fixture(t);
  const u = snapshot.work_units[0], evidence = [{ summary: '驗證依據', source: source('Verification') }];
  Object.assign(u, { source_status: '完成', status: 'completed' });
  Object.assign(u.acceptance_criteria[0], { source_status: '通過', status: 'passed', evidence });
  Object.assign(u.review, { source_status: '通過', status: 'passed', evidence, findings: [{ id: 'R-001', severity: 'Major', summary: '權限尚有問題', source_status: '待處理', status: 'open', source: source('Review'), evidence: [] }] });
  Object.assign(u.human_gate, { source_status: 'Accept', status: 'accepted', decision_by: '人員', decision_at: '2026-10-21', note: '已檢查' });
  await assert.rejects(() => validate(root, snapshot), /Unresolved major/);
});

test('invalid source paths, derived evidence and nonexistent sections are rejected', async t => {
  const { root, snapshot } = await fixture(t);
  await assert.rejects(() => capture(root, ['../outside.md']), /Unsafe path/);
  await assert.rejects(() => capture(root, ['https://example.com']), /Absolute paths/);
  await assert.rejects(() => capture(root, ['06-Visualization/index.html']), /Derived outputs/);
  snapshot.work_units[0].source.section = '不存在的區段';
  await assert.rejects(() => validate(root, snapshot), /section not found/);
});

test('output directory links cannot redirect writes', async t => {
  const { root, snapshot } = await fixture(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), 'royalmap-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, path.join(root, '06-Visualization'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => build(root, snapshot), /Unsafe output directory/);
});

test('source text cannot break out of the embedded JSON script', async t => {
  const { root, snapshot } = await fixture(t);
  snapshot.project = '</script><script>alert(1)</script>';
  await validate(root, snapshot);
  const html = await render(snapshot);
  assert(!html.includes('<script>alert(1)</script>'));
  const embedded = html.match(/<script id="snapshot" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(embedded).project, snapshot.project);
});

test('extra evidence bytes participate in staleness checks', async t => {
  const { root } = await fixture(t);
  await writeFile(path.join(root, 'evidence.bin'), Buffer.from([0, 255, 128]));
  const snapshot = await capture(root, ['evidence.bin']);
  await validate(root, snapshot);
  await writeFile(path.join(root, 'evidence.bin'), Buffer.from([0, 254, 128]));
  await assert.rejects(() => validate(root, snapshot));
});

test('shared document Findings must agree across Work Units', async t => {
  const { root, snapshot, source } = await fixture(t);
  snapshot.work_units[0].review.scope = 'document:DOC-0007';
  snapshot.work_units[0].review.findings = [{ id: 'R-001', severity: 'Minor', summary: '共用審查問題', source_status: '待處理', status: 'open', source: source('Review'), evidence: [] }];
  const second = structuredClone(snapshot.work_units[0]);
  Object.assign(second, { id: 'DOC-0007/WU-02', local_id: 'WU-02', acceptance_criteria: [] });
  second.human_gate.scope = second.id;
  snapshot.work_units.push(second);
  await validate(root, snapshot);
  second.review.findings[0].summary = '不同問題';
  await assert.rejects(() => validate(root, snapshot), /Conflicting shared Finding/);
});

test('shared document Reviews and Human Gates must agree in full', async t => {
  const { root, snapshot, source } = await fixture(t);
  const first = snapshot.work_units[0];
  first.review.scope = first.human_gate.scope = 'document:DOC-0007';
  const evidence = [{ summary: 'Verified', source: source('Verification') }];
  Object.assign(first, { source_status: '完成', status: 'completed' });
  Object.assign(first.acceptance_criteria[0], { source_status: '通過', status: 'passed', evidence });
  Object.assign(first.review, { source_status: '通過', status: 'passed', evidence });
  Object.assign(first.human_gate, { source_status: 'Accept', status: 'accepted', decision_by: 'Reviewer', decision_at: '2026-10-21', note: 'Accept' });
  const second = structuredClone(first);
  Object.assign(second, { id: 'DOC-0007/WU-02', local_id: 'WU-02', acceptance_criteria: [], source_status: '待人工驗收', status: 'human-gate' });
  snapshot.work_units.push(second);
  await validate(root, snapshot);
  second.review.findings.push({ id: 'R-001', severity: 'Major', summary: 'Blocking issue', source_status: '待處理', status: 'open', source: source('Review'), evidence: [] });
  await assert.rejects(() => validate(root, snapshot), /Conflicting shared review/);
  second.review = structuredClone(first.review);
  Object.assign(second.review, { source_status: '需修正', status: 'changes-requested' });
  await assert.rejects(() => validate(root, snapshot), /Conflicting shared review/);
  second.review = structuredClone(first.review);
  Object.assign(second.human_gate, { ...first.human_gate, source_status: 'Reject', status: 'rejected', note: 'Reject' });
  await assert.rejects(() => validate(root, snapshot), /Conflicting shared human_gate/);
  second.human_gate = structuredClone(first.human_gate);
  await validate(root, snapshot);
});

test('source sections exclude fenced examples and accept headings after closing fences', async t => {
  const { root } = await fixture(t);
  const filename = path.join(root, '03-In-Progress/工作.md');
  await writeFile(filename, (await readFile(filename, 'utf8')) + '\n````md\n## Backtick example\n```\n## Still fenced\n````\n~~~md\n## Tilde example\n~~~\n## Actual section\n');
  const snapshot = await capture(root);
  for (const section of ['Backtick example', 'Still fenced', 'Tilde example']) {
    snapshot.issues = [{ message: 'Example reference', source: { path: '03-In-Progress/工作.md', section } }];
    await assert.rejects(() => validate(root, snapshot), /section not found/);
  }
  snapshot.issues[0].source.section = 'Actual section';
  await validate(root, snapshot);
});

test('CLI check rejects missing, stale or altered HTML', async t => {
  const { root, snapshot } = await fixture(t);
  const output = await build(root, snapshot);
  const original = await readFile(output, 'utf8');
  const check = () => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/project.mjs', import.meta.url)), 'check', root], { encoding: 'utf8' });
  assert.equal(check().status, 0);
  for (const html of [original.replace(snapshot.project, 'Stale project'), original.replace('<title>', '<title>Altered '), '<!doctype html><title>Unrelated</title>']) {
    await writeFile(output, html);
    const result = check();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Dashboard HTML differs/);
  }
  await rm(output);
  assert.equal(check().status, 1);
  await build(root, snapshot);
  assert.equal(check().status, 0);
});
