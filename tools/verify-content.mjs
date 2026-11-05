import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const starterRepository = 'alvine-aurelio-org/bsp-github-projects-lab-1';
export const sourceRepositories = [1, 2, 3].map(
  (lab) => `alvine-aurelio-org/bsp-github-projects-lab-${lab}`,
);
export const workItems = [
  {
    key: 'implementation',
    title: '[Workshop] Publish the service release checklist',
  },
  {
    key: 'verification',
    title: '[Workshop] Verify the release checklist in Sprint 2',
  },
];
export const firstCompletion =
  'Open your Project, copy the URL from the address bar, and paste only that link as a new comment below.';
export const contracts = {
  2: {
    title: 'Plan and complete sprint work',
    titles: [
      'Set up your sprint workspace',
      'Show a native dependency',
      'Create a linked pull request',
      'Complete and carry over',
    ],
    times: [18, 7, 12, 8],
    continuationTimes: [8, 7, 12, 8],
    commands: [
      'YOUR_PROJECT_URL',
      '/check 2-2',
      '/check 2-3 #YOUR_PR_NUMBER',
      '/check 2-4 #YOUR_PR_NUMBER',
    ],
    modes: ['mixed', 'repository-verified', 'repository-verified', 'mixed'],
    evidence: [
      'MIXED EVIDENCE',
      'REPOSITORY-VERIFIED',
      'REPOSITORY-VERIFIED',
      'MIXED EVIDENCE',
    ],
  },
  3: {
    title: 'Visualize and communicate',
    titles: [
      'Set up your release roadmap',
      'Inspect workload',
      'Read a progress chart',
      'Publish a delivery update',
    ],
    times: [20, 8, 7, 10],
    continuationTimes: [10, 8, 7, 10],
    commands: ['YOUR_PROJECT_URL', '/done 3-2', '/done 3-3', '/done 3-4'],
    modes: ['mixed', 'self-confirmed', 'self-confirmed', 'self-confirmed'],
    evidence: [
      'MIXED EVIDENCE',
      'SELF-CONFIRMED',
      'SELF-CONFIRMED',
      'SELF-CONFIRMED',
    ],
  },
};

