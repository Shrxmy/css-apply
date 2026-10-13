const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function loadTypeScriptModule(relativePath, imports = {}) {
  const filename = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "server-only") return {};
    if (Object.hasOwn(imports, specifier)) return imports[specifier];
    throw new Error(`Unexpected import ${specifier} in ${relativePath}`);
  };

  vm.runInNewContext(
    `(function (require, module, exports) { ${outputText}\n})`,
    { Object },
    { filename },
  )(localRequire, module, module.exports);
  return module.exports;
}

const questionBank = loadTypeScriptModule("src/data/techdev-exam.ts");
const answerKey = loadTypeScriptModule("src/lib/techdev-exam-key.ts");
const examSet = loadTypeScriptModule("src/lib/techdev-exam-set.ts", {
  zod: require("zod"),
  "@/data/techdev-exam": questionBank,
  "@/lib/techdev-exam-key": answerKey,
  "@/lib/prisma": { prisma: {} },
});
const review = loadTypeScriptModule("src/lib/techdev-exam-review.ts", {
  "@/lib/prisma": { prisma: {} },
});
const set = examSet.DEFAULT_TECHDEV_EXAM_SET;

const choiceQuestions = questionBank.TECHDEV_EXAM_QUESTIONS.filter(
  (question) => question.kind === "choice",
);
const writtenIds = Array.from(review.writtenQuestionIds(set));

test("automatically scores choice answers against the actual key", () => {
  const answers = { ...answerKey.TECHDEV_CHOICE_ANSWERS };
  const summary = review.summarizeTechDevScore(set, answers, {});

  assert.equal(
    summary.choiceCorrect,
    Object.keys(answerKey.TECHDEV_CHOICE_ANSWERS).length,
  );
  assert.equal(summary.choiceTotal, choiceQuestions.length);

  const missedQuestion = choiceQuestions[0];
  answers[missedQuestion.id] = "not the keyed answer";
  assert.equal(
    review.summarizeTechDevScore(set, answers, {}).choiceCorrect,
    summary.choiceCorrect - 1,
  );
});

test("written grading distinguishes partial from complete grading", () => {
  const partial = review.summarizeTechDevScore(set, 
    {},
    {
      [writtenIds[0]]: 2,
      [writtenIds[1]]: 4,
    },
  );
  assert.equal(partial.writtenPoints, 6);
  assert.equal(partial.writtenGraded, 2);
  assert.equal(partial.writtenTotal, writtenIds.length);
  assert.equal(
    partial.writtenMax,
    writtenIds.length * review.TECHDEV_WRITTEN_MAX_POINTS,
  );

  const completeScores = Object.fromEntries(writtenIds.map((id) => [id, 1]));
  const complete = review.summarizeTechDevScore(set, {}, completeScores);
  assert.equal(complete.writtenGraded, writtenIds.length);
  assert.equal(complete.writtenPoints, writtenIds.length);
});

test("a zero-point written score still counts as graded", () => {
  const summary = review.summarizeTechDevScore(set, {}, { [writtenIds[0]]: 0 });
  assert.equal(summary.writtenPoints, 0);
  assert.equal(summary.writtenGraded, 1);
});

test("cleared and missing written scores remain ungraded", () => {
  const manualScores = review.toScoreRecord(set, { [writtenIds[0]]: null });
  assert.equal(Object.keys(manualScores).length, 0);

  const summary = review.summarizeTechDevScore(set, {}, manualScores);
  assert.equal(summary.writtenPoints, 0);
  assert.equal(summary.writtenGraded, 0);
  assert.equal(
    review.reviewQuestions(set, {}, manualScores).find((q) => q.id === writtenIds[0])
      .manualScore,
    null,
  );
});

test("score normalization filters unknown and non-written question keys", () => {
  const scores = review.toScoreRecord(set, {
    [writtenIds[0]]: 3,
    "unknown-question": 5,
    [choiceQuestions[0].id]: 2,
  });

  assert.equal(Object.keys(scores).length, 1);
  assert.equal(scores[writtenIds[0]], 3);
});

