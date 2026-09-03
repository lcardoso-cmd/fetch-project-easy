import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { listMyConversations } from "@/lib/conversations.functions";
import { ConversationCenter } from "@/components/chat/conversation-center";
import { useAuth } from "@/hooks/use-auth";

/**
 * Acesso discreto às conversas pelo cabeçalho. Reutiliza exatamente os
 * mesmos dados e componentes da página `/conversas`.
 */
export function ConversationsDrawer() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listMyConversations);

  const { data: convs = [] } = useQuery({
    queryKey: ["my-conversations"],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const unread = (convs as Array<{ unread: number }>).reduce((s, c) => s + (c.unread ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Conversas internas">
          <MessageSquare className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-3 p-3 sm:max-w-md">
        <h2 className="text-base font-semibold text-foreground">Conversas</h2>
        <div className="min-h-0 flex-1">
          {open && <ConversationCenter compact />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
