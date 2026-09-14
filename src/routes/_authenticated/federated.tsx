import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/federated")({
  component: FederatedLayout,
});

function FederatedLayout() {
  return <Outlet />;
}