test("score normalization rejects invalid numeric points", () => {
  for (const points of [-1, 6, 1.5, NaN, Infinity]) {
    assert.equal(
      Object.keys(review.toScoreRecord(set, { [writtenIds[0]]: points })).length,
      0,
    );
  }
  assert.equal(review.toScoreRecord(set, { [writtenIds[0]]: 0 })[writtenIds[0]], 0);
  assert.equal(review.toScoreRecord(set, { [writtenIds[0]]: 5 })[writtenIds[0]], 5);
});

test("applicant answer normalization keeps string values only", () => {
  const answers = review.toStringRecord({
    [choiceQuestions[0].id]: "chosen answer",
    [writtenIds[0]]: "written response",
    number: 42,
    nil: null,
    flag: false,
  });

  assert.equal(Object.keys(answers).length, 2);
  assert.equal(answers[choiceQuestions[0].id], "chosen answer");
  assert.equal(answers[writtenIds[0]], "written response");
  assert.equal(
    review
      .reviewQuestions(set, answers, {})
      .find((q) => q.id === choiceQuestions[1].id).answer,
    "",
  );
});

const customSet = {
  durationMinutes: 30,
  questions: [
    {
      id: "c-1",
      section: "React",
      prompt: "Which hook stores state?",
      kind: "choice",
      options: ["useState", "useRef"],
      answer: "useState",
    },
    { id: "w-1", section: "React", prompt: "Explain keys.", kind: "code" },
  ],
};

test("a custom A.Y. set is scored by its own key and written questions", () => {
  const parsed = examSet.techDevExamSetSchema.parse(customSet);
  const summary = review.summarizeTechDevScore(
    parsed,
    { "c-1": "useState" },
    { "w-1": 4, "git-4": 5 },
  );
  assert.equal(summary.choiceCorrect, 1);
  assert.equal(summary.choiceTotal, 1);
  assert.equal(summary.writtenPoints, 4);
  assert.equal(summary.max, 1 + review.TECHDEV_WRITTEN_MAX_POINTS);
  assert.deepEqual(Object.keys(review.toScoreRecord(parsed, { "git-4": 5 })), []);
});

test("set validation rejects missing keys, duplicate choices and duplicate ids", () => {
  const [choice, written] = customSet.questions;
  for (const questions of [
    [{ ...choice, answer: "useMemo" }],
    [{ ...choice, answer: undefined }],
    [{ ...choice, options: ["useState", "useState"] }],
    [{ ...choice, options: ["useState"] }],
    [{ ...written, options: ["a", "b"] }],
    [choice, { ...written, id: "c-1" }],
    [{ ...written, id: "toString" }],
    [{ ...written, id: "__proto__" }],
    [],
  ]) {
    assert.equal(
      examSet.techDevExamSetSchema.safeParse({ durationMinutes: 30, questions })
        .success,
      false,
    );
  }
  assert.equal(
    examSet.techDevExamSetSchema.safeParse({ ...customSet, durationMinutes: 1 })
      .success,
    false,
  );
  assert.equal(
    examSet.techDevExamSetSchema.safeParse(examSet.DEFAULT_TECHDEV_EXAM_SET)
      .success,
    true,
  );
});

test("stored sets load per A.Y. and fall back to the default bank", async () => {
  const updatedAt = new Date("2026-10-01T00:00:00.000Z");
  const db = (value) => ({
    systemConfig: {
      findUnique: async ({ where }) => {
        assert.equal(where.key, "techdev_exam_set:cycle-1");
        return value === undefined ? null : { value, updatedAt };
      },
    },
  });
  const saved = await examSet.getTechDevExamSet(
    "cycle-1",
    db(JSON.stringify(customSet)),
  );
  assert.equal(saved.set.questions.length, 2);
  assert.equal(saved.updatedAt, updatedAt);
  const fallback = await examSet.getTechDevExamSet("cycle-1", db(undefined));
  assert.equal(fallback.set, examSet.DEFAULT_TECHDEV_EXAM_SET);
  assert.equal(fallback.updatedAt, null);
  for (const stored of ["not json", JSON.stringify({ questions: [] })]) {
    await assert.rejects(examSet.getTechDevExamSet("cycle-1", db(stored)), /invalid/);
  }
  assert.equal("answer" in examSet.toPublicQuestion(customSet.questions[0]), false);
});
