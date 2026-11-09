import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import {
  contracts,
  firstCompletion,
  markdownFiles,
  repositoryRoot,
  sourceRepositories,
  stepSections,
  validateChecklist,
  validateGuide,
  validateLocalLinks,
  validateMetadata,
  validateMonaWorkflow,
  validatePackage,
  validatePng,
  validateSafety,
  validateSecurity,
  validateVerificationWorkflow,
  verifyContent,
} from '../tools/verify-content.mjs';

const read = (file) =>
  readFileSync(resolve(repositoryRoot, file), 'utf8').replaceAll('\r\n', '\n');
const metadata = JSON.parse(read('workshop.json'));
const guide = read('README.md');
const security = read('SECURITY.md');
const contract = contracts[metadata.lab];
const unit = (name, run) => test(`unit: ${name}`, run);
const guideErrors = (text) => validateGuide(text, metadata);
const changeStep = (number, change) => {
  const step = stepSections(guide)[number - 1];
  return guide.replace(step.text, change(step.text));
};
const pinWorkflow = (workflow, reference, runtime = reference) =>
  workflow
    .replace(
      /(module-runner\.yml@)[^\s]+/,
      (_, prefix) => `${prefix}${reference}`,
    )
    .replace(/(runtime-ref: )[^\s]+/, (_, prefix) => `${prefix}${runtime}`);
const pinnedMona = pinWorkflow(
  read('.github/workflows/mona.yml'),
  'a'.repeat(40),
);

unit('manual-run roadmap and workload guidance uses actual dates and native issue state', () => {
  const steps = stepSections(guide);
  const setup = steps[0].text.replace(/[*`]/g, '');
  for (const text of [
    "that organization's Projects tab",
    'separate browser tabs',
    'Create a project field',
    'Starts on',
    'seven days',
    'Item set to Done',
    'manual demo data, not evidence of a PR merge',
    'Dates: Start date and Target date',
    'Clear inherited filters',
  ])
    assert.ok(setup.includes(text), `Missing roadmap guidance: ${text}`);
  const workload = steps[1].text.replace(/[*`]/g, '');
  for (const text of ['native issue state, not Project Status', 'multi-select', 'clear Count'])
    assert.ok(workload.includes(text), `Missing workload guidance: ${text}`);
});

