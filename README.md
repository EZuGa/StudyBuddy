# Studydeck

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.6.

## Terminology quizzes

The **Terminology** navigation page contains a separate, subject-first collection of written-only quizzes. Definitions can be typed or written on paper, then self-checked against example answers in either feedback mode. Scores use the same device-local history as chapter tests, with separate quiz IDs.

Permanent terminology quizzes live in `public/tests/terminology.json`; regular chapter and midterm tests live in `public/tests/tests.json`. The app loads both files. Terminology quizzes use only `"written"` questions, each with a `prompt` and `exampleAnswer`, and are automatically categorized as terminology when loaded from their file. Keep `category: "terminology"` when sharing them as imports. The parser rejects other question types in terminology quizzes. The Terminology page's import dialog and downloadable template support this format; browser imports remain session-only. Either project file can contain an empty array when that collection has no quizzes.

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
