import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';
import Ajv from 'ajv';
import { renderVocabularyReadme } from './vocabulary-readme.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const PACK_TYPES = ['vocabulary', 'grammar'];
const HEADER_KEYS = [
  'id',
  'type',
  'title',
  'description',
  'category',
  'level',
  'order',
  'sourceLang',
  'targetLang',
  'version',
  'license',
  'source',
  'coverUrl',
  'relatedPacks',
];
const LEVEL_RANK = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'mixed'];
const WORDS_FILE = /^words-\d{3}\.json$/;
const FORBIDDEN_MARKUP = /<\s*(script|iframe|object|embed)/i;
const EXAMPLE_BLOCK = /^::: example\n([\s\S]*?)\n:::$/gm;
const EXAMPLE_OPENER = /^::: example$/gm;

const checkOnly = process.argv.includes('--check');
const errors = [];
const outdated = [];
const ajv = loadSchemas();

main();

function main() {
  const manifests = findPacks().map(buildPack);
  manifests.forEach(({ pack, manifest }) => writeJson(`${pack.dir}/manifest.json`, manifest));
  manifests.filter(({ pack }) => pack.type === 'vocabulary').forEach(writeVocabularyReadme);
  const catalogs = buildCatalogs(manifests);
  Object.entries(catalogs).forEach(([pair, entries]) => writeJson(`catalog/${pair}.json`, entries));
  writeJson('catalog/index.json', buildCatalogIndex(catalogs));
  flagStaleCatalogs(Object.keys(catalogs));
  report();
}

function report() {
  errors.forEach((message) => console.error(`error: ${message}`));
  outdated.forEach((file) => console.error(`out of date: ${file}`));
  if (errors.length > 0) process.exit(1);
  if (outdated.length > 0) {
    console.error('Generated files are stale. Run "npm run build" and commit the result.');
    process.exit(1);
  }
  console.log(checkOnly ? 'All content is valid and up to date.' : 'Build finished.');
}

function loadSchemas() {
  const instance = new Ajv({ allErrors: true, strict: true, strictRequired: false });
  readdirSync('schema').forEach((file) => {
    instance.addSchema(readJson(`schema/${file}`));
  });
  return instance;
}

function findPacks() {
  return PACK_TYPES.flatMap((type) =>
    listDirs(type).flatMap((pair) =>
      listDirs(`${type}/${pair}`).map((id) => ({ type, pair, id, dir: `${type}/${pair}/${id}` })),
    ),
  );
}

function buildPack(pack) {
  const authored = readJson(`${pack.dir}/manifest.json`);
  checkHeaderMatchesFolder(pack, authored);
  const generated = pack.type === 'vocabulary' ? buildVocabulary(pack) : buildGrammar(pack, authored);
  const manifest = { ...pickKeys(authored, HEADER_KEYS), ...generated };
  validate(`${pack.type}-manifest`, manifest, `${pack.dir}/manifest.json`);
  return { pack, manifest };
}

function checkHeaderMatchesFolder(pack, authored) {
  const checks = [
    [authored.id === pack.id, `id must equal the folder name "${pack.id}"`],
    [authored.type === pack.type, `type must be "${pack.type}"`],
    [`${authored.sourceLang}-${authored.targetLang}` === pack.pair, `languages must be ${pack.pair}`],
  ];
  checks.forEach(([ok, message]) => {
    if (!ok) errors.push(`${pack.dir}/manifest.json: ${message}`);
  });
}

function buildVocabulary(pack) {
  const fileNames = readdirSync(pack.dir).filter((name) => WORDS_FILE.test(name)).sort();
  if (fileNames.length === 0) errors.push(`${pack.dir}: no words-NNN.json file`);
  const seen = new Set();
  const files = fileNames.map((name) => buildWordsFile(`${pack.dir}/${name}`, name, seen));
  const wordCount = files.reduce((total, file) => total + file.count, 0);
  return { wordCount, files };
}

function buildWordsFile(path, name, seen) {
  const words = readJson(path);
  validate('vocabulary-words', words, path);
  if (Array.isArray(words)) words.forEach((entry) => flagDuplicate(entry, seen, path));
  return { path: name, count: Array.isArray(words) ? words.length : 0, sha256: sha256(path) };
}

function writeVocabularyReadme({ pack, manifest }) {
  const words = manifest.files.flatMap((file) => readJson(`${pack.dir}/${file.path}`) ?? []);
  writeText(`${pack.dir}/README.md`, renderVocabularyReadme(manifest, words));
}

function flagDuplicate(entry, seen, path) {
  const key = `${String(entry.word).trim().toLowerCase()}|${entry.pos ?? ''}`;
  if (seen.has(key)) errors.push(`${path}: duplicate word "${entry.word}" (${entry.pos ?? 'no pos'})`);
  seen.add(key);
}

function buildGrammar(pack, authored) {
  const authoredLessons = Array.isArray(authored.lessons) ? authored.lessons : [];
  const lessons = authoredLessons.map((lesson) => buildLesson(pack, lesson));
  return { lessonCount: lessons.length, lessons };
}

