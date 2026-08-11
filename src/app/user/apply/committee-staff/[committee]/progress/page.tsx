import ApplicationGuard from "@/components/ApplicationGuard";
import CommitteeStaffProgressPageContent from "./content";

export default function CommitteeStaffProgressPage() {
  return (
    <ApplicationGuard applicationType="committee">
      <CommitteeStaffProgressPageContent />
    </ApplicationGuard>
  );
}
