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
  vm.runInNewContext(
    `(function(require, module, exports) { ${outputText}\n})`,
    { Date, Object, console },
    { filename },
  )(
    (name) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name === "zod") return require(name);
      throw new Error(`Unexpected import: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const enumOf = (...names) => Object.fromEntries(names.map((n) => [n, n]));
class PrismaClientKnownRequestError extends Error {}
const prismaClient = {
  AttendanceGroup: enumOf(
    "MEMBER",
    "COMMITTEE_STAFF",
    "EXECUTIVE_ASSOCIATE",
    "IMPORTED_STUDENT",
  ),
  AttendanceMethod: enumOf("QR", "CSS_ID_QR", "UST_QR", "MANUAL"),
  AttendanceRosterSource: enumOf("CSSAPPLY", "IMPORTED"),
  AttendanceEventStatus: enumOf("DRAFT", "OPEN", "CLOSED", "ARCHIVED"),
  AttendanceScanOutcome: enumOf(
    "ACCEPTED",
    "DUPLICATE",
    "UNKNOWN",
    "INACTIVE",
    "INELIGIBLE",
    "OUTSIDE_WINDOW",
  ),
  Prisma: { PrismaClientKnownRequestError },
};
const digitalIdRole = load("src/lib/digital-id-role.ts", {
  "@/data/committeeRoles": load("src/data/committeeRoles.ts"),
  "@/lib/eb-mapping": load("src/lib/eb-mapping.ts"),
});
const attendance = load("src/lib/attendance.ts", {
  "@prisma/client": prismaClient,
  "@/lib/digital-id-role": digitalIdRole,
});
const next = {
  NextResponse: {
    json: (body, options = {}) => ({ body, status: options.status ?? 200 }),
  },
};
const plain = (value) => JSON.parse(JSON.stringify(value));

// Minimal in-memory stand-in for the Prisma calls the attendance code makes.
function createDb(seed = {}) {
  const db = {
    events: seed.events ?? [],
    roster: seed.roster ?? [],
    attendances: seed.attendances ?? [],
    attempts: seed.attempts ?? [],
    audits: [],
    guests: seed.guests ?? [],
    memberships: seed.memberships ?? [],
    users: seed.users ?? [],
  };
  let nextId = 1;
  const id = (prefix) => `${prefix}-new-${nextId++}`;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) =>
      key === "OR"
        ? value.some((clause) => matches(row, clause))
        : value && typeof value === "object" && "in" in value
          ? value.in.includes(row[key])
          : row[key] === value,
    );
  // The roster query starts from approved users; fixtures describe them as
  // memberships (user + member ID) or as approved users with no member ID yet.
  const approvedUsers = (where) =>
    [
      ...db.memberships
        .filter((m) => m.user && m.recruitmentCycleId === "cycle-1")
        .map((m) => ({ ...m.user, memberships: [{ memberId: m.memberId }] })),
      ...(seed.approvedUsers ?? []).map((u) => ({ ...u, memberships: [] })),
    ].filter(
      (u) =>
        typeof where.studentNumber !== "string" ||
        u.studentNumber === where.studentNumber,
    );

  const prisma = {
    $queryRaw: async () => [],
    $transaction: async (fn) => fn(prisma),
    attendanceEvent: {
      findUnique: async ({ where }) =>
        db.events.find((event) => event.id === where.id) ?? null,
    },
    attendanceGuest: {
      findMany: async ({ where }) => db.guests.filter((g) => matches(g, where)),
      findUnique: async ({ where }) => {
        const key = where.recruitmentCycleId_studentNumber;
        return db.guests.find((g) => matches(g, key)) ?? null;
      },
    },
    membership: {
      findUnique: async ({ where }) =>
        db.memberships.find((m) => m.memberId === where.memberId) ?? null,
    },
    user: {
      findMany: async ({ where }) => approvedUsers(where),
      findUnique: async ({ where }) =>
        db.users.find((u) => u.studentNumber === where.studentNumber) ?? null,
    },
    attendanceEventRoster: {
      findFirst: async ({ where }) =>
        db.roster.find((r) => matches(r, where)) ?? null,
      findUnique: async ({ where }) =>
        db.roster.find((r) => r.id === where.id) ?? null,
      findMany: async ({ where }) => db.roster.filter((r) => matches(r, where)),
      deleteMany: async ({ where }) => {
        const before = db.roster.length;
        db.roster = db.roster.filter((r) => !matches(r, where));
        return { count: before - db.roster.length };
      },
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const row of data) {
          const clash = db.roster.some(
            (r) =>
              r.eventId === row.eventId &&
              (r.studentNumber === row.studentNumber ||
                (row.memberId && r.memberId === row.memberId)),
          );
          if (clash && !skipDuplicates) throw new Error("unique violation");
          if (clash) continue;
          db.roster.push({ id: id("roster"), isActive: true, ...row });
          count += 1;
        }
        return { count };
      },
      update: async ({ where, data }) => {
        const row = db.roster.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    eventAttendance: {
      findUnique: async ({ where, include }) => {
        const row =
          db.attendances.find((a) =>
            where.id
              ? a.id === where.id
              : a.rosterEntryId === where.rosterEntryId,
          ) ?? null;
        if (!row || !include) return row;
        const entry = db.roster.find((r) => r.id === row.rosterEntryId);
        return {
          ...row,
          rosterEntry: entry,
          checkedInBy: { name: "Operator" },
        };
      },
      create: async ({ data }) => {
        const row = { id: id("attendance"), ...data };
        db.attendances.push(row);
        return row;
      },
      deleteMany: async ({ where }) => {
        const before = db.attendances.length;
        db.attendances = db.attendances.filter((a) => a.id !== where.id);
        return { count: before - db.attendances.length };
      },
    },
    attendanceScanAttempt: {
      findUnique: async ({ where }) =>
        db.attempts.find((a) => matches(a, where.eventId_clientScanId)) ?? null,
      create: async ({ data }) => {
        const row = {
          id: id("attempt"),
          rosterEntryId: null,
          attendanceId: null,
          ...data,
        };
        db.attempts.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const rows = db.attempts.filter((a) => matches(a, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    attendanceAuditLog: {
      count: async () => 0,
      create: async ({ data }) => {
        db.audits.push(data);
        return data;
      },
    },
  };
  return { db, prisma };
}

const operator = (role = "super_admin") => ({
  authorizeAttendanceOperator: async (options = {}) =>
    options.superAdminOnly && role !== "super_admin"
      ? {
          response: next.NextResponse.json(
            { error: "Forbidden" },
            { status: 403 },
          ),
        }
      : { operator: { id: "operator-1", role } },
});

function route(file, prisma, role) {
  return load(file, {
    "@prisma/client": prismaClient,
    "next/server": next,
    "@/lib/attendance": attendance,
    "@/lib/attendance-auth": operator(role),
    "@/lib/prisma": { prisma },
  });
}

function application(overrides = {}) {
  return {
    id: "app",
    hasAccepted: true,
    paymentStatus: "approved",
    redirection: null,
    ...overrides,
  };
}

function membership(studentNumber, memberId, apps = {}) {
  return {
    recruitmentCycleId: "cycle-1",
    memberId,
    user: {
      id: `user-${studentNumber}`,
      name: `Student ${studentNumber}`,
      studentNumber,
      section: "1CSA",
      memberApplications: apps.member ?? [],
      committeeApplications: apps.committee ?? [],
      executiveAssociateApplications: apps.ea ?? [],
    },
  };
}

const ALL_GROUPS = [
  "MEMBER",
  "COMMITTEE_STAFF",
  "EXECUTIVE_ASSOCIATE",
  "IMPORTED_STUDENT",
];

test("parses CSS IDs and UST QR credentials", () => {
  assert.deepEqual(
    plain(attendance.parseAttendanceCredential(" css-2026-0001 ")),
    {
      method: "CSS_ID_QR",
      memberId: "CSS-2026-0001",
    },
  );
  assert.deepEqual(
    plain(attendance.parseAttendanceCredential("2026123456-7")),
    {
      method: "UST_QR",
      studentNumber: "2026123456",
    },
  );
  // No hardcoded member ID format: other values go to the database lookup.
  assert.deepEqual(
    plain(attendance.parseAttendanceCredential("CSS-2627-10000")),
    { method: "CSS_ID_QR", memberId: "CSS-2627-10000" },
  );
  assert.equal(attendance.parseAttendanceCredential("has space"), null);
  assert.equal(attendance.parseAttendanceCredential("x".repeat(33)), null);
  assert.throws(() => attendance.parseAttendanceCredential("CSS\u0000"));
});

test("scan accepts any member ID found in the database", async () => {
  const { prisma } = scanSetup(
    {},
    {
      memberships: [
        membership("1000000003", "CSS-2627-10000", { member: [application()] }),
      ],
    },
  );
  const result = await scan(prisma, {
    mode: "QR",
    credential: "css-2627-10000",
  });
  assert.equal(result.body.outcome, "ACCEPTED");
});

test("normalizes student numbers and rejects bad ones", () => {
  assert.equal(attendance.normalizeStudentNumber("2026123456.0"), "2026123456");
  assert.equal(
    attendance.normalizeStudentNumber("'2026-123 456"),
    "2026123456",
  );
  assert.throws(() => attendance.normalizeStudentNumber("202612345"));
  assert.throws(() => attendance.normalizeStudentNumber("abc"));
});

test("roster groups follow the accepted redirection like digital IDs", async () => {
  const { db, prisma } = createDb({
    memberships: [
      // EA redirected to a committee by bare id and by title.
      membership("1000000001", "CSS-2026-0001", {
        ea: [application({ redirection: "academics" })],
      }),
      membership("1000000002", "CSS-2026-0002", {
        ea: [application({ redirection: "Finance" })],
      }),
      membership("1000000003", "CSS-2026-0003", {
        committee: [application({ redirection: "treasurer" })],
      }),
      membership("1000000004", "CSS-2026-0004", {
        committee: [application({ redirection: "member" })],
      }),
      membership("1000000005", "CSS-2026-0005", {
        committee: [application()],
      }),
      membership("1000000006", "CSS-2026-0006", { ea: [application()] }),
      // Membership without an accepted, paid application gets no group.
      membership("1000000007", "CSS-2026-0007"),
    ],
  });

  const count = await attendance.materializeAttendanceRoster(
    prisma,
    "event-1",
    "cycle-1",
    ALL_GROUPS,
  );
  const groups = Object.fromEntries(
    db.roster.map((r) => [r.studentNumber, r.affiliationGroups.join(",")]),
  );
  assert.equal(count, 6);
  assert.deepEqual(groups, {
    1000000001: "COMMITTEE_STAFF",
    1000000002: "COMMITTEE_STAFF",
    1000000003: "EXECUTIVE_ASSOCIATE",
    1000000004: "MEMBER",
    1000000005: "COMMITTEE_STAFF",
    1000000006: "EXECUTIVE_ASSOCIATE",
  });
});

test("roster merges imported guests with members and filters by eligibility", async () => {
  const { db, prisma } = createDb({
    guests: [
      {
        id: "guest-1",
        recruitmentCycleId: "cycle-1",
        isActive: true,
        studentNumber: "1000000001",
        fullName: "Guest One",
        section: null,
      },
    ],
    memberships: [
      membership("1000000001", "CSS-2026-0001", { member: [application()] }),
      membership("1000000002", "CSS-2026-0002", { committee: [application()] }),
    ],
  });

  await attendance.materializeAttendanceRoster(prisma, "event-1", "cycle-1", [
    "MEMBER",
    "IMPORTED_STUDENT",
  ]);
  assert.equal(db.roster.length, 1);
  assert.equal(db.roster[0].guestId, "guest-1");
  assert.equal(db.roster[0].memberId, "CSS-2026-0001");
  assert.deepEqual(plain(db.roster[0].affiliationGroups), [
    "MEMBER",
    "IMPORTED_STUDENT",
  ]);
});

test("add-only sync never removes rows and links guests who became members", async () => {
  const { db, prisma } = createDb({
    roster: [
      // Checked-in guest whose membership was approved after the event opened.
      {
        id: "roster-guest",
        eventId: "event-1",
        studentNumber: "1000000001",
        memberId: null,
        userId: null,
      },
      // No longer eligible, but must stay because it may have a check-in.
      {
        id: "roster-old",
        eventId: "event-1",
        studentNumber: "1000000009",
        memberId: "CSS-2026-0009",
        userId: "user-old",
      },
    ],
    memberships: [
      membership("1000000001", "CSS-2026-0001", { member: [application()] }),
      membership("1000000002", "CSS-2026-0002", { member: [application()] }),
    ],
  });

  const result = await attendance.syncAttendanceRoster(
    prisma,
    "event-1",
    "cycle-1",
    ["MEMBER"],
  );
  assert.deepEqual(plain(result), { added: 1, linked: 1, rosterCount: 3 });
  assert.deepEqual(db.roster.map((r) => r.studentNumber).sort(), [
    "1000000001",
    "1000000002",
    "1000000009",
  ]);
  const guest = db.roster.find((r) => r.id === "roster-guest");
  assert.equal(guest.memberId, "CSS-2026-0001");
  assert.equal(guest.userId, "user-1000000001");
});

// Scan route

const SCAN_ROUTE =
  "src/app/api/admin/attendance/events/[eventId]/scan/route.ts";
const hourMs = 60 * 60 * 1000;

function scanSetup(eventOverrides = {}, seed = {}) {
  const now = Date.now();
  return createDb({
    ...seed,
    events: [
      {
        id: "event-1",
        recruitmentCycleId: "cycle-1",
        status: "OPEN",
        checkInOpensAt: new Date(now - hourMs),
        checkInClosesAt: new Date(now + hourMs),
        eligibleGroups: ["MEMBER", "IMPORTED_STUDENT"],
        ...eventOverrides,
      },
    ],
    roster: [
      {
        id: "roster-1",
        eventId: "event-1",
        studentNumber: "1000000001",
        memberId: "CSS-2026-0001",
        fullName: "Member One",
        section: "1CSA",
        isActive: true,
      },
    ],
    // Known member ID whose holder has no approved application this cycle.
    memberships: [
      membership("1000000002", "CSS-2026-0002"),
      ...(seed.memberships ?? []),
    ],
  });
}

let scanCounter = 0;
async function scan(prisma, body) {
  const clientScanId =
    body.clientScanId ??
    `00000000-0000-4000-8000-${String(++scanCounter).padStart(12, "0")}`;
  const { POST } = route(SCAN_ROUTE, prisma);
  return POST(
    { json: async () => ({ clientScanId, ...body }) },
    { params: Promise.resolve({ eventId: "event-1" }) },
  );
}

test("scan accepts once, then reports duplicates", async () => {
  const { db, prisma } = scanSetup();
  const first = await scan(prisma, { mode: "QR", credential: "CSS-2026-0001" });
  assert.equal(first.body.outcome, "ACCEPTED");
  assert.equal(first.body.attendee.fullName, "Member One");
  const second = await scan(prisma, {
    mode: "MANUAL",
    studentNumber: "1000000001",
  });
  assert.equal(second.body.outcome, "DUPLICATE");
  assert.equal(db.attendances.length, 1);
});

test("scan replays the stored result for a repeated clientScanId", async () => {
  const { db, prisma } = scanSetup();
  const clientScanId = "11111111-1111-4111-8111-111111111111";
  const body = { mode: "QR", credential: "CSS-2026-0001", clientScanId };
  const first = await scan(prisma, body);
  const replay = await scan(prisma, body);
  assert.equal(replay.body.attemptId, first.body.attemptId);
  assert.equal(replay.body.idempotentReplay, true);
  assert.equal(db.attempts.length, 1);
});

test("scan outside the window or on a non-open event is rejected", async () => {
  const now = Date.now();
  for (const overrides of [
    { status: "DRAFT" },
    { status: "CLOSED" },
    {
      checkInOpensAt: new Date(now + hourMs),
      checkInClosesAt: new Date(now + 2 * hourMs),
    },
    {
      checkInOpensAt: new Date(now - 2 * hourMs),
      checkInClosesAt: new Date(now - hourMs),
    },
  ]) {
    const { db, prisma } = scanSetup(overrides);
    const result = await scan(prisma, {
      mode: "QR",
      credential: "CSS-2026-0001",
    });
    assert.equal(
      result.body.outcome,
      "OUTSIDE_WINDOW",
      JSON.stringify(overrides),
    );
    assert.equal(db.attendances.length, 0);
  }
});

test("scan separates unknown credentials from known but ineligible people", async () => {
  const { prisma } = scanSetup();
  const unknownFormat = await scan(prisma, { mode: "QR", credential: "hello" });
  assert.equal(unknownFormat.body.outcome, "UNKNOWN");
  const unknownMember = await scan(prisma, {
    mode: "QR",
    credential: "CSS-2026-0404",
  });
  assert.equal(unknownMember.body.outcome, "UNKNOWN");
  const ineligible = await scan(prisma, {
    mode: "QR",
    credential: "CSS-2026-0002",
  });
  assert.equal(ineligible.body.outcome, "INELIGIBLE");
});

test("scan rejects malformed manual student numbers", async () => {
  const { prisma } = scanSetup();
  const result = await scan(prisma, { mode: "MANUAL", studentNumber: "123" });
  assert.equal(result.status, 422);
});

// Undo route

const UNDO_ROUTE =
  "src/app/api/admin/attendance/events/[eventId]/attendance/[attendanceId]/route.ts";

async function undo(prisma, attendanceId, { role, eventId = "event-1" } = {}) {
  const { DELETE } = route(UNDO_ROUTE, prisma, role);
  return DELETE({}, { params: Promise.resolve({ eventId, attendanceId }) });
}

test("undo removes the check-in, keeps scan history, and allows re-scan", async () => {
  const { db, prisma } = scanSetup();
  const accepted = await scan(prisma, {
    mode: "QR",
    credential: "CSS-2026-0001",
  });
  const result = await undo(prisma, accepted.body.attendanceId);
  assert.equal(result.status, 200);
  assert.equal(db.attendances.length, 0);
  assert.equal(db.attempts.length, 1);
  assert.equal(db.attempts[0].attendanceId, null);
  assert.equal(db.audits[0].action, "ATTENDANCE_CHECKIN_VOIDED");
  assert.equal(db.audits[0].details.studentNumber, "1000000001");

  const retry = await undo(prisma, accepted.body.attendanceId);
  assert.equal(retry.status, 404);
  const again = await scan(prisma, { mode: "QR", credential: "CSS-2026-0001" });
  assert.equal(again.body.outcome, "ACCEPTED");
});

test("undo is super-admin only, event-scoped, and blocked on archived events", async () => {
  const { db, prisma } = scanSetup();
  const accepted = await scan(prisma, {
    mode: "QR",
    credential: "CSS-2026-0001",
  });
  const attendanceId = accepted.body.attendanceId;

  assert.equal(
    (await undo(prisma, attendanceId, { role: "admin" })).status,
    403,
  );
  db.events.push({ id: "event-2", status: "OPEN" });
  assert.equal(
    (await undo(prisma, attendanceId, { eventId: "event-2" })).status,
    404,
  );
  db.events[0].status = "ARCHIVED";
  assert.equal((await undo(prisma, attendanceId)).status, 409);
  assert.equal(db.attendances.length, 1);
});

// Roster refresh / sync route

const STATUS_ROUTE =
  "src/app/api/admin/attendance/events/[eventId]/status/route.ts";

async function refresh(status) {
  const { db, prisma } = createDb({
    events: [
      {
        id: "event-1",
        recruitmentCycleId: "cycle-1",
        status,
        eligibleGroups: ["MEMBER"],
      },
    ],
    roster: [
      {
        id: "roster-old",
        eventId: "event-1",
        studentNumber: "1000000009",
        memberId: null,
        userId: null,
      },
    ],
    memberships: [
      membership("1000000001", "CSS-2026-0001", { member: [application()] }),
    ],
  });
  const { POST } = route(STATUS_ROUTE, prisma);
  const response = await POST(
    {},
    {
      params: Promise.resolve({ eventId: "event-1" }),
    },
  );
  return { db, response };
}

test("roster refresh replaces drafts but only adds to open or closed events", async () => {
  const draft = await refresh("DRAFT");
  assert.equal(draft.response.body.mode, "replace");
  assert.deepEqual(
    draft.db.roster.map((r) => r.studentNumber),
    ["1000000001"],
  );

  for (const status of ["OPEN", "CLOSED"]) {
    const live = await refresh(status);
    assert.equal(live.response.body.mode, "add_only");
    assert.equal(live.response.body.added, 1);
    assert.deepEqual(live.db.roster.map((r) => r.studentNumber).sort(), [
      "1000000001",
      "1000000009",
    ]);
  }

  const archived = await refresh("ARCHIVED");
  assert.equal(archived.response.status, 409);
});

// QR test without an event

const QR_TEST_ROUTE = "src/app/api/admin/attendance/test-credential/route.ts";

function qrTestRoute({ membership = null, user = null, guest = null } = {}) {
  const audits = [];
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    attendanceAuditLog: {
      count: async () => 0,
      create: async ({ data }) => audits.push(data),
    },
    attendanceEvent: {
      findUnique: async () => {
        throw new Error("event lookup should be skipped");
      },
    },
    membership: { findUnique: async () => membership },
    user: { findUnique: async () => user },
    attendanceGuest: { findFirst: async () => guest },
  };
  const { POST } = route(QR_TEST_ROUTE, prisma);
  const test = (credential) => POST({ json: async () => ({ credential }) });
  return { test, audits };
}

test("QR test without an event identifies a CSS member", async () => {
  const { test: run, audits } = qrTestRoute({
    membership: {
      memberId: "CSS-2026-0001",
      recruitmentCycle: { schoolYear: "2026-2027" },
      user: {
        name: "Member One",
        studentNumber: "1000000001",
        section: "1CSA",
      },
    },
  });
  const result = await run("CSS-2026-0001");
  assert.equal(result.status, 200);
  assert.equal(result.body.recognized, true);
  assert.equal(result.body.event, null);
  assert.equal(result.body.attendee.fullName, "Member One");
  assert.equal(result.body.attendee.schoolYear, "2026-2027");
  assert.equal(audits[0].entityType, "attendance_credential");
  assert.equal(audits[0].entityId, null);
});

test("QR test without an event finds UST QR owners or reports unknowns", async () => {
  const guest = await qrTestRoute({
    guest: {
      fullName: "Guest One",
      section: null,
      recruitmentCycle: { schoolYear: "2026-2027" },
    },
  }).test("1000000002-3");
  assert.equal(guest.body.recognized, true);
  assert.equal(guest.body.attendee.source, "IMPORTED");

  const unknown = await qrTestRoute().test("1000000003-4");
  assert.equal(unknown.body.recognized, false);
  assert.equal(unknown.body.credentialType, "UST_QR");

  const garbage = await qrTestRoute().test("hello");
  assert.equal(garbage.body.recognized, false);
  assert.equal(garbage.body.credentialType, "UNKNOWN");
  assert.equal(garbage.body.event, null);
});

// Roster additions for people approved or imported after the snapshot

test("roster includes approved users who do not have a member ID yet", async () => {
  const { db, prisma } = createDb({
    approvedUsers: [
      {
        id: "user-legacy",
        name: "Legacy Member",
        studentNumber: "1000000005",
        section: "2CSB",
        memberApplications: [application()],
        committeeApplications: [],
        executiveAssociateApplications: [],
      },
    ],
  });
  await attendance.materializeAttendanceRoster(prisma, "event-1", "cycle-1", [
    "MEMBER",
  ]);
  assert.equal(db.roster.length, 1);
  assert.equal(db.roster[0].memberId, null);
  assert.equal(db.roster[0].userId, "user-legacy");
});

test("scan adds a member approved after the roster snapshot", async () => {
  const { db, prisma } = scanSetup(
    {},
    {
      memberships: [
        membership("1000000003", "CSS-2026-0003", { member: [application()] }),
      ],
    },
  );
  const result = await scan(prisma, {
    mode: "QR",
    credential: "CSS-2026-0003",
  });
  assert.equal(result.body.outcome, "ACCEPTED");
  assert.equal(result.body.attendee.studentNumber, "1000000003");
  assert.ok(db.roster.some((r) => r.memberId === "CSS-2026-0003"));
  assert.ok(db.audits.some((a) => a.action === "ATTENDANCE_ROSTER_AUTO_ADDED"));

  const again = await scan(prisma, { mode: "QR", credential: "CSS-2026-0003" });
  assert.equal(again.body.outcome, "DUPLICATE");
});

test("scan adds a student imported after the roster snapshot", async () => {
  const { prisma } = scanSetup(
    {},
    {
      guests: [
        {
          id: "guest-late",
          recruitmentCycleId: "cycle-1",
          isActive: true,
          studentNumber: "1000000004",
          fullName: "Late Guest",
          section: null,
        },
      ],
    },
  );
  const result = await scan(prisma, { mode: "QR", credential: "1000000004-1" });
  assert.equal(result.body.outcome, "ACCEPTED");
  assert.equal(result.body.attendee.fullName, "Late Guest");
});

test("scan does not add people outside the event's groups", async () => {
  const { db, prisma } = scanSetup(
    { eligibleGroups: ["COMMITTEE_STAFF"] },
    {
      guests: [
        {
          id: "guest-late",
          recruitmentCycleId: "cycle-1",
          isActive: true,
          studentNumber: "1000000004",
          fullName: "Late Guest",
          section: null,
        },
      ],
    },
  );
  const result = await scan(prisma, {
    mode: "MANUAL",
    studentNumber: "1000000004",
  });
  assert.equal(result.body.outcome, "INELIGIBLE");
  assert.equal(db.roster.length, 1);
});

test("scan links a CSS ID to an imported student's existing roster row", async () => {
  const { db, prisma } = scanSetup(
    {},
    {
      memberships: [
        membership("1000000001", "CSS-2026-0009", { member: [application()] }),
      ],
    },
  );
  db.roster[0].memberId = null;
  const result = await scan(prisma, {
    mode: "QR",
    credential: "CSS-2026-0009",
  });
  assert.equal(result.body.outcome, "ACCEPTED");
  assert.equal(db.roster.length, 1);
  assert.equal(db.roster[0].memberId, "CSS-2026-0009");
});

test("QR test with an event reports eligible people not yet on the roster", async () => {
  const { db, prisma } = scanSetup(
    {},
    {
      memberships: [
        membership("1000000003", "CSS-2026-0003", { member: [application()] }),
      ],
    },
  );
  db.events[0].recruitmentCycle = { schoolYear: "2026-2027" };
  const { POST } = route(QR_TEST_ROUTE, prisma);
  const eligible = await POST({
    json: async () => ({ eventId: "event-1", credential: "CSS-2026-0003" }),
  });
  assert.equal(eligible.body.recognized, true);
  assert.equal(eligible.body.attendee.studentNumber, "1000000003");
  assert.equal(db.roster.length, 1, "dry run must not add roster rows");

  const ineligible = await POST({
    json: async () => ({ eventId: "event-1", credential: "CSS-2026-0002" }),
  });
  assert.equal(ineligible.body.recognized, false);
});

test("active Executive Board officers are on rosters as members", async () => {
  const president = membership("1000000006", "CSS-2026-0006");
  president.user.role = "super_admin";
  president.user.ebProfile = { isActive: true, recruitmentCycleId: "cycle-1" };
  const formerOfficer = membership("1000000007", "CSS-2026-0007");
  formerOfficer.user.role = "admin";
  formerOfficer.user.ebProfile = { isActive: false, recruitmentCycleId: null };
  const plainUser = membership("1000000008", "CSS-2026-0008");
  plainUser.user.role = "user";
  plainUser.user.ebProfile = { isActive: true, recruitmentCycleId: null };

  const { db, prisma } = scanSetup(
    {},
    { memberships: [president, formerOfficer, plainUser] },
  );
  const result = await scan(prisma, {
    mode: "QR",
    credential: "CSS-2026-0006",
  });
  assert.equal(result.body.outcome, "ACCEPTED");
  const row = db.roster.find((r) => r.memberId === "CSS-2026-0006");
  assert.deepEqual(plain(row.affiliationGroups), ["MEMBER"]);

  for (const credential of ["CSS-2026-0007", "CSS-2026-0008"]) {
    const rejected = await scan(prisma, { mode: "QR", credential });
    assert.equal(rejected.body.outcome, "INELIGIBLE", credential);
  }
});
