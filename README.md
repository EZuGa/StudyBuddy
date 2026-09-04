# Studydeck

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.6.

## Generate new quizzes with AI

The portable [AI data kit](ai-data/README.md) contains a standalone guide, a combined JSON schema and example, a copy-paste prompt, and a read-only validator. Attach its three reference files in a fresh AI conversation, then paste your book chapter. Start with [the prompt template](ai-data/PROMPT_TEMPLATE.md).

Run `npm run validate:data` to check the combined library, or `npm run validate:data -- --library path/to/library.additions.json --against-project` to check additions for structural mistakes and ID collisions. Source accuracy still requires review. No existing quizzes, saved scores, or favorites are changed by validation.

## One chapter-based library

Navigate **Test library → subject → chapter → test or terminology**. Both quiz categories live together in `public/tests/library.json`, one flat array of quiz objects. The `category` field is `general` or `terminology`; `subject` and `chapters` determine where a quiz appears. Use the same chapter labels for its test and terminology quiz. Midterms list all included chapters and appear under each, without duplicating their data.

The former separate collections have been merged. All existing quiz IDs, question IDs, answers, and ordering within quizzes are preserved, so score history and favorites still work. Import quizzes accepts either or both categories, and its downloadable template includes both. Browser imports are temporary; add permanent content to the combined project file.

## Terminology quizzes

Choose a **Terminology** quiz inside any chapter. On its start screen, choose **Standard (term → definition)** to type or handwrite definitions and self-check them, or **Inverted (definition → term)** to type automatically graded terms. Both support immediate feedback or answers at the end. **Practice again** reopens these choices, with your previous settings selected. Scores share the quiz ID but track the direction separately; previous terminology scores count as Standard.

Every terminology question in `public/tests/library.json` stores one shared object with `id`, `type: "written"`, `term`, and `definition`. Both directions read this same entry—there are no separate reverse quizzes or duplicated definitions. Optional `acceptedTerms` lists alternate answers for reverse grading, which ignores capitalization, extra whitespace, trailing sentence punctuation, and hyphen differences.

```json
{ "id": "lan", "type": "written", "term": "LAN", "definition": "A network covering a small geographic area.", "acceptedTerms": ["Local area network"] }
```

Keep `category: "terminology"` on the quiz when sharing it as an import. Older written `prompt`/`exampleAnswer` entries still work in the ordinary direction; reverse practice requires explicit term–definition entries. The combined project library may be an empty array.

## Favorites practice

Use the star on any question or terminology entry while answering, self-checking, or reviewing results. Each quiz keeps its own favorites list. Open **Practice favorites** on its card, or choose **Favorites only** in the start screen, to view/remove favorites and practice just those entries. Both feedback modes and both terminology directions are supported. A matching question is saved as one item, including all its pairs.

Only quiz/question IDs are saved in `studydeck-favorites-v1` in localStorage; question content remains in the project JSON files. Standard and Inverted share the same favorites. Removed or unknown question IDs are ignored. If browser storage is unavailable, favorites work for the session and the app shows a notice.

Favorites sessions use a fixed question selection for the current run, so removing a star does not skip questions or change that run's score. Retaking uses the current favorites list. Favorites scores are labeled separately in history and do not replace full-test last/best scores; older scores remain full-test attempts.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
"# TestApp" 
