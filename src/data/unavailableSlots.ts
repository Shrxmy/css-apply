// Shared unavailable slots data
// This would normally be stored in a database and managed by admin
// For now, we'll use a simple Set that can be updated

export const unavailableSlots = new Set<string>([
  // Example unavailable slots - these would be set by admin
  "2025-09-16-09:30",
  "2025-09-16-13:00",
  "2025-09-16-15:00",
  "2025-09-17-10:30",
  "2025-09-17-12:00",
  "2025-09-17-14:00",
  "2025-09-17-16:30",
  "2025-09-18-09:00",
  "2025-09-18-11:00",
  "2025-09-18-15:30",
  "2025-09-19-09:30",
  "2025-09-19-11:30",
  "2025-09-19-13:00",
  "2025-09-19-15:00",
  "2025-09-20-10:00",
  "2025-09-20-14:30",
  "2025-09-21-10:00",
  "2025-09-21-14:30",
  "2025-09-22-10:00",
  "2025-09-22-14:30",
  "2025-09-22-16:00",
  "2025-09-23-09:30",
  "2025-09-23-13:00",
  "2025-09-23-15:00",
  "2025-09-24-10:30",
  "2025-09-24-12:00",
  "2025-09-24-14:00",
  "2025-09-24-16:30",
  "2025-09-25-09:00",
  "2025-09-25-11:00",
  "2025-09-25-15:30",
  "2025-09-26-10:00",
  "2025-09-26-14:30",
]);

// Function to add unavailable slot
export const addUnavailableSlot = (slotId: string) => {
  unavailableSlots.add(slotId);
};

// Function to remove unavailable slot
export const removeUnavailableSlot = (slotId: string) => {
  unavailableSlots.delete(slotId);
};

// Function to check if slot is unavailable
export const isSlotUnavailable = (slotId: string) => {
  return unavailableSlots.has(slotId);
};

// Function to get all unavailable slots
export const getUnavailableSlots = () => {
  return Array.from(unavailableSlots);
};
