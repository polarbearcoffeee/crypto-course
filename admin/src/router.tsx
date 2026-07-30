import {
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { DemoAdminGate } from "./ui/DemoAdminGate";
import { DashboardPage } from "./views/DashboardPage";
import { AnalyticsPage } from "./views/AnalyticsPage";
import { CurriculumPage } from "./views/CurriculumPage";
import { LearnersPage } from "./views/LearnersPage";
import { PlatformLinksPage } from "./views/PlatformLinksPage";
import { SettingsPage } from "./views/SettingsPage";

const rootRoute = createRootRoute({
  component: () => (
    <DemoAdminGate>
      <Outlet />
    </DemoAdminGate>
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

const resourcesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/resources",
  component: PlatformLinksPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  learnersRoute,
  curriculumRoute,
  analyticsRoute,
  settingsRoute,
  resourcesRoute,
]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
