const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(relativePath, imports = {}) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  const localRequire = (name) => {
    if (name === "server-only") return {};
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name === "zod" || name === "node:crypto") return require(name);
    throw new Error(`Unexpected import: ${name}`);
  };
  vm.runInNewContext(
    `(function(require, module, exports) { ${outputText}\n})`,
    {
      Date,
      Object,
      console,
    },
    { filename },
  )(localRequire, module, module.exports);
  return module.exports;
}

const bank = load("src/data/techdev-exam.ts");
const key = load("src/lib/techdev-exam-key.ts");
// Set and scoring modules read the database, so each route gets its own copy.
const examSetModule = (prisma) =>
  load("src/lib/techdev-exam-set.ts", {
    "@/data/techdev-exam": bank,
    "@/lib/techdev-exam-key": key,
    "@/lib/prisma": { prisma },
  });
const scoringModule = (prisma) =>
  load("src/lib/techdev-exam-review.ts", { "@/lib/prisma": { prisma } });
const noSavedSet = {
  findUnique: async () => null,
  create: async ({ data }) => ({ ...data, updatedAt: new Date() }),
};
const writtenId = bank.TECHDEV_EXAM_QUESTIONS.find((q) => q.kind === "code").id;
const next = {
  NextResponse: {
    json: (body, options = {}) => ({ body, status: options.status ?? 200 }),
  },
};
const request = (body) => ({ json: async () => body });
const baselineDate = new Date("2026-10-01T00:00:00.000Z");

function attempt(overrides = {}) {
  return {
    id: "attempt-1",
    recruitmentCycleId: "cycle-1",
    status: "SUBMITTED",
    version: bank.TECHDEV_EXAM_VERSION,
    questionOrder: bank.TECHDEV_EXAM_QUESTIONS.map((q) => q.id),
    answers: {},
    manualScores: {},
    startedAt: baselineDate,
    expiresAt: baselineDate,
    submittedAt: baselineDate,
    updatedAt: baselineDate,
    reviewedAt: null,
    focusLossCount: 0,
    totalAwayMilliseconds: 0,
    user: {
      name: "Applicant",
      email: "applicant@example.invalid",
      studentNumber: "1234567890",
      section: "1CS-A",
    },
    ...overrides,
  };
}

function reviewerRoute({
  reviewer,
  session = { user: { email: "reviewer@example.invalid" } },
  row = attempt(),
  update,
} = {}) {
  const state = { writes: 0, row };
  const prisma = {
    systemConfig: noSavedSet,
    user: {
      findUnique: async () =>
        reviewer ?? { id: "reviewer-1", role: "super_admin" },
    },
    techDevExamAttempt: {
      findMany: async ({ where }) =>
        state.row &&
        (!where.id || where.id === state.row.id) &&
        where.recruitmentCycleId === state.row.recruitmentCycleId
          ? [state.row]
          : [],
      updateMany: async ({ where, data }) => {
        state.writes += 1;
        if (update) return update(where, data);
        if (where.updatedAt.getTime() !== state.row.updatedAt.getTime())
          return { count: 0 };
        state.row = {
          ...state.row,
          ...data,
          updatedAt: data.updatedAt ?? new Date(),
        };
        return { count: 1 };
      },
    },
  };
  const route = load("src/app/api/admin/techdev-exam/route.ts", {
    "next/server": next,
    "next-auth": { getServerSession: async () => session },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": { prisma },
    "@/lib/application-rules": {
      getActiveCycle: async () => ({ id: "cycle-1", schoolYear: "2026-2027" }),
      getApplicationRuleResponse: () => null,
    },
    "@/lib/techdev-exam-review": scoringModule(prisma),
    "@/lib/techdev-exam-set": examSetModule(prisma),
  });
  return { route, state };
}

const grade = (extra = {}) => ({
  attemptId: "attempt-1",
  expectedUpdatedAt: baselineDate.toISOString(),
  scores: { [writtenId]: 3 },
  ...extra,
});

