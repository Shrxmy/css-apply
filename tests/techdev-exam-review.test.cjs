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
const review = loadTypeScriptModule("src/lib/techdev-exam-review.ts", {
  "@/data/techdev-exam": questionBank,
  "@/lib/techdev-exam-key": answerKey,
});

const choiceQuestions = questionBank.TECHDEV_EXAM_QUESTIONS.filter(
  (question) => question.kind === "choice",
);
const writtenIds = Array.from(review.TECHDEV_WRITTEN_QUESTION_IDS);

test("automatically scores choice answers against the actual key", () => {
  const answers = { ...answerKey.TECHDEV_CHOICE_ANSWERS };
  const summary = review.summarizeTechDevScore(answers, {});

  assert.equal(
    summary.choiceCorrect,
    Object.keys(answerKey.TECHDEV_CHOICE_ANSWERS).length,
  );
  assert.equal(summary.choiceTotal, choiceQuestions.length);

  const missedQuestion = choiceQuestions[0];
  answers[missedQuestion.id] = "not the keyed answer";
  assert.equal(
    review.summarizeTechDevScore(answers, {}).choiceCorrect,
    summary.choiceCorrect - 1,
  );
});

test("written grading distinguishes partial from complete grading", () => {
  const partial = review.summarizeTechDevScore(
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
  const complete = review.summarizeTechDevScore({}, completeScores);
  assert.equal(complete.writtenGraded, writtenIds.length);
  assert.equal(complete.writtenPoints, writtenIds.length);
});

test("a zero-point written score still counts as graded", () => {
  const summary = review.summarizeTechDevScore({}, { [writtenIds[0]]: 0 });
  assert.equal(summary.writtenPoints, 0);
  assert.equal(summary.writtenGraded, 1);
});

test("cleared and missing written scores remain ungraded", () => {
  const manualScores = review.toScoreRecord({ [writtenIds[0]]: null });
  assert.equal(Object.keys(manualScores).length, 0);

  const summary = review.summarizeTechDevScore({}, manualScores);
  assert.equal(summary.writtenPoints, 0);
  assert.equal(summary.writtenGraded, 0);
  assert.equal(
    review.reviewQuestions({}, manualScores).find((q) => q.id === writtenIds[0])
      .manualScore,
    null,
  );
});

test("score normalization filters unknown and non-written question keys", () => {
  const scores = review.toScoreRecord({
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
      Object.keys(review.toScoreRecord({ [writtenIds[0]]: points })).length,
      0,
    );
  }
  assert.equal(review.toScoreRecord({ [writtenIds[0]]: 0 })[writtenIds[0]], 0);
  assert.equal(review.toScoreRecord({ [writtenIds[0]]: 5 })[writtenIds[0]], 5);
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
      .reviewQuestions(answers, {})
      .find((q) => q.id === choiceQuestions[1].id).answer,
    "",
  );
});