function buildLesson(pack, lesson) {
  const lessonPath = `${lesson.id}/lesson.md`;
  const fullPath = `${pack.dir}/${lessonPath}`;
  if (!existsSync(fullPath)) {
    errors.push(`${fullPath}: lesson file is missing`);
    return { ...pickKeys(lesson, ['id', 'title', 'level']), path: lessonPath, sha256: '' };
  }
  checkLessonMarkdown(fullPath);
  const entry = {
    ...pickKeys(lesson, ['id', 'title', 'level']),
    path: lessonPath,
    sha256: sha256(fullPath),
  };
  const exercises = buildExercises(pack, lesson.id);
  return exercises ? { ...entry, exercises } : entry;
}

function buildExercises(pack, lessonId) {
  const exercisesPath = `${lessonId}/exercises.json`;
  const fullPath = `${pack.dir}/${exercisesPath}`;
  if (!existsSync(fullPath)) return null;
  const items = readJson(fullPath);
  validate('grammar-exercises', items, fullPath);
  if (Array.isArray(items)) checkExerciseRules(items, fullPath);
  const count = Array.isArray(items) ? items.length : 0;
  return { path: exercisesPath, count, sha256: sha256(fullPath) };
}

function checkExerciseRules(items, path) {
  const ids = new Set();
  items.forEach((item) => {
    if (ids.has(item.id)) errors.push(`${path}: duplicate exercise id "${item.id}"`);
    ids.add(item.id);
    if (item.type === 'choice' && item.answer >= item.options.length) {
      errors.push(`${path}: exercise "${item.id}" answer index is out of range`);
    }
  });
}

function checkLessonMarkdown(path) {
  const text = readFileSync(path, 'utf8');
  if (FORBIDDEN_MARKUP.test(text)) errors.push(`${path}: raw HTML such as <script> is not allowed`);
  const blocks = [...text.matchAll(EXAMPLE_BLOCK)];
  const openers = [...text.matchAll(EXAMPLE_OPENER)];
  if (blocks.length !== openers.length) errors.push(`${path}: an "::: example" block is not closed`);
  blocks.forEach((block) => {
    const lines = block[1].split('\n').filter((line) => line.trim());
    if (lines.length !== 2) {
      errors.push(`${path}: an example block needs exactly 2 lines (English, then translation)`);
    }
  });
}

function buildCatalogs(manifests) {
  const byPair = {};
  manifests.forEach(({ pack, manifest }) => {
    byPair[pack.pair] ??= [];
    byPair[pack.pair].push(toCatalogEntry(pack, manifest));
  });
  Object.entries(byPair).forEach(([pair, entries]) => {
    entries.sort(compareCatalogEntries);
    flagDuplicateOrders(pair, entries);
    validate('catalog', entries, `catalog/${pair}.json`);
  });
  return byPair;
}

function compareCatalogEntries(a, b) {
  return (
    a.type.localeCompare(b.type) ||
    LEVEL_RANK.indexOf(a.level) - LEVEL_RANK.indexOf(b.level) ||
    a.order - b.order ||
    a.id.localeCompare(b.id)
  );
}

function flagDuplicateOrders(pair, entries) {
  const seen = new Map();
  entries.forEach((entry) => {
    const key = `${entry.type}|${entry.level}|${entry.order}`;
    if (seen.has(key)) {
      errors.push(
        `${pair}: "${seen.get(key)}" and "${entry.id}" share ${entry.type} level ${entry.level} order ${entry.order}`,
      );
    }
    seen.set(key, entry.id);
  });
}

function toCatalogEntry(pack, manifest) {
  const header = pickKeys(manifest, HEADER_KEYS);
  const manifestPath = `${pack.dir}/manifest.json`;
  const size =
    pack.type === 'vocabulary'
      ? { wordCount: manifest.wordCount }
      : { lessonCount: manifest.lessonCount };
  return { ...header, manifest: manifestPath, ...size };
}

function buildCatalogIndex(catalogs) {
  const index = Object.entries(catalogs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pair, entries]) => ({
      pair,
      sourceLang: entries[0].sourceLang,
      targetLang: entries[0].targetLang,
      catalog: `catalog/${pair}.json`,
      vocabulary: entries.filter((entry) => entry.type === 'vocabulary').length,
      grammar: entries.filter((entry) => entry.type === 'grammar').length,
    }));
  validate('catalog-index', index, 'catalog/index.json');
  return index;
}

function flagStaleCatalogs(pairs) {
  if (!existsSync('catalog')) return;
  readdirSync('catalog')
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .filter((name) => !pairs.includes(name.slice(0, -5)))
    .forEach((name) => outdated.push(`catalog/${name} has no packs`));
}

function validate(schemaName, data, path) {
  const check = ajv.getSchema(`${schemaName}.schema.json`);
  if (check(data)) return;
  check.errors.forEach((error) => {
    errors.push(`${path}${error.instancePath} ${error.message}`);
  });
}

function writeJson(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path, content) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === content) return;
  if (checkOnly) {
    outdated.push(path);
    return;
  }
  mkdirSync(posix.dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return null;
  }
}

function listDirs(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function pickKeys(source, keys) {
  return Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((k) => [k, source[k]]));
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
