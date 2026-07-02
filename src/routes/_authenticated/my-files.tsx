import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/my-files")({
  beforeLoad: ({}) => {
    throw redirect({ to: "/documentos", replace: true });
  },
});
