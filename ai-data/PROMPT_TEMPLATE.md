# Copy-paste request for a fresh AI chat

Attach the guide, both schemas, and both JSON examples first. Replace the bracketed fields below, then paste the chapter.

```text
Follow the attached AI_DATA_GUIDE.md and StudyDeck JSON schemas.
The example files show the format only; do not reuse their subject matter
unless it is actually covered by the chapter I provide.

Subject: [exact subject name, e.g. Networking]
Chapter(s): [e.g. Chapter 3]
Chapter title(s): [title]
Unique ID prefix: [e.g. networking-ch3]
Generate: [ordinary test / terminology quiz / both]
Kind: [chapter / midterm]
Output language: [e.g. English]
Question count and difficulty: [specify, or choose a reasonable balanced set]
Existing quiz/question IDs: [attach existing data or say not provided]

Use only the source below. Flag missing or conflicting information.
Produce only new quiz objects, not replacements for existing collections.
Use one shared term-definition entry for both terminology directions.
Return separate tests.additions.json and terminology.additions.json files
for the requested collections, plus brief source-review notes outside JSON.
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
Review the generated JSON against the supplied chapter and schemas.
Check every answer key, missing concepts, ambiguous distractors, duplicate
IDs/questions, matching pairs, terminology aliases, and definitions that
reveal the reverse answer. List issues by question ID. Do not silently
change IDs. Return corrected additions only if corrections are needed,
and distinguish checks you actually ran from checks you only inspected.
```