unit('export requires confirmation and a completed download before the final command', () => {
  const update = stepSections(guide)[3].text.replace(/[*`]/g, '');
  for (const text of [
    'all rows are loaded',
    'Save any view changes',
    "confirmation dialog's row count",
    'select Export in that dialog',
    'Opening the dialog alone does not download the TSV',
    'completed TSV download',
    'pending, blocked or cancelled',
    'do not submit /done 3-4',
    'Do not commit, upload or attach the export',
  ])
    assert.ok(update.includes(text), `Missing export stop condition: ${text}`);
});

// Select only "^unit: " while the parent is finalizing the immutable runtime pin.
// This integration test must fail closed in publication CI until that pin is real.
test('integration: complete standalone publication satisfies the offline contract', () => {
  assert.deepEqual(verifyContent(), []);
});

unit(
  'schema-v3 metadata declares four lessons, 45 minutes and a 35-minute continuation',
  () => {
    assert.deepEqual(validateMetadata(metadata), []);
    assert.equal(metadata.lab, 3);
    assert.equal(metadata.schemaVersion, 3);
    assert.equal(metadata.role, 'standalone');
    assert.equal(metadata.lessons.length, 4);
    assert.equal(metadata.minutes, 45);
    assert.equal(metadata.continuationMinutes, 35);
    assert.equal(
      contract.times.reduce((sum, time) => sum + time, 0),
      45,
    );
    assert.equal(
      contract.continuationTimes.reduce((sum, time) => sum + time, 0),
      35,
    );
    assert.deepEqual(metadata.sourceRepositories, sourceRepositories);
  },
);

unit(
  'legacy, malformed, expanded and multi-exercise metadata fail closed',
  () => {
    for (const value of [
      null,
      [],
      {},
      { ...metadata, schemaVersion: 1 },
      { ...metadata, role: 'companion' },
      { ...metadata, minutes: 35 },
      { ...metadata, continuationMinutes: 45 },
      { ...metadata, bootstrapIssueLimit: 3 },
      { ...metadata, defaultBranch: 'dev' },
      { ...metadata, lab: '__proto__' },
      { ...metadata, extra: true },
      { ...metadata, sourceRepositories: sourceRepositories.slice(0, 1) },
      { ...metadata, publicAssetBase: 'https://example.invalid/' },
    ]) {
      assert.ok(validateMetadata(value).length > 0);
    }
    assert.ok(validateGuide(guide, { lab: '__proto__' }).length > 0);
  },
);

unit(
  'the two exact-title work roles cannot be renamed, reordered or auto-expanded',
  () => {
    assert.deepEqual(metadata.workItems, [
      {
        key: 'implementation',
        title: '[Workshop] Publish the service release checklist',
      },
      {
        key: 'verification',
        title: '[Workshop] Verify the release checklist in Sprint 2',
      },
    ]);
    for (const change of [
      (copy) => {
        copy.workItems[0].title += ' extra';
      },
      (copy) => {
        copy.workItems.reverse();
      },
      (copy) => {
        copy.workItems.push({ key: 'extra', title: 'Extra work' });
      },
      (copy) => {
        copy.workItems[1] = null;
      },
    ]) {
      const copy = structuredClone(metadata);
      change(copy);
      assert.ok(
        validateMetadata(copy).some((error) => error.includes('two ordered')),
      );
    }
  },
);

unit(
  'lesson IDs, timings, modes, commands, titles and image contracts are exact',
  () => {
    assert.equal(metadata.lessons[0].command, 'YOUR_PROJECT_URL');
    assert.deepEqual(
      metadata.lessons.map(({ minutes }) => minutes),
      contract.times,
    );
    assert.deepEqual(
      metadata.lessons.map(({ mode }) => mode),
      contract.modes,
    );
    for (const [field, value] of Object.entries({
      id: '9-1',
      step: 0,
      minutes: 99,
      title: 'Other',
      mode: 'self-confirmed',
      command: '/project',
      image: 'missing.png',
    })) {
      const copy = structuredClone(metadata);
      copy.lessons[0][field] = value;
      assert.ok(
        validateMetadata(copy).some((error) => error.includes('Lesson 1')),
        field,
      );
    }
    assert.ok(
      validateMetadata({ ...metadata, lessons: metadata.lessons.slice(1) })
        .length > 0,
    );
  },
);

unit(
  'author scripts use Node built-ins without any package dependencies',
  () => {
    const manifest = JSON.parse(read('package.json'));
    assert.deepEqual(validatePackage(manifest), []);
    for (const key of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      assert.ok(
        validatePackage({ ...manifest, [key]: {} }).some((error) =>
          error.includes('dependencies'),
        ),
      );
    }
    assert.ok(
      validatePackage({
        ...manifest,
        scripts: { ...manifest.scripts, test: 'npm install' },
      }).length > 0,
    );
  },
);

unit(
  'Welcome and Start are inside Step 1 and all four extracted lessons are usable',
  () => {
    assert.deepEqual(guideErrors(guide), []);
    const steps = stepSections(guide);
    assert.deepEqual(
      steps.map(({ number }) => number),
      [1, 2, 3, 4],
    );
    assert.match(steps[0].text, /### Welcome/);
    assert.match(steps[0].text, /### Start here/);
    assert.doesNotMatch(
      guide.slice(0, guide.indexOf('## Step 1')),
      /## Welcome|## Start|Step 0/,
    );
    for (const step of steps)
      for (const label of [
        'Topic:',
        '**Why:**',
        '**How:**',
        '**Expected result:**',
      ])
        assert.ok(step.text.includes(label));
  },
);

unit(
  'optional template initialization coexists with the existing Lab 1 continuation',
  () => {
    const first = stepSections(guide)[0].text;
    assert.ok(
      first.includes(
        `https://github.com/${sourceRepositories[metadata.lab - 1]}/generate`,
      ),
    );
    assert.match(first, /35-minute continuation/);
    assert.match(first, /same Mona exercise issue and same Project/);
    assert.match(first, /No other copy is needed/);
    assert.deepEqual(
      validateSafety(
        'Use this template to create your Private copy. Create a private Project in the browser.',
      ),
      [],
    );
    assert.ok(
      guideErrors(
        guide.replace(
          'No other copy is needed.',
          'Create three private copies.',
        ),
      ).length > 0,
    );
    assert.ok(
      guideErrors(
        `This is a reference-only guide, not a learner template.\n${guide}`,
      ).length > 0,
    );
  },
);