test("reviewer API denies unauthenticated, ordinary and wrong-cycle/committee admins", async () => {
  const anonymous = reviewerRoute({ session: null });
  assert.equal((await anonymous.route.GET()).status, 401);
  for (const reviewer of [
    { role: "user" },
    {
      role: "admin",
      ebProfile: {
        isActive: true,
        recruitmentCycleId: "cycle-1",
        committees: ["finance"],
      },
    },
    {
      role: "admin",
      ebProfile: {
        isActive: true,
        recruitmentCycleId: "old-cycle",
        committees: ["technology"],
      },
    },
    {
      role: "admin",
      ebProfile: {
        isActive: false,
        recruitmentCycleId: "cycle-1",
        committees: ["technology"],
      },
    },
  ]) {
    const { route, state } = reviewerRoute({ reviewer });
    assert.equal((await route.GET()).status, 403);
    assert.equal((await route.PATCH(request(grade()))).status, 403);
    assert.equal(state.writes, 0);
  }
});

test("active current-cycle TechDev EB and Super Admin can review", async () => {
  for (const reviewer of [
    { id: "super", role: "super_admin" },
    {
      id: "eb",
      role: "admin",
      ebProfile: {
        isActive: true,
        recruitmentCycleId: "cycle-1",
        committees: ["technology"],
      },
    },
  ]) {
    const { route } = reviewerRoute({ reviewer });
    const result = await route.GET();
    assert.equal(result.status, 200);
    assert.equal(
      result.body.attempts[0].updatedAt.toISOString(),
      baselineDate.toISOString(),
    );
  }
});

test("stale browser score version is rejected even if server read sees the newer review", async () => {
  const { route, state } = reviewerRoute({
    row: attempt({
      updatedAt: new Date("2026-10-02T00:00:00.000Z"),
      manualScores: { [writtenId]: 5 },
    }),
  });
  const result = await route.PATCH(request(grade()));
  assert.equal(result.status, 409);
  assert.equal(state.row.manualScores[writtenId], 5);
});

test("review version strictly advances even when the clock has not advanced", async () => {
  const version = new Date(Date.now() + 60_000);
  const { route, state } = reviewerRoute({
    row: attempt({ updatedAt: version }),
  });
  const body = grade({ expectedUpdatedAt: version.toISOString() });
  assert.equal((await route.PATCH(request(body))).status, 200);
  assert.equal(state.row.updatedAt.getTime(), version.getTime() + 1);
  assert.equal((await route.PATCH(request(body))).status, 409);
});

test("scores can be saved and cleared without changing finalized answers", async () => {
  const { route, state } = reviewerRoute({
    row: attempt({
      manualScores: { [writtenId]: 5 },
      answers: { [writtenId]: "final answer" },
    }),
  });
  const result = await route.PATCH(
    request(grade({ scores: { [writtenId]: null } })),
  );
  assert.equal(result.status, 200);
  assert.equal(Object.keys(state.row.manualScores).length, 0);
  assert.equal(state.row.answers[writtenId], "final answer");
});

test("invalid scores, missing version, active attempt and other-cycle attempt never write", async () => {
  for (const scores of [
    { [writtenId]: 6 },
    { [writtenId]: -1 },
    { [writtenId]: 1.5 },
    { unknown: 1 },
  ]) {
    const { route, state } = reviewerRoute();
    assert.equal((await route.PATCH(request(grade({ scores })))).status, 400);
    assert.equal(state.writes, 0);
  }
  const missingVersion = reviewerRoute();
  assert.equal(
    (
      await missingVersion.route.PATCH(
        request(grade({ expectedUpdatedAt: undefined })),
      )
    ).status,
    400,
  );
  assert.equal(missingVersion.state.writes, 0);
  const active = reviewerRoute({
    row: attempt({
      status: "IN_PROGRESS",
      expiresAt: new Date(Date.now() + 60_000),
    }),
  });
  assert.equal((await active.route.PATCH(request(grade()))).status, 409);
  assert.equal(active.state.writes, 0);
  const oldCycle = reviewerRoute({
    row: attempt({ recruitmentCycleId: "old-cycle" }),
  });
  assert.equal((await oldCycle.route.PATCH(request(grade()))).status, 404);
  assert.equal(oldCycle.state.writes, 0);
});

