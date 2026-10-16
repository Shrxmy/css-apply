"use client";

import {
  CalendarDays,
  ClipboardCheck,
  QrCode,
  Upload,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import MobileSidebar from "@/components/AdminMobileSB";
import SidebarContent from "@/components/AdminSidebar";
import { focus } from "@/components/admin/ui";
import AttendanceEventsPanel from "@/components/attendance/AttendanceEventsPanel";
import AttendanceImportPanel from "@/components/attendance/AttendanceImportPanel";
import AttendanceQrTestPanel from "@/components/attendance/AttendanceQrTestPanel";
import AttendanceScannerPanel from "@/components/attendance/AttendanceScannerPanel";
import type { AttendanceCycle, AttendanceEvent } from "@/types/attendance";

type Tab = "events" | "check-in" | "qr-test" | "import";

type AttendanceOverview = {
  events: AttendanceEvent[];
  cycles: AttendanceCycle[];
  canManage: boolean;
};

// Kept across client-side navigation so a revisit renders immediately while
// fresh data loads in the background.
let cachedOverview: AttendanceOverview | null = null;

export default function AttendanceAdminPage() {
  const [tab, setTab] = useState<Tab>("events");
  const [events, setEvents] = useState<AttendanceEvent[]>(
    () => cachedOverview?.events ?? [],
  );
  const [cycles, setCycles] = useState<AttendanceCycle[]>(
    () => cachedOverview?.cycles ?? [],
  );
  const [canManage, setCanManage] = useState(
    () => cachedOverview?.canManage ?? false,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/attendance/events", {
        cache: "no-store",
      });
      const body = (await response.json()) as {
        error?: string;
        events?: AttendanceEvent[];
        cycles?: AttendanceCycle[];
        canManage?: boolean;
      };
      if (!response.ok) {
        throw new Error(body.error || "Attendance events could not be loaded");
      }
      cachedOverview = {
        events: body.events || [],
        cycles: body.cycles || [],
        canManage: Boolean(body.canManage),
      };
      setEvents(cachedOverview.events);
      setCycles(cachedOverview.cycles);
      setCanManage(cachedOverview.canManage);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Attendance events could not be loaded",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // The API checks the session itself, so there is no need to wait for the
  // client session round trip before loading.
  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const tabs: Array<{
    id: Tab;
    label: string;
    icon: typeof CalendarDays;
    visible: boolean;
  }> = [
    { id: "events", label: "Events", icon: CalendarDays, visible: true },
    { id: "check-in", label: "Check-in", icon: QrCode, visible: true },
    {
      id: "qr-test",
      label: "QR test",
      icon: ClipboardCheck,
      visible: true,
    },
    {
      id: "import",
      label: "Import students",
      icon: Upload,
      visible: canManage,
    },
  ];

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#F3F3FD] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-repeat">
      <MobileSidebar>
        <SidebarContent activePage="attendance" />
      </MobileSidebar>

      <main className="h-screen flex-1 overflow-y-auto p-5 pt-28 sm:p-6 md:p-8 md:pt-12">
        <header className="mb-6 mt-2 md:mt-8">
          <div className="mb-4 flex w-fit items-center gap-3 rounded-[45px] bg-linear-to-r from-[#2F7EE3] to-[#0349A2] px-6 py-3 text-white lg:px-8 lg:py-4">
            <QrCode className="h-5 w-5 lg:h-7 lg:w-7" />
            <h1 className="font-poppins text-xl font-medium lg:text-4xl">
              Event Attendance
            </h1>
          </div>
          <p className="mb-4 max-w-3xl text-xs font-light leading-5 text-black lg:text-lg">
            Build event rosters from CSSApply members, committee staff,
            executive associates, and imported CS students, then scan their
            approved QR credentials.
          </p>
          <hr className="border-[#005FD9]" />
        </header>

        <nav
          className="mb-5 rounded-2xl border border-[#005FD9]/10 bg-white p-2 shadow-sm"
          aria-label="Attendance sections"
        >
          <div className="flex gap-1 overflow-x-auto">
            {tabs
              .filter((item) => item.visible)
              .map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 font-poppins text-sm font-semibold transition-colors ${focus} ${active ? "bg-[#E8F2FF] text-[#134687]" : "text-[#134687]/55 hover:bg-[#F7F9FC] hover:text-[#134687]"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
          </div>
        </nav>

        {error && (
          <div
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {tab === "events" && (
          <AttendanceEventsPanel
            events={events}
            cycles={cycles}
            canManage={canManage}
            loading={loading}
            onReload={loadEvents}
            onCheckIn={(eventId) => {
              setSelectedEventId(eventId);
              setTab("check-in");
            }}
          />
        )}
        {tab === "check-in" && (
          <AttendanceScannerPanel
            events={events}
            initialEventId={selectedEventId}
            onAttendanceChange={loadEvents}
          />
        )}
        {tab === "qr-test" && <AttendanceQrTestPanel events={events} />}
        {tab === "import" && canManage && (
          <AttendanceImportPanel cycles={cycles} />
        )}

        {!loading && cycles.length === 0 && (
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-[#D6A326]/30 bg-[#FFF8E7] px-4 py-3 text-sm text-[#6F4B00]">
            <UsersRound
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            Create a recruitment cycle before configuring attendance events.
          </div>
        )}
      </main>
    </div>
  );
}
