"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import MobileSidebar from "@/components/AdminMobileSB";
import SidebarContent from "@/components/AdminSidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import useSWR from "swr";

// import {
//   addUnavailableSlot,
//   removeUnavailableSlot,
// } from "@/data/unavailableSlots";
import {
  CalendarPlus,
  Calendar,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const swrFetcher = (url: string) => fetch(url).then((r) => r.json());

const Schedule = () => {
  const { data: session, status } = useSession();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showUnavailableBlocks, setShowUnavailableBlocks] = useState(false);
  const [unavailableTimeSlots, setUnavailableTimeSlots] = useState<
    Array<{
      id: string;
      date: string;
      timeSlot: string;
      startTime: string;
      endTime: string;
    }>
  >([]);
  const [interviewSlots, setInterviewSlots] = useState<
    Array<{
      id: string;
      day: string;
      timeStart: string;
      timeEnd: string;
      name: string;
      meetingLink: string;
    }>
  >([]);

  const shouldShowCalendar =
    showCalendar ||
    unavailableTimeSlots.length > 0 ||
    interviewSlots.length > 0;
  const [calendarEvents, setCalendarEvents] = useState<
    Array<{
      id: string;
      title: string;
      start: Date;
      end: Date;
      backgroundColor: string;
      borderColor: string;
      textColor: string;
      display: string;
      classNames: string;
    }>
  >([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ebProfile, setEbProfile] = useState<{
    userId: string;
    position: string;
    committees: string[];
    isActive: boolean;
  } | null>(null);
  const [calendarRange, setCalendarRange] = useState({
    start: new Date().toISOString().split("T")[0],
    end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  });
  const calendarRef = useRef<FullCalendar>(null);

  // Fetch recruitment cycle dates for calendar range
  useEffect(() => {
    const fetchCycle = async () => {
      try {
        const res = await fetch("/api/admin/recruitment-cycle");
        if (res.ok) {
          const data = await res.json();
          if (data.activeCycle) {
            setCalendarRange({
              start:
                data.activeCycle.interviewStart?.split("T")[0] ??
                new Date().toISOString().split("T")[0],
              end:
                data.activeCycle.interviewEnd?.split("T")[0] ??
                new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
            });
          }
        }
      } catch {
        // Keep defaults
      }
    };
    fetchCycle();
  }, []);

  // Memoized helper function to format date and time for display
  const formatDateTime = useCallback((dateStr: string, timeSlot: string) => {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    // Parse time slot (e.g., "14:30-16:00")
    const [startTime, endTime] = timeSlot.split("-");

    // Format times to 12-hour format
    const formatTime = (time: string) => {
      const [hour, minute] = time.split(":");
      const hourNum = parseInt(hour);
      const ampm = hourNum >= 12 ? "PM" : "AM";
      const displayHour = hourNum % 12 || 12;
      return `${displayHour}:${minute} ${ampm}`;
    };

    return {
      dayName,
      monthDay,
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
    };
  }, []);

  // SWR for EB profile data - caches for 5 minutes
  const { data: ebData, isLoading: isEbLoading } = useSWR(
    session?.user?.dbId ? `/api/admin/eb-profiles/${session.user.dbId}` : null,
    swrFetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 0,
    },
  );

  // Update ebProfile when EB data changes
  useEffect(() => {
    if (ebData?.ebProfile) {
      setEbProfile({
        userId: ebData.ebProfile.userId,
        position: ebData.ebProfile.position,
        committees: ebData.ebProfile.committees,
        isActive: ebData.ebProfile.isActive,
      });
    }
  }, [ebData]);

  // SWR for unavailable slots - uses ebData position to avoid circular dependency
  const {
    data: unavailableData,
    isLoading: isUnavailableLoading,
    mutate: mutateUnavailable,
  } = useSWR(
    ebData?.ebProfile?.position
      ? `/api/admin/unavailable-slots/${encodeURIComponent(ebData.ebProfile.position)}`
      : null,
    swrFetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 0,
    },
  );

  // SWR for interview slots - uses ebData position to avoid circular dependency
  const {
    data: interviewData,
    isLoading: isInterviewLoading,
    mutate: mutateInterviews,
  } = useSWR(
    ebData?.ebProfile?.position
      ? `/api/admin/interview-slots/${encodeURIComponent(ebData.ebProfile.position)}`
      : null,
    swrFetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 0,
    },
  );

  // Update slots when SWR data changes
  useEffect(() => {
    if (unavailableData) {
      setUnavailableTimeSlots(unavailableData.unavailableSlotsData || []);
    }
    if (interviewData?.success && interviewData.slots) {
      setInterviewSlots(interviewData.slots);
    } else if (interviewData) {
      setInterviewSlots([]);
    }
  }, [unavailableData, interviewData]);

  // Combined loading state including EB profile load
  const isSlotsLoading =
    isEbLoading || isUnavailableLoading || isInterviewLoading;

  // FullCalendar event handlers
  const handleDateSelect = (selectInfo: { start: Date; end: Date }) => {
    const start = selectInfo.start;
    const end = selectInfo.end;

    // Create a single continuous block instead of individual 30-minute slots
    // Use local date to avoid timezone issues
    const startDate =
      start.getFullYear() +
      "-" +
      String(start.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(start.getDate()).padStart(2, "0");
    const endDate =
      end.getFullYear() +
      "-" +
      String(end.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(end.getDate()).padStart(2, "0");
    const startTime = start.toTimeString().slice(0, 5);
    const endTime = end.toTimeString().slice(0, 5);

    // If it's the same day, create one block
    if (startDate === endDate) {
      const timeSlot = `${startTime}-${endTime}`;
      const newSlot = {
        id: `slot-${Date.now()}-${Math.random()}`,
        date: startDate,
        timeSlot: timeSlot,
        startTime: startTime,
        endTime: endTime,
      };
      setUnavailableTimeSlots((prev) => [...prev, newSlot]);
    } else {
      const current = new Date(start);
      const endDay = new Date(end);

      // Reset to start of day for comparison
      current.setHours(0, 0, 0, 0);
      endDay.setHours(0, 0, 0, 0);

      while (current <= endDay) {
        // Use local date to avoid timezone issues
        const dateStr =
          current.getFullYear() +
          "-" +
          String(current.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(current.getDate()).padStart(2, "0");
        let dayStartTime = "";
        let dayEndTime = "";

        // Only create blocks for days that have actual selected time
        if (current.toDateString() === start.toDateString()) {
          // First day - from start time to end of day
          dayStartTime = startTime;
          dayEndTime = "21:00";
        } else if (current.toDateString() === end.toDateString()) {
          // Last day - from start of day to end time
          dayStartTime = "07:00";
          dayEndTime = endTime;
        } else {
          // Skip middle days - don't create full day blocks
          current.setDate(current.getDate() + 1);
          continue;
        }

        const timeSlot = `${dayStartTime}-${dayEndTime}`;
        const newSlot = {
          id: `slot-${Date.now()}-${Math.random()}`,
          date: dateStr,
          timeSlot: timeSlot,
          startTime: dayStartTime,
          endTime: dayEndTime,
        };
        setUnavailableTimeSlots((prev) => [...prev, newSlot]);
        current.setDate(current.getDate() + 1);
      }
    }
  };

  const handleEventClick = (clickInfo: {
    event: {
      id: string;
      extendedProps?: { fullName?: string; timeSlot?: string };
    };
  }) => {
    // Only allow removal of unavailable slots, not interview slots
    const eventId = clickInfo.event.id;

    // Check if this is an interview slot (starts with "interview-")
    if (eventId.startsWith("interview-")) {
      const fullName = clickInfo.event.extendedProps?.fullName;
      const timeSlot = clickInfo.event.extendedProps?.timeSlot;
      if (fullName) {
        toast.info(`Interview: ${timeSlot}\nApplicant: ${fullName}`);
      } else {
        toast.info(
          "Interview slots cannot be removed directly. They are managed through applications.",
        );
      }
      return;
    }

    // Remove unavailable slot if clicked
    const actualSlotId = eventId.replace("unavailable-", "");
    setCalendarEvents((prev) => prev.filter((event) => event.id !== eventId));
    setUnavailableTimeSlots((prev) =>
      prev.filter((slot) => slot.id !== actualSlotId),
    );
  };

  const generateCalendarEvents = useCallback(() => {
    const events = [];

    // Convert unavailable time slots to FullCalendar events
    const unavailableEvents = unavailableTimeSlots.map((slot) => {
      const startDateTime = new Date(`${slot.date}T${slot.startTime}:00`);
      const endDateTime = new Date(`${slot.date}T${slot.endTime}:00`);

      return {
        id: `unavailable-${slot.id}`,
        title: "Unavailable", // Show text
        start: startDateTime,
        end: endDateTime,
        backgroundColor: "#134687",
        borderColor: "#0f3a6b",
        textColor: "white", // Make text white
        display: "block",
        classNames: "unavailable-event", // Add custom class
      };
    });

    // Convert interview slots to FullCalendar events
    const interviewEvents = interviewSlots
      .map(
        (slot: {
          id: string;
          day: string;
          name: string;
          timeStart: string;
          timeEnd: string;
          meetingLink?: string;
        }) => {
          // Ensure we have valid date and time data
          if (!slot.day || !slot.timeStart || !slot.timeEnd) {
            console.warn(`Invalid slot data for ${slot.name}:`, slot);
            return null;
          }

          // Parse dates more carefully to avoid timezone issues
          const startDateTime = new Date(`${slot.day}T${slot.timeStart}:00`);
          const endDateTime = new Date(`${slot.day}T${slot.timeEnd}:00`);

          // Validate the parsed dates
          if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            console.warn(`Invalid date parsing for ${slot.name}:`, {
              day: slot.day,
              timeStart: slot.timeStart,
              timeEnd: slot.timeEnd,
              startDateTime,
              endDateTime,
            });
            return null;
          }

          // Create a shorter title to prevent overflow
          const shortName =
            slot.name.length > 15
              ? `${slot.name.substring(0, 12)}...`
              : slot.name;
          const timeSlot = `${slot.timeStart}-${slot.timeEnd}`;
          const title = shortName; // Just show the name, FullCalendar handles the time display

          return {
            id: `interview-${slot.id}`,
            title: title,
            start: startDateTime,
            end: endDateTime,
            backgroundColor: "#dc2626", // Red color for interviews
            borderColor: "#b91c1c",
            textColor: "white",
            display: "block",
            classNames: "interview-event", // Add custom class
            extendedProps: {
              fullName: slot.name, // Store full name for tooltip
              timeSlot: timeSlot,
            },
          };
        },
      )
      .filter((event): event is NonNullable<typeof event> => event !== null); // Remove any null events

    events.push(...unavailableEvents, ...interviewEvents);

    // Debug: Log all events being passed to calendar

    setCalendarEvents(events);
  }, [unavailableTimeSlots, interviewSlots]);

  // Memoized calendar events to prevent unnecessary re-renders
  const memoizedCalendarEvents = useMemo(() => {
    return calendarEvents;
  }, [calendarEvents]);

  // Optimized effect for calendar events
  useEffect(() => {
    if (unavailableTimeSlots.length > 0 || interviewSlots.length > 0) {
      generateCalendarEvents();
    }
  }, [unavailableTimeSlots, interviewSlots, generateCalendarEvents]);

  // Refresh function - use SWR mutate to trigger revalidation
  const refreshSchedule = useCallback(() => {
    mutateUnavailable();
    mutateInterviews();
  }, [mutateUnavailable, mutateInterviews]);

  // SWR automatically loads data, no need for manual fetch
  // The useEffect above updates slots when SWR data changes

  const handleCreateSlot = async () => {
    if (unavailableTimeSlots.length === 0) {
      toast.error("Please select time slots to mark as unavailable");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!ebProfile) return;

    try {
      setIsSaving(true);

      const unavailableSlots = unavailableTimeSlots.map((slot) => ({
        id: `${slot.date}-${slot.startTime}-${slot.endTime}`,
        eb: ebProfile.position,
        day: slot.date,
        timeStart: slot.startTime,
        timeEnd: slot.endTime,
      }));
      const response = await fetch("/api/admin/unavailable-slots", {
        method: "POST",
        body: JSON.stringify(unavailableSlots),
      });

      const res = await response.json();
      if (!res.success) {
        console.error("Error creating unavailable slots:", res.error);
        toast.error(res.message);
        throw new Error(res.message);
      }

      // Reset form and close calendar
      setShowCalendar(false);
      setShowConfirmModal(false);
      // Trigger refresh to reload data via SWR mutate
      mutateUnavailable();
      mutateInterviews();
      toast.success("Unavailable time slots saved successfully!");
    } catch (error) {
      console.error("Error creating unavailable slots:", error);
      toast.error("Failed to save unavailable time slots");
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading for session only
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F3FD] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-repeat">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#044FAF]"></div>
          <p className="mt-4 text-[#134687]">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F3F3FD] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-repeat overflow-x-hidden">
      {/* Sidebar Navigation */}
      <MobileSidebar>
        <SidebarContent activePage="schedule" />
      </MobileSidebar>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 md:p-8 pt-16 md:pt-12 overflow-y-auto h-screen">
        {/* PAGE HEADER */}
        <div className="mb-6 mt-8 md:mb-8 md:mt-8 text-center md:text-left">
          <div className="inline-flex min-h-12 items-center gap-2 rounded-[45px] text-white text-lg lg:text-4xl font-poppins font-medium px-6 py-2 lg:py-4 text-center [background:linear-gradient(90deg,_#2F7EE3_0%,_#0349A2_100%)] w-fit mb-4">
            <span>Welcome,</span>
            {isEbLoading ? (
              <LoadingSpinner
                label="Loading position"
                size="md"
                className="border-white border-t-transparent"
              />
            ) : (
              <span>{ebData?.ebProfile?.position ?? ebProfile?.position ?? "Admin"}</span>
            )}
            <span aria-hidden="true">👋</span>
          </div>
          <p className="text-black text-xs lg:text-lg font-Inter font-light leading-5 mb-4 md:mb-6">
            Stay organized and guide applicants through their journey with CSS
            Apply.
          </p>
          <hr className="border-[#005FD9]" />
        </div>

        {/* MAIN SHAPE */}
        <div className="bg-white rounded-xl border border-[#005FD9]/10 p-4 md:p-6 mb-6 min-h-[calc(100vh-200px)] md:min-h-[calc(100vh-280px)]">
          {/* schedule header */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <div className="flex items-center space-x-2">
              {/* schedule icon */}
              <Calendar className="w-4 h-4 md:w-6 md:h-6 text-[#134687]" />
              <h2 className="text-base md:text-xl font-semibold text-[#134687]">
                Your Schedule
              </h2>
            </div>

            {/* Refresh button */}
            <button
              onClick={refreshSchedule}
              disabled={isSlotsLoading}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-[#134687] bg-white border-2 border-[#005FD9] rounded-md hover:bg-[#F3F3FD] hover:text-[#044FAF] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <div
                className="w-3 h-3 bg-current"
                style={{
                  maskImage: "url(/icons/refresh.svg)",
                  WebkitMaskImage: "url(/icons/refresh.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
              <span>Refresh</span>
            </button>
          </div>

          {/* INNER SHAPE */}
          <div
            className="bg-[#F3F3FD] border border-[#005FD9]/10 rounded-lg p-4 md:p-8"
            style={{ minHeight: "calc(100vh - 400px)" }}
          >
            {isSlotsLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 h-full px-2 text-sm text-[#134687]">
                <LoadingSpinner label="Loading schedule data" size="lg" />
                <p>Loading schedule data...</p>
              </div>
            ) : !shouldShowCalendar ? (
              <div className="flex flex-col items-center justify-center h-full px-2">
                {/* big calendar icon */}
                <div className="w-16 h-16 md:w-24 md:h-24 mb-4 md:mb-6">
                  <CalendarPlus className="w-full h-full text-[#134687]" />
                </div>

                <h3 className="text-base md:text-xl font-semibold text-[#134687] mb-2 md:mb-3 text-center">
                  Set Your Schedule
                </h3>
                <p className="text-xs md:text-base text-[#134687] text-center mb-6 md:mb-8 max-w-sm md:max-w-md">
                  Click the button below to mark your unavailable times. You can
                  select single time blocks or drag across multiple days to
                  create continuous unavailable periods.
                </p>

                <button
                  onClick={() => setShowCalendar(true)}
                  className="text-xs md:text-sm font-medium py-2 px-6 md:py-3 md:px-10 rounded-full bg-[#044FAF] text-white hover:bg-[#0349A2] transition-colors"
                >
                  Set Unavailable Times
                </button>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6">
                {interviewSlots.length > 0 && (
                  <div className="flex">
                    <h4 className="text-xs md:text-sm font-semibold text-[#134687] mb-1">
                      Meeting Link: {interviewSlots[0].meetingLink}
                    </h4>
                  </div>
                )}
                {/* Guide Message */}
                <div className="bg-white rounded-lg p-3 md:p-4">
                  <div className="flex items-start gap-2 md:gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 md:w-6 md:h-6 bg-[#044FAF] rounded-full flex items-center justify-center">
                        <span className="text-white text-xs md:text-sm font-semibold">
                          i
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs md:text-sm font-semibold text-[#134687] mb-1">
                        How to use the schedule calendar:
                      </h4>
                      <ul className="text-xs text-[#134687] space-y-1">
                        <li>
                          • <strong>View:</strong> Blue blocks show unavailable
                          times, red blocks show scheduled interviews
                        </li>
                        <li>
                          • <strong>Single day:</strong> Click and drag to
                          select a time range as unavailable
                        </li>
                        <li>
                          • <strong>Multiple days:</strong> Drag from one day to
                          another to mark entire days as unavailable
                        </li>
                        <li>
                          • <strong>Remove unavailable times:</strong> Click on
                          blue blocks to remove them
                        </li>
                        <li>
                          • <strong>Save:</strong> Click &quot;Save Unavailable
                          Times&quot; when done
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 mb-4">
                  <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">
                    Calendar Legend:
                  </h4>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#134687] rounded border border-[#0f3a6b]"></div>
                      <span className="text-xs text-[#134687]">
                        Unavailable Times
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#dc2626] rounded border border-[#b91c1c]"></div>
                      <span className="text-xs text-[#134687]">
                        Scheduled Interviews
                      </span>
                    </div>
                  </div>
                </div>

                {/* FullCalendar Component */}
                <div className="rounded-lg overflow-hidden">
                  <style jsx global>{`
                    .fc-event {
                      border-radius: 3px;
                      margin: 1px 0;
                      min-height: 20px;
                      font-size: 9px !important;
                    }
                    .fc-event-title-container {
                      overflow: hidden;
                      display: flex;
                      flex-direction: column;
                      align-items: flex-start;
                    }
                    .fc-event-time {
                      font-size: 9px !important;
                      font-weight: normal !important;
                      margin-bottom: 0px !important;
                      line-height: 1.1 !important;
                    }
                    .fc-event-title {
                      font-size: 9px !important;
                      margin-top: 0px !important;
                      line-height: 1.1 !important;
                      font-weight: normal !important;
                    }
                    .fc-event-main {
                      font-size: 9px !important;
                    }
                    .fc-event-content {
                      font-size: 9px !important;
                    }
                    .fc-event-body {
                      font-size: 9px !important;
                    }
                    .interview-event .fc-event-title {
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                      font-size: 9px !important;
                      line-height: 1.1 !important;
                      padding: 1px 3px;
                      margin-top: 0px !important;
                    }
                    .unavailable-event .fc-event-title {
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                      font-size: 9px !important;
                      line-height: 1.1 !important;
                      padding: 1px 3px;
                      margin-top: 0px !important;
                    }
                  `}</style>
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    headerToolbar={{
                      left: "prev,next",
                      center: "",
                      right: "",
                    }}
                    height="auto"
                    slotMinTime="07:00:00"
                    slotMaxTime="21:00:00"
                    slotDuration="00:30:00"
                    slotLabelInterval="00:30:00"
                    allDaySlot={false}
                    weekends={true}
                    selectable={true}
                    selectMirror={true}
                    dayMaxEvents={true}
                    moreLinkClick="popover"
                    events={memoizedCalendarEvents}
                    select={handleDateSelect}
                    eventClick={handleEventClick}
                    selectOverlap={false}
                    eventDisplay="block"
                    eventTimeFormat={{
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }}
                    selectConstraint={{
                      start: calendarRange.start,
                      end: calendarRange.end,
                    }}
                    validRange={{
                      start: calendarRange.start,
                      end: calendarRange.end,
                    }}
                    eventOverlap={false}
                    nowIndicator={true}
                    scrollTime="07:00:00"
                    businessHours={{
                      daysOfWeek: [1, 2, 3, 4, 5, 6, 0], // Monday through Sunday
                      startTime: "07:00",
                      endTime: "21:00",
                    }}
                    eventTextColor="white"
                    eventBackgroundColor="#134687"
                    eventBorderColor="#0f3a6b"
                    dayHeaderFormat={{
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    }}
                    slotLabelFormat={{
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    }}
                    dayMaxEventRows={6}
                    moreLinkContent={(arg) => {
                      return `+${arg.num} more`;
                    }}
                    eventClassNames="cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </div>

                {/* Selected Unavailable Time Slots */}
                {unavailableTimeSlots.length > 0 && (
                  <div>
                    <button
                      onClick={() =>
                        setShowUnavailableBlocks(!showUnavailableBlocks)
                      }
                      className="flex items-center justify-between w-full text-left mb-2 hover:bg-gray-50 rounded-md p-2 -m-2 transition-colors"
                    >
                      <h4 className="text-xs md:text-sm font-medium text-gray-700">
                        Selected Unavailable Time Blocks (
                        {unavailableTimeSlots.length})
                      </h4>
                      {showUnavailableBlocks ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {showUnavailableBlocks && (
                      <div className="flex flex-wrap gap-1.5 md:gap-2 overflow-hidden">
                        {unavailableTimeSlots.map((slot) => {
                          const formatted = formatDateTime(
                            slot.date,
                            slot.timeSlot,
                          );
                          return (
                            <div
                              key={slot.id}
                              className="time-block flex items-center gap-1 md:gap-2 bg-[#134687] text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs shadow-sm"
                            >
                              <Clock className="w-2.5 h-2.5 md:w-3 md:h-3 text-blue-200 flex-shrink-0" />
                              <div className="time-block-text flex flex-col min-w-0 flex-1">
                                <span className="font-medium text-xs">
                                  {formatted.dayName}, {formatted.monthDay}
                                </span>
                                <span className="text-blue-100 text-xs">
                                  {formatted.startTime} - {formatted.endTime}
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  setUnavailableTimeSlots((prev) =>
                                    prev.filter((s) => s.id !== slot.id),
                                  )
                                }
                                className="ml-1 hover:bg-[#0f3a6b] rounded-full p-0.5 md:p-1 transition-colors flex-shrink-0"
                              >
                                <X className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowCalendar(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSlot}
                    disabled={unavailableTimeSlots.length === 0}
                    className="px-4 sm:px-6 py-2 bg-[#134687] text-white rounded-lg hover:bg-[#0f3a6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Save Unavailable Times
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 sm:p-6"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-4 sm:p-6 lg:p-10 max-w-xl w-full shadow-2xl border-[#FFBC2B] border-2 sm:border-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* Header section with icon and title */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-4 sm:mb-6">
                <div className="p-2 sm:p-3 flex items-center justify-center h-12 w-12 sm:h-15 sm:w-15 rounded-full bg-[#FFE7B4] flex-shrink-0">
                  <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-[#CE9823]" />
                </div>
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                  <h3 className="text-lg sm:text-xl font-inter font-bold text-[#CE9823] mb-2">
                    Confirm Schedule Setup
                  </h3>
                  <div className="font-inter text-xs sm:text-sm text-black">
                    Please review your chosen time slots carefully. Once
                    confirmed, these will be saved to the system.
                  </div>
                </div>
              </div>

              {/* Note section */}
              <div className="bg-[#ECECEC] border-[#C8C5C5] border-1 rounded-lg px-4 sm:px-8 lg:px-14 py-4 sm:py-6 lg:py-9 mb-4 sm:mb-6 text-left">
                <p className="font-inter text-xs sm:text-sm text-[#CE9823] font-bold mb-2">
                  Note:
                </p>
                <ul className="list-disc pl-4 sm:pl-5 space-y-1 text-xs sm:text-sm text-black font-inter">
                  <li>Double-check your selected time slots before saving.</li>
                  <li>Ensure availability to avoid missed interviews.</li>
                </ul>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSaving}
                  className="px-6 sm:px-9 py-2 sm:py-2.5 bg-[#E7E3E3] text-black rounded-2xl font-inter font-semibold text-xs sm:text-sm hover:bg-gray-400 transition-colors disabled:opacity-50 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                  className="px-6 sm:px-9 py-2 sm:py-2.5 bg-[#FFBC2B] text-[#5B4515] rounded-full font-inter font-semibold text-xs sm:text-sm hover:bg-[#D9A129] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Confirm</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
