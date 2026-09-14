import { getRoleId } from "@/lib/eb-mapping";
import { getManilaDateKey } from "@/lib/manila-date";

export interface InterviewAvailabilitySlot {
  id: string;
  start: string;
  end: string;
  date: string;
  time: string;
  isBooked: boolean;
  assignedEB: string;
}

export interface InterviewerAvailability {
  position: string;
}

export interface InterviewUnavailableBlock {
  eb: string;
  day: string;
  timeStart: string;
  timeEnd: string;
}

export interface InterviewBooking {
  interviewBy: string | null;
  interviewSlotDay: string | null;
  interviewSlotTimeStart: string | null;
  interviewSlotTimeEnd: string | null;
}

interface GenerateInterviewAvailabilityInput {
  interviewStart: Date;
  interviewEnd: Date;
  interviewers: InterviewerAvailability[];
  unavailableBlocks: InterviewUnavailableBlock[];
  bookings: InterviewBooking[];
  assignmentSeed: string;
  now?: Date;
}

const SLOT_START_MINUTES = 7 * 60;
const SLOT_END_MINUTES = 21 * 60;
const SLOT_DURATION_MINUTES = 30;

function storedDateKey(date: Date) {
  return getManilaDateKey(date);
}

function parseTime(value: string | null) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function canonicalInterviewerKey(position: string | null) {
  return position ? getRoleId(position).trim().toLowerCase() : "";
}

function overlaps(
  slotStart: number,
  slotEnd: number,
  rangeStart: string | null,
  rangeEnd: string | null,
) {
  const start = parseTime(rangeStart);
  const end = parseTime(rangeEnd);
  return start !== null && end !== null && slotStart < end && slotEnd > start;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function eachStoredDate(start: Date, end: Date) {
  const startKey = storedDateKey(start);
  const endKey = storedDateKey(end);
  const cursor = new Date(`${startKey}T00:00:00.000Z`);
  const finalDate = new Date(`${endKey}T00:00:00.000Z`);
  const dates: string[] = [];

  while (cursor <= finalDate) {
    dates.push(storedDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function generateInterviewAvailability({
  interviewStart,
  interviewEnd,
  interviewers,
  unavailableBlocks,
  bookings,
  assignmentSeed,
  now = new Date(),
}: GenerateInterviewAvailabilityInput): InterviewAvailabilitySlot[] {
  const uniqueInterviewers = Array.from(
    new Map(
      interviewers
        .filter(({ position }) => position.trim().length > 0)
        .map((interviewer) => [
          canonicalInterviewerKey(interviewer.position),
          interviewer,
        ]),
    ).values(),
  ).sort((left, right) => left.position.localeCompare(right.position));

  const slots: InterviewAvailabilitySlot[] = [];

  for (const date of eachStoredDate(interviewStart, interviewEnd)) {
    for (
      let startMinutes = SLOT_START_MINUTES;
      startMinutes < SLOT_END_MINUTES;
      startMinutes += SLOT_DURATION_MINUTES
    ) {
      const endMinutes = startMinutes + SLOT_DURATION_MINUTES;
      const time = formatTime(startMinutes);
      const end = formatTime(endMinutes);
      const slotStart = new Date(`${date}T${time}:00+08:00`);

      if (slotStart.getTime() <= now.getTime()) continue;

      const availableInterviewers = uniqueInterviewers.filter(
        ({ position }) => {
          const interviewerKey = canonicalInterviewerKey(position);
          const unavailable = unavailableBlocks.some(
            (block) =>
              canonicalInterviewerKey(block.eb) === interviewerKey &&
              block.day === date &&
              overlaps(
                startMinutes,
                endMinutes,
                block.timeStart,
                block.timeEnd,
              ),
          );
          if (unavailable) return false;

          return !bookings.some(
            (booking) =>
              canonicalInterviewerKey(booking.interviewBy) === interviewerKey &&
              booking.interviewSlotDay === date &&
              overlaps(
                startMinutes,
                endMinutes,
                booking.interviewSlotTimeStart,
                booking.interviewSlotTimeEnd,
              ),
          );
        },
      );

      const assignedInterviewer =
        availableInterviewers.length > 0
          ? availableInterviewers[
              stableHash(`${assignmentSeed}:${date}:${time}`) %
                availableInterviewers.length
            ]
          : null;

      slots.push({
        id: `${date}-${time}-${end}`,
        start: slotStart.toISOString(),
        end,
        date,
        time,
        isBooked: assignedInterviewer === null,
        assignedEB: assignedInterviewer?.position ?? "",
      });
    }
  }

  return slots;
}
