"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { ComponentProps } from "react";

// Bundles FullCalendar with its plugins so pages can load it via next/dynamic.
export default function AdminCalendar(
  props: Omit<ComponentProps<typeof FullCalendar>, "plugins">,
) {
  return <FullCalendar {...props} plugins={[timeGridPlugin, interactionPlugin]} />;
}
