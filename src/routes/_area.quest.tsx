import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout pai de /quest/* — precisa de Outlet para as rotas filhas. */
export const Route = createFileRoute("/_area/quest")({
  component: () => <Outlet />,
});
