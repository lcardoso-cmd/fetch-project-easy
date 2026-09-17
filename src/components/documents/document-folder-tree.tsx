import { useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createDocumentFolder, deleteDocumentFolder, listDocumentFolders,
  renameDocumentFolder, type DocumentFolder,
} from "@/lib/document-folders.functions";

type FolderDoc = { id: string; folder_id?: string | null };

export function DocumentFolderTree<T extends FolderDoc>({
  caseId,
  documents,
  renderDocument,
  emptyMessage = "Nenhum documento nesta pasta.",
}: {
  caseId: string | null;
  documents: T[];
  renderDocument: (document: T) => ReactNode;
  emptyMessage?: string;
}) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listDocumentFolders);
  const createFn = useServerFn(createDocumentFolder);
  const renameFn = useServerFn(renameDocumentFolder);
  const deleteFn = useServerFn(deleteDocumentFolder);
  const key = ["document-folders", caseId ?? "library"];
  const { data: folders = [] } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { case_id: caseId } }),
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const children = useMemo(() => {
    const map = new Map<string | null, DocumentFolder[]>();
    for (const folder of folders) {
      const parent = folder.parent_folder_id ?? null;
      map.set(parent, [...(map.get(parent) ?? []), folder]);
    }
    return map;
  }, [folders]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: ["documents-all"] }),
      ...(caseId ? [queryClient.invalidateQueries({ queryKey: ["documents", caseId] })] : []),
    ]);
  };

  const create = async (parentId: string | null = null) => {
    const name = window.prompt("Nome da nova pasta:")?.trim();
    if (!name) return;
    try {
      const folder = await createFn({ data: { case_id: caseId, parent_folder_id: parentId, name } });
      if (parentId) setExpanded((current) => new Set(current).add(parentId));
      toast.success(`Pasta “${folder.name}” criada`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a pasta");
    }
  };

  const rename = async (folder: DocumentFolder) => {
    const name = window.prompt("Novo nome da pasta:", folder.name)?.trim();
    if (!name || name === folder.name) return;
    try {
      await renameFn({ data: { id: folder.id, name } });
      toast.success("Pasta renomeada");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível renomear a pasta");
    }
  };

  const remove = async (folder: DocumentFolder) => {
    if (!window.confirm(`Excluir a pasta “${folder.name}”? Os documentos e subpastas serão movidos para o nível anterior.`)) return;
    try {
      await deleteFn({ data: { id: folder.id } });
      toast.success("Pasta excluída; os documentos foram preservados");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a pasta");
    }
  };

  const renderFolder = (folder: DocumentFolder, depth: number): ReactNode => {
    const open = expanded.has(folder.id);
    const nestedFolders = children.get(folder.id) ?? [];
    const nestedDocs = documents.filter((document) => document.folder_id === folder.id);
    const count = nestedDocs.length;
    return (
      <div key={folder.id} className="border-b last:border-b-0">
        <div className="flex items-center gap-2 px-2 py-2 hover:bg-muted/40" style={{ paddingLeft: `${8 + depth * 20}px` }}>
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setExpanded((current) => {
            const next = new Set(current); if (open) next.delete(folder.id); else next.add(folder.id); return next;
          })} aria-label={open ? `Recolher ${folder.name}` : `Expandir ${folder.name}`}>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
          {open ? <FolderOpen className="size-4 text-primary" /> : <Folder className="size-4 text-muted-foreground" />}
          <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium" onClick={() => setExpanded((current) => new Set(current).add(folder.id))}>{folder.name}</button>
          <span className="text-xs text-muted-foreground">{count}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Ações da pasta ${folder.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void create(folder.id)}><FolderPlus />Nova subpasta</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void rename(folder)}><Pencil />Renomear</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={() => void remove(folder)}><Trash2 />Excluir pasta</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {open && <div className="border-t bg-muted/10">
          {nestedFolders.map((child) => renderFolder(child, depth + 1))}
          {nestedDocs.map(renderDocument)}
          {nestedFolders.length === 0 && nestedDocs.length === 0 && <p className="px-12 py-3 text-sm text-muted-foreground">{emptyMessage}</p>}
        </div>}
      </div>
    );
  };

  const rootDocs = documents.filter((document) => !document.folder_id);
  return <div className="space-y-3">
    <div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => void create()}><FolderPlus className="mr-2 size-4" />Nova pasta</Button></div>
    <div className="overflow-hidden rounded-md border">
      {(children.get(null) ?? []).map((folder) => renderFolder(folder, 0))}
      {rootDocs.length > 0 && <div>
        <div className="flex items-center gap-2 border-y bg-muted/30 px-3 py-2 first:border-t-0"><Folder className="size-4 text-muted-foreground" /><span className="text-sm font-medium">Sem pasta</span><span className="ml-auto text-xs text-muted-foreground">{rootDocs.length}</span></div>
        <div className="divide-y">{rootDocs.map(renderDocument)}</div>
      </div>}
      {folders.length === 0 && rootDocs.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
    </div>
  </div>;
}