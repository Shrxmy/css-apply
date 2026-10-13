# CSSApply UI Design Guidelines

Use this document as the fallback when a UI request does not include a more specific visual reference. Its purpose is to keep new or revised screens consistent with CSSApply—not to authorize a broad redesign.

## Scope and precedence

1. Follow an explicit user-provided screenshot, design reference, or instruction for the screen being changed.
2. Otherwise, match the nearest existing screen in the same area of the product.
3. Use these guidelines when there is no clear screen-level reference.

This guide establishes the **admin-side fallback**. The existing user-facing UI is a protected baseline and must remain visually and behaviorally unchanged unless the user explicitly requests a user-side change.

## Admin-side visual direction

The admin UI should feel calm, compact, clear, and operational. Prefer filled surfaces and spacing to decorative outlines. Keep CSSApply's blue identity, but avoid neon-like saturation, glows, and unnecessary gradients.

### Core colors

Use the existing CSSApply palette already present in the admin screens:

| Purpose | Color | Guidance |
| --- | --- | --- |
| Main page background | `#F3F3FD` | Existing pale lavender-blue background. |
| Primary text / dark brand blue | `#134687` | Headings, body text, and primary buttons. |
| Action/link blue | `#044FAF` | Links, selected states, focus indicators, and secondary emphasis. |
| Blue accent | `#005FD9` | Use sparingly; avoid large, highly saturated areas. |
| Pale blue surface | `#E8F2FF` | Filled controls, panels, selected rows, and secondary surfaces. |
| Very pale blue surface | `#F3F8FF` | Quiet cards, notices, and table striping. |
| Main surface | `#FFFFFF` | Content cards, forms, and dialogs. |
| Muted text | `#134687` at reduced opacity | Supporting details; maintain readable contrast. |

Do not introduce a new accent palette for a single control or page. Green and red may be used sparingly for meaningful success/approval and destructive/rejected states. A **Needs Revision** state is not a rejection: present it with a calm brand-blue or neutral treatment, not a red or loud amber treatment.

### Fills, borders, and decorative lines

- Prefer a clear fill (`white`, pale blue, or very pale blue) over a solid outline.
- Avoid heavy or high-contrast borders around cards and controls. If a boundary is necessary, use a very subtle blue tint or separation by spacing and background fill.
- Do not add colored vertical accent bars or lines on the left **or right** of a card, note, status, or comment. Do not use a colored line as the primary way to communicate state.
- Avoid neon glows, strong drop shadows, high-saturation gradients, and stacked decorative effects.
- Keep the existing branded gradient title treatment only where the surrounding admin page already uses it. Do not repeat large gradients inside the page content.
- Use filled status chips with clear text rather than outlined, glowing, or color-only indicators.

### Typography and alignment

- Use the existing Poppins heading and Inter body typography (`font-poppins` and `font-inter`).
- Use centered alignment for page titles, concise summaries, status/count tiles, confirmation dialogs, and empty/loading/success states when it matches adjacent screens.
- Keep applicant names, long comments, emails, and table content left-aligned for scanning. Center short status values and numeric data where that improves comparison.
- Use monospace sparingly for IDs, timestamps, and other fixed-format metadata; do not make ordinary content look technical or overly dense.
- Keep labels concise and visually secondary to their values. Avoid excessive uppercase, tiny text, or long all-caps headings.
- Preserve readable contrast. Muted text should remain legible; do not rely on opacity so low that it fades into the background.

### Compactness and layout

Compactness is a core requirement for admin screens:

- Prefer short, grouped sections and modest spacing (`gap-2`/`gap-3`, `p-3`/`p-4`) over tall stacks of cards.
- Remove duplicate headings, redundant wrappers, and unused whitespace. Put related controls together and keep their labels close to them.
- Keep applicant rows compact but readable: name and primary identifier first, secondary metadata below, then status/comment and actions in a predictable place.
- Use consistent card padding and button heights within a screen. Avoid oversized empty cards, large decorative headers, and excessive vertical margins.
- On narrow screens, stack controls and actions cleanly; avoid horizontal page scrolling. If a table must scroll horizontally, keep the scroll within the table container.
- Do not shrink text below a comfortable reading size to achieve compactness. Prefer shortening labels and reducing empty space instead.

### Controls and interaction states

- Primary actions use a solid CSSApply blue fill (`#134687` or `#044FAF`) with white text and a darker blue hover state.
- Secondary actions use a pale-blue fill with dark-blue text. Prefer this over an isolated colored outline.
- Inputs and selects should use a clean light surface, dark-blue text, and a restrained blue focus treatment. Keep focus indicators visible for keyboard users without neon glow.
- Disabled controls must look disabled and must not appear actionable.
- Use red only for destructive or rejected states. Do not use red for a non-rejection revision request.
- Use status text as well as color. A user must not need to infer meaning from color alone.

### Tables, status notes, and comments

- Use a dark CSSApply-blue table header with white text when consistent with nearby admin tables.
- Use subtle white / pale-blue row fills for separation; avoid heavy cell borders and vertical grid lines.
- Keep row actions aligned consistently and avoid making the action column visually louder than the record.
- Show reviewer comments in a quiet filled note (white or pale blue) with dark, readable text. No colored side stripe or bright warning box for a non-rejection revision.
- Reserve red notes for rejected/invalid states. For Needs Revision, use a neutral blue treatment and label it clearly, such as “Revision requested.”

## User-facing UI: preserve unchanged

The public/applicant experience is **not being redesigned by this guide**. Keep existing user-side pages, forms, progress screens, colors, spacing, typography, copy, and interaction flow as they are today.

- Do not apply admin compactness rules or new admin colors to applicant pages.
- Do not make global CSS or shared-component changes that alter user-facing screens as a side effect of an admin update.
- If a future request explicitly changes a user-side screen, scope the change to that screen and preserve its surrounding established design unless the user asks otherwise.
- Treat existing user-side screenshots and behavior as constraints, not as an invitation to normalize them to the admin UI.

## Fallback examples

A compact filled admin panel may look like this:

```tsx
<section className="rounded-xl bg-white p-4 sm:p-5">
  <h2 className="font-poppins text-base font-semibold text-[#134687]">
    Receipt status
  </h2>
  <p className="mt-1 text-sm text-[#134687]/70">Review the saved comment.</p>
  <div className="mt-3 rounded-lg bg-[#F3F8FF] p-3 text-sm text-[#134687]">
    Revision requested: attach the acknowledgement receipt.
  </div>
</section>
```

A primary admin action may look like this:

```tsx
<button className="rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0F376B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] focus-visible:ring-offset-2">
  Save changes
</button>
```

Avoid patterns such as thick colored side borders, neon focus glows, highly saturated gradients, or large amounts of empty padding around a single control.

## Review checklist

Before considering an admin UI change complete, verify:

- [ ] It follows a relevant screenshot or nearby admin page before applying this fallback.
- [ ] Surfaces are primarily distinguished by restrained fills and spacing, not solid outlines.
- [ ] There are no colored right-side/left-side accent lines or neon-like effects.
- [ ] Colors come from the CSSApply palette and status colors carry clear meaning.
- [ ] Text alignment supports scanning: centered summaries, left-aligned records/comments.
- [ ] The layout is compact without making labels or content hard to read.
- [ ] Loading, empty, error, disabled, and keyboard-focus states remain clear.
- [ ] Responsive layouts do not create page-level horizontal overflow.
- [ ] User-facing screens remain unchanged unless explicitly included in the request.
