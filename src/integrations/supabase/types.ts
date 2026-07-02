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
      ai_chat_messages: {
        Row: {
          citations: Json | null
          content: string
          created_at: string
          id: string
          images: Json | null
          model_tier: string | null
          role: string
          thread_id: string
          tool_steps: Json | null
          user_id: string
        }
        Insert: {
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          images?: Json | null
          model_tier?: string | null
          role: string
          thread_id: string
          tool_steps?: Json | null
          user_id: string
        }
        Update: {
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          images?: Json | null
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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          oab_number: string | null
          onboarding_completed: boolean
          phone: string | null
          practice_type: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          oab_number?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          practice_type?: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          oab_number?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          practice_type?: string
          specialty?: string | null
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
