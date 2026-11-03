import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_area/video-aulas")({
  component: () => <Outlet />,
});
