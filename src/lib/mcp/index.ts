import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCases from "./tools/list-cases";
import getCase from "./tools/get-case";
import listDocuments from "./tools/list-documents";
import searchDocuments from "./tools/search-documents";
import listTasks from "./tools/list-tasks";
import createTask from "./tools/create-task";
import searchJurisprudence from "./tools/search-jurisprudence";

// Direct Supabase issuer (not the .lovable.cloud proxy). Read from Vite-inlined
// literal so it survives publish; the fallback keeps the URL well-formed during
// the manifest-extract eval when the literal is unset.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "jurismind-mcp",
  title: "JurisMind",
  version: "0.1.0",
  instructions:
    "Ferramentas do JurisMind AI para advogados: consulta casos, documentos, tarefas e busca semântica (RAG) nos autos do usuário autenticado. Todas as leituras/escritas respeitam as políticas RLS do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCases, getCase, listDocuments, searchDocuments, listTasks, createTask, searchJurisprudence],
});