const plain = (text) =>
  text.replace(/[*`]/g, '').replace(/[ \t]*\|[ \t]*/g, ' | ');
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const tokens = new Set([
  'REPO',
  'OWNER',
  'LEARNER',
  'PROJECT_URL',
  'ISSUE_implementation',
  'ISSUE_verification',
  'PR_NUMBER',
  'EXERCISE_URL',
]);

// Match the runtime's real top-level boundaries; headings inside fences are examples.
function topLevelHeadings(markdown) {
  const headings = [];
  let fence = null;
  let offset = 0;
  for (const line of markdown.split('\n')) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (
        marker &&
        marker[1][0] === fence.character &&
        marker[1].length >= fence.length &&
        /^\s*$/.test(marker[2])
      )
        fence = null;
    } else if (marker) {
      fence = { character: marker[1][0], length: marker[1].length };
    } else if (/^##(?:[ \t]+|$)/.test(line)) {
      headings.push({ title: line.replace(/^##[ \t]*/, ''), index: offset });
    }
    offset += line.length + 1;
  }
  return headings;
}

function learnerContent(markdown) {
  const headings = topLevelHeadings(markdown);
  const author = headings.findIndex(
    ({ title }) => title === 'Author verification',
  );
  return author < 0
    ? markdown
    : markdown.slice(0, headings[author].index) +
        markdown.slice(headings[author + 1]?.index ?? markdown.length);
}

export function stepSections(source) {
  const markdown = source.replaceAll('\r\n', '\n');
  const headings = topLevelHeadings(markdown);
  return headings.flatMap((heading, index) => {
    const step = /^Step (\d+) \u2014 (.+)$/.exec(heading.title);
    return step
      ? [
          {
            number: Number(step[1]),
            heading: heading.title,
            text: markdown.slice(
              heading.index,
              headings[index + 1]?.index ?? markdown.length,
            ),
          },
        ]
      : [];
  });
}

export function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    return ['Metadata must be an object.'];
  const errors = [];
  const keys = [
    'schemaVersion',
    'role',
    'lab',
    'title',
    'minutes',
    'continuationMinutes',
    'bootstrapIssueLimit',
    'starterRepository',
    'sourceRepositories',
    'defaultBranch',
    'exerciseTitle',
    'publicAssetBase',
    'workBranch',
    'workFile',
    'requiredWorkText',
    'workItems',
    'lessons',
  ];
  const contract = [2, 3].includes(metadata.lab)
    ? contracts[metadata.lab]
    : null;
  if (!exactKeys(metadata, keys))
    errors.push('Metadata must keep the exact standalone schema-v3 keys.');
  if (metadata.schemaVersion !== 3 || metadata.role !== 'standalone')
    errors.push('Metadata must declare schemaVersion 3 and role standalone.');
  if (![2, 3].includes(metadata.lab))
    errors.push('Metadata lab must be 2 or 3.');
  if (metadata.title !== contract?.title)
    errors.push('Metadata title does not match the lab.');
  if (metadata.minutes !== 45 || metadata.continuationMinutes !== 35)
    errors.push(
      'Metadata must total 45 minutes with a 35-minute continuation.',
    );
  if (metadata.bootstrapIssueLimit !== 1)
    errors.push('Bootstrap must create only one Mona exercise issue.');
  if (
    metadata.starterRepository !== starterRepository ||
    JSON.stringify(metadata.sourceRepositories) !==
      JSON.stringify(sourceRepositories)
  )
    errors.push(
      'Metadata must retain Lab 1 and all three inert source repositories.',
    );
  if (
    metadata.defaultBranch !== 'main' ||
    metadata.exerciseTitle !==
      `Mona's GitHub Projects Lab ${metadata.lab} \u2014 start here`
  )
    errors.push(
      'Metadata must keep the main branch and exact Mona exercise title.',
    );
  if (
    metadata.publicAssetBase !==
    `https://raw.githubusercontent.com/${sourceRepositories[metadata.lab - 1]}/main/assets/screenshots/`
  )
    errors.push("Images must use this lab's canonical public asset base.");
  if (
    metadata.workBranch !== 'workshop/release-checklist' ||
    metadata.workFile !== 'work/release-checklist.md' ||
    metadata.requiredWorkText !== '- [x] Publish the service release checklist'
  )
    errors.push('Metadata must retain the exact browser checklist exercise.');
  if (
    !Array.isArray(metadata.workItems) ||
    metadata.workItems.length !== 2 ||
    metadata.workItems.some(
      (item, index) =>
        !exactKeys(item, ['key', 'title']) ||
        item.key !== workItems[index].key ||
        item.title !== workItems[index].title,
    )
  )
    errors.push(
      'Exactly the two ordered, exact-title work roles are required.',
    );
  if (!Array.isArray(metadata.lessons) || metadata.lessons.length !== 4) {
    errors.push('Exactly four standalone lessons are required.');
  } else {
    metadata.lessons.forEach((lesson, index) => {
      const step = index + 1;
      if (
        !exactKeys(lesson, [
          'id',
          'step',
          'minutes',
          'title',
          'mode',
          'command',
          'image',
        ]) ||
        lesson.id !== `${metadata.lab}-${step}` ||
        lesson.step !== step ||
        lesson.minutes !== contract?.times[index] ||
        lesson.title !== contract?.titles[index] ||
        lesson.mode !== contract?.modes[index] ||
        lesson.command !== contract?.commands[index] ||
        lesson.image !== `lab-${metadata.lab}-step-${step}.png`
      )
        errors.push(
          `Lesson ${step} must match its title, timing, mode, command and image contract.`,
        );
    });
    if (
      metadata.lessons.reduce(
        (sum, lesson) => sum + (lesson?.minutes ?? 0),
        0,
      ) !== 45
    )
      errors.push('Lesson times must total 45 minutes.');
  }
  return errors;
}

