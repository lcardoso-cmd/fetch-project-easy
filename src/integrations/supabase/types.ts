export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_budgets: {
        Row: {
          max_context_chars: number
          max_retries: number
          max_tokens: number
          monthly_limit_usd: number
          updated_at: string
          user_id: string
          warn_threshold_pct: number
        }
        Insert: {
          max_context_chars?: number
          max_retries?: number
          max_tokens?: number
          monthly_limit_usd?: number
          updated_at?: string
          user_id: string
          warn_threshold_pct?: number
        }
        Update: {
          max_context_chars?: number
          max_retries?: number
          max_tokens?: number
          monthly_limit_usd?: number
          updated_at?: string
          user_id?: string
          warn_threshold_pct?: number
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          audio_duration_ms: number | null
          audio_path: string | null
          citations: Json | null
          content: string
          created_at: string
          id: string
          images: Json | null
          input_kind: string
          model_tier: string | null
          role: string
          thread_id: string
          tool_steps: Json | null
          user_id: string
        }
        Insert: {
          audio_duration_ms?: number | null
          audio_path?: string | null
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          images?: Json | null
          input_kind?: string
          model_tier?: string | null
          role: string
          thread_id: string
          tool_steps?: Json | null
          user_id: string
        }
        Update: {
          audio_duration_ms?: number | null
          audio_path?: string | null
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          images?: Json | null
          input_kind?: string
          model_tier?: string | null
          role?: string
          thread_id?: string
          tool_steps?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_threads: {
        Row: {
          case_id: string
          created_at: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_threads_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_session_events: {
        Row: {
          case_id: string | null
          chars_after: number | null
          chars_before: number | null
          created_at: string
          event_type: string
          fallback_model: string | null
          feature: string | null
          id: string
          latency_ms: number | null
          messages_truncated: number | null
          model: string | null
          payload: Json | null
          reason: string | null
          session_id: string
          thread_id: string | null
          user_id: string
        }
        Insert: {
          case_id?: string | null
          chars_after?: number | null
          chars_before?: number | null
          created_at?: string
          event_type: string
          fallback_model?: string | null
          feature?: string | null
          id?: string
          latency_ms?: number | null
          messages_truncated?: number | null
          model?: string | null
          payload?: Json | null
          reason?: string | null
          session_id: string
          thread_id?: string | null
          user_id: string
        }
        Update: {
          case_id?: string | null
          chars_after?: number | null
          chars_before?: number | null
          created_at?: string
          event_type?: string
          fallback_model?: string | null
          feature?: string | null
          id?: string
          latency_ms?: number | null
          messages_truncated?: number | null
          model?: string | null
          payload?: Json | null
          reason?: string | null
          session_id?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          case_id: string | null
          completion_tokens: number
          context_chars_after: number | null
          context_chars_before: number | null
          cost_usd: number
          created_at: string
          feature: string
          gateway_run_id: string | null
          id: string
          max_tokens_applied: number | null
          messages_truncated: number | null
          model: string
          prompt_tokens: number
          retries_used: number | null
          thread_id: string | null
          total_tokens: number
          user_id: string
        }
        Insert: {
          case_id?: string | null
          completion_tokens?: number
          context_chars_after?: number | null
          context_chars_before?: number | null
          cost_usd?: number
          created_at?: string
          feature: string
          gateway_run_id?: string | null
          id?: string
          max_tokens_applied?: number | null
          messages_truncated?: number | null
          model: string
          prompt_tokens?: number
          retries_used?: number | null
          thread_id?: string | null
          total_tokens?: number
          user_id: string
        }
        Update: {
          case_id?: string | null
          completion_tokens?: number
          context_chars_after?: number | null
          context_chars_before?: number | null
          cost_usd?: number
          created_at?: string
          feature?: string
          gateway_run_id?: string | null
          id?: string
          max_tokens_applied?: number | null
          messages_truncated?: number | null
          model?: string
          prompt_tokens?: number
          retries_used?: number | null
          thread_id?: string | null
          total_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      app_oauth_settings: {
        Row: {
          client_id: string | null
          client_secret_encrypted: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id?: string | null
          client_secret_encrypted?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string | null
          client_secret_encrypted?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      b2b_service_catalog: {
        Row: {
          active: boolean
          created_at: string
          description: string
          icon: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          icon?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          icon?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      b2b_service_request_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          request_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by_user_id: string
          visibility: Database["public"]["Enums"]["b2b_attachment_visibility"]
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          request_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by_user_id: string
          visibility?: Database["public"]["Enums"]["b2b_attachment_visibility"]
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          request_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by_user_id?: string
          visibility?: Database["public"]["Enums"]["b2b_attachment_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "b2b_service_request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "b2b_service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_service_request_events: {
        Row: {
          author_user_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["b2b_event_kind"]
          payload: Json
          request_id: string
        }
        Insert: {
          author_user_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["b2b_event_kind"]
          payload?: Json
          request_id: string
        }
        Update: {
          author_user_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["b2b_event_kind"]
          payload?: Json
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_service_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "b2b_service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_service_requests: {
        Row: {
          case_id: string | null
          contact_email: string
          contact_phone: string | null
          created_at: string
          description: string
          desired_deadline: string | null
          id: string
          requester_user_id: string
          service_slug: string
          status: Database["public"]["Enums"]["b2b_request_status"]
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["b2b_request_urgency"]
        }
        Insert: {
          case_id?: string | null
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          description: string
          desired_deadline?: string | null
          id?: string
          requester_user_id: string
          service_slug: string
          status?: Database["public"]["Enums"]["b2b_request_status"]
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["b2b_request_urgency"]
        }
        Update: {
          case_id?: string | null
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          description?: string
          desired_deadline?: string | null
          id?: string
          requester_user_id?: string
          service_slug?: string
          status?: Database["public"]["Enums"]["b2b_request_status"]
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["b2b_request_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "b2b_service_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_service_requests_service_slug_fkey"
            columns: ["service_slug"]
            isOneToOne: false
            referencedRelation: "b2b_service_catalog"
            referencedColumns: ["slug"]
          },
        ]
      }
      case_quesitos: {
        Row: {
          answer: string | null
          case_id: string
          created_at: string
          id: string
          number: number | null
          question: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          case_id: string
          created_at?: string
          id?: string
          number?: number | null
          question: string
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          case_id?: string
          created_at?: string
          id?: string
          number?: number | null
          question?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_quesitos_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assisted_party_name: string | null
          case_number: string | null
          case_type: string | null
          client_name: string | null
          created_at: string
          description: string | null
          id: string
          jurisdiction: string | null
          matter_kind: string
          parties: Json | null
          perito_appointment_date: string | null
          perito_deadline_date: string | null
          perito_fee_cents: number | null
          perito_nomination_ref: string | null
          practice_type: string | null
          represented_party: Json | null
          status: string
          summary: string | null
          summary_updated_at: string | null
          team_member_ids: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assisted_party_name?: string | null
          case_number?: string | null
          case_type?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          jurisdiction?: string | null
          matter_kind?: string
          parties?: Json | null
          perito_appointment_date?: string | null
          perito_deadline_date?: string | null
          perito_fee_cents?: number | null
          perito_nomination_ref?: string | null
          practice_type?: string | null
          represented_party?: Json | null
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          team_member_ids?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assisted_party_name?: string | null
          case_number?: string | null
          case_type?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          jurisdiction?: string | null
          matter_kind?: string
          parties?: Json | null
          perito_appointment_date?: string | null
          perito_deadline_date?: string | null
          perito_fee_cents?: number | null
          perito_nomination_ref?: string | null
          practice_type?: string | null
          represented_party?: Json | null
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          team_member_ids?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string
          id: string
          kind: string
          last_message_at: string
          title: string | null
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          kind: string
          last_message_at?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          last_message_at?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          billing_email: string | null
          created_at: string
          id: string
          mrr_cents: number
          name: string | null
          notes: string | null
          owner_user_id: string
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          id?: string
          mrr_cents?: number
          name?: string | null
          notes?: string | null
          owner_user_id: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          id?: string
          mrr_cents?: number
          name?: string | null
          notes?: string | null
          owner_user_id?: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_audit_events: {
        Row: {
          action: string
          case_id: string
          content_hash: string | null
          created_at: string
          document_id: string | null
          filename: string | null
          id: string
          metadata: Json
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          case_id: string
          content_hash?: string | null
          created_at?: string
          document_id?: string | null
          filename?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          case_id?: string
          content_hash?: string | null
          created_at?: string
          document_id?: string | null
          filename?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_audit_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          case_id: string
          chunk_index: number
          content: string
          content_tsv: unknown
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          source_kind: string
          user_id: string
        }
        Insert: {
          case_id: string
          chunk_index: number
          content: string
          content_tsv?: unknown
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          source_kind?: string
          user_id: string
        }
        Update: {
          case_id?: string
          chunk_index?: number
          content?: string
          content_tsv?: unknown
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          source_kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          case_id: string
          content_hash: string | null
          created_at: string
          extracted_text: string | null
          file_size: number | null
          file_type: string
          filename: string
          id: string
          processing_status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          content_hash?: string | null
          created_at?: string
          extracted_text?: string | null
          file_size?: number | null
          file_type: string
          filename: string
          id?: string
          processing_status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          content_hash?: string | null
          created_at?: string
          extracted_text?: string | null
          file_size?: number | null
          file_type?: string
          filename?: string
          id?: string
          processing_status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          case_id: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          event_type: string
          id: string
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          case_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          starts_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          case_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          google_email: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          refresh_token: string
          scope: string | null
          selected_calendar_ids: string[] | null
          sync_end_date: string | null
          sync_window_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          google_email?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          refresh_token: string
          scope?: string | null
          selected_calendar_ids?: string[] | null
          sync_end_date?: string | null
          sync_window_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          google_email?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          refresh_token?: string
          scope?: string | null
          selected_calendar_ids?: string[] | null
          sync_end_date?: string | null
          sync_window_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      message_mentions: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          mentioned_user_id: string
          message_id: string
          read_at: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
          message_id: string
          read_at?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
          message_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_mentions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_tasks: {
        Row: {
          message_id: string
          task_id: string
        }
        Insert: {
          message_id: string
          task_id: string
        }
        Update: {
          message_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_tasks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          author_id: string
          body: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          reply_to_id: string | null
        }
        Insert: {
          attachments?: Json
          author_id: string
          body?: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
        }
        Update: {
          attachments?: Json
          author_id?: string
          body?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      outlook_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          outlook_email: string | null
          refresh_token: string
          scope: string | null
          selected_calendar_ids: string[] | null
          sync_end_date: string | null
          sync_window_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          outlook_email?: string | null
          refresh_token: string
          scope?: string | null
          selected_calendar_ids?: string[] | null
          sync_end_date?: string | null
          sync_window_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          outlook_email?: string | null
          refresh_token?: string
          scope?: string | null
          selected_calendar_ids?: string[] | null
          sync_end_date?: string | null
          sync_window_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      outlook_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          metadata: Json
          target_customer_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_customer_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_customer_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_log_target_customer_id_fkey"
            columns: ["target_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          entity_type: string
          firm_address: string | null
          firm_name: string | null
          firm_website: string | null
          full_name: string | null
          id: string
          logo_path: string | null
          oab_number: string | null
          onboarding_completed: boolean
          phone: string | null
          practice_type: string
          specialty: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type?: string
          firm_address?: string | null
          firm_name?: string | null
          firm_website?: string | null
          full_name?: string | null
          id: string
          logo_path?: string | null
          oab_number?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          practice_type?: string
          specialty?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          firm_address?: string | null
          firm_name?: string | null
          firm_website?: string | null
          full_name?: string | null
          id?: string
          logo_path?: string | null
          oab_number?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          practice_type?: string
          specialty?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposal_attachments: {
        Row: {
          case_id: string | null
          created_at: string
          extracted_fields: Json | null
          extracted_text: string | null
          extraction_error: string | null
          extraction_status: string
          file_size: number
          file_type: string
          filename: string
          id: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          extracted_fields?: Json | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string
          file_size?: number
          file_type?: string
          filename: string
          id?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          extracted_fields?: Json | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string
          file_size?: number
          file_type?: string
          filename?: string
          id?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_attachments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_drafts: {
        Row: {
          case_id: string | null
          created_at: string
          form: Json
          id: string
          output: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          form?: Json
          id?: string
          output?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          form?: Json
          id?: string
          output?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_drafts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_shares: {
        Row: {
          client_name: string | null
          cover: Json | null
          created_at: string
          download_count: number
          expires_at: string | null
          html: string
          id: string
          last_accessed_at: string | null
          max_downloads: number | null
          page_config: Json
          password_hash: string | null
          password_salt: string | null
          revoked_at: string | null
          title: string
          token: string
          user_id: string
          watermark: Json | null
        }
        Insert: {
          client_name?: string | null
          cover?: Json | null
          created_at?: string
          download_count?: number
          expires_at?: string | null
          html: string
          id?: string
          last_accessed_at?: string | null
          max_downloads?: number | null
          page_config?: Json
          password_hash?: string | null
          password_salt?: string | null
          revoked_at?: string | null
          title: string
          token: string
          user_id: string
          watermark?: Json | null
        }
        Update: {
          client_name?: string | null
          cover?: Json | null
          created_at?: string
          download_count?: number
          expires_at?: string | null
          html?: string
          id?: string
          last_accessed_at?: string | null
          max_downloads?: number | null
          page_config?: Json
          password_hash?: string | null
          password_salt?: string | null
          revoked_at?: string | null
          title?: string
          token?: string
          user_id?: string
          watermark?: Json | null
        }
        Relationships: []
      }
      proposal_versions: {
        Row: {
          case_id: string | null
          created_at: string
          description: string | null
          form: Json
          id: string
          label: string
          origin: string
          output: string
          pinned: boolean
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          description?: string | null
          form?: Json
          id?: string
          label: string
          origin: string
          output?: string
          pinned?: boolean
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          description?: string | null
          form?: Json
          id?: string
          label?: string
          origin?: string
          output?: string
          pinned?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to_user_id: string | null
          case_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          source_message_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          source_message_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to_user_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          source_message_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_at: string
          owner_user_id: string
          status: string
          team_member_id: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_at?: string
          owner_user_id: string
          status?: string
          team_member_id: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_at?: string
          owner_user_id?: string
          status?: string
          team_member_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          access_role: string
          color: string | null
          created_at: string
          email: string | null
          id: string
          member_user_id: string | null
          name: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_role?: string
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          member_user_id?: string | null
          name: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_role?: string
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          member_user_id?: string | null
          name?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_capabilities: {
        Row: {
          capability: Database["public"]["Enums"]["app_capability"]
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          capability: Database["public"]["Enums"]["app_capability"]
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          capability?: Database["public"]["Enums"]["app_capability"]
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_usage_by_feature: {
        Args: { _from: string; _to: string }
        Returns: {
          calls: number
          completion_tokens: number
          cost_usd: number
          feature: string
          prompt_tokens: number
          total_tokens: number
        }[]
      }
      ai_usage_by_model: {
        Args: { _from: string; _to: string }
        Returns: {
          calls: number
          completion_tokens: number
          cost_usd: number
          model: string
          prompt_tokens: number
          total_tokens: number
        }[]
      }
      ai_usage_by_user: {
        Args: { _from: string; _to: string }
        Returns: {
          calls: number
          completion_tokens: number
          cost_usd: number
          email: string
          full_name: string
          prompt_tokens: number
          total_tokens: number
          user_id: string
        }[]
      }
      ai_usage_current_month_cost: {
        Args: { _user_id: string }
        Returns: number
      }
      ai_usage_summary: {
        Args: { _from: string; _to: string }
        Returns: {
          calls: number
          completion_tokens: number
          cost_usd: number
          day: string
          prompt_tokens: number
          total_tokens: number
        }[]
      }
      can_view_all_ai_usage: { Args: { _user_id: string }; Returns: boolean }
      has_capability: {
        Args: {
          _capability: Database["public"]["Enums"]["app_capability"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hybrid_search_chunks: {
        Args: {
          filter_case_id?: string
          filter_doc_ids?: string[]
          filter_user_id: string
          match_count?: number
          query_embedding: string
          query_text: string
          rrf_k?: number
        }
        Returns: {
          case_id: string
          content: string
          document_id: string
          fts_rank: number
          id: string
          score: number
          source_kind: string
          vector_similarity: number
        }[]
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      match_chunks: {
        Args: {
          filter_user_id?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          case_id: string
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
      match_chunks_scoped: {
        Args: {
          filter_case_id?: string
          filter_doc_ids?: string[]
          filter_user_id: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          case_id: string
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
      user_can_access_case: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_edit_case: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_capability:
        | "cases"
        | "expert_opinion"
        | "commercial"
        | "marketing"
        | "office_admin"
        | "platform_admin"
        | "super_admin"
      app_role: "admin" | "user"
      b2b_attachment_visibility: "client" | "internal"
      b2b_event_kind:
        | "status_change"
        | "note_public"
        | "note_internal"
        | "attachment"
        | "created"
      b2b_request_status:
        | "novo"
        | "em_analise"
        | "proposta_enviada"
        | "aceita"
        | "recusada"
        | "cancelada"
        | "concluido"
      b2b_request_urgency: "normal" | "alta" | "critica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_capability: [
        "cases",
        "expert_opinion",
        "commercial",
        "marketing",
        "office_admin",
        "platform_admin",
        "super_admin",
      ],
      app_role: ["admin", "user"],
      b2b_attachment_visibility: ["client", "internal"],
      b2b_event_kind: [
        "status_change",
        "note_public",
        "note_internal",
        "attachment",
        "created",
      ],
      b2b_request_status: [
        "novo",
        "em_analise",
        "proposta_enviada",
        "aceita",
        "recusada",
        "cancelada",
        "concluido",
      ],
      b2b_request_urgency: ["normal", "alta", "critica"],
    },
  },
} as const
