// Observabilidade do RAG: grava apenas métricas e identificadores.
// Nunca grava o conteúdo dos documentos nem a pergunta integral.

import type { RetrievalLog } from "../chat-rag.server";

export async function logRetrievalEvent(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  caseId: string;
  threadId?: string | null;
  log: RetrievalLog;
  embeddingModel: string;
}): Promise<void> {
  try {
    await opts.supabase.from("rag_retrieval_events").insert({
      user_id: opts.userId,
      case_id: opts.caseId,
      thread_id: opts.threadId ?? null,
      question_chars: opts.log.question_chars,
      queries_used: opts.log.queries_used,
      keywords_used: opts.log.keywords_used,
      candidates: opts.log.candidates,
      retrieved: opts.log.retrieved,
      neighbors: opts.log.neighbors,
      documents_touched: opts.log.documents_touched,
      sufficiency: opts.log.sufficiency,
      top_similarity: opts.log.top_similarity,
      reranker_used: opts.log.reranker_used,
      reranker_reason: opts.log.reranker_reason,
      retrieval_version: opts.log.retrieval_version,
      chunking_versions: opts.log.chunking_versions,
      embedding_model: opts.embeddingModel,
      model_tier: opts.log.model_tier,
      latency_ms: opts.log.latency_ms,
    });
  } catch {
    // diagnóstico não pode quebrar a resposta
  }
}
