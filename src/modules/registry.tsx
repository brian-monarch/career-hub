import type { ReactNode } from "react";
import { CoachPage } from "@/modules/coach/CoachPage";
import { ProgressPage } from "@/modules/coach/ProgressPage";
import { StoriesPage } from "@/modules/stories/StoriesPage";
import { ComingSoon } from "@/modules/pipeline/ComingSoon";

/**
 * Each job to be done is a module with its own folder under src/modules.
 * Modules share auth, data and the design system from src/platform, and can be
 * split into their own app later without touching the others.
 */
export type HubModule = {
  path: string;
  label: string;
  group: "Prepare" | "Search";
  status: "live" | "soon";
  element: ReactNode;
};

export const modules: HubModule[] = [
  { path: "/coach", label: "Mock interview", group: "Prepare", status: "live", element: <CoachPage /> },
  { path: "/stories", label: "Story bank", group: "Prepare", status: "live", element: <StoriesPage /> },
  { path: "/progress", label: "Progress", group: "Prepare", status: "live", element: <ProgressPage /> },
  {
    path: "/pipeline",
    label: "Pipeline",
    group: "Search",
    status: "soon",
    element: <ComingSoon title="Pipeline" note="Kanban of every role by stage, with time-in-stage. Planned for mid-January." />,
  },
  {
    path: "/contacts",
    label: "Contacts",
    group: "Search",
    status: "soon",
    element: <ComingSoon title="Contacts" note="People, warmth, last touch, and the next follow-up for each." />,
  },
  {
    path: "/discover",
    label: "Discover",
    group: "Search",
    status: "soon",
    element: <ComingSoon title="Discover" note="Saved searches and fit-scored matches from target companies' job boards." />,
  },
];
