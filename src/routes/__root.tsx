import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { migrateLegacyStorageKeys } from "@/lib/legacy-storage-migrate";

if (typeof window !== "undefined") {
  migrateLegacyStorageKeys();
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Estufoo" },
      { name: "description", content: "Plataforma de estudos para concursos públicos." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Estufoo" },
      { property: "og:image", content: "/logo.png" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: "/logo.png" },
      { name: "theme-color", content: "#1e3a5f" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Estufoo" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function CloudAuthBootstrap() {
  useEffect(() => {
    void (async () => {
      try {
        const { authService } = await import("@/services/auth.service");
        if (!authService.isCloud()) return;
        const { tokenStore } = await import("@/services/api");
        const restored = await authService.restoreCloudSession();
        if (!restored) return;
        if (!tokenStore.get()) tokenStore.set(restored.token, { remember: true });
        const { syncCloudUserIntoMock } = await import("@/services/mock/handlers");
        syncCloudUserIntoMock(restored.user);
        const { setStudyOwnerUserId } = await import("@/lib/study-owner");
        setStudyOwnerUserId(restored.user.id);
        const { syncAccountStudyData } = await import("@/lib/study-account-sync");
        try {
          await syncAccountStudyData(restored.user.id);
        } catch (err) {
          console.warn("[auth] sync estudo → conta falhou", err);
        }

        const { supabase } = await import("@/lib/supabase");
        supabase?.auth.onAuthStateChange((_event, session) => {
          const uid = session?.user?.id ?? null;
          void import("@/lib/study-owner").then(({ setStudyOwnerUserId: setOwner }) => {
            setOwner(uid);
          });
          if (uid) {
            void import("@/lib/study-account-sync").then(({ syncAccountStudyData: sync }) => {
              void sync(uid);
            });
          }
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <CloudAuthBootstrap />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