export function validateSafety(text, { instructions = true } = {}) {
  const errors = [];
  if (
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(text)
  )
    errors.push('Credential-shaped text must not be published.');
  if (!instructions) return errors;
  const content = plain(text);
  if (
    /\b(?:create|generate|paste|enter|provide|set|store|add|export|supply|configure)\s+(?:(?:a|an|your|the|new|repository|participant|own)\s+)*(?:personal access token|PAT\b|GH_TOKEN\b|GITHUB_TOKEN\b)/i.test(
      content,
    )
  )
    errors.push('Do not request a participant token or secret.');
  if (
    /\bgit(?:\.exe)?\s+(?:clone|init|fetch|pull|push|switch|checkout|branch|add|commit|diff|status|remote|config|reset|merge|restore|clean|rebase|log)\b|\bgh\s+(?:repo|project|auth|api|pr|issue)\b/i.test(
      content,
    )
  )
    errors.push(
      'Learner instructions must be browser-only, without Git or CLI commands.',
    );
  if (
    /\b(?:PowerShell|pwsh|terminal|VS\s*Code|Visual Studio Code|npm|npx|GitHub CLI|local clone|working tree|command.line)\b|\bclon(?:e|ing)\s+(?:your|the|this|a|an)\b/i.test(
      content,
    ) ||
    /^\s*(?:`{3,}|~{3,})\s*(?:powershell|pwsh|ps1|bash|sh|shell|cmd|bat|console)\b/im.test(
      text,
    )
  )
    errors.push(
      'Learner instructions must be browser-only, without local tooling or shell fences.',
    );
  if (
    /\b(?:Mona|bot|workflow|bootstrap|template)\s+(?:will\s+|automatically\s+)?(?:create[sd]?|seed[sd]?|generate[sd]?)\s+(?:automatically\s+)?(?:(?:the|your|both|two|five|all)\s+)*(?:work|sample|demo)\s+(?:issues|items)\b/i.test(
      content,
    ) ||
    /\b(?:work|sample|demo)\s+(?:issues|items)\s+(?:are|will be)\s+automatically\s+(?:created|seeded|generated)\b/i.test(
      content,
    )
  )
    errors.push(
      'Work issues must be created manually; Mona creates only the exercise.',
    );
  if (
    /\b(?:Mona|bot|workflow)\s+(?:reads|verifies|checks|inspects)\s+(?:(?:your|the|all|private)\s+)*Projects?\s+(?:fields|charts|views|updates|settings|membership|existence|access)\b|\bMona\s+uses\s+(?:the\s+)?Projects API\b/i.test(
      content,
    )
  )
    errors.push(
      'Project UI is self-confirmed; do not claim Projects API verification.',
    );
  if (
    /\b(?:create|make)\s+(?:all\s+)?(?:three|3)\s+(?:private\s+)?(?:copies|repositories|repos)\b/i.test(
      content,
    )
  )
    errors.push('Do not require three learner copies.');
  if (
    /\bapprove your own (?:PR|pull request)\b|\bself-approve (?:your|the) (?:PR|pull request)\b/i.test(
      content,
    )
  )
    errors.push(
      'Do not require self-approval or call self-inspection independent review.',
    );
  return errors;
}

function requireText(errors, text, literals, scope) {
  for (const literal of literals)
    if (!text.includes(literal))
      errors.push(`${scope} is missing required instruction: ${literal}`);
}

export function validateGuide(source, metadata) {
  const contract = [2, 3].includes(metadata?.lab)
    ? contracts[metadata.lab]
    : null;
  if (!contract) return ['Cannot validate a guide without a valid lab.'];
  const markdown = source.replaceAll('\r\n', '\n');
  const errors = validateSafety(learnerContent(markdown));
  const steps = stepSections(markdown);
  if (
    steps.length !== 4 ||
    topLevelHeadings(markdown).filter(({ title }) => /^Step\b/i.test(title))
      .length !== 4 ||
    steps.map((step) => step.number).join(',') !== '1,2,3,4'
  )
    errors.push(
      'Exactly four ordered Step 1 through Step 4 sections are required.',
    );
  if (
    markdown.length > 512_000 ||
    steps.some(({ text }) => text.length > 48_000)
  )
    errors.push('Guide or step exceeds the runtime content limit.');
  const times = steps.map((step) =>
    Number(/\*\*Time: (\d+) minutes/.exec(step.text)?.[1]),
  );
  if (
    times.reduce((sum, time) => sum + time, 0) !== 45 ||
    times.join(',') !== contract.times.join(',')
  )
    errors.push(
      'Step times must match the standalone contract and total 45 minutes.',
    );
  for (const [index, step] of steps.entries()) {
    if (step.heading !== `Step ${index + 1} \u2014 ${contract.titles[index]}`)
      errors.push(`Step ${step.number} must keep its exact top-level heading.`);
    for (const label of [
      'Topic:',
      '**Why:**',
      '**How:**',
      '**Expected result:**',
    ]) {
      if (!step.text.includes(label))
        errors.push(`Step ${step.number} is missing ${label}`);
    }
    if (!/\*\*Do(?: \u2014 [^*\n]+)?:\*\*/.test(step.text))
      errors.push(`Step ${step.number} is missing **Do:**`);
    const commands = (step.text.match(/^\/[a-z]+(?: .*)?$/gm) ?? []).map(
      (command) => command.trim(),
    );
    if (index === 0) {
      if (
        !step.text.includes(firstCompletion) ||
        commands.length ||
        /\/project\b|YOUR_PROJECT_URL|\b(?:PASTE|ACTUAL)_PROJECT_URL\b|https?:\/\/github\.com\/(?:users|orgs)\/[^\s)]+\/projects\//i.test(
          step.text,
        ) ||
        /^\s*(?:`{3,}|~{3,})/m.test(step.text)
      )
        errors.push(
          'Step 1 must request only the actual Project address-bar link as a new comment, without a command, URL example, placeholder or code block.',
        );
      const footer =
        /\*\*MIXED EVIDENCE:\*\*([^\n]*)/.exec(step.text)?.[1] ?? '';
      if (
        !footer.includes('native work issues') ||
        !footer.includes('self-confirmed') ||
        footer.length > 240 ||
        /\b(?:API|endpoint|immutable|authorship|GraphQL|REST)\b/i.test(footer)
      )
        errors.push(
          'Keep the first evidence footer concise: native issue binding plus self-confirmed Project UI.',
        );
    } else if (
      commands.length !== 1 ||
      commands[0] !== contract.commands[index]
    )
      errors.push(`Step ${step.number} has the wrong completion command.`);
    if (!step.text.includes(`**${contract.evidence[index]}:**`))
      errors.push(`Step ${step.number} has the wrong evidence class.`);
    const remainder = step.text.replace(/\{\{([A-Za-z_]+)\}\}/g, (_, key) => {
      if (!tokens.has(key))
        errors.push(`Step ${step.number} has an unknown interpolation token.`);
      if (index === 0 && !['REPO', 'OWNER', 'LEARNER'].includes(key))
        errors.push(
          'Step 1 cannot use an unbound Project, issue, PR or exercise placeholder.',
        );
      if (key === 'PR_NUMBER' && !(metadata.lab === 2 && step.number === 4))
        errors.push('PR_NUMBER is not bound before Lab 2 Step 4.');
      return '';
    });
    if (remainder.includes('{{') || remainder.includes('}}'))
      errors.push(`Step ${step.number} has a malformed interpolation token.`);
    const image = `assets/screenshots/lab-${metadata.lab}-step-${step.number}.png`;
    if (
      !(step.text.match(/!\[[^\]\r\n]+\]\(([^)]+)\)/g) ?? []).some(
        (reference) => reference.endsWith(`](${image})`),
      )
    )
      errors.push(
        `Step ${step.number} must show its own screenshot with alt text.`,
      );
  }
  const images = [...markdown.matchAll(/!\[[^\]\r\n]*\]\(([^)]+)\)/g)].map(
    (match) => match[1],
  );
  const expectedImages = [1, 2, 3, 4].map(
    (step) => `assets/screenshots/lab-${metadata.lab}-step-${step}.png`,
  );
  if (images.join('|') !== expectedImages.join('|'))
    errors.push(
      'Exactly the four lab screenshot references are required, once each in order.',
    );
  const welcome = steps[0]?.text ?? '';
  for (const label of [
    'Who is this for?',
    'What will you learn?',
    'What will you build?',
    'How long?',
    'Prerequisites:',
  ]) {
    if (!welcome.includes(label))
      errors.push(`Step 1 Welcome is missing ${label}`);
  }
  const setup = plain(welcome);
  requireText(
    errors,
    setup,
    [
      '### Welcome',
      '### Start here',
      '35-minute continuation',
      '45 minutes',
      '35 minutes',
      'same Mona exercise issue and same Project',
      'five existing work issues',
      'No other copy is needed.',
      'Optional standalone',
      'one private repository and one private Project',
      'Already in your private copy? Skip the template button.',
      'only one exercise issue',
      'new comment',
      'Public source repositories are inert',
      'only two work issues',
      "after Mona's exercise was opened",
      'Your projects',
      'New project',
      'Table',
      'Private',
      'same owner as your repository',
      'Projects \u2192 Link a project',
      'Effort',
      'Number',
      'Sprint',
      'Iteration',
      'one-week',
      'Sprint 1',
      'Sprint 2',
    ],
    'Step 1',
  );
  if (
    !welcome.includes(`](https://github.com/${starterRepository})`) ||
    !welcome.includes(
      `[Use this template](https://github.com/${sourceRepositories[metadata.lab - 1]}/generate)`,
    )
  )
    errors.push(
      "Step 1 must link the existing Lab 1 path and this lab's optional template entrypoint.",
    );
  if (
    /reference.only|not a learner template|no (?:Mona workflow|bootstrap|learner initialization)|only Lab 1 is a (?:starter|template)/i.test(
      learnerContent(markdown),
    )
  )
    errors.push(
      'Do not describe a standalone source as reference-only or without initialization.',
    );
  const implementationStatus = metadata.lab === 2 ? 'In progress' : 'Done';
  const verificationSprint = metadata.lab === 2 ? 'Sprint 1' : 'Sprint 2';
  requireText(
    errors,
    setup,
    [
      `Implementation | ${workItems[0].title} | 3 | Yourself | ${implementationStatus} | Sprint 1`,
      `Verification | ${workItems[1].title} | 2 | Unassigned | Todo | ${verificationSprint}`,
    ],
    'Two-issue setup',
  );
  const allText = plain(markdown);
  requireText(
    errors,
    allText,
    [
      'no Projects API',
      'self-confirmed',
      'exact title',
      'actual IDs',
      'learner authorship',
      'creation after the exercise',
    ],
    'Evidence FAQ',
  );
  if (metadata.lab === 2) {
    requireText(
      errors,
      plain(steps[0]?.text ?? ''),
      [
        'both issues in Sprint 1',
        'Group by \u2192 Sprint',
        'Field sum \u2192 Effort',
        'total Effort 5',
        'keep both open',
      ],
      'Lab 2 setup',
    );
    requireText(
      errors,
      plain(steps[1]?.text ?? ''),
      [
        'Relationships',
        'Blocked by \u2192 implementation',
        'Blocking \u2192 verification',
      ],
      'Lab 2 dependency',
    );
    requireText(
      errors,
      plain(steps[2]?.text ?? ''),
      [
        'Code',
        'branch dropdown',
        'workshop/release-checklist from main',
        'pencil \u2192 Edit this file',
        'work/release-checklist.md',
        '- [x] Publish the service release checklist',
        'second checkbox unchecked',
        'Commit changes',
        'Commit directly to the workshop/release-checklist branch',
        'Compare & pull request',
        'base: main',
        'compare: workshop/release-checklist',
        'Closes #{{ISSUE_implementation}}',
        'Files changed',
        'Keep the PR open until Mona confirms Step 2-3 passed',
        'not independent review or self-approval',
      ],
      'Lab 2 browser PR',
    );
    requireText(
      errors,
      plain(steps[3]?.text ?? ''),
      [
        'Item closed \u2192 Status: Done',
        'Files changed',
        'content verification and test checks',
        'Merge pull request',
        'Sprint 1',
        'Sprint 2',
        'Keep verification open',
        'closes only this standalone exercise issue',
      ],
      'Lab 2 completion',
    );
    if (/Closes\s+#(?!\{\{ISSUE_implementation\}\})\S+/i.test(markdown))
      errors.push(
        'Use the bound implementation interpolation, not a fictional closing number.',
      );
  } else {
    requireText(
      errors,
      setup,
      [
        'Verification must remain open',
        'Implementation may be open or closed as completed',
        'manual demo data, not evidence of a PR merge',
        'Start date',
        'Target date',
        'Date',
        'actual date values',
        'Release roadmap',
        'Date fields',
        'Markers',
        'Save',
      ],
      'Lab 3 roadmap setup',
    );
    requireText(
      errors,
      plain(steps[1]?.text ?? ''),
      [
        'Workload',
        'is:open',
        'native issue state, not Project Status',
        'Group by \u2192 Assignees',
        'Field sum \u2192 Effort',
        'unassigned',
        'Assign it to yourself',
        'Sprint 2',
        'two actual issues',
        'five existing issues',
      ],
      'Lab 3 workload',
    );
    requireText(
      errors,
      plain(steps[2]?.text ?? ''),
      [
        'Insights',
        'Delivery status',
        'Column',
        'Status',
        'Count of items',
        'one Done and one Todo',
        'incomplete',
      ],
      'Lab 3 chart',
    );
    const updateInstructions = plain(
      /\*\*Do:\*\*([\s\S]*?)\*\*Expected result:\*\*/.exec(
        steps[3]?.text ?? '',
      )?.[1] ?? '',
    );
    requireText(
      errors,
      updateInstructions,
      [
        'Project details',
        'Status updates',
        'Add update',
        'At risk',
        'target date after Sprint 2',
        'Save update',
        'Mitigation:',
        'has an owner',
        'planned for Sprint 2',
        'Export view data',
        'TSV locally',
        'downloads panel',
        'two issue rows for standalone',
        'five existing issue rows for the all-three-lab path',
        'Do not commit, upload or attach the export',
      ],
      'Lab 3 native update and export',
    );
    requireText(
      errors,
      plain(steps[3]?.text ?? ''),
      ['only the exercise issue', 'Verification remains open for Sprint 2'],
      'Lab 3 completion',
    );
  }
  return errors;
}

