import ApplicationGuard from "@/components/ApplicationGuard";
import MemberProgressPageContent from "./content";

export default function MemberProgressPage() {
  return (
    <ApplicationGuard applicationType="member">
      <MemberProgressPageContent />
    </ApplicationGuard>
  );
}
