// Test file to verify ApplicationGuard functionality
// This demonstrates how the ApplicationGuard component works

import ApplicationGuard from "@/components/ApplicationGuard";

// Example usage for different application types:

// 1. Member application protection
function MemberSchedulePage() {
  return (
    <ApplicationGuard applicationType="member">
      <div>Member Schedule Page Content</div>
    </ApplicationGuard>
  );
}

// 2. Committee application protection
function CommitteeSchedulePage() {
  return (
    <ApplicationGuard applicationType="committee">
      <div>Committee Schedule Page Content</div>
    </ApplicationGuard>
  );
}

// 3. Executive Assistant application protection
function EASchedulePage() {
  return (
    <ApplicationGuard applicationType="ea">
      <div>EA Schedule Page Content</div>
    </ApplicationGuard>
  );
}

// 4. Custom redirect path
function CustomRedirectPage() {
  return (
    <ApplicationGuard
      applicationType="member"
      redirectPath="/custom/redirect/path"
    >
      <div>Custom Redirect Page Content</div>
    </ApplicationGuard>
  );
}

export {
  MemberSchedulePage,
  CommitteeSchedulePage,
  EASchedulePage,
  CustomRedirectPage,
};
