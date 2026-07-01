import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListTodo } from "lucide-react";
import { TaskManager } from "./task-manager";

export function CaseTasksDialog({
  caseId,
  caseTitle,
  trigger,
}: {
  caseId: string;
  caseTitle: string;
  trigger?: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="w-full">
            <ListTodo className="mr-2 h-4 w-4" /> Gerenciar tarefas do caso
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Tarefas do caso</DialogTitle>
          <DialogDescription>{caseTitle}</DialogDescription>
        </DialogHeader>
        <TaskManager caseId={caseId} />
      </DialogContent>
    </Dialog>
  );
}