export function validateSecurity(markdown) {
  const errors = validateSafety(markdown);
  requireText(
    errors,
    plain(markdown),
    [
      'browser-only',
      'public source repositories are inert',
      'only one Mona exercise issue',
      'exact titles',
      'immutable issue IDs',
      'learner authorship',
      'creation time',
      'SELF-CONFIRMED',
      'no Projects API',
      'contents: read',
      'issues: write',
      'pull-requests: read',
      'built-in GITHUB_TOKEN',
      '40-character commit SHA',
      'runtime-ref',
      'read-only',
      'Node 24',
      'No participant PAT, App, instructor account',
    ],
    'Security notes',
  );
  return errors;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function validatePng(bytes) {
  try {
    const require = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    require(Buffer.isBuffer(bytes) &&
      bytes.length >= 45, 'PNG is absent or truncated.');
    require(bytes
      .subarray(0, 8)
      .equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      ), 'Invalid PNG signature.');
    let offset = 8;
    let header;
    let ended = false;
    const imageData = [];
    while (offset < bytes.length) {
      require(offset + 12 <= bytes.length, 'Truncated PNG chunk.');
      const length = bytes.readUInt32BE(offset);
      const end = offset + length + 12;
      require(end <= bytes.length, 'PNG chunk extends past the file.');
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      const body = bytes.subarray(offset + 8, offset + 8 + length);
      require(crc32(bytes.subarray(offset + 4, offset + 8 + length)) ===
        bytes.readUInt32BE(offset + 8 + length), 'PNG chunk checksum failed.');
      if (offset === 8) require(type === 'IHDR', 'PNG must start with IHDR.');
      if (type === 'IHDR') {
        require(!header && length === 13, 'Invalid or duplicate PNG header.');
        header = {
          width: body.readUInt32BE(0),
          height: body.readUInt32BE(4),
          depth: body[8],
          color: body[9],
          interlace: body[12],
        };
        require(header.width > 0 &&
          header.height > 0, 'PNG dimensions must be positive.');
        const depths = {
          0: [1, 2, 4, 8, 16],
          2: [8, 16],
          3: [1, 2, 4, 8],
          4: [8, 16],
          6: [8, 16],
        };
        require(depths[header.color]?.includes(
          header.depth,
        ), 'Invalid PNG color type or bit depth.');
        require(body[10] === 0 &&
          body[11] === 0 &&
          [0, 1].includes(
            header.interlace,
          ), 'Invalid PNG compression, filter or interlace method.');
      }
      if (type === 'IDAT') imageData.push(body);
      offset = end;
      if (type === 'IEND') {
        require(length === 0, 'Invalid PNG end chunk.');
        ended = true;
        break;
      }
    }
    require(header &&
      ended &&
      offset === bytes.length &&
      imageData.length > 0, 'PNG image data or final end chunk is missing.');
    const pixels = inflateSync(Buffer.concat(imageData), {
      maxOutputLength: 128 * 1024 * 1024,
    });
    require(pixels.length > 0, 'PNG has no decoded pixel data.');
    if (header.interlace === 0) {
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.color];
      const rowBytes =
        1 + Math.ceil((header.width * channels * header.depth) / 8);
      require(pixels.length ===
        header.height *
          rowBytes, 'PNG pixel data length does not match its dimensions.');
      for (let row = 0; row < header.height; row += 1)
        require(pixels[row * rowBytes] <= 4, 'Invalid PNG row filter.');
    }
    return [];
  } catch (error) {
    return [error.message];
  }
}

