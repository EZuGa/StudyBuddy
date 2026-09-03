# StudyDeck AI data kit

Use this folder to give any LLM the context it needs to turn a book chapter into compatible data. No account-specific setup, custom model, or training is required.

## What to give the AI

Attach these five files to a fresh conversation:

1. `AI_DATA_GUIDE.md`
2. `tests.schema.json`
3. `terminology.schema.json`
4. `examples/tests.example.json`
5. `examples/terminology.example.json`

Then fill in `PROMPT_TEMPLATE.md` and paste your chapter. The examples are complete formatting demonstrations; they must not be copied into a different chapter's output. Their tiny demonstration source is in `examples/SOURCE_EXCERPT.md` if you want to test the process.

If attachments are unavailable, paste the guide and schemas as reference material. The model does not automatically see files in this repository. For long chapters, send numbered parts and finish with `END OF CHAPTER`.

## Validate the generated files

Run these commands from the project directory after installing project dependencies with `npm ci` (only if needed):

```sh
# Check the current project collections, without modifying them.
npm run validate:data

# Check the supplied examples.
npm run validate:data -- --examples

# Check both additions and detect collisions with existing project IDs.
npm run validate:data -- --tests "path/to/tests.additions.json" --terminology "path/to/terminology.additions.json" --against-project

# Check only terminology additions.
npm run validate:data -- --terminology "path/to/terminology.additions.json" --against-project

# Run regression checks for the validator.
npm run test:data
```

Replace `path/to/...` with the files you received. Input paths are relative to your terminal's current directory; quote paths containing spaces. For complete replacement-file review, omit `--against-project` so the file is not compared against itself. `--examples` is a standalone mode.

Errors fail validation (exit code 1). Warnings ask for manual review but do not fail it. A passing result does not prove that answers agree with the book. The schemas deliberately enforce a cleaner generation format than the app's permissive legacy import parser; for example, new terminology must use shared term–definition objects.

## Add reviewed data safely

Try each file through its matching app page's Import action. This is temporary. For permanent storage, append ordinary quiz objects into `public/tests/tests.json` and terminology quiz objects into `public/tests/terminology.json`. Preserve the surrounding array and existing entries. Re-run `npm run validate:data` after merging. Do not change IDs belonging to previously completed quizzes casually.

The validator never writes, imports, merges, or deploys data. It uses the project's development dependency `ajv`; the schemas themselves are standalone Draft 7 JSON Schemas with no external references. The kit contains no book chapters, account credentials, or score history.

When the app's data format changes, update the schemas, guide, examples, validator, and compatibility tests together. The relevant app source is `src/app/models.ts`, `src/app/test-data.service.ts`, and the grading functions in `src/app/app.ts`.

## Downloadable copy

The project also includes `public/ai-data-kit.zip`, served at `/ai-data-kit.zip` on the private site. Unzip it before attaching the five reference files if your AI chat does not read ZIP files. The archive contains this kit only, not the student's live quizzes or scores.

After changing any kit files, regenerate the archive from the project directory (PowerShell):

```powershell
Compress-Archive -Path ai-data -DestinationPath public/ai-data-kit.zip -Force
```
