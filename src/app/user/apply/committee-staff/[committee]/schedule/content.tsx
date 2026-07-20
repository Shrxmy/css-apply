"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
// import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConfirmationModal from "@/components/Modal";
import { committeeRoles } from "@/data/committeeRoles";
import { getRoleId } from "@/lib/eb-mapping";
import { useApplicationsOpen } from "@/lib/useApplicationsOpen";

export default function SchedulePageContent() {
  const router = useRouter();
  const { committee: committeeId } = useParams<{ committee: string }>();

  // Gate: redirect to /user when applications are closed
  const applicationsOpen = useApplicationsOpen("/user");

  // State for scheduling
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<
    Array<{
      id: string;
      start: string;
      end: string;
      date: string;
      time: string;
      isBooked: boolean;
      assignedEB: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groupedSlots, setGroupedSlots] = useState<
    Record<
      string,
      Array<{
        id: string;
        start: string;
        end: string;
        date: string;
        time: string;
        isBooked: boolean;
        assignedEB: string;
      }>
    >
  >({});
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showModal) {
        setShowModal(false);
      }
    };

    if (showModal) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden"; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [showModal]);

  const fetchUnavailableSlots = useCallback(async () => {
    const ebForInterview = await fetch(
      `/api/applications/committee-staff/eb/${committeeId}`
    );
    const ebRes = await ebForInterview.json();
    const ebForInterviewData = ebRes.ebs;

    const ebUnavailabilityMap = await Promise.all(
      ebForInterviewData.map(async (eb: { position: string }) => {
        // Fetch unavailable slots
        const unavailableResponse = await fetch(
          `/api/admin/unavailable-slots/${getRoleId(eb.position)}`
        );
        const unavailableData = await unavailableResponse.json();
        const unavailableSlots = unavailableData.unavailableSlotsData.map(
          (slot: { date: string; startTime: string; endTime: string }) =>
            `${slot.date}-${slot.startTime}-${slot.endTime}`
        );

        // Fetch existing interview bookings
        const interviewSlotsResponse = await fetch(
          `/api/admin/interview-slots/${eb.position}`
        );
        const interviewSlotsData = await interviewSlotsResponse.json();
        const bookedSlots = interviewSlotsData.success
          ? interviewSlotsData.slots.map(
              (slot: { day: string; timeStart: string; timeEnd: string }) =>
                `${slot.day}-${slot.timeStart}-${slot.timeEnd}`
            )
          : [];

        return {
          eb: eb.position,
          unavailableSlots: new Set(unavailableSlots),
          bookedSlots: new Set(bookedSlots),
        };
      })
    );

    // Create a flattened set for backward compatibility
    const flattenedSlots = ebUnavailabilityMap.flatMap((item) =>
      Array.from(item.unavailableSlots)
    );

    return {
      unavailableSlots: new Set(flattenedSlots),
      ebUnavailabilityMap,
      allEbs: ebForInterviewData.map((eb: { position: string }) => eb.position),
    };
  }, [committeeId]);

  // Generate hardcoded available slots (same as admin)
  useEffect(() => {
    const generateHardcodedSlots = async () => {
      const { ebUnavailabilityMap, allEbs } = await fetchUnavailableSlots();
      const now = new Date();

      const slots: Array<{
        id: string;
        start: string;
        end: string;
        date: string;
        time: string;
        isBooked: boolean;
        assignedEB: string;
      }> = [];

      // Fetch interview dates from active recruitment cycle
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(end.getDate() + 14); // Default fallback
      try {
        const cycleRes = await fetch('/api/admin/recruitment-cycle');
        if (cycleRes.ok) {
          const cycleData = await cycleRes.json();
          if (cycleData.activeCycle?.interviewStart) {
            const [year, month, day] = cycleData.activeCycle.interviewStart
              .slice(0, 10)
              .split("-")
              .map(Number);
            start.setFullYear(year, month - 1, day);
            start.setHours(0, 0, 0, 0);
          }
          if (cycleData.activeCycle?.interviewEnd) {
            const [year, month, day] = cycleData.activeCycle.interviewEnd
              .slice(0, 10)
              .split("-")
              .map(Number);
            end.setFullYear(year, month - 1, day);
          }
        }
      } catch {
        // Keep defaults
      }
      end.setHours(23, 59, 59, 999);

      const hardcodedDates: Date[] = [];
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        hardcodedDates.push(new Date(date));
      }

      // Use shared unavailable slots from admin settings

      hardcodedDates.forEach((date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        // Generate time slots from 7 AM to 9 PM in 30-minute increments
        for (let hour = 7; hour < 21; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const timeStr = `${hour.toString().padStart(2, "0")}:${minute
              .toString()
              .padStart(2, "0")}`;
            const startTime = new Date(date);
            startTime.setHours(hour, minute, 0, 0);

            // Skip slots that are in the past for today's date
            if (
              date.toDateString() === now.toDateString() &&
              startTime.getTime() <= now.getTime()
            ) {
              continue;
            }

            const endTime = new Date(startTime);
            endTime.setMinutes(startTime.getMinutes() + 30);

            const endTimeStr = `${endTime
              .getHours()
              .toString()
              .padStart(2, "0")}:${endTime
              .getMinutes()
              .toString()
              .padStart(2, "0")}`;
            const slotId = `${dateStr}-${timeStr}-${endTimeStr}`;

            // Find which EBs are available for this time slot
            const availableEBsForSlot = allEbs.filter((eb: string) => {
              const ebData = ebUnavailabilityMap.find((item) => item.eb === eb);
              if (!ebData) return true;

              const slotEndTime = new Date(startTime);
              slotEndTime.setMinutes(startTime.getMinutes() + 30);
              const endTimeStr = `${slotEndTime
                .getHours()
                .toString()
                .padStart(2, "0")}:${slotEndTime
                .getMinutes()
                .toString()
                .padStart(2, "0")}`;

              // Check if this time slot is already booked for this EB
              const slotKey = `${dateStr}-${timeStr}-${endTimeStr}`;
              if (ebData.bookedSlots.has(slotKey)) {
                return false;
              }

              // Check if this EB is unavailable at this time slot
              return !(Array.from(ebData.unavailableSlots) as string[]).some(
                (unavailableSlot: string) => {
                  const parts = unavailableSlot.split("-");
                  if (parts.length >= 4) {
                    const unavailableDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
                    const unavailableStartTime = parts[3];
                    const unavailableEndTime = parts[4];

                    if (unavailableDate === dateStr) {
                      const slotTimeMinutes = hour * 60 + minute;
                      const [startHour, startMinute] = unavailableStartTime
                        .split(":")
                        .map(Number);
                      const [endHour, endMinute] = unavailableEndTime
                        .split(":")
                        .map(Number);
                      const startTimeMinutes = startHour * 60 + startMinute;
                      const endTimeMinutes = endHour * 60 + endMinute;

                      return (
                        slotTimeMinutes >= startTimeMinutes &&
                        slotTimeMinutes < endTimeMinutes
                      );
                    }
                  }
                  return false;
                }
              );
            });

            if (availableEBsForSlot.length > 0) {
              // Randomly assign one EB from the available EBs
              const randomIndex = Math.floor(
                Math.random() * availableEBsForSlot.length
              );
              const assignedEB = availableEBsForSlot[randomIndex];

              slots.push({
                id: slotId,
                start: startTime.toISOString(),
                end: endTimeStr,
                date: dateStr,
                time: timeStr,
                isBooked: false,
                assignedEB: assignedEB,
              });
            } else {
              // Keep fully unavailable slots visible as dark blocked cells.
              slots.push({
                id: slotId,
                start: startTime.toISOString(),
                end: endTimeStr,
                date: dateStr,
                time: timeStr,
                isBooked: true,
                assignedEB: "",
              });
            }
          }
        }
      });

      setAvailableSlots(slots);

      // Group slots by date
      const grouped = slots.reduce(
        (acc, slot) => {
          if (!acc[slot.date]) {
            acc[slot.date] = [];
          }
          acc[slot.date].push(slot);
          return acc;
        },
        {} as Record<
          string,
          Array<{
            id: string;
            start: string;
            end: string;
            date: string;
            time: string;
            isBooked: boolean;
            assignedEB: string;
          }>
        >
      );

      setGroupedSlots(grouped);
      setIsLoading(false);
    };

    generateHardcodedSlots();
  }, [fetchUnavailableSlots]);

  const handleSlotSelect = (slotId: string) => {
    if (selectedSlot === slotId) {
      setSelectedSlot(null);
    } else {
      setSelectedSlot(slotId);
    }
  };

  const handleSubmitClick = () => {
    if (selectedSlot) {
      setShowModal(true);
    }
  };

  const handleConfirmSchedule = async () => {
    if (selectedSlot) {
      const selectedSlotData = availableSlots.find(
        (slot) => slot.id === selectedSlot
      );

      if (!selectedSlotData) {
        alert("Selected slot not found");
        return;
      }

      setIsSubmitting(true);

      try {
        const userResponse = await fetch("/api/applications/committee-staff");
        let studentNumber = "";

        if (userResponse.ok) {
          const userData = await userResponse.json();
          studentNumber = userData.user?.studentNumber || "";
        }

        if (!studentNumber) {
          throw new Error("Student number not found");
        }

        const response = await fetch(
          "/api/applications/committee-staff/schedule",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              studentNumber,
              interviewSlotDay: selectedSlotData.date,
              interviewSlotTimeStart: selectedSlotData.time,
              interviewSlotTimeEnd: selectedSlotData.end,
              interviewBy: selectedSlotData.assignedEB,
            }),
          }
        );

        const result = await response.json();

        if (response.ok) {
          setShowModal(false);

          // Store scheduled time for success page
          const date = new Date(selectedSlotData.date);
          const formattedDate = date.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const [hourStr, minute] = selectedSlotData.time.split(":");
          let hour = parseInt(hourStr, 10);
          const ampm = hour >= 12 ? "pm" : "am";
          hour = hour % 12;
          if (hour === 0) hour = 12;
          const formattedTime = `${hour}:${minute} ${ampm}`;

          localStorage.setItem(
            "scheduledTime",
            `${formattedDate} at ${formattedTime}`
          );

          router.push(`/user/apply/committee-staff/${committeeId}/success`);
        } else {
          if (result.conflict) {
            // Handle slot conflict - refresh the page to get updated availability
            alert(`This time slot is no longer available. Please select another time slot.`);
            window.location.reload();
          } else {
            alert(`Error: ${result.error}`);
          }
        }
      } catch (error) {
        console.error("Error scheduling interview:", error);
        alert("Failed to schedule interview. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancelSubmit = () => {
    setShowModal(false);
  };

  const selectedCommittee = committeeRoles.find(
    (role) => role.id === committeeId
  );

  if (!selectedCommittee) {
    return (
      <section className="min-h-screen bg-[rgb(243,243,253)]">
        <div className="flex flex-col justify-center items-center px-50 py-20">
          <div className="text-center">
            <h1 className="text-2xl font-inter font-bold text-black mb-4">
              Committee not found
            </h1>
            <button
              onClick={() => router.push("/user/apply/committee-staff")}
              className="bg-[#044FAF] text-white px-6 py-3 rounded-md font-inter font-normal text-sm hover:bg-[#04387B] transition-all duration-150 active:scale-95"
            >
              Back to Committee Selection
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Block access when applications are closed (redirect fires from hook)
  if (!applicationsOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F3FD]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#044FAF]"></div>
          <p className="mt-3 text-sm text-[#134687]/60">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white sm:bg-[rgb(243,243,253)] sm:bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] sm:bg-cover  sm:bg-no-repeat flex flex-col justify-between">
      <Header />

      <section className="flex flex-col items-center justify-center my-12 lg:my-28">
        <div className="w-[80%] rounded-3xl  sm:bg-white sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] md:p-16 lg:py-20 lg:px-24">
          <div className="text-3xl lg:text-4xl font-raleway font-semibold mb-2 lg:mb-4">
            <span className="text-black">Apply for </span>
            <span className="text-[#134687]">
              {selectedCommittee.title} Committee
            </span>
          </div>

          <div className="text-black text-xs lg:text-[16px] font-Inter font-light text-justify">
            {selectedCommittee.description}
          </div>

          <hr className="my-5 lg:my-8 border-t border-[#717171]" />

          <div className="flex flex-col items-center justify-center">
            {/* Stepper */}
            <div className="w-full flex flex-col items-center justify-center">
              <div className="flex items-center">
                <div
                  onClick={() => router.push("/user/apply/committee-staff")}
                  className="flex items-center justify-center rounded-full bg-[#D9D9D9] w-5 h-5 lg:w-10 lg:h-10 cursor-pointer hover:bg-[#DAE2ED] transition-colors"
                >
                  <span className="text-[#696767] text-[9px] lg:text-xs font-bold font-inter">
                    1
                  </span>
                </div>

                <div className="w-20 lg:w-24 h-0.5 lg:h-0.75 bg-[#D9D9D9]" />

                <div
                  onClick={() =>
                    router.push(
                      `/user/apply/committee-staff/${committeeId}/application`
                    )
                  }
                  className="flex items-center justify-center rounded-full bg-[#D9D9D9] w-5 h-5 lg:w-10 lg:h-10 cursor-pointer hover:bg-[#DAE2ED] transition-colors"
                >
                  <span className="text-[#696767] text-[9px] lg:text-xs font-bold font-inter">
                    2
                  </span>
                </div>

                <div className="w-20 lg:w-24 h-0.5 lg:h-0.75 bg-[#D9D9D9]" />

                <div className="flex items-center justify-center rounded-full bg-[#2F7EE3] w-5 h-5 lg:w-10 lg:h-10">
                  <span className="text-white text-[9px] lg:text-xs font-bold font-inter">
                    3
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 w-72 lg:w-100 mt-3 gap-x-0 place-items-center font-inter font-medium">
                <span className="text-[9px] lg:text-[11px] leading-none whitespace-nowrap text-center">
                  Select a Role
                </span>
                <span className="text-[9px] lg:text-[11px] leading-none whitespace-nowrap text-center">
                  Enter Information
                </span>
                <span className="text-[9px] lg:text-[11px] leading-none whitespace-nowrap text-center">
                  Schedule Interview
                </span>
              </div>
            </div>

            {/* Scheduling Section */}
            <div className="lg:mb-8 mt-5 lg:mt-8 flex flex-col items-center justify-center w-full">
              <p className="text-black text-xs lg:text-md font-bold text-center mb-3 lg:mb-6 font-inter">
                Click on any available slot to reserve your interview schedule.
                Each slot shows the EB who will conduct your interview. Slots
                are available when at least one EB is free.
              </p>

              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#134687]"></div>
                </div>
              ) : (
                <div className="space-y-4 w-full">
                  {Object.keys(groupedSlots).length === 0 ? (
                    <div className="text-center py-8 text-[#134687]/40 text-sm font-inter">
                      No available slots at the moment. Please check back later.
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-[#164E96] overflow-hidden">
                      <div className="overflow-x-auto divide-y divide-[#164E96]">
                        {/* Header Row */}
                        <div className="flex min-w-fit">
                          <div className="sticky left-0 bg-white z-10 px-2 py-1.5 font-inter font-semibold text-xs text-[#134687] flex items-center justify-center text-center w-12.5 lg:w-20 shrink-0 border-r border-[#164E96]">
                            Time
                          </div>
                          <div className="flex flex-1 divide-x divide-[#164E96] border-l border-[#164E96]">
                            {Object.entries(groupedSlots)
                              .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                              .map(([date]) => {
                                const dayDate = new Date(date);
                                const dayName = dayDate.toLocaleDateString("en-US", { weekday: "short" });
                                const dayNumber = dayDate.getDate();
                                return (
                                  <div key={date} className="bg-[#164E96] p-1.5 text-center shrink-0 w-12.5 lg:w-auto lg:flex-1 lg:shrink">
                                    <div className="font-inter font-semibold text-xs text-white">{dayName}</div>
                                    <div className="font-inter text-[10px] text-white/70">{dayNumber}</div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* Time slot rows */}
                        {(() => {
                          const allTimeSlots = [];
                          for (let hour = 7; hour < 21; hour++) {
                            for (let minute = 0; minute < 60; minute += 30) {
                              const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                              const endHour = minute === 30 ? hour + 1 : hour;
                              const endMinute = minute === 30 ? 0 : 30;
                              allTimeSlots.push({
                                time: timeStr,
                                displayTime: `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`,
                                endDisplayTime: `${endHour > 12 ? endHour - 12 : endHour === 0 ? 12 : endHour}:${endMinute.toString().padStart(2, "0")} ${endHour >= 12 ? "PM" : "AM"}`,
                              });
                            }
                          }

                          // Track which date columns had unavailable in the previous time slot
                          const prevRowUnavailable = new Map<string, boolean>();

                          return allTimeSlots.map((timeSlot, timeIndex) => {
                            const sortedEntries = Object.entries(groupedSlots)
                              .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());

                            const rowCells = sortedEntries.map(([date, slots]) => {
                              const slotForThisTime = slots.find((slot) => slot.time === timeSlot.time);
                              const isAvailable = slotForThisTime && !slotForThisTime.isBooked;
                              const isSelected = selectedSlot === slotForThisTime?.id;
                              const isUnavailable = slotForThisTime ? !isAvailable : false;
                              const prevUnavailable = prevRowUnavailable.get(date) ?? false;

                              // Only show "Unavailable" text on the first cell of a consecutive run
                              const showText = isUnavailable && !prevUnavailable;

                              // Update tracker for next row
                              prevRowUnavailable.set(date, isUnavailable);

                              return (
                                <div key={date} className={`min-h-9 shrink-0 w-12.5 lg:w-auto lg:flex-1 lg:shrink ${isUnavailable && prevUnavailable ? '-mt-px' : ''}`}>
                                  {slotForThisTime ? (
                                    <button
                                      onClick={() => isAvailable ? handleSlotSelect(slotForThisTime.id) : null}
                                      disabled={!isAvailable}
                                      className={`w-full h-full transition-colors text-[10px] font-inter flex items-center justify-center ${
                                        !isAvailable
                                          ? "bg-[#0f172a] cursor-not-allowed text-white/75"
                                          : isSelected
                                          ? "bg-[#044FAF] text-white font-semibold"
                                          : "bg-white hover:bg-blue-50 cursor-pointer text-[#134687]"
                                      }`}
                                    >
                                      {showText ? (
                                        <span className="block w-full text-center text-[9px] font-medium leading-none">Unavailable</span>
                                      ) : isSelected ? "Selected" : ""}
                                    </button>
                                  ) : (
                                    <div className="w-full h-full bg-gray-100"></div>
                                  )}
                                </div>
                              );
                            });

                            return (
                              <div key={timeIndex} className="flex min-w-fit">
                                <div className="sticky left-0 bg-white z-10 px-2 py-1 text-center w-12.5 lg:w-20 shrink-0 border-r border-[#164E96]">
                                  <div className="font-inter text-[11px] text-[#134687]">{timeSlot.displayTime}</div>
                                  <div className="font-inter text-[9px] text-[#134687]/40">{timeSlot.endDisplayTime}</div>
                                </div>
                                <div className="flex flex-1 divide-x divide-[#164E96] border-l border-[#164E96]">
                                  {rowCells}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="text-center text-xs text-[#134687]/40 font-inter">
                    Once a timeslot is selected, it will be reserved under your name. Changes are not allowed after confirmation.
                  </div>
                </div>
              )}
            </div>

            <hr className="my-8 border-t border-[#717171]" />

            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/user/apply/committee-staff/${committeeId}/application`
                  )
                }
                className="cursor-pointer hidden lg:block bg-[#E7E3E3] text-gray-700 px-15 py-3 rounded-lg font-inter font-semibold text-sm hover:bg-[#CDCCCC] transition-all duration-150 active:scale-95"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={!selectedSlot}
                className={` cursor-pointer whitespace-nowrap font-inter text-sm font-semibold px-15 py-3 rounded-lg border-2 transition-all duration-150 active:scale-95 ${
                  selectedSlot
                    ? "text-[#134687] border-[#134687] bg-white hover:bg-[#B1CDF0]"
                    : "text-gray-400 border-gray-300 bg-gray-100 cursor-not-allowed"
                }`}
              >
                {selectedSlot ? "Submit" : "Select a Time Slot"}
              </button>
            </div>
          </div>
        </div>

        {/* REF: lagay sa component */}
        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={showModal}
          onClose={handleCancelSubmit}
          onConfirm={handleConfirmSchedule}
          message={
            <p>
              Are you sure you want to schedule your interview for{" "}
              {(() => {
                const selectedSlotData = availableSlots.find(
                  (slot) => slot.id === selectedSlot
                );
                if (selectedSlotData) {
                  const date = new Date(selectedSlotData.date);
                  const formattedDate = date.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
                  return (
                    <>
                      <span className="font-semibold">{formattedDate}</span> at{" "}
                      <span className="font-semibold">
                        {(() => {
                          const [hourStr, minute] =
                            selectedSlotData.time.split(":");
                          let hour = parseInt(hourStr, 10);
                          const ampm = hour >= 12 ? "pm" : "am";
                          hour = hour % 12;
                          if (hour === 0) hour = 12;
                          return `${hour}:${minute} ${ampm}`;
                        })()}
                      </span>
                    </>
                  );
                }
                return (
                  <span className="font-semibold">Selected time slot</span>
                );
              })()}
              ?
            </p>
          }
          isLoading={isSubmitting}
        />
      </section>

      <Footer />
    </div>
  );
}