function inside(root, target) {
  const path = relative(root, target);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export function validateLocalLinks(root, markdown, fromFile = 'README.md') {
  const errors = [];
  const document = resolve(root, fromFile);
  if (!inside(resolve(root), document))
    return [`${fromFile}: Markdown source escapes this repository.`];
  const targets = [
    ...[
      ...markdown.matchAll(
        /!?\[[^\]\r\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\s*\)/g,
      ),
    ].map((link) => link[1] ?? link[2]),
    ...[
      ...markdown.matchAll(/^ {0,3}\[[^\]\r\n]+\]:\s*(?:<([^>]+)>|([^\s]+))/gm),
    ].map((link) => link[1] ?? link[2]),
    ...[
      ...markdown.matchAll(
        /<(?:a|img)\b[^>]*\b(?:href|src)=["']([^"']+)["'][^>]*>/gi,
      ),
    ].map((link) => link[1]),
    ...[...markdown.matchAll(/<((?:[a-z][a-z\d+.-]*:|\/\/)[^<>\s]+)>/gi)].map(
      (link) => link[1],
    ),
  ];
  for (const target of new Set(targets)) {
    let decoded;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      errors.push(`${fromFile}: invalid URL encoding.`);
      continue;
    }
    if (/[\u0000-\u001f\u007f\\]/.test(decoded) || decoded.startsWith('//')) {
      errors.push(`${fromFile}: unsupported or unsafe link.`);
    } else if (/^https?:/i.test(decoded)) {
      try {
        const url = new URL(decoded);
        if (
          url.protocol !== 'https:' ||
          !url.hostname ||
          url.username ||
          url.password
        )
          throw new Error('Unsafe URL');
      } catch {
        errors.push(
          `${fromFile}: external links must be credential-free HTTPS URLs.`,
        );
      }
    } else if (/^mailto:/i.test(decoded)) {
      if (!/^mailto:[^\s?@:]+@[^\s?@:]+$/i.test(decoded))
        errors.push(`${fromFile}: unsupported email link.`);
    } else if (decoded.startsWith('#')) {
      continue;
    } else if (/^[a-z][a-z\d+.-]*:/i.test(decoded) || isAbsolute(decoded)) {
      errors.push(`${fromFile}: unsupported local link.`);
    } else {
      const localPath = decodeURIComponent(target.split(/[?#]/)[0]);
      const absolute = resolve(dirname(document), localPath);
      if (!inside(resolve(root), absolute))
        errors.push(
          `${fromFile}: local link escapes this standalone repository.`,
        );
      else if (!existsSync(absolute))
        errors.push(`${fromFile}: missing local link ${localPath}`);
      else if (!inside(realpathSync(root), realpathSync(absolute)))
        errors.push(
          `${fromFile}: local link resolves outside this repository.`,
        );
      else if (!statSync(absolute).isFile())
        errors.push(`${fromFile}: local link is not a file: ${localPath}`);
    }
  }
  return errors;
}

export function markdownFiles(root, directory = root) {
  const ignored = new Set([
    '.git',
    'node_modules',
    '.artifacts',
    'coverage',
    '.vscode',
    '.idea',
  ]);
  if (!inside(realpathSync(root), realpathSync(directory)))
    throw new Error('Markdown directory escapes this repository.');
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory() && !ignored.has(entry.name))
      return markdownFiles(root, absolute);
    return entry.isFile() && entry.name.endsWith('.md')
      ? [relative(root, absolute)]
      : [];
  });
}

