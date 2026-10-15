const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, imports = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  vm.runInThisContext(`(function(require,module,exports){${outputText}\n})`, {
    filename,
  })(
    (name) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name === "react/jsx-runtime") return require(name);
      throw new Error(`Unexpected import: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const committees = load("src/data/committeeRoles.ts");
const eb = load("src/data/ebRoles.ts");
const mapping = load("src/lib/eb-mapping.ts");
const resolver = load("src/lib/digital-id-role.ts", {
  "@/data/committeeRoles": committees,
  "@/lib/eb-mapping": mapping,
});
const memberId = "CSS-2627-0202";
function fixture(overrides = {}) {
  return {
    hasApplication: true,
    application: {
      id: "application-1",
      studentNumber: "1234567890",
      ebRole: "secretary",
      firstOptionEb: "secretary",
      secondOptionEb: "treasurer",
      firstOptionCommittee: "finance",
      secondOptionCommittee: "technology",
      cv: "",
      hasFinishedInterview: true,
      status: "passed",
      redirection: "member",
      hasAccepted: true,
      paymentStatus: "approved",
      paymentProof: "https://example.invalid/receipt",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-13T00:00:00.000Z",
      ...overrides,
    },
    user: {
      id: "user-1",
      name: "Test Applicant",
      studentNumber: "1234567890",
      section: "1CS-A",
      memberships: [
        {
          memberId,
          photoPath: null,
          recruitmentCycle: {
            schoolYear: "2026-2027",
            membershipExpiration: null,
          },
        },
      ],
    },
    ebRole: "secretary",
    meetingLink: null,
  };
}
function renderProgress(type, record) {
  const cards = [];
  const nothing = { __esModule: true, default: () => null };
  const imports = {
    react: {
      ...React,
      useState(initial) {
        // Supply loaded application state instead of making network requests.
        if (initial === null) return [record, () => {}];
        if (initial === true) return [false, () => {}];
        return [typeof initial === "function" ? initial() : initial, () => {}];
      },
      useEffect() {},
      useCallback: (callback) => callback,
    },
    "next/navigation": {
      useRouter: () => ({}),
      useParams: () => ({ committee: "finance" }),
    },
    "next/image": nothing,
    "next-auth/react": {
      useSession: () => ({ data: { user: { name: "Test Applicant" } } }),
    },
    "@/data/committeeRoles": committees,
    "@/data/ebRoles": eb,
    "@/lib/useEbRoles": { useEbRoles: () => ({ roles: eb.roles }) },
    "@/lib/usePaymentQr": { usePaymentQr: () => ({ paymentQrUrl: null }) },
    "@/lib/useCommunityLink": {
      useCommunityLink: () => ({ communityEnabled: false, communityUrl: null }),
    },
    "@/lib/usePaymentReceiptTemplate": {
      usePaymentReceiptTemplate: () => ({ receiptTemplateUrl: null }),
    },
    "@/lib/usePaymentDeadline": {
      usePaymentDeadline: () => ({
        deadline: null,
        deadlinePassed: false,
        paymentsClosed: false,
      }),
    },
    "@/lib/digital-id-role": resolver,
    sonner: { toast: { error() {}, success() {} } },
    "@/components/DigitalIdCard": {
      __esModule: true,
      default(props) {
        cards.push(props);
        return React.createElement(
          "div",
          { "data-testid": "digital-id", "data-role": props.roleTitle },
          props.memberId,
        );
      },
    },
  };
  for (const name of [
    "Header",
    "Footer",
    "LoadingSpinner",
    "LoadingScreen",
    "FormProcessingOverlay",
    "CommunityJoinCard",
    "NoApplicationFound",
    "PaymentDeadlineNotice",
  ])
    imports[`@/components/${name}`] = nothing;
  const file =
    type === "committee"
      ? "src/app/user/apply/committee-staff/[committee]/progress/content.tsx"
      : "src/app/user/apply/executive-associate/[eb-role]/progress/content.tsx";
  const Page = load(file, imports).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  return { cards, html };
}

for (const type of ["committee", "ea"]) {
  test(`${type} progress embeds Official Member for an accepted Member redirection without changing the canonical record`, () => {
    const record = fixture();
    const before = JSON.stringify(record);
    const { cards, html } = renderProgress(type, record);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].roleTitle, "Official Member");
    assert.equal(cards[0].memberId, memberId);
    assert.equal(JSON.stringify(record), before);
    assert.ok(
      html.includes(type === "committee" ? "Finance Committee" : "Secretary"),
      "original choice remains application history",
    );
  });

  test(`${type} progress cannot show a digital ID before payment approval`, () => {
    for (const paymentStatus of [
      "not_submitted",
      "pending",
      "needs_revision",
      "rejected",
    ]) {
      assert.equal(
        renderProgress(type, fixture({ paymentStatus })).cards.length,
        0,
        paymentStatus,
      );
    }
  });
}

for (const type of ["committee", "ea"]) {
  test(`${type} progress keeps the source role for pending, unknown, and absent redirections`, () => {
    for (const overrides of [
      { hasAccepted: false, status: "redirected", redirection: "member" },
      { redirection: "unknown-destination" },
      { redirection: null },
    ]) {
      const { cards } = renderProgress(type, fixture(overrides));
      assert.equal(cards.length, 1);
      assert.equal(
        cards[0].roleTitle,
        type === "committee"
          ? "Staff - Finance"
          : "Executive Associate (Secretary)",
      );
    }
  });

  test(`${type} progress does not render an ID without a current valid membership`, () => {
    const record = fixture();
    record.user.memberships = [];
    assert.equal(renderProgress(type, record).cards.length, 0);
  });
}

test("progress cards honor accepted cross-type destinations", () => {
  assert.equal(
    renderProgress("committee", fixture({ redirection: "treasurer" })).cards[0]
      .roleTitle,
    "Executive Associate (Treasurer)",
  );
  assert.equal(
    renderProgress("ea", fixture({ redirection: "committee-technology" }))
      .cards[0].roleTitle,
    "Staff - Technology Development",
  );
});
