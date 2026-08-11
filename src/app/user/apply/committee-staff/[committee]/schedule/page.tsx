import ApplicationGuard from "@/components/ApplicationGuard";
import SchedulePageContent from "./content";

export default function SchedulePage() {
  return (
    <ApplicationGuard applicationType="committee">
      <SchedulePageContent />
    </ApplicationGuard>
  );
}
