import ApplicationGuard from "@/components/ApplicationGuard";
import ExecutiveAssistantProgressPageContent from "./content";

export default function ExecutiveAssistantProgressPage() {
  return (
    <ApplicationGuard applicationType="executive-associate">
      <ExecutiveAssistantProgressPageContent />
    </ApplicationGuard>
  );
}