test("applicant late save cannot overwrite an attempt submitted after the initial read", async () => {
  const row = attempt({
    status: "IN_PROGRESS",
    expiresAt: new Date(Date.now() + 60_000),
  });
  const finalized = {
    ...row,
    status: "SUBMITTED",
    answers: { [writtenId]: "submitted answer" },
  };
  let reads = 0;
  let conditionalWrite = false;
  const prisma = {
    systemConfig: noSavedSet,
    user: {
      findUnique: async () => ({ id: "user-1", studentNumber: "1234567890" }),
    },
    recruitmentCycle: { findFirst: async () => ({ id: "cycle-1" }) },
    committeeApplication: { findFirst: async () => ({ id: "application-1" }) },
    techDevExamAttempt: {
      findUnique: async () => (++reads === 1 ? row : finalized),
      updateMany: async ({ where }) => {
        assert.equal(where.status, "IN_PROGRESS");
        assert.ok(where.expiresAt.gt instanceof Date);
        conditionalWrite = true;
        return { count: 0 }; // A concurrent submission has already won.
      },
    },
  };
  const route = load("src/app/api/user/techdev-exam/route.ts", {
    "next/server": next,
    "next-auth": {
      getServerSession: async () => ({
        user: { email: "applicant@example.invalid" },
      }),
    },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": { prisma },
    "@/data/techdev-exam": bank,
    "@/lib/techdev-exam-set": examSetModule(prisma),
  });
  const result = await route.POST(
    request({ action: "save", answers: { [writtenId]: "late autosave" } }),
  );
  assert.equal(result.status, 409);
  assert.equal(conditionalWrite, true);
  assert.equal(result.body.eligible, true);
  assert.equal(
    result.body.attempt.attempt.answers[writtenId],
    "submitted answer",
  );
  assert.equal(result.body.attempt.attempt.status, "SUBMITTED");
  assert.equal(result.body.manualScores, undefined);
});

