# Copy-paste request for a fresh AI chat

Attach AI_DATA_GUIDE.md, library.schema.json, and examples/library.example.json first. Replace the bracketed fields below, then paste the chapter.

```text
Follow the attached AI_DATA_GUIDE.md and library.schema.json.
The example shows the format only; do not reuse its subject matter
unless it is actually covered by the chapter I provide.

Subject: [exact subject name, e.g. Networking]
Chapter(s): [e.g. Chapter 3]
Chapter title(s): [title]
Unique ID prefix: [e.g. networking-ch3]
Generate: [ordinary test / terminology quiz / both]
Kind: [chapter / midterm]
Output language: [e.g. English]
Question count and difficulty: [specify, or choose a reasonable balanced set]
Existing chapter/quiz/question IDs: [attach existing data or say not provided]

Use only the source below. Flag missing or conflicting information.
Produce only requested chapter additions, not complete library replacements.
If updating an existing chapter, preserve its ID and put additions inside
that same chapter; do not create a separate chapter for terminology.
Use one shared term-definition entry for both terminology directions.
Return one library.additions.json array of chapter objects. Each chapter
must contain quiz and/or terminology as nested objects. Put both inside
the SAME chapter when both are requested. Store subject, chapter title,
and kind only on the parent; do not add category fields. Only midterms
have a chapters array of covered chapter titles. Add brief source-review
notes outside JSON.
Do not edit the app or deploy anything.

BEGIN CHAPTER
[paste chapter here]
END OF CHAPTER
```

## If the chapter needs several messages

Before sending the first part, say:

```text
I will send the chapter in numbered parts. Acknowledge each part only.
Wait for END OF CHAPTER before generating anything. Tell me if earlier
parts are no longer available to you rather than guessing their contents.
```

Use `PART 1 OF N`, `PART 2 OF N`, and so on. Send the completed metadata request with the first part or immediately after the last part.

## Optional second-pass review

```text
Review the generated JSON against the supplied chapter and library.schema.json.
Check every answer key, missing concepts, ambiguous distractors, duplicate
IDs/questions, matching pairs, terminology aliases, and definitions that
reveal the reverse answer. List issues by question ID. Do not silently
change IDs. Return corrected additions only if corrections are needed,
and distinguish checks you actually ran from checks you only inspected.
```
