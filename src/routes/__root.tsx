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
import brainSquareNavy from "@/assets/brain-square-navy.png.asset.json";

const OG_IMAGE_URL =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/Sls90jSFrMa8ECulf4OjLMG7sRB3/social-images/social-1783001247994-LOGO_JURISMIND_16-9.webp";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { ErrorFallback } from "@/components/errors/error-fallback";
import { GlobalErrorBoundary } from "@/components/errors/global-error-boundary";


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
      { title: "B2B | JurisMind AI" },
      { name: "description", content: "B2B | JurisMind AI é uma plataforma jurídica para advogados: RAG de documentos jurídicos e gestão inteligente de prazos." },
      { name: "author", content: "B2B | JurisMind AI" },
      { property: "og:site_name", content: "JurisMind AI" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "B2B | JurisMind AI" },
      { property: "og:description", content: "Plataforma jurídica com IA: RAG de documentos e gestão inteligente de prazos." },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "675" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@JurisMind" },
      { name: "twitter:title", content: "B2B | JurisMind AI" },
      { name: "twitter:description", content: "Plataforma jurídica com IA: RAG de documentos e gestão inteligente de prazos." },
      { name: "twitter:image", content: OG_IMAGE_URL },
    ],
    links: [
      { rel: "icon", type: "image/png", href: brainSquareNavy.url },
      { rel: "shortcut icon", type: "image/png", href: brainSquareNavy.url },
      { rel: "apple-touch-icon", href: brainSquareNavy.url },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Jost:wght@300;400;500;600;700&display=swap",
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
              url: "https://b2bjurismind.lovable.app",
              logo: OG_IMAGE_URL,
              sameAs: ["https://b2bjurismind.lovable.app"],
            },
            {
              "@type": "WebSite",
              name: "JurisMind AI",
              url: "https://b2bjurismind.lovable.app",
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
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
            <ThemeToggle floating />
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
