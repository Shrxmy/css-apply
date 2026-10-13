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
const scoring = load("src/lib/techdev-exam-review.ts", {
  "@/data/techdev-exam": bank,
  "@/lib/techdev-exam-key": key,
});
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
    "@/lib/techdev-exam-review": scoring,
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
