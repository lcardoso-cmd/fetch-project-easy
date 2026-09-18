import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, FolderSymlink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createDocumentFolder, deleteDocumentFolder, listDocumentFolders,
  moveDocument, moveDocumentFolder, renameDocumentFolder, type DocumentFolder,
} from "@/lib/document-folders.functions";

type FolderDoc = { id: string; folder_id?: string | null };

export function DocumentFolderTree<T extends FolderDoc>({
  caseId,
  documents,
  renderDocument,
  emptyMessage = "Nenhum documento nesta pasta.",
  revealDocuments = false,
}: {
  caseId?: string | null;
  documents: T[];
  renderDocument: (document: T) => ReactNode;
  emptyMessage?: string;
  revealDocuments?: boolean;
}) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listDocumentFolders);
  const createFn = useServerFn(createDocumentFolder);
  const renameFn = useServerFn(renameDocumentFolder);
  const deleteFn = useServerFn(deleteDocumentFolder);
  const moveFolderFn = useServerFn(moveDocumentFolder);
  const key = ["document-folders", caseId === undefined ? "all" : (caseId ?? "library")];
  const { data: folders = [] } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: caseId === undefined ? {} : { case_id: caseId } }),
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

  const foldersWithVisibleDocuments = useMemo(() => {
    if (!revealDocuments) return [];
    const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
    const visible = new Set<string>();
    for (const document of documents) {
      let folderId = document.folder_id ?? null;
      while (folderId && !visible.has(folderId)) {
        visible.add(folderId);
        folderId = foldersById.get(folderId)?.parent_folder_id ?? null;
      }
    }
    return [...visible];
  }, [documents, folders, revealDocuments]);

  useEffect(() => {
    if (foldersWithVisibleDocuments.length === 0) return;
    setExpanded((current) => {
      const next = new Set(current);
      foldersWithVisibleDocuments.forEach((folderId) => next.add(folderId));
      return next;
    });
  }, [foldersWithVisibleDocuments]);

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
      const folder = await createFn({ data: { case_id: caseId ?? null, parent_folder_id: parentId, name } });
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

  const moveFolder = async (folder: DocumentFolder, parentId: string | null) => {
    try {
      await moveFolderFn({ data: { id: folder.id, parent_folder_id: parentId } });
      toast.success("Pasta movida");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível mover a pasta");
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><FolderSymlink />Mover para</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 overflow-auto">
                  <DropdownMenuItem onSelect={() => void moveFolder(folder, null)}>Nível principal</DropdownMenuItem>
                  {folders.filter((target) => target.id !== folder.id && target.case_id === folder.case_id).map((target) => (
                    <DropdownMenuItem key={target.id} onSelect={() => void moveFolder(folder, target.id)}><Folder className="size-4" />{target.name}</DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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

export function DocumentMoveButton({ documentId, caseId }: { documentId: string; caseId?: string }) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listDocumentFolders);
  const moveFn = useServerFn(moveDocument);
  const { data: folders = [] } = useQuery({
    queryKey: ["document-folders", caseId ?? "all"],
    queryFn: () => listFn({ data: caseId ? { case_id: caseId } : {} }),
  });
  const move = async (folderId: string | null) => {
    try {
      await moveFn({ data: { document_id: documentId, folder_id: folderId } });
      toast.success("Documento movido");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents-all"] }),
        ...(caseId ? [queryClient.invalidateQueries({ queryKey: ["documents", caseId] })] : []),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível mover o documento");
    }
  };
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Mover documento"><FolderSymlink className="size-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="max-h-72 overflow-auto">
      <DropdownMenuItem onSelect={() => void move(null)}>Sem pasta</DropdownMenuItem>
      {folders.filter((folder) => !folder.case_id || !caseId || folder.case_id === caseId).map((folder) => <DropdownMenuItem key={folder.id} onSelect={() => void move(folder.id)}><Folder className="size-4" />{folder.name}</DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}