unit(
  'first completion is only the actual Project address-bar link, with a short mixed footer',
  () => {
    const first = stepSections(guide)[0].text;
    assert.ok(first.includes(firstCompletion));
    assert.doesNotMatch(
      first,
      /\/project\b|YOUR_PROJECT_URL|^\/(?:done|check)\b|```/m,
    );
    assert.match(
      first,
      /\*\*MIXED EVIDENCE:\*\*.*native work issues.*self-confirmed/,
    );
  },
);

unit(
  'first-step commands, URL examples, typed placeholders and code blocks are rejected',
  () => {
    for (const suffix of [
      '/project',
      `/done ${metadata.lab}-1`,
      'YOUR_PROJECT_URL',
      'https://github.com/users/example/projects/1',
      '```text\nhttps://example.invalid\n```',
    ]) {
      const changed = guide.replace(
        firstCompletion,
        `${firstCompletion}\n\n${suffix}\n`,
      );
      assert.ok(
        guideErrors(changed).some((error) =>
          error.includes('only the actual Project'),
        ),
        suffix,
      );
    }
  },
);

unit(
  'technical native-identity detail belongs in the FAQ, not the first footer',
  () => {
    const changed = guide.replace(
      'Mona checks and binds the two native work issues;',
      'Mona checks and binds the two native work issues with an API endpoint and immutable IDs;',
    );
    assert.ok(
      guideErrors(changed).some((error) =>
        error.includes('first evidence footer'),
      ),
    );
  },
);

unit(
  'Step 1 accepts bound account tokens but not unbound Project, issue or PR tokens',
  () => {
    for (const token of ['REPO', 'OWNER', 'LEARNER'])
      assert.deepEqual(
        guideErrors(
          guide.replace(firstCompletion, `${firstCompletion} {{${token}}}`),
        ),
        [],
      );
    for (const token of [
      'PROJECT_URL',
      'ISSUE_implementation',
      'ISSUE_verification',
      'PR_NUMBER',
      'EXERCISE_URL',
    ]) {
      assert.ok(
        guideErrors(
          guide.replace(firstCompletion, `${firstCompletion} {{${token}}}`),
        ).some((error) => error.includes('unbound')),
      );
    }
  },
);

unit(
  'later tokens are allowlisted and PR_NUMBER is unavailable before Lab 2 Step 4',
  () => {
    for (const token of [
      'REPO',
      'OWNER',
      'LEARNER',
      'PROJECT_URL',
      'ISSUE_implementation',
      'ISSUE_verification',
      'EXERCISE_URL',
    ]) {
      assert.deepEqual(
        guideErrors(changeStep(2, (text) => `${text}\n{{${token}}}\n`)),
        [],
      );
    }
    assert.ok(
      guideErrors(changeStep(3, (text) => `${text}\n{{PR_NUMBER}}\n`)).some(
        (error) => error.includes('not bound before'),
      ),
    );
    assert.ok(
      guideErrors(changeStep(2, (text) => `${text}\n{{UNKNOWN}}\n`)).some(
        (error) => error.includes('unknown interpolation'),
      ),
    );
    assert.ok(
      guideErrors(changeStep(2, (text) => `${text}\n{{REPO}\n`)).some((error) =>
        error.includes('malformed interpolation'),
      ),
    );
  },
);

unit(
  'schedule drift, extra steps and noncanonical headings fail closed',
  () => {
    assert.ok(
      guideErrors(
        guide.replace(
          `**Time: ${contract.times[0]} minutes`,
          '**Time: 99 minutes',
        ),
      ).some((error) => error.includes('45 minutes')),
    );
    for (const number of [0, 5])
      assert.ok(
        guideErrors(`${guide}\n## Step ${number} \u2014 Extra\n`).some(
          (error) => error.includes('four ordered'),
        ),
      );
    assert.ok(
      guideErrors(guide.replace('## Step 1 \u2014', '## Step 1 -')).some(
        (error) => error.includes('four ordered'),
      ),
    );
  },
);

unit(
  'every step needs its explanatory labels and exactly its own screenshot',
  () => {
    for (const label of ['**Why:**', '**How:**', '**Expected result:**'])
      assert.ok(guideErrors(guide.replace(label, '**Other:**')).length > 0);
    const image = `assets/screenshots/lab-${metadata.lab}-step-1.png`;
    assert.ok(
      guideErrors(guide.replace(`](${image})`, '](README.md)')).some((error) =>
        error.includes('screenshot'),
      ),
    );
    assert.ok(
      guideErrors(`${guide}\n![Duplicate](${image})\n`).some((error) =>
        error.includes('four lab screenshot'),
      ),
    );
    assert.ok(
      guideErrors(guide.replace(/!\[[^\]]+\]/, '![]')).some((error) =>
        error.includes('alt text'),
      ),
    );
  },
);

