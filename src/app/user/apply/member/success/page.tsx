import ApplicationGuard from "@/components/ApplicationGuard";
import SuccessPageContent from "./content";

export default function SuccessPage() {
  return (
    <ApplicationGuard applicationType="member">
      <SuccessPageContent />
    </ApplicationGuard>
  );
}
