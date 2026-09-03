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
          force_fallback_on_retry: boolean
          max_context_chars: number
          max_retries: number
          max_tokens: number
          monthly_limit_usd: number
          organization_id: string
          updated_at: string
          warn_threshold_pct: number
        }
        Insert: {
          force_fallback_on_retry?: boolean
          max_context_chars?: number
          max_retries?: number
          max_tokens?: number
          monthly_limit_usd?: number
          organization_id: string
          updated_at?: string
          warn_threshold_pct?: number
        }
        Update: {
          force_fallback_on_retry?: boolean
          max_context_chars?: number
          max_retries?: number
          max_tokens?: number
          monthly_limit_usd?: number
          organization_id?: string
          updated_at?: string
          warn_threshold_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          role?: string
          thread_id?: string
          tool_steps?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          created_by_user_id: string
          id: string
          last_message_at: string
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          last_message_at?: string
          organization_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          last_message_at?: string
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_threads_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          payload?: Json | null
          reason?: string | null
          session_id?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_session_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          prompt_tokens?: number
          retries_used?: number | null
          thread_id?: string | null
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            foreignKeyName: "b2b_service_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      billing_email_log: {
        Row: {
          created_at: string
          error: string | null
          event: string
          id: string
          organization_id: string | null
          provider_message_id: string | null
          recipient: string
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: string
          id?: string
          organization_id?: string | null
          provider_message_id?: string | null
          recipient: string
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          organization_id?: string | null
          provider_message_id?: string | null
          recipient?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_email_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          attempts: number
          created_at: string
          environment: string
          error: string | null
          external_event_id: string
          id: string
          occurred_at: string | null
          organization_id: string | null
          processed_at: string | null
          provider: string
          status: string
          summary: Json
          type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          environment?: string
          error?: string | null
          external_event_id: string
          id?: string
          occurred_at?: string | null
          organization_id?: string | null
          processed_at?: string | null
          provider?: string
          status?: string
          summary?: Json
          type: string
        }
        Update: {
          attempts?: number
          created_at?: string
          environment?: string
          error?: string | null
          external_event_id?: string
          id?: string
          occurred_at?: string | null
          organization_id?: string | null
          processed_at?: string | null
          provider?: string
          status?: string
          summary?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_access: {
        Row: {
          access_level: Database["public"]["Enums"]["case_access_level"]
          case_id: string
          created_at: string
          granted_by_user_id: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["case_access_level"]
          case_id: string
          created_at?: string
          granted_by_user_id?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["case_access_level"]
          case_id?: string
          created_at?: string
          granted_by_user_id?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_access_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_quesitos: {
        Row: {
          answer: string | null
          case_id: string
          created_at: string
          created_by_user_id: string
          id: string
          number: number | null
          organization_id: string
          question: string
          source: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          case_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          number?: number | null
          organization_id: string
          question: string
          source: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          case_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          number?: number | null
          organization_id?: string
          question?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_quesitos_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_quesitos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          created_by_user_id: string
          description: string | null
          id: string
          jurisdiction: string | null
          lead_id: string | null
          matter_kind: string
          opportunity_id: string | null
          organization_id: string
          parties: Json | null
          perito_appointment_date: string | null
          perito_deadline_date: string | null
          perito_fee_cents: number | null
          perito_nomination_ref: string | null
          practice_type: string | null
          proposal_id: string | null
          represented_party: Json | null
          status: string
          summary: string | null
          summary_updated_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assisted_party_name?: string | null
          case_number?: string | null
          case_type?: string | null
          client_name?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          jurisdiction?: string | null
          lead_id?: string | null
          matter_kind?: string
          opportunity_id?: string | null
          organization_id: string
          parties?: Json | null
          perito_appointment_date?: string | null
          perito_deadline_date?: string | null
          perito_fee_cents?: number | null
          perito_nomination_ref?: string | null
          practice_type?: string | null
          proposal_id?: string | null
          represented_party?: Json | null
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assisted_party_name?: string | null
          case_number?: string | null
          case_type?: string | null
          client_name?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          jurisdiction?: string | null
          lead_id?: string | null
          matter_kind?: string
          opportunity_id?: string | null
          organization_id?: string
          parties?: Json | null
          perito_appointment_date?: string | null
          perito_deadline_date?: string | null
          perito_fee_cents?: number | null
          perito_nomination_ref?: string | null
          practice_type?: string | null
          proposal_id?: string | null
          represented_party?: Json | null
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          organization_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          organization_id?: string
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
          {
            foreignKeyName: "conversation_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string
          dm_key: string | null
          id: string
          kind: string
          last_message_at: string
          organization_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by: string
          dm_key?: string | null
          id?: string
          kind: string
          last_message_at?: string
          organization_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string
          dm_key?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          organization_id?: string
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
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_at: string
          created_at: string
          created_by_user_id: string
          description: string | null
          due_at: string | null
          event_id: string | null
          id: string
          kind: string
          lead_id: string | null
          next_step: string | null
          opportunity_id: string | null
          organization_id: string
          outcome: string | null
          owner_user_id: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_at?: string
          created_at?: string
          created_by_user_id: string
          description?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          kind: string
          lead_id?: string | null
          next_step?: string | null
          opportunity_id?: string | null
          organization_id: string
          outcome?: string | null
          owner_user_id?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_at?: string
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          next_step?: string | null
          opportunity_id?: string | null
          organization_id?: string
          outcome?: string | null
          owner_user_id?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_conflict_checks: {
        Row: {
          created_at: string
          created_by_user_id: string
          decided_at: string | null
          decided_by_user_id: string | null
          id: string
          notes: string | null
          opportunity_id: string
          organization_id: string
          results: Json
          status: string
          terms: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          organization_id: string
          results?: Json
          status?: string
          terms?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          organization_id?: string
          results?: Json
          status?: string
          terms?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_conflict_checks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conflict_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          created_at: string
          created_by_user_id: string
          email: string | null
          email_normalized: string | null
          id: string
          is_primary: boolean
          lead_id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          phone_digits: string | null
          role_title: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          email?: string | null
          email_normalized?: string | null
          id?: string
          is_primary?: boolean
          lead_id: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          phone_digits?: string | null
          role_title?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          email?: string | null
          email_normalized?: string | null
          id?: string
          is_primary?: boolean
          lead_id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          phone_digits?: string | null
          role_title?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by_user_id: string
          document: string | null
          document_digits: string | null
          email: string | null
          email_normalized: string | null
          id: string
          kind: string
          last_interaction_at: string | null
          name: string
          notes: string | null
          organization_id: string
          owner_user_id: string | null
          phone: string | null
          phone_digits: string | null
          source: string | null
          state: string | null
          status: string
          trade_name: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_digits: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by_user_id: string
          document?: string | null
          document_digits?: string | null
          email?: string | null
          email_normalized?: string | null
          id?: string
          kind?: string
          last_interaction_at?: string | null
          name: string
          notes?: string | null
          organization_id: string
          owner_user_id?: string | null
          phone?: string | null
          phone_digits?: string | null
          source?: string | null
          state?: string | null
          status?: string
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_digits?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by_user_id?: string
          document?: string | null
          document_digits?: string | null
          email?: string | null
          email_normalized?: string | null
          id?: string
          kind?: string
          last_interaction_at?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          owner_user_id?: string | null
          phone?: string | null
          phone_digits?: string | null
          source?: string | null
          state?: string | null
          status?: string
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_digits?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          archived_at: string | null
          contact_id: string | null
          converted_case_id: string | null
          created_at: string
          created_by_user_id: string
          currency: string
          description: string | null
          estimated_value_cents: number
          expected_close_date: string | null
          id: string
          lead_id: string | null
          lost_reason: string | null
          next_activity_at: string | null
          organization_id: string
          owner_user_id: string | null
          position: number
          practice_area: string | null
          priority: string
          probability: number
          proposal_id: string | null
          source: string | null
          stage: string
          stage_changed_at: string
          stage_changed_by_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          contact_id?: string | null
          converted_case_id?: string | null
          created_at?: string
          created_by_user_id: string
          currency?: string
          description?: string | null
          estimated_value_cents?: number
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          next_activity_at?: string | null
          organization_id: string
          owner_user_id?: string | null
          position?: number
          practice_area?: string | null
          priority?: string
          probability?: number
          proposal_id?: string | null
          source?: string | null
          stage?: string
          stage_changed_at?: string
          stage_changed_by_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          contact_id?: string | null
          converted_case_id?: string | null
          created_at?: string
          created_by_user_id?: string
          currency?: string
          description?: string | null
          estimated_value_cents?: number
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          next_activity_at?: string | null
          organization_id?: string
          owner_user_id?: string | null
          position?: number
          practice_area?: string | null
          priority?: string
          probability?: number
          proposal_id?: string | null
          source?: string | null
          stage?: string
          stage_changed_at?: string
          stage_changed_by_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_converted_case_id_fkey"
            columns: ["converted_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opps_proposal_fk"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_settings: {
        Row: {
          created_at: string
          default_currency: string
          default_validity_days: number
          loss_reasons: string[]
          organization_id: string
          practice_areas: string[]
          proposal_prefix: string
          required_fields: Json
          sources: string[]
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          default_currency?: string
          default_validity_days?: number
          loss_reasons?: string[]
          organization_id: string
          practice_areas?: string[]
          proposal_prefix?: string
          required_fields?: Json
          sources?: string[]
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          default_currency?: string
          default_validity_days?: number
          loss_reasons?: string[]
          organization_id?: string
          practice_areas?: string[]
          proposal_prefix?: string
          required_fields?: Json
          sources?: string[]
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stage_history: {
        Row: {
          created_at: string
          created_by_user_id: string
          from_stage: string | null
          id: string
          note: string | null
          opportunity_id: string
          organization_id: string
          to_stage: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          from_stage?: string | null
          id?: string
          note?: string | null
          opportunity_id: string
          organization_id: string
          to_stage: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          from_stage?: string | null
          id?: string
          note?: string | null
          opportunity_id?: string
          organization_id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          actor_user_id: string
          case_id: string
          content_hash: string | null
          created_at: string
          document_id: string | null
          filename: string | null
          id: string
          metadata: Json
          organization_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          case_id: string
          content_hash?: string | null
          created_at?: string
          document_id?: string | null
          filename?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          case_id?: string
          content_hash?: string | null
          created_at?: string
          document_id?: string | null
          filename?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_audit_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          case_id: string
          chunk_index: number
          chunking_version: string | null
          content: string
          content_hash: string | null
          content_tsv: unknown
          created_at: string
          created_by_user_id: string
          document_id: string
          embedding: string | null
          embedding_model: string | null
          id: string
          metadata: Json
          organization_id: string
          page_end: number | null
          page_start: number | null
          parser_version: string | null
          row_end: number | null
          row_start: number | null
          section_title: string | null
          sheet_name: string | null
          source_kind: string
          token_count: number | null
        }
        Insert: {
          case_id: string
          chunk_index: number
          chunking_version?: string | null
          content: string
          content_hash?: string | null
          content_tsv?: unknown
          created_at?: string
          created_by_user_id: string
          document_id: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          page_end?: number | null
          page_start?: number | null
          parser_version?: string | null
          row_end?: number | null
          row_start?: number | null
          section_title?: string | null
          sheet_name?: string | null
          source_kind?: string
          token_count?: number | null
        }
        Update: {
          case_id?: string
          chunk_index?: number
          chunking_version?: string | null
          content?: string
          content_hash?: string | null
          content_tsv?: unknown
          created_at?: string
          created_by_user_id?: string
          document_id?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          page_end?: number | null
          page_start?: number | null
          parser_version?: string | null
          row_end?: number | null
          row_start?: number | null
          section_title?: string | null
          sheet_name?: string | null
          source_kind?: string
          token_count?: number | null
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
          {
            foreignKeyName: "document_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          case_id: string
          content_hash: string | null
          created_at: string
          created_by_user_id: string
          extracted_text: string | null
          file_size: number | null
          file_type: string
          filename: string
          id: string
          organization_id: string
          processing_status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          case_id: string
          content_hash?: string | null
          created_at?: string
          created_by_user_id: string
          extracted_text?: string | null
          file_size?: number | null
          file_type: string
          filename: string
          id?: string
          organization_id: string
          processing_status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          content_hash?: string | null
          created_at?: string
          created_by_user_id?: string
          extracted_text?: string | null
          file_size?: number | null
          file_type?: string
          filename?: string
          id?: string
          organization_id?: string
          processing_status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          case_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          ends_at: string | null
          event_type: string
          id: string
          opportunity_id: string | null
          organization_id: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          case_id?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          opportunity_id?: string | null
          organization_id: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          case_id?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          opportunity_id?: string | null
          organization_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          refresh_token?: string
          scope?: string | null
          selected_calendar_ids?: string[] | null
          sync_end_date?: string | null
          sync_window_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      mcp_tool_audit_log: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          organization_id: string
          params: Json
          result_count: number | null
          status: string
          tool_name: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          organization_id: string
          params?: Json
          result_count?: number | null
          status?: string
          tool_name: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          organization_id?: string
          params?: Json
          result_count?: number | null
          status?: string
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tool_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_mentions: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          mentioned_user_id: string
          message_id: string
          organization_id: string
          read_at: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
          message_id: string
          organization_id: string
          read_at?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
          message_id?: string
          organization_id?: string
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
          {
            foreignKeyName: "message_mentions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          deleted_at: string | null
          edited_at: string | null
          id: string
          organization_id: string
          reply_to_id: string | null
        }
        Insert: {
          attachments?: Json
          author_id: string
          body?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          organization_id: string
          reply_to_id?: string | null
        }
        Update: {
          attachments?: Json
          author_id?: string
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          organization_id?: string
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
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      monitoring_terms: {
        Row: {
          active: boolean
          case_id: string | null
          created_at: string
          created_by_user_id: string
          deadline_days: number
          id: string
          kind: string
          label: string | null
          last_run_at: string | null
          organization_id: string
          responsible_user_id: string | null
          uf: string | null
          updated_at: string
          use_paid_fallback: boolean
          value: string
        }
        Insert: {
          active?: boolean
          case_id?: string | null
          created_at?: string
          created_by_user_id: string
          deadline_days?: number
          id?: string
          kind: string
          label?: string | null
          last_run_at?: string | null
          organization_id: string
          responsible_user_id?: string | null
          uf?: string | null
          updated_at?: string
          use_paid_fallback?: boolean
          value: string
        }
        Update: {
          active?: boolean
          case_id?: string | null
          created_at?: string
          created_by_user_id?: string
          deadline_days?: number
          id?: string
          kind?: string
          label?: string | null
          last_run_at?: string | null
          organization_id?: string
          responsible_user_id?: string | null
          uf?: string | null
          updated_at?: string
          use_paid_fallback?: boolean
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_terms_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_user_id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: Database["public"]["Enums"]["org_invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by_user_id: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["org_invitation_status"]
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_user_id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["org_invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invoice_items: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_price_cents?: number
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "organization_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invoices: {
        Row: {
          attempt_count: number
          billing_email: string | null
          created_at: string
          created_by_user_id: string | null
          currency: string
          discount_cents: number
          due_date: string | null
          environment: string
          external_invoice_id: string | null
          hosted_url: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string
          organization_id: string
          origin: string
          paid_at: string | null
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          attempt_count?: number
          billing_email?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          discount_cents?: number
          due_date?: string | null
          environment?: string
          external_invoice_id?: string | null
          hosted_url?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number: string
          organization_id: string
          origin?: string
          paid_at?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          attempt_count?: number
          billing_email?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          discount_cents?: number
          due_date?: string | null
          environment?: string
          external_invoice_id?: string | null
          hosted_url?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number?: string
          organization_id?: string
          origin?: string
          paid_at?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_permissions: {
        Row: {
          created_at: string
          granted: boolean
          granted_by_user_id: string | null
          id: string
          organization_id: string
          permission: Database["public"]["Enums"]["org_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          granted_by_user_id?: string | null
          id?: string
          organization_id: string
          permission: Database["public"]["Enums"]["org_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          granted_by_user_id?: string | null
          id?: string
          organization_id?: string
          permission?: Database["public"]["Enums"]["org_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_payments: {
        Row: {
          amount_cents: number
          attempt: number
          created_at: string
          environment: string
          external_payment_id: string | null
          failure_reason: string | null
          id: string
          invoice_id: string | null
          justification: string | null
          method: string | null
          method_summary: string | null
          notes: string | null
          organization_id: string
          paid_at: string
          provider: string
          receipt_path: string | null
          recorded_by_user_id: string | null
          reference: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          attempt?: number
          created_at?: string
          environment?: string
          external_payment_id?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string | null
          justification?: string | null
          method?: string | null
          method_summary?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string
          provider?: string
          receipt_path?: string | null
          recorded_by_user_id?: string | null
          reference?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          attempt?: number
          created_at?: string
          environment?: string
          external_payment_id?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string | null
          justification?: string | null
          method?: string | null
          method_summary?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string
          provider?: string
          receipt_path?: string | null
          recorded_by_user_id?: string | null
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "organization_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          amount_cents: number
          billing_interval: string
          cancel_at_period_end: boolean
          cancel_effective_at: string | null
          cancelled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string
          environment: string
          external_customer_id: string | null
          external_price_id: string | null
          external_subscription_id: string | null
          id: string
          notes: string | null
          organization_id: string
          past_due_since: string | null
          plan_id: string
          provider: string
          scheduled_interval: string | null
          scheduled_plan_id: string | null
          seats: number
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          billing_interval?: string
          cancel_at_period_end?: boolean
          cancel_effective_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string
          environment?: string
          external_customer_id?: string | null
          external_price_id?: string | null
          external_subscription_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          past_due_since?: string | null
          plan_id: string
          provider?: string
          scheduled_interval?: string | null
          scheduled_plan_id?: string | null
          seats?: number
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_interval?: string
          cancel_at_period_end?: boolean
          cancel_effective_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string
          environment?: string
          external_customer_id?: string | null
          external_price_id?: string | null
          external_subscription_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          past_due_since?: string | null
          plan_id?: string
          provider?: string
          scheduled_interval?: string | null
          scheduled_plan_id?: string | null
          seats?: number
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_scheduled_plan_id_fkey"
            columns: ["scheduled_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_city: string | null
          address_line: string | null
          address_postal_code: string | null
          address_state: string | null
          billing_email: string | null
          billing_environment: string
          billing_provider_customer_id: string | null
          cancelled_at: string | null
          conversion_source: string | null
          converted_at: string | null
          country: string
          created_at: string
          created_by_user_id: string
          domain: string | null
          grace_until: string | null
          id: string
          is_demo: boolean
          legacy_customer_account_id: string | null
          legal_name: string | null
          name: string
          phone: string | null
          primary_contact_name: string | null
          status: Database["public"]["Enums"]["org_status"]
          suspended_at: string | null
          tax_id: string | null
          trial_ends_at: string
          trial_extension_days: number
          trial_started_at: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_line?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          billing_email?: string | null
          billing_environment?: string
          billing_provider_customer_id?: string | null
          cancelled_at?: string | null
          conversion_source?: string | null
          converted_at?: string | null
          country?: string
          created_at?: string
          created_by_user_id: string
          domain?: string | null
          grace_until?: string | null
          id?: string
          is_demo?: boolean
          legacy_customer_account_id?: string | null
          legal_name?: string | null
          name: string
          phone?: string | null
          primary_contact_name?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          suspended_at?: string | null
          tax_id?: string | null
          trial_ends_at?: string
          trial_extension_days?: number
          trial_started_at?: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_line?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          billing_email?: string | null
          billing_environment?: string
          billing_provider_customer_id?: string | null
          cancelled_at?: string | null
          conversion_source?: string | null
          converted_at?: string | null
          country?: string
          created_at?: string
          created_by_user_id?: string
          domain?: string | null
          grace_until?: string | null
          id?: string
          is_demo?: boolean
          legacy_customer_account_id?: string | null
          legal_name?: string | null
          name?: string
          phone?: string | null
          primary_contact_name?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          suspended_at?: string | null
          tax_id?: string | null
          trial_ends_at?: string
          trial_extension_days?: number
          trial_started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      outlook_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          outlook_email?: string | null
          refresh_token?: string
          scope?: string | null
          selected_calendar_ids?: string[] | null
          sync_end_date?: string | null
          sync_window_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlook_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      plan_entitlements: {
        Row: {
          created_at: string
          id: string
          key: string
          plan_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          plan_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          plan_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          archived_at: string | null
          code: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_trial_default: boolean
          monthly_price_cents: number
          name: string
          provider_monthly_price_id: string | null
          provider_product_id: string | null
          provider_yearly_price_id: string | null
          sort_order: number
          updated_at: string
          yearly_price_cents: number | null
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_trial_default?: boolean
          monthly_price_cents?: number
          name: string
          provider_monthly_price_id?: string | null
          provider_product_id?: string | null
          provider_yearly_price_id?: string | null
          sort_order?: number
          updated_at?: string
          yearly_price_cents?: number | null
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_trial_default?: boolean
          monthly_price_cents?: number
          name?: string
          provider_monthly_price_id?: string | null
          provider_product_id?: string | null
          provider_yearly_price_id?: string | null
          sort_order?: number
          updated_at?: string
          yearly_price_cents?: number | null
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
      platform_user_roles: {
        Row: {
          created_at: string
          granted_by_user_id: string | null
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by_user_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by_user_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
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
          created_by_user_id: string
          extracted_fields: Json | null
          extracted_text: string | null
          extraction_error: string | null
          extraction_status: string
          file_size: number
          file_type: string
          filename: string
          id: string
          organization_id: string
          proposal_id: string | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by_user_id: string
          extracted_fields?: Json | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string
          file_size?: number
          file_type?: string
          filename: string
          id?: string
          organization_id: string
          proposal_id?: string | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by_user_id?: string
          extracted_fields?: Json | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string
          file_size?: number
          file_type?: string
          filename?: string
          id?: string
          organization_id?: string
          proposal_id?: string | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_attachments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_attachments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_drafts: {
        Row: {
          case_id: string | null
          created_at: string
          created_by_user_id: string
          form: Json
          id: string
          organization_id: string
          output: string
          proposal_id: string | null
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by_user_id: string
          form?: Json
          id?: string
          organization_id: string
          output?: string
          proposal_id?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by_user_id?: string
          form?: Json
          id?: string
          organization_id?: string
          output?: string
          proposal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_drafts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_drafts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_events: {
        Row: {
          actor_label: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          kind: string
          metadata: Json
          organization_id: string
          proposal_id: string
        }
        Insert: {
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          organization_id: string
          proposal_id: string
        }
        Update: {
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          organization_id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_shares: {
        Row: {
          access_count: number
          client_name: string | null
          cover: Json | null
          created_at: string
          created_by_user_id: string
          download_count: number
          expires_at: string | null
          first_accessed_at: string | null
          html: string
          id: string
          last_accessed_at: string | null
          max_downloads: number | null
          organization_id: string
          page_config: Json
          password_hash: string | null
          password_salt: string | null
          proposal_id: string | null
          revoked_at: string | null
          title: string
          token: string
          watermark: Json | null
        }
        Insert: {
          access_count?: number
          client_name?: string | null
          cover?: Json | null
          created_at?: string
          created_by_user_id: string
          download_count?: number
          expires_at?: string | null
          first_accessed_at?: string | null
          html: string
          id?: string
          last_accessed_at?: string | null
          max_downloads?: number | null
          organization_id: string
          page_config?: Json
          password_hash?: string | null
          password_salt?: string | null
          proposal_id?: string | null
          revoked_at?: string | null
          title: string
          token: string
          watermark?: Json | null
        }
        Update: {
          access_count?: number
          client_name?: string | null
          cover?: Json | null
          created_at?: string
          created_by_user_id?: string
          download_count?: number
          expires_at?: string | null
          first_accessed_at?: string | null
          html?: string
          id?: string
          last_accessed_at?: string | null
          max_downloads?: number | null
          organization_id?: string
          page_config?: Json
          password_hash?: string | null
          password_salt?: string | null
          proposal_id?: string | null
          revoked_at?: string | null
          title?: string
          token?: string
          watermark?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_shares_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          case_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          form: Json
          id: string
          label: string
          organization_id: string
          origin: string
          output: string
          pinned: boolean
          proposal_id: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          form?: Json
          id?: string
          label: string
          organization_id: string
          origin: string
          output?: string
          pinned?: boolean
          proposal_id?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          form?: Json
          id?: string
          label?: string
          organization_id?: string
          origin?: string
          output?: string
          pinned?: boolean
          proposal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          case_id: string | null
          commercial_notes: string | null
          content_html: string
          converted_case_id: string | null
          created_at: string
          created_by_user_id: string
          currency: string
          decline_reason: string | null
          first_viewed_at: string | null
          fixed_value_cents: number
          form: Json
          id: string
          last_viewed_at: string | null
          lead_id: string | null
          number: number
          opportunity_id: string | null
          organization_id: string
          owner_user_id: string | null
          payment_terms: string | null
          recurring_value_cents: number
          responded_at: string | null
          response_comment: string | null
          response_email: string | null
          response_name: string | null
          sent_at: string | null
          status: string
          success_fee_percent: number | null
          title: string
          updated_at: string
          valid_until: string | null
          view_count: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          case_id?: string | null
          commercial_notes?: string | null
          content_html?: string
          converted_case_id?: string | null
          created_at?: string
          created_by_user_id: string
          currency?: string
          decline_reason?: string | null
          first_viewed_at?: string | null
          fixed_value_cents?: number
          form?: Json
          id?: string
          last_viewed_at?: string | null
          lead_id?: string | null
          number?: number
          opportunity_id?: string | null
          organization_id: string
          owner_user_id?: string | null
          payment_terms?: string | null
          recurring_value_cents?: number
          responded_at?: string | null
          response_comment?: string | null
          response_email?: string | null
          response_name?: string | null
          sent_at?: string | null
          status?: string
          success_fee_percent?: number | null
          title: string
          updated_at?: string
          valid_until?: string | null
          view_count?: number
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          case_id?: string | null
          commercial_notes?: string | null
          content_html?: string
          converted_case_id?: string | null
          created_at?: string
          created_by_user_id?: string
          currency?: string
          decline_reason?: string | null
          first_viewed_at?: string | null
          fixed_value_cents?: number
          form?: Json
          id?: string
          last_viewed_at?: string | null
          lead_id?: string | null
          number?: number
          opportunity_id?: string | null
          organization_id?: string
          owner_user_id?: string | null
          payment_terms?: string | null
          recurring_value_cents?: number
          responded_at?: string | null
          response_comment?: string | null
          response_email?: string | null
          response_name?: string | null
          sent_at?: string | null
          status?: string
          success_fee_percent?: number | null
          title?: string
          updated_at?: string
          valid_until?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_converted_case_id_fkey"
            columns: ["converted_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_fetch_log: {
        Row: {
          cost_usd: number
          created_at: string
          created_by_user_id: string
          error: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          ok: boolean
          organization_id: string
          results_count: number
          source: string
          term_id: string | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          created_by_user_id: string
          error?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          ok?: boolean
          organization_id: string
          results_count?: number
          source: string
          term_id?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          created_by_user_id?: string
          error?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          ok?: boolean
          organization_id?: string
          results_count?: number
          source?: string
          term_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_fetch_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_fetch_log_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "monitoring_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_term_matches: {
        Row: {
          created_at: string
          id: string
          matched_field: string | null
          matched_snippet: string | null
          organization_id: string
          publication_id: string
          term_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          matched_field?: string | null
          matched_snippet?: string | null
          organization_id: string
          publication_id: string
          term_id: string
        }
        Update: {
          created_at?: string
          id?: string
          matched_field?: string | null
          matched_snippet?: string | null
          organization_id?: string
          publication_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_term_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_term_matches_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_term_matches_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "monitoring_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          captured_at: string
          case_id: string | null
          cnj: string | null
          content: string
          created_at: string
          created_by_user_id: string
          external_id: string | null
          hash: string
          id: string
          organization_id: string
          orgao: string | null
          publication_date: string | null
          snippet: string | null
          source: string
          status: string
          task_id: string | null
          tribunal: string | null
          url_original: string | null
        }
        Insert: {
          captured_at?: string
          case_id?: string | null
          cnj?: string | null
          content: string
          created_at?: string
          created_by_user_id: string
          external_id?: string | null
          hash: string
          id?: string
          organization_id: string
          orgao?: string | null
          publication_date?: string | null
          snippet?: string | null
          source: string
          status?: string
          task_id?: string | null
          tribunal?: string | null
          url_original?: string | null
        }
        Update: {
          captured_at?: string
          case_id?: string | null
          cnj?: string | null
          content?: string
          created_at?: string
          created_by_user_id?: string
          external_id?: string | null
          hash?: string
          id?: string
          organization_id?: string
          orgao?: string | null
          publication_date?: string | null
          snippet?: string | null
          source?: string
          status?: string
          task_id?: string | null
          tribunal?: string | null
          url_original?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_retrieval_events: {
        Row: {
          candidates: number
          case_id: string | null
          chunking_versions: string[] | null
          created_at: string
          documents_touched: number
          embedding_model: string | null
          id: string
          keywords_used: number
          latency_ms: number | null
          model_tier: string | null
          neighbors: number
          organization_id: string
          queries_used: number
          question_chars: number
          reranker_reason: string | null
          reranker_used: boolean
          retrieval_version: string | null
          retrieved: number
          sufficiency: string | null
          thread_id: string | null
          top_similarity: number | null
          user_id: string
        }
        Insert: {
          candidates?: number
          case_id?: string | null
          chunking_versions?: string[] | null
          created_at?: string
          documents_touched?: number
          embedding_model?: string | null
          id?: string
          keywords_used?: number
          latency_ms?: number | null
          model_tier?: string | null
          neighbors?: number
          organization_id: string
          queries_used?: number
          question_chars?: number
          reranker_reason?: string | null
          reranker_used?: boolean
          retrieval_version?: string | null
          retrieved?: number
          sufficiency?: string | null
          thread_id?: string | null
          top_similarity?: number | null
          user_id: string
        }
        Update: {
          candidates?: number
          case_id?: string | null
          chunking_versions?: string[] | null
          created_at?: string
          documents_touched?: number
          embedding_model?: string | null
          id?: string
          keywords_used?: number
          latency_ms?: number | null
          model_tier?: string | null
          neighbors?: number
          organization_id?: string
          queries_used?: number
          question_chars?: number
          reranker_reason?: string | null
          reranker_used?: boolean
          retrieval_version?: string | null
          retrieved?: number
          sufficiency?: string | null
          thread_id?: string | null
          top_similarity?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_retrieval_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event: string
          from_plan_id: string | null
          from_status: string | null
          id: string
          metadata: Json
          organization_id: string
          reason: string | null
          subscription_id: string | null
          to_plan_id: string | null
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event: string
          from_plan_id?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          reason?: string | null
          subscription_id?: string | null
          to_plan_id?: string | null
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event?: string
          from_plan_id?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          reason?: string | null
          subscription_id?: string | null
          to_plan_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_access_grants: {
        Row: {
          created_at: string
          expires_at: string
          granted_by_user_id: string
          id: string
          organization_id: string
          reason: string | null
          revoked_at: string | null
          starts_at: string
          support_user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          granted_by_user_id: string
          id?: string
          organization_id: string
          reason?: string | null
          revoked_at?: string | null
          starts_at?: string
          support_user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_by_user_id?: string
          id?: string
          organization_id?: string
          reason?: string | null
          revoked_at?: string | null
          starts_at?: string
          support_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_access_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          created_by_user_id: string
          description: string | null
          due_date: string | null
          id: string
          opportunity_id: string | null
          organization_id: string
          position: number
          priority: string
          source_message_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id: string
          position?: number
          priority?: string
          source_message_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id?: string
          position?: number
          priority?: string
          source_message_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      case_organization: { Args: { _case_id: string }; Returns: string }
      crm_can_view_all: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      crm_can_write: {
        Args: {
          _organization_id: string
          _owner_user_id: string
          _user_id: string
        }
        Returns: boolean
      }
      crm_digits: { Args: { _value: string }; Returns: string }
      crm_normalize_email: { Args: { _value: string }; Returns: string }
      fetch_chunk_neighbors: {
        Args: {
          chunk_indexes: number[]
          doc_ids: string[]
          filter_case_id: string
          filter_organization_id: string
        }
        Returns: {
          case_id: string
          chunk_index: number
          chunking_version: string
          content: string
          document_id: string
          id: string
          page_end: number
          page_start: number
          row_end: number
          row_start: number
          section_title: string
          sheet_name: string
          source_kind: string
        }[]
      }
      has_capability: {
        Args: {
          _capability: Database["public"]["Enums"]["app_capability"]
          _user_id: string
        }
        Returns: boolean
      }
      has_org_permission: {
        Args: {
          _organization_id: string
          _permission: Database["public"]["Enums"]["org_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_platform_role: {
        Args: {
          _role: Database["public"]["Enums"]["platform_role"]
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
      hybrid_search_chunks_v2: {
        Args: {
          filter_case_id?: string
          filter_doc_ids?: string[]
          filter_organization_id: string
          keyword_text?: string
          match_count?: number
          query_embedding: string
          query_text: string
          rrf_k?: number
        }
        Returns: {
          case_id: string
          chunk_index: number
          chunking_version: string
          content: string
          document_id: string
          fts_rank: number
          id: string
          page_end: number
          page_start: number
          row_end: number
          row_start: number
          score: number
          section_title: string
          sheet_name: string
          source_kind: string
          vector_similarity: number
        }[]
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_staff: { Args: { _user_id: string }; Returns: boolean }
      is_platform_user: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      org_active_owner_count: {
        Args: { _organization_id: string }
        Returns: number
      }
      org_can_use_ai: { Args: { _organization_id: string }; Returns: boolean }
      org_effective_entitlements: {
        Args: { _organization_id: string }
        Returns: Json
      }
      org_effective_permissions: {
        Args: { _organization_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["org_permission"][]
      }
      org_is_active: { Args: { _organization_id: string }; Returns: boolean }
      org_member_role: {
        Args: { _organization_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      org_operational_state: {
        Args: { _organization_id: string }
        Returns: string
      }
      org_role_default_permissions: {
        Args: { _role: Database["public"]["Enums"]["org_role"] }
        Returns: Database["public"]["Enums"]["org_permission"][]
      }
      org_subscription_mrr_cents: {
        Args: { _amount_cents: number; _interval: string }
        Returns: number
      }
      org_trial_end: { Args: { _organization_id: string }; Returns: string }
      support_can_read: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      support_has_active_grant: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
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
      case_access_level: "viewer" | "editor" | "manager"
      invoice_status: "draft" | "open" | "paid" | "void" | "overdue"
      membership_status: "active" | "revoked"
      org_invitation_status: "pending" | "accepted" | "revoked" | "expired"
      org_permission:
        | "members.view"
        | "members.invite"
        | "members.manage"
        | "permissions.manage"
        | "billing.view"
        | "billing.manage"
        | "subscription.manage"
        | "services.view"
        | "services.request"
        | "services.contract"
        | "integrations.view"
        | "integrations.manage"
        | "usage.view_self"
        | "usage.view_organization"
        | "usage.manage_budget"
        | "cases.create"
        | "cases.view_all"
        | "cases.manage_all"
        | "cases.delete"
        | "documents.upload"
        | "documents.delete"
        | "ai.use"
        | "proposals.use"
        | "marketing.use"
        | "publications.use"
        | "crm.view"
        | "crm.manage_own"
        | "crm.view_all"
        | "crm.manage_all"
        | "crm.view_values"
        | "crm.proposals_create"
        | "crm.proposals_approve"
        | "crm.proposals_share"
        | "crm.record_outcome"
        | "crm.convert"
        | "crm.admin"
      org_role:
        | "owner"
        | "admin"
        | "manager"
        | "lawyer"
        | "collaborator"
        | "viewer"
        | "billing_manager"
      org_status: "trial" | "active" | "suspended" | "cancelled"
      platform_role:
        | "super_admin"
        | "platform_admin"
        | "platform_operations"
        | "platform_finance"
        | "platform_support"
        | "platform_readonly"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      case_access_level: ["viewer", "editor", "manager"],
      invoice_status: ["draft", "open", "paid", "void", "overdue"],
      membership_status: ["active", "revoked"],
      org_invitation_status: ["pending", "accepted", "revoked", "expired"],
      org_permission: [
        "members.view",
        "members.invite",
        "members.manage",
        "permissions.manage",
        "billing.view",
        "billing.manage",
        "subscription.manage",
        "services.view",
        "services.request",
        "services.contract",
        "integrations.view",
        "integrations.manage",
        "usage.view_self",
        "usage.view_organization",
        "usage.manage_budget",
        "cases.create",
        "cases.view_all",
        "cases.manage_all",
        "cases.delete",
        "documents.upload",
        "documents.delete",
        "ai.use",
        "proposals.use",
        "marketing.use",
        "publications.use",
        "crm.view",
        "crm.manage_own",
        "crm.view_all",
        "crm.manage_all",
        "crm.view_values",
        "crm.proposals_create",
        "crm.proposals_approve",
        "crm.proposals_share",
        "crm.record_outcome",
        "crm.convert",
        "crm.admin",
      ],
      org_role: [
        "owner",
        "admin",
        "manager",
        "lawyer",
        "collaborator",
        "viewer",
        "billing_manager",
      ],
      org_status: ["trial", "active", "suspended", "cancelled"],
      platform_role: [
        "super_admin",
        "platform_admin",
        "platform_operations",
        "platform_finance",
        "platform_support",
        "platform_readonly",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "suspended",
        "cancelled",
      ],
    },
  },
} as const
