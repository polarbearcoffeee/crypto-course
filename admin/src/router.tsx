import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AdminShell } from "./ui/AdminShell";
import { DashboardPage } from "./views/DashboardPage";
import { AnalyticsPage } from "./views/AnalyticsPage";
import { CurriculumPage } from "./views/CurriculumPage";
import { LearnersPage } from "./views/LearnersPage";
import { SettingsPage } from "./views/SettingsPage";

const rootRoute = createRootRoute({
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const learnersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learners",
  component: LearnersPage,
});

const curriculumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/curriculum",
  component: CurriculumPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: AnalyticsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  learnersRoute,
  curriculumRoute,
  analyticsRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