unit(
  'later completion commands and evidence classes cannot be substituted',
  () => {
    for (const [index, command] of contract.commands.entries()) {
      if (index === 0) continue;
      assert.ok(
        guideErrors(guide.replace(`\n${command}\n`, '\n/done 9-9\n')).some(
          (error) => error.includes('completion command'),
        ),
      );
    }
    assert.ok(
      guideErrors(
        guide.replace('**MIXED EVIDENCE:**', '**SELF-CONFIRMED:**'),
      ).some((error) => error.includes('evidence class')),
    );
    assert.ok(
      guideErrors(changeStep(2, (text) => `${text}\n/check 9-9\n`)).some(
        (error) => error.includes('completion command'),
      ),
    );
  },
);

unit(
  'local commands, shell fences and installed-editor participation are rejected',
  () => {
    for (const instruction of [
      'git clone https://example.invalid/repo',
      'git switch work',
      'git push',
      'gh repo create',
      'Open a terminal.',
      'Use PowerShell.',
      'Open VSCode.',
      'Use VS Code.',
      'Use Visual Studio Code.',
      'Run npm test.',
      'Use your local clone.',
      '```bash\necho example\n```',
      '```powershell\nGet-Location\n```',
    ]) {
      assert.ok(
        validateSafety(instruction).some((error) =>
          error.includes('browser-only'),
        ),
        instruction,
      );
    }
    assert.deepEqual(
      validateSafety(
        'Use GitHub in your browser. Select Commit changes and Compare & pull request.',
      ),
      [],
    );
  },
);

unit(
  'participant token requests and credential-shaped publication content fail',
  () => {
    for (const instruction of [
      'Create a personal access token.',
      'Paste your PAT.',
      'Set GITHUB_TOKEN.',
      'Add a repository GH_TOKEN.',
    ])
      assert.ok(validateSafety(instruction).length > 0);
    const inertToken = ['ghp', '_', 'A'.repeat(30)].join('');
    assert.ok(
      validateSafety(inertToken).some((error) =>
        error.includes('Credential-shaped'),
      ),
    );
    assert.ok(validateSafety(inertToken, { instructions: false }).length > 0);
    assert.deepEqual(
      validateSafety(
        'No participant PAT or App is needed; normal browser sign-in is sufficient.',
      ),
      [],
    );
  },
);

unit(
  'only one Mona exercise is automated, never work-issue seeding or three copies',
  () => {
    assert.deepEqual(
      validateSafety(
        'Mona creates only one exercise issue, never work issues. Create the two work issues yourself.',
      ),
      [],
    );
    for (const text of [
      'Mona creates two work issues.',
      'The workflow automatically creates sample issues.',
      'Work issues are automatically seeded.',
      'Create three private copies.',
    ])
      assert.ok(validateSafety(text).length > 0, text);
    assert.ok(stepSections(guide)[0].text.includes('only one exercise issue'));
  },
);

unit(
  'the two work-issue rows require exact titles, effort, ownership, status and sprint',
  () => {
    const canonicalGuide = guide.replace(/[ \t]*\|[ \t]*/g, ' | ');
    for (const [before, after] of [
      [
        '[Workshop] Publish the service release checklist',
        '[Workshop] Renamed task',
      ],
      ['| 3 | Yourself |', '| 4 | Yourself |'],
      ['| 2 | Unassigned |', '| 2 | Yourself |'],
      ['| Todo |', '| Done |'],
      ['same owner as your repository', 'a different owner'],
    ])
      assert.ok(
        guideErrors(canonicalGuide.replace(before, after)).length > 0,
        before,
      );
  },
);

unit(
  'Security and FAQ distinguish native issue binding from unverified Project UI',
  () => {
    assert.deepEqual(validateSecurity(security), []);
    for (const text of [
      'Mona reads private Project fields.',
      'Mona verifies all Project charts.',
      'Mona uses the Projects API.',
    ])
      assert.ok(
        validateSafety(text).some((error) => error.includes('self-confirmed')),
        text,
      );
    assert.ok(
      validateSecurity(security.replace('no Projects API', 'a Projects API'))
        .length > 0,
    );
    assert.ok(
      guideErrors(guide.replace('no Projects API', 'a Projects API')).length >
        0,
    );
  },
);

