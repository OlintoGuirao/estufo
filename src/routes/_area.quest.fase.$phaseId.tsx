import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout de /quest/fase/$phaseId/* */
export const Route = createFileRoute("/_area/quest/fase/$phaseId")({
  component: () => <Outlet />,
});
