# Alavo Library

Open learning content for [Alavo](https://chromewebstore.google.com/detail/alavo-%E2%80%94-smart-vocabulary/conipkingmplphabcmllnggkppalmagj), organized by language pair.

## What is inside

- **Vocabulary packs**: a named list of words with meanings, pronunciation and example sentences. Example: [Daily routines](vocabulary/en-vi/daily-routines-a1/).
- **Grammar courses**: an ordered set of short lessons, each with optional practice exercises. Example: [Present tenses](grammar/en-vi/present-tenses/).

## Key terms

- **Language pair**: two language codes joined by a dash, `<source>-<target>`. `en-vi` means "learning English, explained in Vietnamese". The first code is the language being learned, the second is the learner's own language.
- **Pack**: one folder holding one vocabulary pack or one grammar course.
- **Manifest**: the `manifest.json` file inside a pack. It describes the pack (title, level, version) and lists the files that belong to it.
- **Catalog**: `catalog/<pair>.json`, a list with one short entry per pack in that language pair. `catalog/index.json` lists the pairs themselves, so a reader can tell which catalogs exist without guessing file names.
- **CEFR level**: the standard scale for language ability, from `A1` (beginner) to `C2` (near native).

## Folder layout

```
catalog/
  index.json                       generated: the language pairs the library has packs for
  en-vi.json                       generated, do not edit by hand
vocabulary/
  en-vi/
    daily-routines-a1/
      manifest.json
      README.md                    generated table of the words, readable on GitHub
      words-001.json
      words-002.json
grammar/
  en-vi/
    present-tenses/
      manifest.json
      present-simple/
        lesson.md
        exercises.json
      present-continuous/
        lesson.md
        exercises.json
schema/                            JSON Schema files that define every format
scripts/build.mjs                  validates content and generates the derived fields
```

## Contributing

You need Node.js 20 or newer.

```
npm install
npm run build      # validate everything and regenerate the generated files
npm run check      # same validation, but fails if a generated file is stale
```

`npm run build` fills in what you should not write by hand: word counts, file lists, `sha256` hashes (a short fingerprint of a file's content), the catalog and the `README.md` table inside each vocabulary pack. Run it after every content change and commit the files it updates. The GitHub check runs `npm run check` on every pull request and fails if you forgot.

[CONTRIBUTING.md](CONTRIBUTING.md) explains how to add a pack and the exact file formats.

## Licensing

- **Code** (`scripts/`, `schema/`, `.github/`) is under the [MIT License](LICENSE).
- **Content** (`vocabulary/`, `grammar/`, `catalog/`) written by the Alavo contributors is dedicated to the public domain under [CC0 1.0](LICENSE-CONTENT).

Each pack also declares its own `license` in its manifest, and `source` says where the content came from. A pack taken from another source keeps that source's license. Only add content you wrote yourself or content whose license allows redistribution. By opening a pull request you agree that your contribution is released under the license that covers the files you changed.