unit(
  'each of the four supplied screenshot files is a CRC-checked decodable PNG',
  () => {
    for (const step of [1, 2, 3, 4]) {
      const file = `assets/screenshots/lab-${metadata.lab}-step-${step}.png`;
      const bytes = readFileSync(resolve(repositoryRoot, file));
      assert.deepEqual(validatePng(bytes), [], file);
      assert.ok(validatePng(bytes.subarray(0, 20)).length > 0, file);
    }
  },
);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const bytes = Buffer.alloc(body.length + 12);
  bytes.writeUInt32BE(body.length);
  bytes.write(type, 4, 'ascii');
  body.copy(bytes, 8);
  bytes.writeUInt32BE(
    crc32(bytes.subarray(4, body.length + 8)),
    body.length + 8,
  );
  return bytes;
}

function png({ width = 1, filter = 0, encoded = null } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk(
      'IDAT',
      encoded ?? deflateSync(Buffer.from([filter, 255, 0, 0, 255])),
    ),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

unit(
  'PNG structure, signatures, CRCs and final boundaries are validated',
  () => {
    const bytes = png();
    assert.deepEqual(validatePng(bytes), []);
    const corrupt = Buffer.from(bytes);
    corrupt[29] ^= 1;
    assert.ok(validatePng(corrupt).some((error) => error.includes('checksum')));
    assert.ok(validatePng(Buffer.from('not a PNG')).length > 0);
    assert.ok(validatePng(bytes.subarray(0, -12)).length > 0);
    assert.ok(validatePng(Buffer.concat([bytes, Buffer.from([0])])).length > 0);
  },
);

unit(
  'PNG checks actually inflate IDAT and validate decoded dimensions and filters',
  () => {
    const invalidDeflate = validatePng(
      png({ encoded: Buffer.from([1, 2, 3]) }),
    );
    assert.ok(invalidDeflate.length > 0);
    assert.ok(
      invalidDeflate.every((error) => !error.includes('checksum')),
      'The checksum is valid; inflate must reject the payload.',
    );
    assert.ok(
      validatePng(png({ width: 2 })).some((error) =>
        error.includes('dimensions'),
      ),
    );
    assert.ok(
      validatePng(png({ filter: 5 })).some((error) =>
        error.includes('row filter'),
      ),
    );
  },
);

unit(
  'all existing Markdown links and images resolve within this standalone repository',
  () => {
    for (const file of markdownFiles(repositoryRoot))
      assert.deepEqual(
        validateLocalLinks(repositoryRoot, read(file), file),
        [],
        file,
      );
  },
);

unit(
  'local links support encoded spaces, nested documents, reference links and HTML images',
  () => {
    assert.deepEqual(
      validateLocalLinks(
        repositoryRoot,
        '[Guide](README.md#overview)\n[report](docs/daily%20work%20report/2026-11-05.md)',
      ),
      [],
    );
    assert.deepEqual(
      validateLocalLinks(
        repositoryRoot,
        '[guide]: README.md\n<img src="assets/screenshots/lab-3-step-1.png">',
      ),
      [],
    );
    assert.deepEqual(
      validateLocalLinks(
        repositoryRoot,
        '[Home](../../README.md)',
        'assets/screenshots/SOURCES.md',
      ),
      [],
    );
  },
);

unit(
  'local links reject missing files, traversal, outside documents and machine paths',
  () => {
    for (const target of [
      '../README.md',
      '%2e%2e/README.md',
      'missing-guide.md',
      'file:///C:/private',
      'file%3A///C:/private',
      'C:/private/readme.md',
      '%5c%5cserver%5cshare',
      '/README.md',
      'README%ZZ.md',
    ])
      assert.ok(
        validateLocalLinks(repositoryRoot, `[Bad](${target})`).length > 0,
        target,
      );
    assert.ok(
      validateLocalLinks(
        repositoryRoot,
        '[Guide](README.md)',
        '../outside.md',
      ).some((error) => error.includes('escapes')),
    );
  },
);

unit(
  'unsafe web URLs, protocol-relative links, executable schemes and URL credentials fail',
  () => {
    for (const target of [
      'http://example.invalid',
      'https://user:password@example.invalid',
      '//example.invalid/readme',
      'javascript:alert(1)',
      'data:text/plain,example',
      'https://example.invalid/%0a',
      'mailto:user@example.invalid?body=secret',
    ]) {
      assert.ok(
        validateLocalLinks(repositoryRoot, `[Bad](${target})`).length > 0,
        target,
      );
    }
    assert.deepEqual(
      validateLocalLinks(
        repositoryRoot,
        '[Docs](https://docs.github.com/)\n<https://github.com/>',
      ),
      [],
    );
  },
);

unit(
  'Mona accepts only a matching full SHA for the canonical Lab 1 reusable runtime',
  () => {
    assert.deepEqual(validateMonaWorkflow(pinnedMona), []);
    assert.match(
      pinnedMona,
      /bsp-github-projects-lab-1\/\.github\/workflows\/module-runner\.yml@[a-f\d]{40}/,
    );
    assert.ok(
      validateMonaWorkflow(
        pinnedMona.replace(
          'bsp-github-projects-lab-1/.github',
          'bsp-github-projects-lab-2/.github',
        ),
      ).length > 0,
    );
  },
);

unit(
  'Mona rejects unresolved, mutable, abbreviated and mismatched runtime pins',
  () => {
    for (const value of [
      'RUNTIME_COMMIT',
      'main',
      'v1',
      'a'.repeat(39),
      'a'.repeat(41),
    ]) {
      assert.ok(
        validateMonaWorkflow(pinWorkflow(pinnedMona, value)).some((error) =>
          error.includes('matching 40-character'),
        ),
        value,
      );
    }
    assert.ok(
      validateMonaWorkflow(
        pinWorkflow(pinnedMona, 'a'.repeat(40), 'b'.repeat(40)),
      ).length > 0,
    );
  },
);

unit(
  'Mona caller cannot add secrets, scripts, PR triggers, permissions or extra jobs',
  () => {
    for (const changed of [
      pinnedMona.replace('types: [created]', 'types: [created, edited]'),
      pinnedMona.replace('issue_comment:', 'pull_request_target:'),
      pinnedMona.replace('contents: read', 'contents: write'),
      pinnedMona.replace(/^name:.*$/m, 'name: ${{ secrets.EXAMPLE }}'),
      `${pinnedMona}\n    secrets: inherit\n`,
      `${pinnedMona}\n    run: echo unsafe\n`,
      `${pinnedMona}\n  extra:\n    runs-on: ubuntu-latest\n`,
    ])
      assert.ok(validateMonaWorkflow(changed).length > 0);
  },
);

unit(
  'verification CI retains pinned read-only Actions, Node 24 and offline-only commands',
  () => {
    const workflow = read('.github/workflows/verify.yml');
    assert.deepEqual(validateVerificationWorkflow(workflow), []);
    for (const changed of [
      workflow.replace('contents: read', 'contents: write'),
      workflow.replace("node-version: '24'", "node-version: '22'"),
      workflow.replace('11d5960a326750d5838078e36cf38b85af677262', 'v4'),
      workflow.replace(
        'persist-credentials: false',
        'persist-credentials: true',
      ),
      workflow.replace(/^name:.*$/m, 'name: ${{ secrets.EXAMPLE }}'),
      workflow.replace('pull_request:', 'pull_request_target:'),
      `${workflow}\n    secrets: inherit\n`,
      workflow.replace(
        'run: node tools/verify-content.mjs',
        'run: npm install',
      ),
    ])
      assert.ok(validateVerificationWorkflow(changed).length > 0);
  },
);

unit(
  'only Lab 2 carries the checklist and either publication checkbox state passes',
  () => {
    const unchecked =
      '- [ ] Publish the service release checklist\n- [ ] Confirm verification work for Sprint 2\n';
    const checked = unchecked.replace('- [ ] Publish', '- [x] Publish');
    assert.deepEqual(validateChecklist(unchecked, 2), []);
    assert.deepEqual(validateChecklist(checked, 2), []);
    assert.ok(
      validateChecklist(checked.replace('- [ ] Confirm', '- [x] Confirm'), 2)
        .length > 0,
    );
    assert.ok(validateChecklist(null, 2).length > 0);
    assert.deepEqual(validateChecklist(null, 3), []);
    assert.ok(validateChecklist(unchecked, 3).length > 0);
    const file = 'work/release-checklist.md';
    assert.equal(existsSync(resolve(repositoryRoot, file)), metadata.lab === 2);
    assert.deepEqual(
      validateChecklist(metadata.lab === 2 ? read(file) : null, metadata.lab),
      [],
    );
  },
);

unit(
  'step extraction ignores fenced headings and enforces runtime size limits',
  () => {
    const withExample = changeStep(
      2,
      (text) => `${text}\n\`\`\`text\n## Step 9 \u2014 Example only\n\`\`\`\n`,
    );
    assert.equal(stepSections(withExample).length, 4);
    assert.deepEqual(guideErrors(withExample), []);
    assert.ok(
      guideErrors(changeStep(2, (text) => `${text}${'x'.repeat(48_000)}`)).some(
        (error) => error.includes('content limit'),
      ),
    );
  },
);

unit('author-only checks do not become learner tooling requirements', () => {
  assert.deepEqual(
    guideErrors(
      guide.replace(
        '**Maintainers only:**',
        '**Maintainers only:** npm test is an author-only check.',
      ),
    ),
    [],
  );
  assert.ok(
    guideErrors(
      changeStep(2, (text) => `${text}\nRun npm test to participate.\n`),
    ).some((error) => error.includes('browser-only')),
  );
});

unit(
  'security notes cannot omit the native/UI boundary or runtime token limits',
  () => {
    for (const literal of [
      'immutable issue IDs',
      'SELF-CONFIRMED',
      'runtime-ref',
      '40-character commit SHA',
      'No participant PAT, App, instructor account',
    ])
      assert.ok(
        validateSecurity(security.replace(literal, 'omitted')).length > 0,
        literal,
      );
  },
);

unit(
  'Lab 3 binds native issues first, then records only three Project self-confirmations',
  () => {
    const steps = stepSections(guide);
    assert.match(steps[0].text, /\*\*MIXED EVIDENCE:\*\*/);
    assert.match(steps[0].text, /manual demo data, not evidence of a PR merge/);
    assert.ok(
      guideErrors(
        guide.replace(
          'manual demo data, not evidence of a PR merge',
          'proof of a PR merge',
        ),
      ).length > 0,
    );
    for (const [index, step] of steps.slice(1).entries()) {
      assert.match(step.text, /\*\*SELF-CONFIRMED:\*\*/);
      assert.ok(step.text.includes(`/done 3-${index + 2}`));
      assert.doesNotMatch(step.text, /^\/check /m);
    }
    assert.ok(
      guideErrors(changeStep(4, (text) => `${text}\n{{PR_NUMBER}}\n`)).some(
        (error) => error.includes('not bound before'),
      ),
    );
  },
);

unit(
  'Lab 3 workload uses the actual dataset and distinguishes open state from Done status',
  () => {
    for (const literal of [
      'Group by → Assignees',
      'is:open',
      'native issue state, not Project Status',
      'Assign it to yourself',
      'two actual issues',
      'five existing issues',
    ]) {
      assert.ok(
        guideErrors(changeStep(2, (text) => text.replace(literal, 'omitted')))
          .length > 0,
        literal,
      );
    }
    assert.ok(
      guideErrors(guide.replace('actual date values', 'unspecified dates'))
        .length > 0,
    );
  },
);

unit(
  'Lab 3 needs native Status Insights and a native At risk update with mitigation',
  () => {
    assert.ok(
      guideErrors(
        changeStep(3, (text) => text.replace('Count of items', 'Effort')),
      ).length > 0,
    );
    for (const literal of [
      'Status updates',
      'Add update',
      'At risk',
      'Save update',
      'has an owner',
      'planned for Sprint 2',
    ]) {
      assert.ok(
        guideErrors(changeStep(4, (text) => text.replace(literal, 'omitted')))
          .length > 0,
        literal,
      );
    }
  },
);

unit(
  'Lab 3 browser export has two standalone rows, five continuation rows and no uploads',
  () => {
    for (const literal of [
      'two issue rows for standalone',
      'five existing issue rows for the all-three-lab path',
      'downloads panel',
      'Do not commit, upload or attach the export',
      'only the exercise issue',
      'Verification remains open for Sprint 2',
    ]) {
      assert.ok(
        guideErrors(changeStep(4, (text) => text.replaceAll(literal, 'omitted')))
          .length > 0,
        literal,
      );
    }
    assert.match(
      stepSections(guide)[3].text,
      /closes \*\*only the exercise issue\*\*/,
    );
  },
);
