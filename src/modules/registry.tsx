import type { ReactNode } from "react";
import { CoachPage } from "@/modules/coach/CoachPage";
import { ProgressPage } from "@/modules/coach/ProgressPage";
import { StoriesPage } from "@/modules/stories/StoriesPage";
import { ApplyPage } from "@/modules/apply/ApplyPage";
import { DiscoverPage } from "@/modules/search/DiscoverPage";
import { PipelinePage } from "@/modules/search/PipelinePage";
import { WatchlistPage } from "@/modules/search/WatchlistPage";
import { PreferencesPage } from "@/modules/search/PreferencesPage";

/**
 * Each job to be done is a module with its own folder under src/modules.
 * Modules share auth, data and the design system from src/platform, and can be
 * split into their own app later without touching the others.
 */
export type HubModule = {
  path: string;
  label: string;
  group: "Search" | "Apply" | "Prepare";
  status: "live" | "soon";
  element: ReactNode;
};

export const HOME_PATH = "/discover";

export const modules: HubModule[] = [
  { path: "/discover", label: "Discover", group: "Search", status: "live", element: <DiscoverPage /> },
  { path: "/pipeline", label: "Pipeline", group: "Search", status: "live", element: <PipelinePage /> },
  { path: "/watchlist", label: "Watchlist", group: "Search", status: "live", element: <WatchlistPage /> },
  { path: "/preferences", label: "Preferences", group: "Search", status: "live", element: <PreferencesPage /> },
  { path: "/apply", label: "Tailor resume", group: "Apply", status: "live", element: <ApplyPage /> },
  { path: "/coach", label: "Mock interview", group: "Prepare", status: "live", element: <CoachPage /> },
  { path: "/stories", label: "Story bank", group: "Prepare", status: "live", element: <StoriesPage /> },
  { path: "/progress", label: "Progress", group: "Prepare", status: "live", element: <ProgressPage /> },
];
