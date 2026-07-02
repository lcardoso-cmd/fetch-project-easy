import { createFileRoute, redirect } from "@tanstack/react-router";

// A tela de credenciais OAuth do SaaS é servida em /settings/oauth (já
// existente e protegida por permissão de admin). O item de menu na
// Plataforma B2B aponta para cá e apenas redireciona, mantendo uma
// única fonte de UI e evitando duplicação.
export const Route = createFileRoute("/_authenticated/plataforma/credenciais/")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes/oauth" });
  },
  component: () => null,
});
