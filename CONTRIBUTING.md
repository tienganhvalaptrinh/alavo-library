# Contributing

Every change follows the same loop: edit files, run `npm run build`, commit the result, open a pull request. The build script rejects anything that does not match the formats below.

## Add a vocabulary pack

1. Create `vocabulary/<source>-<target>/<pack-id>/`. The pack id is lowercase words joined by dashes, for example `travel-a2`.
2. Write `manifest.json` with only the descriptive fields:

```json
{
  "id": "travel-a2",
  "type": "vocabulary",
  "title": "Travel",
  "description": "Words for airports, hotels and getting around.",
  "category": "travel",
  "level": "A2",
  "order": 1,
  "sourceLang": "en",
  "targetLang": "vi",
  "version": "1.0.0",
  "license": "CC0-1.0",
  "source": "Written by <your name>"
}
```

3. Write one or more `words-001.json`, `words-002.json`, ... files. Each file is an array of words. Put up to 2000 words in a file, and start a new file when you pass that.

```json
[
  {
    "word": "luggage",
    "phonetic": "/ˈlʌɡɪdʒ/",
    "definition": "bags and suitcases you take on a trip",
    "translation": "hành lý",
    "exampleSentence": "Please keep your luggage with you.",
    "exampleTranslation": "Xin hãy giữ hành lý bên mình.",
    "pos": "noun",
    "difficultyLevel": "A2"
  }
]
```

Only `word` is required, plus at least one of `definition` or `translation`. `exampleSentence` is in the language being learned and `exampleTranslation` is the same sentence in the learner's language. `pos` (part of speech) is lowercase, such as `noun` or `verb`. `difficultyLevel` is a CEFR level. `audioUrl`, when present, must start with `https://`. The same word with the same `pos` cannot appear twice in one pack.

4. Run `npm run build`. It adds `wordCount` and `files` (with hashes) to your manifest, adds the pack to `catalog/<pair>.json`, and writes a `README.md` next to the words, a table that GitHub shows when someone opens the pack folder. Never edit that `README.md` by hand, because the next build overwrites it.

## Add a grammar course

1. Create `grammar/<source>-<target>/<course-id>/`.
2. Write `manifest.json` with the descriptive fields and the lessons in teaching order. Each lesson needs an `id`, a `title` and a CEFR `level`:

```json
{
  "id": "past-tenses",
  "type": "grammar",
  "title": "Past tenses",
  "description": "Talk about things that already happened.",
  "category": "tenses",
  "level": "A2",
  "order": 1,
  "sourceLang": "en",
  "targetLang": "vi",
  "version": "1.0.0",
  "license": "CC0-1.0",
  "source": "Written by <your name>",
  "lessons": [
    { "id": "past-simple", "title": "Thì quá khứ đơn", "level": "A2" }
  ]
}
```

3. For each lesson, create a folder named after its `id` with a `lesson.md` and, optionally, an `exercises.json`.
4. Run `npm run build`. It adds the `path`, `sha256`, `lessonCount` and exercise details for you.

### Lesson format

A lesson is plain Markdown: headings, paragraphs, bullet lists and bold text. The lesson is written in the learner's language (the second code of the pair), and the example sentences are in the language being learned.

Example sentences use a special block so the app can show a play button and a translation:

```
::: example
She works in a bank.
Cô ấy làm việc ở ngân hàng.
:::
```

The first line is the sentence being learned, the second line is its translation. A block with any other number of lines fails the build. Raw HTML is not allowed.

### Exercise format

`exercises.json` is an array. The app compares fill-in answers after trimming spaces and ignoring upper or lower case. There are two exercise types.

A multiple choice exercise gives `options` and the zero-based index of the right one in `answer`:

```json
{
  "id": "goes-to-school",
  "type": "choice",
  "prompt": "She ___ to school every day.",
  "options": ["go", "goes", "going"],
  "answer": 1,
  "explanation": "She is third person singular, so the verb takes -es: goes."
}
```

A fill-in-the-blank exercise marks the gap with `___` in the prompt and lists every accepted answer:

```json
{
  "id": "he-watches-tv",
  "type": "fill-blank",
  "prompt": "He ___ (watch) TV in the evening.",
  "answers": ["watches"],
  "explanation": "Watch ends in -ch, so it takes -es: watches."
}
```

## Order of packs and lessons

Learners see packs from easiest to hardest, so every manifest has an `order` number (1 or higher). The catalog sorts packs of the same type first by `level` (A1 to C2, then `mixed`), then by `order`, then by `id`. Two packs of the same type and level cannot share an `order`, and the build fails if they do. Numbering is per language pair, because each pair has its own folder and its own catalog, so `en-vi` and `en-ja` can order the same topics differently.

Lessons inside a grammar course are shown in the order of the `lessons` array in the manifest, so write them in the order you want them taught.

## Link related packs

`relatedPacks` lists packs that go well together, for example a grammar course and a vocabulary pack on the same topic. Each entry has the `type` and `id` of the other pack.

## Change a pack that already exists

Raise `version` in the manifest when you change content. Use a patch number (`1.0.1`) for typo fixes and a minor number (`1.1.0`) when you add words or lessons. The app uses the version to tell learners that an update is available.
