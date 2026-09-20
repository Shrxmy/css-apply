"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
// import { useSession } from "next-auth/react";
// import { adminSchedule } from "@/data/adminSchedule";
import Header from "@/components/Header";
import ConfirmationModal from "@/components/Modal";
import Footer from "@/components/Footer";
import { useEbRoles } from "@/lib/useEbRoles";
import { useApplicationsOpen } from "@/lib/useApplicationsOpen";
import { useInterviewAvailability } from "@/lib/useInterviewAvailability";

export default function SchedulePageContent() {
  const router = useRouter();
  const { "eb-role": ebId } = useParams<{ "eb-role": string }>();

  // Gate: redirect to /user when applications are closed
  const applicationsOpen = useApplicationsOpen("/user");

  // State for scheduling
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const {
    availableSlots,
    groupedSlots,
    isLoading,
    error: availabilityError,
    refresh: refreshAvailability,
  } = useInterviewAvailability("executive-associate", ebId);
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
        (slot) => slot.id === selectedSlot,
      );

      if (!selectedSlotData) {
        alert("Selected slot not found");
        return;
      }

      setIsSubmitting(true);

      try {
        const userResponse = await fetch(
          "/api/applications/executive-associate",
        );
        let studentNumber = "";

        if (userResponse.ok) {
          const userData = await userResponse.json();
          studentNumber = userData.user?.studentNumber || "";
        }

        if (!studentNumber) {
          throw new Error("Student number not found");
        }

        const response = await fetch(
          "/api/applications/executive-associate/schedule",
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
              ebRole: ebId,
              interviewBy: selectedSlotData.assignedEB,
            }),
          },
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
            `${formattedDate} at ${formattedTime}`,
          );

          router.push(`/user/apply/executive-associate/${ebId}/success`);
        } else {
          const availabilityChanged = [
            "INTERVIEW_SLOT_UNAVAILABLE",
            "INTERVIEW_SLOT_CONFLICT",
            "INTERVIEWER_UNAVAILABLE",
          ].includes(result.code);
          if (response.status === 409 && availabilityChanged) {
            alert(
              "This time slot is no longer available. Please select another time slot.",
            );
            setSelectedSlot(null);
            await refreshAvailability();
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

  const { roles } = useEbRoles();
  const selectedEB = roles.find((role) => role.id === ebId);

  if (!selectedEB) {
    return (
      <section className="min-h-screen bg-[rgb(243,243,253)]">
        <div className="flex flex-col justify-center items-center px-50 py-20">
          <div className="text-center">
            <h1 className="text-2xl font-inter font-bold text-black mb-4">
              Executive Board role not found
            </h1>
            <button
              onClick={() => router.push("/user/apply/executive-associate")}
              className="bg-[#044FAF] text-white px-6 py-3 rounded-md font-inter font-normal text-sm hover:bg-[#04387B] transition-all duration-150 active:scale-95"
            >
              Back to Role Selection
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
            <span className="text-black">
              Apply as Executive Associate for{" "}
            </span>
            <span className="text-[#134687]">{selectedEB.title}</span>
          </div>

          <div className="text-black text-xs lg:text-[16px] font-Inter font-light text-justify">
            Executive Associates work closely with the CSS Executive Boards to
            help them with their tasks in events and committees. This role
            requires responsibility, attention to detail, and strong
            communication skills.
          </div>

          <hr className="my-5 lg:my-8 border-t border-[#717171]" />

          <div className="flex flex-col items-center justify-center">
            {/* Stepper */}
            <div className="w-full flex flex-col items-center justify-center">
              <div className="flex items-center">
                <div
                  onClick={() => router.push("/user/apply/executive-associate")}
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
                      `/user/apply/executive-associate/application?eb=${ebId}`,
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
                Click on any colorless slot to reserve your interview schedule.
              </p>

              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#134687]"></div>
                </div>
              ) : availabilityError ? (
                <div className="w-full rounded-xl border border-[#B77900] bg-white p-5 text-center text-sm text-[#8A5A00]">
                  <p>{availabilityError}</p>
                  <button
                    type="button"
                    onClick={() => void refreshAvailability()}
                    className="mt-3 rounded-lg border border-[#B77900] px-4 py-2 font-semibold transition-colors hover:bg-[#FFF8E8]"
                  >
                    Try Again
                  </button>
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
                        <div className="grid min-w-fit" style={{ gridTemplateColumns: "5rem minmax(0, 1fr)" }}>
                          <div className="sticky left-0 bg-white z-10 px-2 py-1.5 font-inter font-semibold text-xs text-[#134687] flex items-center justify-center text-center w-12.5 lg:w-20 shrink-0 border-r border-[#164E96]">
                            Time
                          </div>
                          <div
                            className="grid flex-1 divide-x divide-[#164E96] border-l border-[#164E96]"
                            style={{
                              gridTemplateColumns: `repeat(${Object.keys(groupedSlots).length}, minmax(0, 1fr))`,
                            }}
                          >
                            {Object.entries(groupedSlots)
                              .sort(
                                ([a], [b]) =>
                                  new Date(a).getTime() - new Date(b).getTime(),
                              )
                              .map(([date]) => {
                                const dayDate = new Date(date);
                                const dayName = dayDate.toLocaleDateString(
                                  "en-US",
                                  { weekday: "short" },
                                );
                                const dayNumber = dayDate.getDate();
                                return (
                                  <div
                                    key={date}
                                    className="min-w-0 bg-[#164E96] p-1.5 text-center"
                                  >
                                    <div className="font-inter font-semibold text-xs text-white">
                                      {dayName}
                                    </div>
                                    <div className="font-inter text-[10px] text-white/70">
                                      {dayNumber}
                                    </div>
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
                            const sortedEntries = Object.entries(
                              groupedSlots,
                            ).sort(
                              ([a], [b]) =>
                                new Date(a).getTime() - new Date(b).getTime(),
                            );

                            const rowCells = sortedEntries.map(
                              ([date, slots]) => {
                                const slotForThisTime = slots.find(
                                  (slot) => slot.time === timeSlot.time,
                                );
                                const isAvailable =
                                  slotForThisTime && !slotForThisTime.isBooked;
                                const isSelected =
                                  selectedSlot === slotForThisTime?.id;
                                const isUnavailable = slotForThisTime
                                  ? !isAvailable
                                  : false;
                                const prevUnavailable =
                                  prevRowUnavailable.get(date) ?? false;
                                const showText =
                                  isUnavailable && !prevUnavailable;
                                prevRowUnavailable.set(date, isUnavailable);

                                return (
                                  <div
                                    key={date}
                                    className="min-w-0 min-h-9"
                                  >
                                    {slotForThisTime ? (
                                      <button
                                        onClick={() =>
                                          isAvailable
                                            ? handleSlotSelect(
                                                slotForThisTime.id,
                                              )
                                            : null
                                        }
                                        disabled={!isAvailable}
                                        title={
                                          isAvailable
                                            ? `Available with ${slotForThisTime.assignedEB}`
                                            : "No interviewer is available"
                                        }
                                        aria-label={
                                          isAvailable
                                            ? `${date} at ${timeSlot.displayTime}, available with ${slotForThisTime.assignedEB}`
                                            : `${date} at ${timeSlot.displayTime}, unavailable`
                                        }
                                        className={`w-full h-full transition-colors text-[10px] font-inter flex items-center justify-center ${
                                          !isAvailable
                                            ? "bg-[#0f172a] cursor-not-allowed text-white/75"
                                            : isSelected
                                              ? "bg-[#044FAF] text-white font-semibold"
                                              : "bg-white hover:bg-blue-50 cursor-pointer text-[#134687]"
                                        }`}
                                      >
                                        {showText ? (
                                          <span className="block w-full text-center text-[9px] font-medium leading-none">
                                            Unavailable
                                          </span>
                                        ) : isSelected ? (
                                          "Selected"
                                        ) : isAvailable ? (
                                          <>
                                            <span className="hidden min-w-0 max-w-full truncate px-1 text-center text-[8px] lg:block">
                                              {slotForThisTime.assignedEB}
                                            </span>
                                            <span className="text-[8px] lg:hidden">
                                              Free
                                            </span>
                                          </>
                                        ) : null}
                                      </button>
                                    ) : (
                                      <div className="w-full h-full bg-gray-100"></div>
                                    )}
                                  </div>
                                );
                              },
                            );

                            return (
                              <div key={timeIndex} className="grid min-w-fit" style={{ gridTemplateColumns: "5rem minmax(0, 1fr)" }}>
                                <div className="sticky left-0 bg-white z-10 px-2 py-1 text-center w-12.5 lg:w-20 shrink-0 border-r border-[#164E96]">
                                  <div className="font-inter text-[11px] text-[#134687]">
                                    {timeSlot.displayTime}
                                  </div>
                                  <div className="font-inter text-[9px] text-[#134687]/40">
                                    {timeSlot.endDisplayTime}
                                  </div>
                                </div>
                                <div
                                  className="grid min-w-0 divide-x divide-[#164E96] border-l border-[#164E96]"
                                  style={{
                                    gridTemplateColumns: `repeat(${sortedEntries.length}, minmax(0, 1fr))`,
                                  }}
                                >
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
                    Once a timeslot is selected, it will be reserved under your
                    name. Changes are not allowed after confirmation.
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
                    `/user/apply/executive-associate/${ebId}/application`,
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
                className={`cursor-pointer whitespace-nowrap font-inter text-sm font-semibold px-15 py-3 rounded-lg border-2 transition-all duration-150 active:scale-95 ${
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
                  (slot) => slot.id === selectedSlot,
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
                      </span>{" "}
                      with{" "}
                      <span className="font-semibold">
                        {selectedSlotData.assignedEB}
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
