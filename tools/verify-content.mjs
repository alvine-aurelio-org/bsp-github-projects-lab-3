import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const starterRepository = 'alvine-aurelio-org/bsp-github-projects-lab-1';
export const contracts = {
  2: {
    title: 'Plan and complete sprint work',
    times: [8, 7, 12, 8],
    commands: ['/done 2-1', '/check 2-2', '/check 2-3 #YOUR_PR_NUMBER', '/check 2-4 #YOUR_PR_NUMBER'],
    evidence: ['SELF-CONFIRMED', 'REPOSITORY-VERIFIED', 'REPOSITORY-VERIFIED', 'MIXED EVIDENCE'],
  },
  3: {
    title: 'Visualize and communicate',
    times: [10, 8, 7, 10],
    commands: ['/done 3-1', '/done 3-2', '/done 3-3', '/done 3-4'],
    evidence: ['SELF-CONFIRMED', 'SELF-CONFIRMED', 'SELF-CONFIRMED', 'SELF-CONFIRMED'],
  },
};

export function stepSections(markdown) {
  const headings = [...markdown.matchAll(/^## (.+)\r?$/gm)];
  return headings.flatMap((heading, index) => {
    const step = /^Step (\d+) \u2014 (.+?)\r?$/.exec(heading[1]);
    return step ? [{
      number: Number(step[1]),
      text: markdown.slice(heading.index, headings[index + 1]?.index ?? markdown.length),
    }] : [];
  });
}

export function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return ['Metadata must be an object.'];
  const errors = [];
  const keys = ['schemaVersion', 'role', 'lab', 'title', 'minutes', 'starterRepository'].sort();
  if (Object.keys(metadata).sort().join('|') !== keys.join('|')) errors.push('Metadata must keep the minimal companion schema.');
  if (metadata.schemaVersion !== 1 || metadata.role !== 'companion') errors.push('Metadata must declare schemaVersion 1 and role companion.');
  if (!contracts[metadata.lab] || ![2, 3].includes(metadata.lab)) errors.push('Metadata lab must be 2 or 3.');
  if (metadata.title !== contracts[metadata.lab]?.title) errors.push('Metadata title does not match the lab.');
  if (metadata.minutes !== 35) errors.push('Metadata total must be 35 minutes.');
  if (metadata.starterRepository !== starterRepository) errors.push('Metadata must point to the sole Lab 1 starter.');
  return errors;
}

export function validateSafety(text, { instructions = true } = {}) {
  const errors = [];
  if (/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(text)) errors.push('Credential-shaped text must not be published.');
  if (!instructions) return errors;
  if (/\b(?:create|generate|paste|enter|provide|set|store|add|export)\s+(?:(?:a|an|your|the|new|repository)\s+)*(?:personal access token|PAT\b|GH_TOKEN\b|GITHUB_TOKEN\b)/i.test(text)) errors.push('Do not request a participant token or secret.');
  if (/\bgit\s+clone\b|\bgh\s+repo\s+(?:create|fork|clone)\b|\bgh\s+project\s+create\b|\/generate\b|Use this template/i.test(text)) errors.push('Do not introduce a new learner repository or Project initialization.');
  if (/^\s*(?:[-*]|\d+\.)?\s*(?:create|make|initialize)\s+(?:(?:a|another|second|additional|new|private|learner)\s+)+(?:repository|project)\b/im.test(text)) errors.push('Do not require an additional learner repository or Project.');
  return errors;
}

export function validateGuide(markdown, metadata) {
  const contract = contracts[metadata?.lab];
  if (!contract) return ['Cannot validate a guide without a valid lab.'];
  const errors = validateSafety(markdown);
  const steps = stepSections(markdown);
  if (steps.length !== 4 || (markdown.match(/^## Step\b/gm) ?? []).length !== 4 || steps.map((step) => step.number).join(',') !== '1,2,3,4') errors.push('Exactly four ordered Step 1 through Step 4 sections are required.');
  const times = steps.map((step) => Number(/\*\*Time: (\d+) minutes/.exec(step.text)?.[1]));
  if (times.reduce((sum, time) => sum + time, 0) !== 35 || times.join(',') !== contract.times.join(',')) errors.push('Step times must match the starter and total 35 minutes.');
  for (const [index, step] of steps.entries()) {
    for (const label of ['Topic:', '**Why:**', '**Do:**', '**Expected result:**']) {
      if (!step.text.includes(label)) errors.push(`Step ${step.number} is missing ${label}`);
    }
    const commands = (step.text.match(/^\/(?:done|check|project) .+$/gm) ?? []).map((command) => command.trim());
    if (commands.length !== 1 || commands[0] !== contract.commands[index]) errors.push(`Step ${step.number} has the wrong completion command.`);
    if (!step.text.includes(`**${contract.evidence[index]}:**`)) errors.push(`Step ${step.number} has the wrong evidence class.`);
    const image = `assets/screenshots/lab-${metadata.lab}-step-${step.number}.png`;
    if (!(step.text.match(/!\[[^\]\r\n]+\]\(([^)]+)\)/g) ?? []).some((reference) => reference.endsWith(`](${image})`))) errors.push(`Step ${step.number} must show its own screenshot with alt text.`);
  }
  const images = [...markdown.matchAll(/!\[[^\]\r\n]*\]\(([^)]+)\)/g)].map((match) => match[1]);
  const expectedImages = [1, 2, 3, 4].map((step) => `assets/screenshots/lab-${metadata.lab}-step-${step}.png`);
  if (images.join('|') !== expectedImages.join('|')) errors.push('Exactly the four lab screenshot references are required, once each in order.');
  const welcome = markdown.slice(0, markdown.indexOf('## Step 1'));
  for (const label of ['Who is this for?', 'What will you learn?', 'What will you build?', 'How long?', 'Prerequisites:']) {
    if (!welcome.includes(label)) errors.push(`Welcome is missing ${label}`);
  }
  if (!welcome.includes(`](https://github.com/${starterRepository})`) || !welcome.includes('do not copy, fork or clone this companion')) errors.push('A prominent continue-in-Lab-1 link and no-copy warning are required.');
  if (!welcome.includes('Mona lives in your own existing Lab 1 copy') || !welcome.includes('one private repository and one private Project')) errors.push('Explain the existing private workspace and where Mona lives.');
  if (metadata.lab === 2) {
    for (const literal of ['- [x] Publish the service release checklist', 'work/release-checklist.md', 'workshop/release-checklist', 'Closes #YOUR_IMPLEMENTATION_ISSUE_NUMBER', 'Keep the PR open until Mona confirms Step 2-3 passed', 'not independent review or self-approval']) {
      if (!markdown.includes(literal)) errors.push(`Lab 2 is missing required instruction: ${literal}`);
    }
    if (/Closes #\d+\b/.test(markdown)) errors.push('Use the actual-issue placeholder, not a fictional closing number.');
  } else {
    for (const literal of ['Status updates', 'Add update', 'At risk', 'Save update', 'Export view data', 'TSV locally', 'Do not commit, upload or attach the export', 'Verification remains open']) {
      if (!markdown.includes(literal)) errors.push(`Lab 3 is missing required instruction: ${literal}`);
    }
  }
  return errors;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function validatePng(bytes) {
  try {
    const require = (condition, message) => { if (!condition) throw new Error(message); };
    require(Buffer.isBuffer(bytes) && bytes.length >= 45, 'PNG is absent or truncated.');
    require(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid PNG signature.');
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
      require(crc32(bytes.subarray(offset + 4, offset + 8 + length)) === bytes.readUInt32BE(offset + 8 + length), 'PNG chunk checksum failed.');
      if (offset === 8) require(type === 'IHDR', 'PNG must start with IHDR.');
      if (type === 'IHDR') {
        require(!header && length === 13, 'Invalid or duplicate PNG header.');
        header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], color: body[9], interlace: body[12] };
        require(header.width > 0 && header.height > 0, 'PNG dimensions must be positive.');
        const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
        require(depths[header.color]?.includes(header.depth), 'Invalid PNG color type or bit depth.');
        require(body[10] === 0 && body[11] === 0 && [0, 1].includes(header.interlace), 'Invalid PNG compression, filter or interlace method.');
      }
      if (type === 'IDAT') imageData.push(body);
      offset = end;
      if (type === 'IEND') {
        require(length === 0, 'Invalid PNG end chunk.');
        ended = true;
        break;
      }
    }
    require(header && ended && offset === bytes.length && imageData.length > 0, 'PNG image data or final end chunk is missing.');
    const pixels = inflateSync(Buffer.concat(imageData), { maxOutputLength: 128 * 1024 * 1024 });
    require(pixels.length > 0, 'PNG has no decoded pixel data.');
    if (header.interlace === 0) {
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.color];
      const rowBytes = 1 + Math.ceil(header.width * channels * header.depth / 8);
      require(pixels.length === header.height * rowBytes, 'PNG pixel data length does not match its dimensions.');
      for (let row = 0; row < header.height; row += 1) require(pixels[row * rowBytes] <= 4, 'Invalid PNG row filter.');
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
  const links = [...markdown.matchAll(/!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\s*\)/g)];
  for (const link of links) {
    const target = link[1] ?? link[2];
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
    if (/^[a-z][a-z\d+.-]*:|\\/i.test(target)) {
      errors.push(`${fromFile}: unsupported local link.`);
      continue;
    }
    let localPath;
    try { localPath = decodeURIComponent(target.split(/[?#]/)[0]); } catch { errors.push(`${fromFile}: invalid URL encoding.`); continue; }
    const absolute = resolve(dirname(resolve(root, fromFile)), localPath);
    if (!inside(resolve(root), absolute)) errors.push(`${fromFile}: local link escapes this standalone companion.`);
    else if (!existsSync(absolute) || !statSync(absolute).isFile()) errors.push(`${fromFile}: missing local link ${localPath}`);
    else if (!inside(realpathSync(root), realpathSync(absolute))) errors.push(`${fromFile}: local link resolves outside this companion.`);
  }
  return errors;
}

export function markdownFiles(root, directory = root) {
  const ignored = new Set(['.git', 'node_modules', '.artifacts', 'coverage', '.vscode', '.idea']);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory() && !ignored.has(entry.name)) return markdownFiles(root, absolute);
    return entry.isFile() && entry.name.endsWith('.md') ? [relative(root, absolute)] : [];
  });
}

export function verifyContent(root = repositoryRoot) {
  const errors = [];
  const read = (path) => {
    try { return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n'); }
    catch { errors.push(`Required file is missing or unreadable: ${path}`); return ''; }
  };
  const json = (path) => {
    try { return JSON.parse(read(path)); }
    catch { errors.push(`Invalid JSON: ${path}`); return null; }
  };
  const metadata = json('workshop.json');
  errors.push(...validateMetadata(metadata));
  errors.push(...validateGuide(read('README.md'), metadata));
  const manifest = json('package.json');
  if (manifest?.engines?.node !== '>=22' || manifest?.type !== 'module') errors.push('Author tooling must support Node 22+ ES modules.');
  if (manifest?.scripts?.test !== 'node --test --test-reporter=tap' || manifest?.scripts?.verify !== 'node tools/verify-content.mjs') errors.push('Use the dependency-free Node test and verify scripts.');
  if (['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].some((key) => manifest && key in manifest)) errors.push('Companion packages must not declare npm dependencies.');
  for (const path of ['SECURITY.md', 'THIRD-PARTY-NOTICES.md', 'assets/screenshots/SOURCES.md', 'tools/verify-content.mjs', 'test/content.test.mjs']) read(path);
  const license = read('LICENSE');
  if (!license.includes('MIT License') || !license.includes('CC BY 4.0')) errors.push('Keep the MIT license and separate GitHub Docs CC BY notice.');
  const attributes = read('.gitattributes');
  if (!/^\* text=auto eol=lf$/m.test(attributes) || !/^\*\.png binary$/m.test(attributes)) errors.push('Require LF text and binary PNG attributes.');
  const ignored = read('.gitignore').split('\n');
  if (!['node_modules/', '.artifacts/', '.env', '.env.*', '*.tsv', '*.csv'].every((path) => ignored.includes(path))) errors.push('Ignore dependencies, artifacts, credentials and local data exports.');
  const workflow = read('.github/workflows/verify.yml');
  const refs = [...workflow.matchAll(/^\s+uses:\s+([^\s#]+)/gm)].map((match) => match[1]);
  if (refs.join('|') !== 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262|actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020') errors.push('Use only the two approved, fully pinned official Actions.');
  const events = [...(workflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1] ?? '').matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1]);
  if (events.join('|') !== 'push|pull_request|workflow_dispatch' || !workflow.includes('    branches: [main]')) errors.push('CI must run on push main, pull_request and workflow_dispatch only.');
  if ((workflow.match(/^permissions:\n([\s\S]*?)^jobs:/m)?.[1] ?? '').trim() !== 'contents: read' || (workflow.match(/\bpermissions:/g) ?? []).length !== 1 || /secrets\.|:\s*write\b|write-all/.test(workflow)) errors.push('CI must have contents read only and no secrets.');
  if (!workflow.includes('persist-credentials: false') || !/node-version: ['"]?24['"]?$/m.test(workflow)) errors.push('CI must use Node 24 without persisted checkout credentials.');
  const runs = [...workflow.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => match[1]);
  if (runs.join('|') !== 'node tools/verify-content.mjs|node --test --test-reporter=tap') errors.push('CI must run only static content verification and Node tests.');
  const workflowDirectory = resolve(root, '.github/workflows');
  if (existsSync(workflowDirectory) && readdirSync(workflowDirectory).sort().join('|') !== 'verify.yml') errors.push('Companions must not contain Mona or bootstrap workflows.');
  for (const file of markdownFiles(root)) {
    const markdown = read(file);
    errors.push(...validateLocalLinks(root, markdown, file));
    // Attribution can name a source UI control without instructing learners to use it.
    const instructions = ['README.md', 'SECURITY.md'].includes(file);
    errors.push(...validateSafety(markdown, { instructions }).map((error) => `${file}: ${error}`));
  }
  if ([2, 3].includes(metadata?.lab)) {
    for (const step of [1, 2, 3, 4]) {
      const image = `assets/screenshots/lab-${metadata.lab}-step-${step}.png`;
      try { errors.push(...validatePng(readFileSync(resolve(root, image))).map((error) => `${image}: ${error}`)); }
      catch { errors.push(`Actual PNG is missing or unreadable: ${image}`); }
    }
  }
  return [...new Set(errors)];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = verifyContent();
  if (errors.length > 0) {
    console.error(`Companion verification failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('Offline companion verification passed: 4 steps, 35 minutes, 4 valid PNGs and resolved local links. This is not live Project evidence.');
  }
}