export function validatePackage(manifest) {
  const errors = [];
  if (
    manifest?.engines?.node !== '>=22' ||
    manifest?.type !== 'module' ||
    manifest?.private !== true
  )
    errors.push(
      'Author tooling must be private Node 22+ ES modules; CI uses Node 24.',
    );
  if (
    manifest?.scripts?.test !== 'node --test --test-reporter=tap' ||
    manifest?.scripts?.verify !== 'node tools/verify-content.mjs'
  )
    errors.push('Use the dependency-free Node test and verify scripts.');
  if (
    [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ].some((key) => manifest && key in manifest)
  )
    errors.push(
      'Standalone author packages must not declare npm dependencies.',
    );
  return errors;
}

function workflowLines(workflow) {
  return workflow
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.replace(/\s+#.*$/, '').trimEnd())
    .filter(
      (line) =>
        line.trim() && !/^\s*#/.test(line) && !/^\s*(?:- )?name: /.test(line),
    )
    .map((line) =>
      line.replace(/node-version: ['"]24['"]$/, 'node-version: 24'),
    )
    .join('\n');
}

export function validateMonaWorkflow(workflow) {
  const errors = [];
  const lines = workflowLines(workflow);
  const source = `${starterRepository}/.github/workflows/module-runner.yml`;
  const reference = /^ {4}uses: ([^\s]+)$/m.exec(lines)?.[1];
  const runtime = /^ {6}runtime-ref: ([^\s]+)$/m.exec(lines)?.[1];
  const pin = reference?.startsWith(`${source}@`)
    ? reference.slice(source.length + 1)
    : '';
  if (
    !/^[a-f\d]{40}$/.test(pin) ||
    !/^[a-f\d]{40}$/.test(runtime ?? '') ||
    pin !== runtime
  )
    errors.push(
      'Mona must use matching 40-character commit pins for the Lab 1 module-runner.yml and runtime-ref; branches, tags and unresolved pins are forbidden.',
    );
  const expected = [
    'on:',
    '  push:',
    '    branches: [main]',
    '  issue_comment:',
    '    types: [created]',
    '  workflow_dispatch:',
    'permissions:',
    '  contents: read',
    '  issues: write',
    '  pull-requests: read',
    'jobs:',
    '  guide:',
    `    uses: ${source}@${pin}`,
    '    with:',
    `      runtime-ref: ${pin}`,
  ].join('\n');
  if (lines !== expected || /\bsecrets\s*(?:\.|\[|:)/i.test(workflow))
    errors.push(
      'Mona must be only the guarded reusable caller: main push, new issue comments, manual start, exact repository permissions and no secrets, scripts or extra jobs.',
    );
  return errors;
}

export function validateVerificationWorkflow(workflow) {
  const expected = [
    'on:',
    '  push:',
    '    branches: [main]',
    '  pull_request:',
    '  workflow_dispatch:',
    'permissions:',
    '  contents: read',
    'jobs:',
    '  verify:',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 5',
    '    steps:',
    '        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    '        with:',
    '          persist-credentials: false',
    '        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    '        with:',
    '          node-version: 24',
    '        run: node tools/verify-content.mjs',
    '        run: node --test --test-reporter=tap',
  ].join('\n');
  return workflowLines(workflow) === expected &&
    !/\bsecrets\s*(?:\.|\[|:)/i.test(workflow)
    ? []
    : [
        'Verification workflow must remain read-only, with pinned official Actions, Node 24, no secrets and only the two offline commands.',
      ];
}

export function validateChecklist(content, lab) {
  if (lab === 3)
    return content === null
      ? []
      : [
          'Only Lab 2 may contain the root work/release-checklist.md exercise file.',
        ];
  if (lab !== 2) return ['Cannot validate the checklist without a valid lab.'];
  const items =
    typeof content === 'string'
      ? content
          .replaceAll('\r\n', '\n')
          .split('\n')
          .filter((line) => /^- \[[^\]]*\]/.test(line))
      : [];
  return items.length === 2 &&
    /^- \[[ x]\] Publish the service release checklist$/.test(items[0]) &&
    items[1] === '- [ ] Confirm verification work for Sprint 2'
    ? []
    : [
        'Lab 2 must retain both checklist items; publication may be checked or unchecked, but verification stays unchecked.',
      ];
}

export function verifyContent(root = repositoryRoot) {
  const errors = [];
  let canonicalRoot;
  try {
    canonicalRoot = realpathSync(root);
  } catch {
    return ['Repository root is missing or unreadable.'];
  }
  const bytes = (path) => {
    try {
      const absolute = resolve(root, path);
      if (
        !inside(resolve(root), absolute) ||
        !inside(canonicalRoot, realpathSync(absolute)) ||
        !statSync(absolute).isFile()
      )
        throw new Error('Unsafe file');
      return readFileSync(absolute);
    } catch {
      errors.push(
        `Required file is missing, unreadable or outside the repository: ${path}`,
      );
      return null;
    }
  };
  const read = (path) => {
    return bytes(path)?.toString('utf8').replaceAll('\r\n', '\n') ?? '';
  };
  const json = (path) => {
    try {
      return JSON.parse(read(path));
    } catch {
      errors.push(`Invalid JSON: ${path}`);
      return null;
    }
  };
  const metadata = json('workshop.json');
  errors.push(...validateMetadata(metadata));
  errors.push(...validateGuide(read('README.md'), metadata));
  errors.push(...validateSecurity(read('SECURITY.md')));
  errors.push(...validatePackage(json('package.json')));
  for (const path of [
    'THIRD-PARTY-NOTICES.md',
    'assets/screenshots/SOURCES.md',
    'tools/verify-content.mjs',
    'test/content.test.mjs',
  ])
    read(path);
  const license = read('LICENSE');
  if (!license.includes('MIT License') || !license.includes('CC BY 4.0'))
    errors.push('Keep the MIT license and separate GitHub Docs CC BY notice.');
  const attributes = read('.gitattributes');
  if (
    !/^\* text=auto eol=lf$/m.test(attributes) ||
    !/^\*\.png binary$/m.test(attributes)
  )
    errors.push('Require LF text and binary PNG attributes.');
  const ignored = read('.gitignore').split('\n');
  if (
    !['node_modules/', '.artifacts/', '.env', '.env.*', '*.tsv', '*.csv'].every(
      (path) => ignored.includes(path),
    )
  )
    errors.push(
      'Ignore dependencies, artifacts, credentials and local data exports.',
    );
  errors.push(
    ...validateVerificationWorkflow(read('.github/workflows/verify.yml')),
  );
  errors.push(...validateMonaWorkflow(read('.github/workflows/mona.yml')));
  const workflowDirectory = resolve(root, '.github/workflows');
  if (
    existsSync(workflowDirectory) &&
    readdirSync(workflowDirectory).sort().join('|') !== 'mona.yml|verify.yml'
  )
    errors.push(
      'Only the read-only verification workflow and pinned Mona caller are allowed.',
    );
  const checklist = 'work/release-checklist.md';
  errors.push(
    ...validateChecklist(
      existsSync(resolve(root, checklist)) ? read(checklist) : null,
      metadata?.lab,
    ),
  );
  for (const file of markdownFiles(root)) {
    const markdown = read(file);
    errors.push(...validateLocalLinks(root, markdown, file));
    // Historical reports and inherited attribution are not current learner instructions.
    const instructions = ['README.md', 'SECURITY.md'].includes(file);
    errors.push(
      ...validateSafety(
        file === 'README.md' ? learnerContent(markdown) : markdown,
        { instructions },
      ).map((error) => `${file}: ${error}`),
    );
  }
  if ([2, 3].includes(metadata?.lab)) {
    for (const step of [1, 2, 3, 4]) {
      const image = `assets/screenshots/lab-${metadata.lab}-step-${step}.png`;
      errors.push(
        ...validatePng(bytes(image)).map((error) => `${image}: ${error}`),
      );
    }
  }
  return [...new Set(errors)];
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = verifyContent();
  if (errors.length > 0) {
    console.error(
      `Standalone verification failed:\n${errors.map((error) => `- ${error}`).join('\n')}`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      'Offline standalone verification passed: 4 steps, 45 minutes (35-minute continuation), 4 valid PNGs, pinned runtime and resolved local links. This is not live Project evidence.',
    );
  }
}
