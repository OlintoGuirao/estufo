import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout pai de /trilha/* — precisa de Outlet para /trilha/semana/$week. */
export const Route = createFileRoute("/_area/trilha")({
  component: () => <Outlet />,
});
