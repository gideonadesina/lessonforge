"use client";

import Link from "next/link";

type PlanningStatusCardProps = {
  schemeUploaded?: boolean;
  calendarUploaded?: boolean;
  curriculumCount?: number;
  configuredClasses?: number;
  pendingItems?: number;
};

export default function PlanningStatusCard({
  schemeUploaded = false,
  calendarUploaded = false,
  curriculumCount = 0,
  configuredClasses = 0,
  pendingItems = 0,
}: PlanningStatusCardProps) {
  const statusItems = [
    {
      label: "Scheme of Work",
      value: schemeUploaded ? "Uploaded" : "Not uploaded",
      good: schemeUploaded,
    },
    {
      label: "Academic Calendar",
      value: calendarUploaded ? "Configured" : "Not configured",
      good: calendarUploaded,
    },
    {
      label: "Curriculum Profiles",
      value: curriculumCount > 0 ? `${curriculumCount} active` : "None added",
      good: curriculumCount > 0,
    },
    {
      label: "Configured Classes",
      value: configuredClasses > 0 ? `${configuredClasses} classes` : "No class setup yet",
      good: configuredClasses > 0,
    },
  ];


}