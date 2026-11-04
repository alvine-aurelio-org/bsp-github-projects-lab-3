import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  contracts, markdownFiles, repositoryRoot, stepSections, validateGuide,
  validateLocalLinks, validateMetadata, validatePng, validateSafety, verifyContent,
} from '../tools/verify-content.mjs';

const metadata = JSON.parse(readFileSync(resolve(repositoryRoot, 'workshop.json'), 'utf8'));
const guide = readFileSync(resolve(repositoryRoot, 'README.md'), 'utf8').replaceAll('\r\n', '\n');
const contract = contracts[metadata.lab];

test('complete standalone publication satisfies the offline companion contract', () => {
  assert.deepEqual(verifyContent(), []);
});

test('minimal companion metadata points to the sole starter and totals 35 minutes', () => {
  assert.deepEqual(validateMetadata(metadata), []);
  assert.equal(metadata.lab, 3);
  assert.ok(validateMetadata({ ...metadata, role: 'starter' }).length > 0);
  assert.ok(validateMetadata({ ...metadata, minutes: 40 }).length > 0);
  assert.ok(validateMetadata({ ...metadata, lessons: [] }).length > 0);
});

test('welcome, exactly four steps, images, commands and evidence match the starter', () => {
  assert.deepEqual(validateGuide(guide, metadata), []);
  assert.equal(stepSections(guide).length, 4);
  assert.equal(contract.times.reduce((sum, time) => sum + time, 0), 35);
});

test('each of the four supplied screenshot files is an actual decodable PNG', () => {
  for (const step of [1, 2, 3, 4]) {
    const file = `assets/screenshots/lab-${metadata.lab}-step-${step}.png`;
    const bytes = readFileSync(resolve(repositoryRoot, file));
    assert.deepEqual(validatePng(bytes), [], file);
    assert.ok(validatePng(bytes.subarray(0, 20)).length > 0, 'Truncated real image must fail.');
  }
});

test('all local Markdown links and images resolve inside this repository', () => {
  for (const file of markdownFiles(repositoryRoot)) {
    assert.deepEqual(validateLocalLinks(repositoryRoot, readFileSync(resolve(repositoryRoot, file), 'utf8'), file), [], file);
  }
});

test('local link validation rejects traversal and author-machine file URLs', () => {
  assert.ok(validateLocalLinks(repositoryRoot, '[outside](../README.md)').some((error) => error.includes('escapes')));
  assert.ok(validateLocalLinks(repositoryRoot, '[machine](file:///C:/private)').some((error) => error.includes('unsupported')));
});

test('schedule drift, extra steps, missing images and wrong commands fail closed', () => {
  const time = `**Time: ${contract.times[0]} minutes`;
  assert.ok(validateGuide(guide.replace(time, '**Time: 99 minutes'), metadata).some((error) => error.includes('35 minutes')));
  assert.ok(validateGuide(`${guide}\n## Step 5 \u2014 Extra work\n`, metadata).some((error) => error.includes('four ordered')));
  const image = `assets/screenshots/lab-${metadata.lab}-step-1.png`;
  assert.ok(validateGuide(guide.replace(`](${image})`, '](README.md)'), metadata).some((error) => error.includes('screenshot')));
  assert.ok(validateGuide(guide.replace(`\n${contract.commands[0]}\n`, '\n/done 9-9\n'), metadata).some((error) => error.includes('completion command')));
});

test('token requests and extra learner repository or Project initialization are rejected', () => {
  for (const instruction of ['Create a personal access token.', 'Run git clone https://github.com/alvine-aurelio-org/bsp-github-projects-lab-3', 'Create another private Project.']) {
    assert.ok(validateSafety(instruction).length > 0);
  }
  const inertToken = ['ghp', '_', 'A'.repeat(30)].join('');
  assert.ok(validateSafety(inertToken).some((error) => error.includes('Credential-shaped')));
});

test('Lab 3 has four self-confirmations and keeps native updates and exports local', () => {
  for (const [index, step] of stepSections(guide).entries()) {
    assert.match(step.text, /\*\*SELF-CONFIRMED:\*\*/);
    assert.ok(step.text.includes(`/done 3-${index + 1}`));
    assert.doesNotMatch(step.text, /^\/check /m);
  }
  const issueCommentSubstitute = guide.replace('**Status updates**', '**Issue comments**');
  assert.ok(validateGuide(issueCommentSubstitute, metadata).some((error) => error.includes('Status updates')));
  assert.match(guide, /Do not commit, upload or attach the export/);
  assert.match(guide, /Verification remains open for Sprint 2/);
});
