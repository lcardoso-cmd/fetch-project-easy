import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ErrorFallback } from "./components/errors/error-fallback";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error, reset }) => (
      <ErrorFallback error={error} reset={reset} boundary="router_default" />
    ),
  });

  return router;
};
