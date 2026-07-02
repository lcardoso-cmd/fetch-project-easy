import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/invite/$token")({
  beforeLoad: ({, params}) => {
    throw redirect({ to: "/convite/$token", params: { token: params.token }, replace: true });
  },
});