test("GET, start and submit share the applicant page's nested response contract", async () => {
  let row = attempt({
    status: "IN_PROGRESS",
    expiresAt: new Date(Date.now() + 60_000),
  });
  const prisma = {
    systemConfig: noSavedSet,
    user: {
      findUnique: async () => ({ id: "user-1", studentNumber: "1234567890" }),
    },
    recruitmentCycle: { findFirst: async () => ({ id: "cycle-1" }) },
    committeeApplication: { findFirst: async () => ({ id: "application-1" }) },
    techDevExamAttempt: {
      findUnique: async () => row,
      updateMany: async ({ where, data }) => {
        assert.equal(where.status, "IN_PROGRESS");
        row = { ...row, ...data };
        return { count: 1 };
      },
    },
  };
  prisma.$executeRaw = async () => 0;
  prisma.$transaction = async (callback) => callback(prisma);
  const route = load("src/app/api/user/techdev-exam/route.ts", {
    "next/server": next,
    "next-auth": {
      getServerSession: async () => ({
        user: { email: "applicant@example.invalid" },
      }),
    },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": { prisma },
    "@/data/techdev-exam": bank,
    "@/lib/techdev-exam-set": examSetModule(prisma),
  });
  for (const response of [
    await route.GET(),
    await route.POST(request({ action: "start" })),
  ]) {
    assert.equal(response.status, 200);
    assert.equal(response.body.eligible, true);
    assert.equal(response.body.attempt.attempt.id, row.id);
    assert.equal(
      response.body.attempt.questions.length,
      bank.TECHDEV_EXAM_QUESTIONS.length,
    );
    assert.equal(response.body.attempt.attempt.manualScores, undefined);
    assert.equal(
      response.body.attempt.questions.some(
        (q) => q.correctAnswer !== undefined,
      ),
      false,
    );
  }
  const result = await route.POST(
    request({ action: "submit", answers: { [writtenId]: "final" } }),
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.eligible, true);
  assert.equal(result.body.attempt.attempt.status, "SUBMITTED");
  assert.equal(result.body.attempt.attempt.answers[writtenId], "final");
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

function questionsRoute({ reviewer, attempts = 0, saved = null, afterTransaction, session = { user: { email: "reviewer@example.invalid" } } } = {}) {
  const state = { saved, writes: 0 };
  const config = () =>
    state.saved && {
      value: JSON.stringify(state.saved.set),
      updatedAt: state.saved.updatedAt,
    };
  const prisma = {
    user: {
      findUnique: async () =>
        reviewer ?? { id: "reviewer-1", role: "super_admin" },
    },
    systemConfig: {
      findUnique: async () => config(),
      upsert: async ({ create, update }) => {
        state.writes += 1;
        const data = state.saved ? update : create;
        state.saved = {
          set: JSON.parse(data.value),
          updatedAt: data.updatedAt,
        };
        return config();
      },
    },
    techDevExamAttempt: { count: async () => attempts },
  };
  prisma.$executeRaw = async () => 0;
  prisma.$transaction = async (callback) => {
    const outcome = await callback(prisma);
    if (afterTransaction) await afterTransaction(state);
    return outcome;
  };
  const route = load("src/app/api/admin/techdev-exam/questions/route.ts", {
    "next/server": next,
    "next-auth": {
      getServerSession: async () => session,
    },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": { prisma },
    "@/lib/application-rules": {
      getActiveCycle: async () => ({ id: "cycle-1", schoolYear: "2026-2027" }),
      getApplicationRuleResponse: () => null,
    },
    "@/lib/techdev-exam-review": scoringModule(prisma),
    "@/lib/techdev-exam-set": examSetModule(prisma),
  });
  return { route, state };
}

const save = (set, expectedUpdatedAt = null) =>
  request({ set, expectedUpdatedAt });

test("question editor is limited to TechDev EBs and Super Admins", async () => {
  const { route, state } = questionsRoute({
    reviewer: { role: "admin", ebProfile: null },
  });
  assert.equal((await route.GET()).status, 403);
  assert.equal((await route.PUT(save(customSet))).status, 403);
  assert.equal(state.writes, 0);
});

test("a new A.Y. starts on the default bank and saves its own set", async () => {
  const { route, state } = questionsRoute();
  const initial = await route.GET();
  assert.equal(initial.body.isCustom, false);
  assert.equal(initial.body.locked, false);
  assert.equal(
    initial.body.set.questions.length,
    bank.TECHDEV_EXAM_QUESTIONS.length,
  );

  const result = await route.PUT(save(customSet));
  assert.equal(result.status, 200);
  assert.equal(result.body.isCustom, true);
  assert.equal(result.body.set.questions.length, 2);
  assert.equal(state.writes, 1);

  // The editor's old version is now stale.
  assert.equal((await route.PUT(save(customSet))).status, 409);
  const again = await route.PUT(
    save(customSet, result.body.updatedAt.toISOString()),
  );
  assert.equal(again.status, 200);
  assert.equal(state.writes, 2);
});

test("invalid sets and started exams never write", async () => {
  const invalid = questionsRoute();
  const noKey = {
    ...customSet,
    questions: [{ ...customSet.questions[0], answer: "useMemo" }],
  };
  const result = await invalid.route.PUT(save(noKey));
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Question 1 needs a correct answer");
  assert.equal(invalid.state.writes, 0);

  const started = questionsRoute({ attempts: 1 });
  assert.equal((await started.route.GET()).body.locked, true);
  assert.equal((await started.route.PUT(save(customSet))).status, 409);
  assert.equal(started.state.writes, 0);
});

test("an applicant starts the A.Y.'s custom set without seeing its key", async () => {
  let row = null;
  const prisma = {
    systemConfig: {
      findUnique: async () => ({
        value: JSON.stringify(customSet),
        updatedAt: baselineDate,
      }),
    },
    user: {
      findUnique: async () => ({ id: "user-1", studentNumber: "1234567890" }),
    },
    recruitmentCycle: { findFirst: async () => ({ id: "cycle-1" }) },
    committeeApplication: { findFirst: async () => ({ id: "application-1" }) },
    techDevExamAttempt: {
      findUnique: async () => row,
      create: async ({ data }) => {
        row = attempt({ ...data, status: "IN_PROGRESS" });
        return row;
      },
      updateMany: async () => ({ count: 1 }),
    },
  };
  prisma.$executeRaw = async () => 0;
  prisma.$transaction = async (callback) => callback(prisma);
  const route = load("src/app/api/user/techdev-exam/route.ts", {
    "next/server": next,
    "next-auth": {
      getServerSession: async () => ({
        user: { email: "applicant@example.invalid" },
      }),
    },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": { prisma },
    "@/data/techdev-exam": bank,
    "@/lib/techdev-exam-set": examSetModule(prisma),
  });

  const before = await route.GET();
  assert.equal(before.body.questionCount, 2);
  assert.equal(before.body.durationMinutes, 30);
  assert.deepEqual([...before.body.sections], ["React"]);

  const started = await route.POST(request({ action: "start" }));
  assert.equal(started.status, 200);
  assert.deepEqual(
    [...started.body.attempt.questions.map((q) => q.id)].sort(),
    ["c-1", "w-1"],
  );
  assert.equal(
    started.body.attempt.questions.some((q) => "answer" in q),
    false,
  );
  assert.equal(row.version, baselineDate.toISOString());

  // Answers for questions outside this attempt are rejected.
  const stray = await route.POST(
    request({ action: "save", answers: { "git-1": "x" } }),
  );
  assert.equal(stray.status, 400);
});

function starterRoute({ savedSet = null, current = null, beforeLock } = {}) {
  const state = { row: current, saved: savedSet, frozenWrites: 0, attemptWrites: 0, locked: false };
  const prisma = {
    user: { findUnique: async () => ({ id: "user-1", studentNumber: "1234567890" }) },
    recruitmentCycle: { findFirst: async () => ({ id: "cycle-1" }) },
    committeeApplication: { findFirst: async () => ({ id: "application-1" }) },
    systemConfig: {
      findUnique: async () => state.saved && { value: JSON.stringify(state.saved.set), updatedAt: state.saved.updatedAt },
      create: async ({ data }) => {
        assert.equal(state.locked, true);
        assert.equal(state.saved, null);
        state.frozenWrites += 1;
        state.saved = { set: JSON.parse(data.value), updatedAt: baselineDate };
        return { ...data, updatedAt: baselineDate };
      },
    },
    techDevExamAttempt: {
      findUnique: async () => state.row,
      create: async ({ data }) => {
        assert.equal(state.locked, true);
        assert.ok(state.saved);
        state.attemptWrites += 1;
        state.row = attempt({ ...data, status: "IN_PROGRESS" });
        return state.row;
      },
    },
    $executeRaw: async () => {
      if (beforeLock) await beforeLock(state);
      state.locked = true;
      return 0;
    },
  };
  prisma.$transaction = async (callback) => {
    try { return await callback(prisma); }
    finally { state.locked = false; }
  };
  const sets = examSetModule(prisma);
  const route = load("src/app/api/user/techdev-exam/route.ts", {
    "next/server": next,
    "next-auth": { getServerSession: async () => ({ user: { email: "applicant@example.invalid" } }) },
    "@/lib/auth": { authOptions: {} }, "@/lib/prisma": { prisma },
    "@/data/techdev-exam": bank, "@/lib/techdev-exam-set": sets,
  });
  return { route, state, sets };
}

test("default start durably freezes the bank/key before creating an attempt and repeats are idempotent", async () => {
  const { route, state, sets } = starterRoute();
  const started = await route.POST(request({ action: "start" }));
  assert.equal(started.status, 200);
  assert.equal(state.frozenWrites, 1);
  assert.equal(state.attemptWrites, 1);
  assert.equal(state.row.version, baselineDate.toISOString());
  const first = state.saved.set.questions[0];
  assert.equal(first.answer, key.TECHDEV_CHOICE_ANSWERS[first.id]);
  assert.equal(started.body.attempt.questions.some((q) => "answer" in q), false);
  sets.DEFAULT_TECHDEV_EXAM_SET.questions[0].prompt = "A later deployment changed the default";
  const resumed = await route.GET();
  assert.equal(resumed.body.attempt.questions.find((q) => q.id === first.id).prompt, first.prompt);
  assert.equal((await route.POST(request({ action: "start" }))).status, 200);
  assert.equal(state.frozenWrites, 1);
  assert.equal(state.attemptWrites, 1);
});

test("a competing starter returns the latest frozen set under the lock rather than an earlier set", async () => {
  const latest = { ...customSet, questions: [{ ...customSet.questions[0], prompt: "The final saved prompt" }, customSet.questions[1]] };
  const { route, state } = starterRoute({
    savedSet: { set: customSet, updatedAt: baselineDate },
    beforeLock: (state) => {
      state.saved = { set: latest, updatedAt: new Date(baselineDate.getTime() + 1) };
      state.row = attempt({ status: "IN_PROGRESS", questionOrder: ["c-1", "w-1"], version: state.saved.updatedAt.toISOString() });
    },
  });
  const result = await route.POST(request({ action: "start" }));
  assert.equal(result.status, 200);
  assert.equal(result.body.attempt.questions.find((q) => q.id === "c-1").prompt, "The final saved prompt");
  assert.equal(state.attemptWrites, 0);
  assert.equal(state.frozenWrites, 0);
});

test("exam-set edit tokens always advance and stale drafts are rejected", async () => {
  const version = new Date(Date.now() + 60_000);
  const { route, state } = questionsRoute({ saved: { set: customSet, updatedAt: version } });
  const result = await route.PUT(save(customSet, version.toISOString()));
  assert.equal(result.status, 200);
  assert.equal(result.body.updatedAt.getTime(), version.getTime() + 1);
  assert.equal(state.saved.updatedAt.getTime(), result.body.updatedAt.getTime());
  assert.equal((await route.PUT(save(customSet, version.toISOString()))).status, 409);
});

test("question save responds with its own snapshot even if another edit lands after commit", async () => {
  const peerSet = { ...customSet, durationMinutes: 60 };
  const { route } = questionsRoute({ afterTransaction: (state) => {
    state.saved = { set: peerSet, updatedAt: new Date(Date.now() + 1000) };
  } });
  const result = await route.PUT(save(customSet));
  assert.equal(result.status, 200);
  assert.equal(result.body.set.durationMinutes, 30);
});

test("question editor denies anonymous, non-admin, inactive and wrong-cycle reviewers", async () => {
  const anonymous = questionsRoute({ session: null });
  assert.equal((await anonymous.route.GET()).status, 401);
  assert.equal((await anonymous.route.PUT(save(customSet))).status, 401);
  for (const reviewer of [
    { role: "user" },
    { role: "admin", ebProfile: { isActive: false, recruitmentCycleId: "cycle-1", committees: ["technology"] } },
    { role: "admin", ebProfile: { isActive: true, recruitmentCycleId: "old-cycle", committees: ["technology"] } },
  ]) {
    const { route, state } = questionsRoute({ reviewer });
    assert.equal((await route.GET()).status, 403);
    assert.equal((await route.PUT(save(customSet))).status, 403);
    assert.equal(state.writes, 0);
  }
});
