import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import socialImage from "@/assets/jurismind-case-agent-og.jpg.asset.json";
const OG_IMAGE_URL = `https://jurismind.b2bconsulting.com.br${socialImage.url}`;
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { Toaster } from "@/components/ui/sonner";
import { ErrorFallback } from "@/components/errors/error-fallback";
import { GlobalErrorBoundary } from "@/components/errors/global-error-boundary";
import { UploadManagerProvider } from "@/components/documents/upload-manager";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} boundary="tanstack_root_error_component" />;
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "p3ExxCrmwEsSNVlYERSKycUlGwJJm3BL7AaCzNGUWJU" },
      { title: "JurisMind AI — um agente de IA que trabalha para você" },
      { name: "description", content: "Cada caso ganha um agente de IA que conhece os autos, executa tarefas e apoia o advogado do início à entrega." },
      { name: "author", content: "B2B | JurisMind AI" },
      { property: "og:site_name", content: "JurisMind AI" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "JurisMind AI — um agente de IA que trabalha para você" },
      { property: "og:description", content: "Cada caso ganha um agente de IA que conhece os autos, executa tarefas e apoia o advogado do início à entrega." },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@JurisMind" },
      { name: "twitter:title", content: "JurisMind AI — um agente de IA que trabalha para você" },
      { name: "twitter:description", content: "Cada caso ganha um agente de IA que conhece os autos, executa tarefas e apoia o advogado do início à entrega." },
      { name: "twitter:image", content: OG_IMAGE_URL },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "shortcut icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "JurisMind AI",
              url: "https://jurismind.b2bconsulting.com.br",
              logo: OG_IMAGE_URL,
              sameAs: ["https://jurismind.b2bconsulting.com.br"],
            },
            {
              "@type": "WebSite",
              name: "JurisMind AI",
              url: "https://jurismind.b2bconsulting.com.br",
              inLanguage: "pt-BR",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('jurismind-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <GlobalErrorBoundary boundary="app_root">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <UploadManagerProvider>
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
              <Toaster richColors position="top-right" />
            </UploadManagerProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
