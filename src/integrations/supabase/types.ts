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
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          owner_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          owner_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          owner_id?: string
        }
        Relationships: []
      }
      agent_capabilities: {
        Row: {
          action: string
          allowed: boolean
          created_at: string
          id: string
          max_per_hour: number
          notes: string | null
          owner_id: string
          requires_confirm: boolean
          server_id: string
          updated_at: string
        }
        Insert: {
          action: string
          allowed?: boolean
          created_at?: string
          id?: string
          max_per_hour?: number
          notes?: string | null
          owner_id: string
          requires_confirm?: boolean
          server_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          allowed?: boolean
          created_at?: string
          id?: string
          max_per_hour?: number
          notes?: string | null
          owner_id?: string
          requires_confirm?: boolean
          server_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_capabilities_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_configs: {
        Row: {
          allowed_commands: string[]
          autostart: boolean
          created_at: string
          extra: Json
          heartbeat_interval_sec: number
          id: string
          resource_limits: Json
          server_id: string
          updated_at: string
        }
        Insert: {
          allowed_commands?: string[]
          autostart?: boolean
          created_at?: string
          extra?: Json
          heartbeat_interval_sec?: number
          id?: string
          resource_limits?: Json
          server_id: string
          updated_at?: string
        }
        Update: {
          allowed_commands?: string[]
          autostart?: boolean
          created_at?: string
          extra?: Json
          heartbeat_interval_sec?: number
          id?: string
          resource_limits?: Json
          server_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_configs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_installers: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          install_command: string
          label: string | null
          os_target: string
          owner_id: string
          server_id: string | null
          status: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          install_command: string
          label?: string | null
          os_target?: string
          owner_id?: string
          server_id?: string | null
          status?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          install_command?: string
          label?: string | null
          os_target?: string
          owner_id?: string
          server_id?: string | null
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_installers_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_instances: {
        Row: {
          agent_id: string | null
          agent_key: string
          agent_version: string | null
          created_at: string
          id: string
          last_error: string | null
          last_heartbeat_at: string | null
          last_poll_at: string | null
          link_quality: number | null
          machine_id: string | null
          meta: Json
          net_rx_bytes: number | null
          net_tx_bytes: number | null
          os: string | null
          owner_id: string
          poll_latency_ms: number | null
          role: string
          running_commands: number
          server_id: string
          status: string
          updated_at: string
          uptime_seconds: number | null
          verified_at: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_key?: string
          agent_version?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_heartbeat_at?: string | null
          last_poll_at?: string | null
          link_quality?: number | null
          machine_id?: string | null
          meta?: Json
          net_rx_bytes?: number | null
          net_tx_bytes?: number | null
          os?: string | null
          owner_id: string
          poll_latency_ms?: number | null
          role?: string
          running_commands?: number
          server_id: string
          status?: string
          updated_at?: string
          uptime_seconds?: number | null
          verified_at?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_key?: string
          agent_version?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_heartbeat_at?: string | null
          last_poll_at?: string | null
          link_quality?: number | null
          machine_id?: string | null
          meta?: Json
          net_rx_bytes?: number | null
          net_tx_bytes?: number | null
          os?: string | null
          owner_id?: string
          poll_latency_ms?: number | null
          role?: string
          running_commands?: number
          server_id?: string
          status?: string
          updated_at?: string
          uptime_seconds?: number | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_instances_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_job_steps: {
        Row: {
          action: string
          args: Json
          command_id: string | null
          created_at: string
          exit_code: number | null
          id: string
          job_id: string
          output: string | null
          owner_id: string
          status: string
          step_no: number
          updated_at: string
        }
        Insert: {
          action: string
          args?: Json
          command_id?: string | null
          created_at?: string
          exit_code?: number | null
          id?: string
          job_id: string
          output?: string | null
          owner_id: string
          status?: string
          step_no?: number
          updated_at?: string
        }
        Update: {
          action?: string
          args?: Json
          command_id?: string | null
          created_at?: string
          exit_code?: number | null
          id?: string
          job_id?: string
          output?: string | null
          owner_id?: string
          status?: string
          step_no?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_job_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_jobs: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_step: string | null
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          owner_id: string
          payload: Json
          progress: number
          requested_by: string | null
          result: string | null
          server_id: string
          started_at: string | null
          status: string
          steps_total: number
          title: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_step?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          owner_id: string
          payload?: Json
          progress?: number
          requested_by?: string | null
          result?: string | null
          server_id: string
          started_at?: string | null
          status?: string
          steps_total?: number
          title: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_step?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          owner_id?: string
          payload?: Json
          progress?: number
          requested_by?: string | null
          result?: string | null
          server_id?: string
          started_at?: string | null
          status?: string
          steps_total?: number
          title?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_jobs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_role_bindings: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          owner_id: string
          role_id: string
          server_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          owner_id: string
          role_id: string
          server_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          owner_id?: string
          role_id?: string
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_role_bindings_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "agent_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_role_bindings_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_roles: {
        Row: {
          actions: string[]
          created_at: string
          description: string | null
          id: string
          is_builtin: boolean
          key: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          actions?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          key: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          actions?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          key?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          model_id: string | null
          owner_id: string
          title: string
          updated_at: string
          website_ids: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          model_id?: string | null
          owner_id: string
          title?: string
          updated_at?: string
          website_ids?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string | null
          owner_id?: string
          title?: string
          updated_at?: string
          website_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model_label: string | null
          owner_id: string
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          model_label?: string | null
          owner_id: string
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model_label?: string | null
          owner_id?: string
          role?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_tests: {
        Row: {
          answer: string | null
          completion_tokens: number | null
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          model_id: string | null
          model_label: string
          owner_id: string
          prompt: string
          prompt_tokens: number | null
          provider_label: string | null
          settings: Json
          status: string
          total_tokens: number | null
        }
        Insert: {
          answer?: string | null
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model_id?: string | null
          model_label?: string
          owner_id: string
          prompt?: string
          prompt_tokens?: number | null
          provider_label?: string | null
          settings?: Json
          status?: string
          total_tokens?: number | null
        }
        Update: {
          answer?: string | null
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model_id?: string | null
          model_label?: string
          owner_id?: string
          prompt?: string
          prompt_tokens?: number | null
          provider_label?: string | null
          settings?: Json
          status?: string
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_tests_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          capabilities: string[]
          context_window: number | null
          created_at: string
          endpoint_url: string | null
          id: string
          is_active: boolean
          is_default: boolean
          kind: string
          last_latency_ms: number | null
          metadata: Json
          model_id: string
          name: string
          owner_id: string
          port: number | null
          priority: number
          provider_id: string | null
          server_id: string | null
          server_port_id: string | null
          size_mb: number | null
          status: string
          updated_at: string
        }
        Insert: {
          capabilities?: string[]
          context_window?: number | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: string
          last_latency_ms?: number | null
          metadata?: Json
          model_id: string
          name: string
          owner_id: string
          port?: number | null
          priority?: number
          provider_id?: string | null
          server_id?: string | null
          server_port_id?: string | null
          size_mb?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          capabilities?: string[]
          context_window?: number | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: string
          last_latency_ms?: number | null
          metadata?: Json
          model_id?: string
          name?: string
          owner_id?: string
          port?: number | null
          priority?: number
          provider_id?: string | null
          server_id?: string | null
          server_port_id?: string | null
          size_mb?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_models_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_models_server_port_id_fkey"
            columns: ["server_port_id"]
            isOneToOne: false
            referencedRelation: "server_ports"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          api_key_encrypted: string | null
          base_url: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          last_checked_at: string | null
          last_latency_ms: number | null
          metadata: Json
          name: string
          owner_id: string
          server_id: string | null
          status: string
          updated_at: string
          vendor: string
        }
        Insert: {
          api_key_encrypted?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_checked_at?: string | null
          last_latency_ms?: number | null
          metadata?: Json
          name: string
          owner_id: string
          server_id?: string | null
          status?: string
          updated_at?: string
          vendor?: string
        }
        Update: {
          api_key_encrypted?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_checked_at?: string | null
          last_latency_ms?: number | null
          metadata?: Json
          name?: string
          owner_id?: string
          server_id?: string | null
          status?: string
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_providers_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_routing: {
        Row: {
          created_at: string
          fallback_model_ids: string[]
          id: string
          owner_id: string
          primary_model_id: string | null
          task: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fallback_model_ids?: string[]
          id?: string
          owner_id: string
          primary_model_id?: string | null
          task: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fallback_model_ids?: string[]
          id?: string
          owner_id?: string
          primary_model_id?: string | null
          task?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_routing_primary_model_id_fkey"
            columns: ["primary_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_task_steps: {
        Row: {
          created_at: string
          detail: string | null
          duration_ms: number | null
          id: string
          owner_id: string
          stage: string
          status: string
          step_no: number
          task_id: string
          title: string
          tool_name: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          duration_ms?: number | null
          id?: string
          owner_id: string
          stage?: string
          status?: string
          step_no?: number
          task_id: string
          title: string
          tool_name?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          duration_ms?: number | null
          id?: string
          owner_id?: string
          stage?: string
          status?: string
          step_no?: number
          task_id?: string
          title?: string
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ai_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tasks: {
        Row: {
          allow_edit: boolean
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          file_paths: string[]
          id: string
          instructions: string
          last_step_at: string | null
          model_id: string | null
          owner_id: string
          priority: number
          progress: number
          result: string | null
          server_id: string | null
          stage: string
          started_at: string | null
          status: string
          title: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          allow_edit?: boolean
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          file_paths?: string[]
          id?: string
          instructions?: string
          last_step_at?: string | null
          model_id?: string | null
          owner_id?: string
          priority?: number
          progress?: number
          result?: string | null
          server_id?: string | null
          stage?: string
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          allow_edit?: boolean
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          file_paths?: string[]
          id?: string
          instructions?: string
          last_step_at?: string | null
          model_id?: string | null
          owner_id?: string
          priority?: number
          progress?: number
          result?: string | null
          server_id?: string | null
          stage?: string
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tasks_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tasks_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tasks_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          channel: string
          comparator: string
          created_at: string
          for_seconds: number
          id: string
          is_active: boolean
          last_fired_at: string | null
          metric: string
          name: string
          owner_id: string
          scope: string
          server_id: string | null
          severity: string
          threshold: number
          updated_at: string
        }
        Insert: {
          channel?: string
          comparator?: string
          created_at?: string
          for_seconds?: number
          id?: string
          is_active?: boolean
          last_fired_at?: string | null
          metric: string
          name: string
          owner_id?: string
          scope?: string
          server_id?: string | null
          severity?: string
          threshold: number
          updated_at?: string
        }
        Update: {
          channel?: string
          comparator?: string
          created_at?: string
          for_seconds?: number
          id?: string
          is_active?: boolean
          last_fired_at?: string | null
          metric?: string
          name?: string
          owner_id?: string
          scope?: string
          server_id?: string | null
          severity?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          ip: string | null
          owner_id: string
          resource: string | null
          resource_id: string | null
          server_id: string | null
          severity: string
          user_agent: string | null
          website_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          owner_id?: string
          resource?: string | null
          resource_id?: string | null
          server_id?: string | null
          severity?: string
          user_agent?: string | null
          website_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          owner_id?: string
          resource?: string | null
          resource_id?: string | null
          server_id?: string | null
          severity?: string
          user_agent?: string | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_destinations: {
        Row: {
          base_path: string
          created_at: string
          host: string
          id: string
          is_enabled: boolean
          last_run_at: string | null
          last_run_status: string | null
          last_run_summary: Json
          name: string
          notes: string | null
          owner_id: string
          port: number
          secret_id: string | null
          updated_at: string
          username: string
        }
        Insert: {
          base_path?: string
          created_at?: string
          host: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          last_run_summary?: Json
          name: string
          notes?: string | null
          owner_id: string
          port?: number
          secret_id?: string | null
          updated_at?: string
          username?: string
        }
        Update: {
          base_path?: string
          created_at?: string
          host?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          last_run_summary?: Json
          name?: string
          notes?: string | null
          owner_id?: string
          port?: number
          secret_id?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_destinations_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "vault_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_schedules: {
        Row: {
          backup_type: string
          copies: number
          created_at: string
          dest_path: string | null
          encrypt: boolean
          group_id: string | null
          id: string
          is_active: boolean
          label: string | null
          last_run_at: string | null
          last_verify_at: string | null
          next_run_at: string | null
          notify_on_failure: boolean
          owner_id: string
          retention_count: number
          schedule: string
          server_id: string | null
          target_server_id: string | null
          updated_at: string
          verify_status: string | null
          website_id: string | null
        }
        Insert: {
          backup_type?: string
          copies?: number
          created_at?: string
          dest_path?: string | null
          encrypt?: boolean
          group_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_run_at?: string | null
          last_verify_at?: string | null
          next_run_at?: string | null
          notify_on_failure?: boolean
          owner_id: string
          retention_count?: number
          schedule?: string
          server_id?: string | null
          target_server_id?: string | null
          updated_at?: string
          verify_status?: string | null
          website_id?: string | null
        }
        Update: {
          backup_type?: string
          copies?: number
          created_at?: string
          dest_path?: string | null
          encrypt?: boolean
          group_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_run_at?: string | null
          last_verify_at?: string | null
          next_run_at?: string | null
          notify_on_failure?: boolean
          owner_id?: string
          retention_count?: number
          schedule?: string
          server_id?: string | null
          target_server_id?: string | null
          updated_at?: string
          verify_status?: string | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_schedules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "site_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_schedules_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_schedules_target_server_id_fkey"
            columns: ["target_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_schedules_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category: string | null
          content: string
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      blueprint_deployments: {
        Row: {
          blueprint_id: string
          created_at: string
          id: string
          result: Json | null
          server_id: string | null
          status: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          blueprint_id: string
          created_at?: string
          id?: string
          result?: Json | null
          server_id?: string | null
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          blueprint_id?: string
          created_at?: string
          id?: string
          result?: Json | null
          server_id?: string | null
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_deployments_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "fleet_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_deployments_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_deployments_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_settings: {
        Row: {
          accent_color: string | null
          background_color: string | null
          created_at: string
          favicon_url: string | null
          font_family: string | null
          id: string
          logo_url: string
          name: string
          primary_color: string | null
          radius: string | null
          shadow: string | null
          singleton: boolean
          tagline: string
          theme_id: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          logo_url: string
          name?: string
          primary_color?: string | null
          radius?: string | null
          shadow?: string | null
          singleton?: boolean
          tagline?: string
          theme_id?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          logo_url?: string
          name?: string
          primary_color?: string | null
          radius?: string | null
          shadow?: string | null
          singleton?: boolean
          tagline?: string
          theme_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      core_directive_targets: {
        Row: {
          created_at: string
          delivered_at: string | null
          directive_id: string
          error_message: string | null
          http_status: number | null
          id: string
          response_ms: number | null
          status: string
          website_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          directive_id: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          response_ms?: number | null
          status?: string
          website_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          directive_id?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          response_ms?: number | null
          status?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_directive_targets_directive_id_fkey"
            columns: ["directive_id"]
            isOneToOne: false
            referencedRelation: "core_directives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_directive_targets_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      core_directives: {
        Row: {
          body: string
          broadcast_at: string | null
          created_at: string
          delivered_count: number
          directive_type: string
          failed_count: number
          id: string
          metadata: Json
          owner_id: string
          priority: string
          scope: string
          status: string
          target_service_type: string | null
          target_website_ids: string[]
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          broadcast_at?: string | null
          created_at?: string
          delivered_count?: number
          directive_type?: string
          failed_count?: number
          id?: string
          metadata?: Json
          owner_id: string
          priority?: string
          scope?: string
          status?: string
          target_service_type?: string | null
          target_website_ids?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          broadcast_at?: string | null
          created_at?: string
          delivered_count?: number
          directive_type?: string
          failed_count?: number
          id?: string
          metadata?: Json
          owner_id?: string
          priority?: string
          scope?: string
          status?: string
          target_service_type?: string | null
          target_website_ids?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      core_hub_config: {
        Row: {
          api_key: string | null
          auto_broadcast: boolean
          connection_status: string
          core_url: string
          created_at: string
          id: string
          last_ping_ms: number | null
          last_sync_at: string | null
          metadata: Json
          owner_id: string
          updated_at: string
          webhook_path: string
        }
        Insert: {
          api_key?: string | null
          auto_broadcast?: boolean
          connection_status?: string
          core_url?: string
          created_at?: string
          id?: string
          last_ping_ms?: number | null
          last_sync_at?: string | null
          metadata?: Json
          owner_id: string
          updated_at?: string
          webhook_path?: string
        }
        Update: {
          api_key?: string | null
          auto_broadcast?: boolean
          connection_status?: string
          core_url?: string
          created_at?: string
          id?: string
          last_ping_ms?: number | null
          last_sync_at?: string | null
          metadata?: Json
          owner_id?: string
          updated_at?: string
          webhook_path?: string
        }
        Relationships: []
      }
      dashboard_tasks: {
        Row: {
          agent_job_id: string | null
          assigned_to: string | null
          category: string
          completed_at: string | null
          created_at: string
          description: string
          due_at: string | null
          id: string
          owner_id: string
          priority: number
          server_id: string | null
          status: string
          title: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          agent_job_id?: string | null
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          due_at?: string | null
          id?: string
          owner_id: string
          priority?: number
          server_id?: string | null
          status?: string
          title: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          agent_job_id?: string | null
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          due_at?: string | null
          id?: string
          owner_id?: string
          priority?: number
          server_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_tasks_agent_job_id_fkey"
            columns: ["agent_job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_tasks_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_tasks_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      databases: {
        Row: {
          agent_id: string | null
          agent_last_seen_at: string | null
          capabilities: Json
          connection_url: string | null
          created_at: string
          db_kind: string
          db_name: string | null
          db_type: string
          db_user: string | null
          env_key: string | null
          host: string | null
          id: string
          is_primary: boolean
          last_error: string | null
          last_migration_at: string | null
          last_sync_at: string | null
          linked_database_id: string | null
          migration_status: string
          name: string
          owner_id: string
          pairing_status: string
          password_hash: string | null
          port: number | null
          public_endpoint: string | null
          rows_count: number | null
          server_id: string | null
          size_mb: number | null
          status: string
          sync_mode: string
          tables_count: number | null
          tunnel_id: string | null
          updated_at: string
          website_id: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_last_seen_at?: string | null
          capabilities?: Json
          connection_url?: string | null
          created_at?: string
          db_kind?: string
          db_name?: string | null
          db_type?: string
          db_user?: string | null
          env_key?: string | null
          host?: string | null
          id?: string
          is_primary?: boolean
          last_error?: string | null
          last_migration_at?: string | null
          last_sync_at?: string | null
          linked_database_id?: string | null
          migration_status?: string
          name: string
          owner_id: string
          pairing_status?: string
          password_hash?: string | null
          port?: number | null
          public_endpoint?: string | null
          rows_count?: number | null
          server_id?: string | null
          size_mb?: number | null
          status?: string
          sync_mode?: string
          tables_count?: number | null
          tunnel_id?: string | null
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_last_seen_at?: string | null
          capabilities?: Json
          connection_url?: string | null
          created_at?: string
          db_kind?: string
          db_name?: string | null
          db_type?: string
          db_user?: string | null
          env_key?: string | null
          host?: string | null
          id?: string
          is_primary?: boolean
          last_error?: string | null
          last_migration_at?: string | null
          last_sync_at?: string | null
          linked_database_id?: string | null
          migration_status?: string
          name?: string
          owner_id?: string
          pairing_status?: string
          password_hash?: string | null
          port?: number | null
          public_endpoint?: string | null
          rows_count?: number | null
          server_id?: string | null
          size_mb?: number | null
          status?: string
          sync_mode?: string
          tables_count?: number | null
          tunnel_id?: string | null
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "databases_linked_database_id_fkey"
            columns: ["linked_database_id"]
            isOneToOne: false
            referencedRelation: "databases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "databases_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "databases_tunnel_id_fkey"
            columns: ["tunnel_id"]
            isOneToOne: false
            referencedRelation: "server_tunnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "databases_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      db_connections: {
        Row: {
          agent_instance_id: string | null
          capabilities: Json
          certificate_expires_at: string | null
          certificate_fingerprint: string | null
          connection_kind: string
          created_at: string
          database_id: string
          id: string
          last_error: string | null
          last_latency_ms: number | null
          last_seen_at: string | null
          owner_id: string
          pairing_code_hash: string | null
          pairing_expires_at: string | null
          server_id: string | null
          status: string
          tunnel_id: string | null
          updated_at: string
        }
        Insert: {
          agent_instance_id?: string | null
          capabilities?: Json
          certificate_expires_at?: string | null
          certificate_fingerprint?: string | null
          connection_kind?: string
          created_at?: string
          database_id: string
          id?: string
          last_error?: string | null
          last_latency_ms?: number | null
          last_seen_at?: string | null
          owner_id: string
          pairing_code_hash?: string | null
          pairing_expires_at?: string | null
          server_id?: string | null
          status?: string
          tunnel_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_instance_id?: string | null
          capabilities?: Json
          certificate_expires_at?: string | null
          certificate_fingerprint?: string | null
          connection_kind?: string
          created_at?: string
          database_id?: string
          id?: string
          last_error?: string | null
          last_latency_ms?: number | null
          last_seen_at?: string | null
          owner_id?: string
          pairing_code_hash?: string | null
          pairing_expires_at?: string | null
          server_id?: string | null
          status?: string
          tunnel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "db_connections_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "db_connections_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: true
            referencedRelation: "databases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "db_connections_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "db_connections_tunnel_id_fkey"
            columns: ["tunnel_id"]
            isOneToOne: false
            referencedRelation: "server_tunnels"
            referencedColumns: ["id"]
          },
        ]
      }
      deployment_job_targets: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          owner_id: string
          processed_at: string | null
          status: string
          website_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          owner_id: string
          processed_at?: string | null
          status?: string
          website_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          owner_id?: string
          processed_at?: string | null
          status?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployment_job_targets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "deployment_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      deployment_jobs: {
        Row: {
          action_type: string
          completed_at: string | null
          created_at: string
          error_count: number
          id: string
          owner_id: string
          payload: Json
          scope_id: string | null
          scope_type: string
          started_at: string | null
          status: string
          success_count: number
          target_count: number
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          completed_at?: string | null
          created_at?: string
          error_count?: number
          id?: string
          owner_id: string
          payload?: Json
          scope_id?: string | null
          scope_type: string
          started_at?: string | null
          status?: string
          success_count?: number
          target_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          completed_at?: string | null
          created_at?: string
          error_count?: number
          id?: string
          owner_id?: string
          payload?: Json
          scope_id?: string | null
          scope_type?: string
          started_at?: string | null
          status?: string
          success_count?: number
          target_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      domain_redirects: {
        Row: {
          created_at: string
          id: string
          last_checked_at: string | null
          mode: string
          owner_id: string
          server_id: string | null
          source: string
          source_kind: string
          status: string
          target: string
          target_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          mode: string
          owner_id: string
          server_id?: string | null
          source: string
          source_kind: string
          status?: string
          target: string
          target_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          mode?: string
          owner_id?: string
          server_id?: string | null
          source?: string
          source_kind?: string
          status?: string
          target?: string
          target_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_redirects_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_settings: {
        Row: {
          auto_renew: boolean
          backend_port: number | null
          client_max_body_mb: number
          created_at: string
          domain: string
          extra_directives: string | null
          force_https: boolean
          http2: boolean
          id: string
          last_applied_at: string | null
          last_test_output: string | null
          nginx_template: string | null
          owner_id: string
          proxy_read_timeout: number
          redirect_www: boolean
          security_headers: boolean
          server_id: string | null
          ssl_cert_path: string | null
          ssl_expires_at: string | null
          ssl_issuer: string | null
          ssl_key_path: string | null
          ssl_mode: string
          status: string
          updated_at: string
          upstream_host: string
          website_id: string | null
          websockets: boolean
        }
        Insert: {
          auto_renew?: boolean
          backend_port?: number | null
          client_max_body_mb?: number
          created_at?: string
          domain: string
          extra_directives?: string | null
          force_https?: boolean
          http2?: boolean
          id?: string
          last_applied_at?: string | null
          last_test_output?: string | null
          nginx_template?: string | null
          owner_id?: string
          proxy_read_timeout?: number
          redirect_www?: boolean
          security_headers?: boolean
          server_id?: string | null
          ssl_cert_path?: string | null
          ssl_expires_at?: string | null
          ssl_issuer?: string | null
          ssl_key_path?: string | null
          ssl_mode?: string
          status?: string
          updated_at?: string
          upstream_host?: string
          website_id?: string | null
          websockets?: boolean
        }
        Update: {
          auto_renew?: boolean
          backend_port?: number | null
          client_max_body_mb?: number
          created_at?: string
          domain?: string
          extra_directives?: string | null
          force_https?: boolean
          http2?: boolean
          id?: string
          last_applied_at?: string | null
          last_test_output?: string | null
          nginx_template?: string | null
          owner_id?: string
          proxy_read_timeout?: number
          redirect_www?: boolean
          security_headers?: boolean
          server_id?: string | null
          ssl_cert_path?: string | null
          ssl_expires_at?: string | null
          ssl_issuer?: string | null
          ssl_key_path?: string | null
          ssl_mode?: string
          status?: string
          updated_at?: string
          upstream_host?: string
          website_id?: string | null
          websockets?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "domain_settings_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_settings_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          auto_renew: boolean
          created_at: string
          dns_status: string
          domain: string
          expires_at: string | null
          id: string
          nameservers: string[] | null
          notes: string | null
          owner_id: string
          registrar: string | null
          ssl_expires_at: string | null
          ssl_status: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          dns_status?: string
          domain: string
          expires_at?: string | null
          id?: string
          nameservers?: string[] | null
          notes?: string | null
          owner_id: string
          registrar?: string | null
          ssl_expires_at?: string | null
          ssl_status?: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          dns_status?: string
          domain?: string
          expires_at?: string | null
          id?: string
          nameservers?: string[] | null
          notes?: string | null
          owner_id?: string
          registrar?: string | null
          ssl_expires_at?: string | null
          ssl_status?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: []
      }
      entity_relations: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          owner_id: string
          relation: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          owner_id: string
          relation?: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          owner_id?: string
          relation?: string
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_integrations: {
        Row: {
          created_at: string
          id: string
          last_checked_at: string | null
          last_error: string | null
          method: string
          name: string
          owner_id: string
          service_key: string
          status: string
          token: string | null
          updated_at: string
          url: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          method?: string
          name: string
          owner_id: string
          service_key: string
          status?: string
          token?: string | null
          updated_at?: string
          url: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          method?: string
          name?: string
          owner_id?: string
          service_key?: string
          status?: string
          token?: string | null
          updated_at?: string
          url?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      failover_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          from_server_id: string | null
          id: string
          owner_id: string
          policy_id: string | null
          reason: string | null
          to_server_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          from_server_id?: string | null
          id?: string
          owner_id?: string
          policy_id?: string | null
          reason?: string | null
          to_server_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          from_server_id?: string | null
          id?: string
          owner_id?: string
          policy_id?: string | null
          reason?: string | null
          to_server_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failover_events_from_server_id_fkey"
            columns: ["from_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failover_events_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "failover_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failover_events_to_server_id_fkey"
            columns: ["to_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      failover_policies: {
        Row: {
          auto_failback: boolean
          backup_server_id: string | null
          check_interval_sec: number
          consecutive_failures: number
          created_at: string
          current_state: string
          failure_threshold: number
          health_url: string | null
          id: string
          is_active: boolean
          last_checked_at: string | null
          name: string
          owner_id: string
          primary_server_id: string | null
          updated_at: string
          website_id: string | null
        }
        Insert: {
          auto_failback?: boolean
          backup_server_id?: string | null
          check_interval_sec?: number
          consecutive_failures?: number
          created_at?: string
          current_state?: string
          failure_threshold?: number
          health_url?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          name: string
          owner_id?: string
          primary_server_id?: string | null
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          auto_failback?: boolean
          backup_server_id?: string | null
          check_interval_sec?: number
          consecutive_failures?: number
          created_at?: string
          current_state?: string
          failure_threshold?: number
          health_url?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          name?: string
          owner_id?: string
          primary_server_id?: string | null
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failover_policies_backup_server_id_fkey"
            columns: ["backup_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failover_policies_primary_server_id_fkey"
            columns: ["primary_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failover_policies_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      federated_alerts: {
        Row: {
          body: string | null
          created_at: string
          id: string
          resolved_at: string | null
          severity: string
          source_id: string | null
          source_kind: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          source_id?: string | null
          source_kind?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          source_id?: string | null
          source_kind?: string | null
          title?: string
        }
        Relationships: []
      }
      federated_queries: {
        Row: {
          confirmed: boolean
          created_at: string
          created_by: string | null
          destructive: boolean
          id: string
          results: Json | null
          sql_text: string
          status: string
          target_ids: string[]
          target_kind: string
          updated_at: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          created_by?: string | null
          destructive?: boolean
          id?: string
          results?: Json | null
          sql_text: string
          status?: string
          target_ids?: string[]
          target_kind?: string
          updated_at?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          created_by?: string | null
          destructive?: boolean
          id?: string
          results?: Json | null
          sql_text?: string
          status?: string
          target_ids?: string[]
          target_kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      file_replicas: {
        Row: {
          backup_server_id: string | null
          checksum: string | null
          created_at: string
          file_path: string
          id: string
          owner_id: string
          primary_server_id: string | null
          replica_server_id: string | null
          size_bytes: number
          state: string
          subscription_id: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          backup_server_id?: string | null
          checksum?: string | null
          created_at?: string
          file_path: string
          id?: string
          owner_id: string
          primary_server_id?: string | null
          replica_server_id?: string | null
          size_bytes?: number
          state?: string
          subscription_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          backup_server_id?: string | null
          checksum?: string | null
          created_at?: string
          file_path?: string
          id?: string
          owner_id?: string
          primary_server_id?: string | null
          replica_server_id?: string | null
          size_bytes?: number
          state?: string
          subscription_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_replicas_backup_server_id_fkey"
            columns: ["backup_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_replicas_primary_server_id_fkey"
            columns: ["primary_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_replicas_replica_server_id_fkey"
            columns: ["replica_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_replicas_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "hosting_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      file_transfers: {
        Row: {
          build_cmd: string | null
          command_id: string | null
          created_at: string
          dry_run: boolean
          file_count: number | null
          host: string | null
          id: string
          install_cmd: string | null
          log: string | null
          mode: string
          name: string
          output_dir: string | null
          owner_id: string
          port: number | null
          server_id: string | null
          service_name: string | null
          size_bytes: number | null
          ssh_user: string | null
          start_cmd: string | null
          status: string
          steps: Json
          storage_path: string | null
          target_path: string
          updated_at: string
        }
        Insert: {
          build_cmd?: string | null
          command_id?: string | null
          created_at?: string
          dry_run?: boolean
          file_count?: number | null
          host?: string | null
          id?: string
          install_cmd?: string | null
          log?: string | null
          mode?: string
          name: string
          output_dir?: string | null
          owner_id?: string
          port?: number | null
          server_id?: string | null
          service_name?: string | null
          size_bytes?: number | null
          ssh_user?: string | null
          start_cmd?: string | null
          status?: string
          steps?: Json
          storage_path?: string | null
          target_path?: string
          updated_at?: string
        }
        Update: {
          build_cmd?: string | null
          command_id?: string | null
          created_at?: string
          dry_run?: boolean
          file_count?: number | null
          host?: string | null
          id?: string
          install_cmd?: string | null
          log?: string | null
          mode?: string
          name?: string
          output_dir?: string | null
          owner_id?: string
          port?: number | null
          server_id?: string | null
          service_name?: string | null
          size_bytes?: number | null
          ssh_user?: string | null
          start_cmd?: string | null
          status?: string
          steps?: Json
          storage_path?: string | null
          target_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_transfers_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      firewall_rules: {
        Row: {
          action: string
          applied_at: string | null
          created_at: string
          domain: string | null
          id: string
          last_output: string | null
          owner_id: string
          port: number
          protocol: string
          reason: string | null
          requested_by: string | null
          server_id: string
          source_cidr: string
          status: string
          updated_at: string
        }
        Insert: {
          action?: string
          applied_at?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          last_output?: string | null
          owner_id?: string
          port: number
          protocol?: string
          reason?: string | null
          requested_by?: string | null
          server_id: string
          source_cidr?: string
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          applied_at?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          last_output?: string | null
          owner_id?: string
          port?: number
          protocol?: string
          reason?: string | null
          requested_by?: string | null
          server_id?: string
          source_cidr?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "firewall_rules_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_blueprints: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          schema_sql: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          schema_sql?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          schema_sql?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      git_deployments: {
        Row: {
          command_id: string | null
          commit_message: string | null
          commit_sha: string | null
          created_at: string
          finished_at: string | null
          id: string
          logs: string | null
          owner_id: string
          repository_id: string | null
          server_id: string | null
          started_at: string | null
          status: string
          trigger_source: string
          website_id: string | null
        }
        Insert: {
          command_id?: string | null
          commit_message?: string | null
          commit_sha?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          owner_id?: string
          repository_id?: string | null
          server_id?: string | null
          started_at?: string | null
          status?: string
          trigger_source?: string
          website_id?: string | null
        }
        Update: {
          command_id?: string | null
          commit_message?: string | null
          commit_sha?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          owner_id?: string
          repository_id?: string | null
          server_id?: string | null
          started_at?: string | null
          status?: string
          trigger_source?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "git_deployments_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "git_repositories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "git_deployments_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "git_deployments_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      git_repositories: {
        Row: {
          auto_deploy: boolean
          branch: string
          build_command: string | null
          created_at: string
          deploy_path: string | null
          id: string
          last_commit: string | null
          output_dir: string | null
          owner_id: string
          provider: string
          repo_url: string
          server_id: string | null
          updated_at: string
          webhook_secret: string | null
          website_id: string | null
        }
        Insert: {
          auto_deploy?: boolean
          branch?: string
          build_command?: string | null
          created_at?: string
          deploy_path?: string | null
          id?: string
          last_commit?: string | null
          output_dir?: string | null
          owner_id?: string
          provider?: string
          repo_url: string
          server_id?: string | null
          updated_at?: string
          webhook_secret?: string | null
          website_id?: string | null
        }
        Update: {
          auto_deploy?: boolean
          branch?: string
          build_command?: string | null
          created_at?: string
          deploy_path?: string | null
          id?: string
          last_commit?: string | null
          output_dir?: string | null
          owner_id?: string
          provider?: string
          repo_url?: string
          server_id?: string | null
          updated_at?: string
          webhook_secret?: string | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "git_repositories_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "git_repositories_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      hn_certificates: {
        Row: {
          created_at: string
          domain: string
          expires_at: string
          fingerprint: string
          id: string
          issued_at: string
          owner_id: string
          payload: Json
          revoked_at: string | null
          revoked_reason: string | null
          serial: string
          signature: string
          status: string
          updated_at: string
          verification_method: string
          website_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          expires_at?: string
          fingerprint: string
          id?: string
          issued_at?: string
          owner_id: string
          payload?: Json
          revoked_at?: string | null
          revoked_reason?: string | null
          serial: string
          signature: string
          status?: string
          updated_at?: string
          verification_method?: string
          website_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          expires_at?: string
          fingerprint?: string
          id?: string
          issued_at?: string
          owner_id?: string
          payload?: Json
          revoked_at?: string | null
          revoked_reason?: string | null
          serial?: string
          signature?: string
          status?: string
          updated_at?: string
          verification_method?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hn_certificates_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      hn_domains: {
        Row: {
          created_at: string
          fqdn: string
          id: string
          is_public: boolean
          last_error: string | null
          last_published_at: string | null
          name: string
          owner_id: string
          public_fqdn: string | null
          records: Json
          server_id: string | null
          status: string
          subscription_id: string | null
          target_ip: string | null
          target_port: number | null
          updated_at: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          fqdn: string
          id?: string
          is_public?: boolean
          last_error?: string | null
          last_published_at?: string | null
          name: string
          owner_id: string
          public_fqdn?: string | null
          records?: Json
          server_id?: string | null
          status?: string
          subscription_id?: string | null
          target_ip?: string | null
          target_port?: number | null
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          fqdn?: string
          id?: string
          is_public?: boolean
          last_error?: string | null
          last_published_at?: string | null
          name?: string
          owner_id?: string
          public_fqdn?: string | null
          records?: Json
          server_id?: string | null
          status?: string
          subscription_id?: string | null
          target_ip?: string | null
          target_port?: number | null
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hn_domains_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hn_domains_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "hosting_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hn_domains_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      hn_group_identities: {
        Row: {
          code: string
          created_at: string
          first_seen_at: string
          hub_source: string | null
          id: string
          last_signal_at: string | null
          metadata: Json
          origin: string | null
          service_name: string | null
          service_number: number | null
          signal_count: number
          site_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          first_seen_at?: string
          hub_source?: string | null
          id?: string
          last_signal_at?: string | null
          metadata?: Json
          origin?: string | null
          service_name?: string | null
          service_number?: number | null
          signal_count?: number
          site_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          first_seen_at?: string
          hub_source?: string | null
          id?: string
          last_signal_at?: string | null
          metadata?: Json
          origin?: string | null
          service_name?: string | null
          service_number?: number | null
          signal_count?: number
          site_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hn_group_identity_signals: {
        Row: {
          code: string
          created_at: string
          id: string
          identity_id: string | null
          ip_hash: string | null
          origin: string | null
          payload: Json
          signature_valid: boolean
          user_agent: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          identity_id?: string | null
          ip_hash?: string | null
          origin?: string | null
          payload?: Json
          signature_valid?: boolean
          user_agent?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          identity_id?: string | null
          ip_hash?: string | null
          origin?: string | null
          payload?: Json
          signature_valid?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hn_group_identity_signals_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "hn_group_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      hosting_plans: {
        Row: {
          backup_policy: string
          code: string
          created_at: string
          db_isolation: string
          db_quota_mb: number
          external_domains_limit: number
          features: Json
          hn_domains_limit: number
          id: string
          is_visible: boolean
          name: string
          name_ar: string
          price_monthly: number
          price_yearly: number
          sites_limit: number
          sort_order: number
          storage_gb: number
          transfer_gb: number
          updated_at: string
        }
        Insert: {
          backup_policy?: string
          code: string
          created_at?: string
          db_isolation?: string
          db_quota_mb?: number
          external_domains_limit?: number
          features?: Json
          hn_domains_limit?: number
          id?: string
          is_visible?: boolean
          name: string
          name_ar: string
          price_monthly?: number
          price_yearly?: number
          sites_limit?: number
          sort_order?: number
          storage_gb?: number
          transfer_gb?: number
          updated_at?: string
        }
        Update: {
          backup_policy?: string
          code?: string
          created_at?: string
          db_isolation?: string
          db_quota_mb?: number
          external_domains_limit?: number
          features?: Json
          hn_domains_limit?: number
          id?: string
          is_visible?: boolean
          name?: string
          name_ar?: string
          price_monthly?: number
          price_yearly?: number
          sites_limit?: number
          sort_order?: number
          storage_gb?: number
          transfer_gb?: number
          updated_at?: string
        }
        Relationships: []
      }
      hosting_subscriptions: {
        Row: {
          addons: Json
          billing_cycle: string
          created_at: string
          current_period_end: string | null
          id: string
          notes: string | null
          owner_id: string
          plan_id: string
          status: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          addons?: Json
          billing_cycle?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          plan_id: string
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          addons?: Json
          billing_cycle?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          plan_id?: string
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hosting_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hosting_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_subscriptions_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      hosting_tenants: {
        Row: {
          bucket_name: string | null
          created_at: string
          db_role: string | null
          id: string
          isolation: string
          owner_id: string
          schema_name: string | null
          status: string
          subscription_id: string
          tenant_key: string
          updated_at: string
        }
        Insert: {
          bucket_name?: string | null
          created_at?: string
          db_role?: string | null
          id?: string
          isolation?: string
          owner_id: string
          schema_name?: string | null
          status?: string
          subscription_id: string
          tenant_key: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string | null
          created_at?: string
          db_role?: string | null
          id?: string
          isolation?: string
          owner_id?: string
          schema_name?: string | null
          status?: string
          subscription_id?: string
          tenant_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hosting_tenants_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "hosting_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_exports: {
        Row: {
          created_at: string
          error_message: string | null
          hub_key: string
          hub_url: string
          id: string
          owner_id: string
          response: Json | null
          sites_count: number
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          hub_key: string
          hub_url: string
          id?: string
          owner_id: string
          response?: Json | null
          sites_count?: number
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          hub_key?: string
          hub_url?: string
          id?: string
          owner_id?: string
          response?: Json | null
          sites_count?: number
          status?: string
        }
        Relationships: []
      }
      lovable_sites: {
        Row: {
          created_at: string
          domain: string | null
          external_project_id: string | null
          external_site_id: string | null
          id: string
          imported_website_id: string | null
          is_remix: boolean | null
          name: string | null
          owner_email: string | null
          primary_domain: string | null
          raw_data: Json | null
          remix_of: string | null
          sync_status: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          external_project_id?: string | null
          external_site_id?: string | null
          id?: string
          imported_website_id?: string | null
          is_remix?: boolean | null
          name?: string | null
          owner_email?: string | null
          primary_domain?: string | null
          raw_data?: Json | null
          remix_of?: string | null
          sync_status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          external_project_id?: string | null
          external_site_id?: string | null
          id?: string
          imported_website_id?: string | null
          is_remix?: boolean | null
          name?: string | null
          owner_email?: string | null
          primary_domain?: string | null
          raw_data?: Json | null
          remix_of?: string | null
          sync_status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lovable_sites_imported_website_id_fkey"
            columns: ["imported_website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lovable_sites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "lovable_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lovable_workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lovable_workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "lovable_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lovable_workspaces: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          last_sync_at: string | null
          name: string
          owner_email: string | null
          owner_id: string | null
          source: string | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          owner_email?: string | null
          owner_id?: string | null
          source?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          owner_email?: string | null
          owner_id?: string | null
          source?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      manara_addresses: {
        Row: {
          created_at: string
          fingerprint: string | null
          host: string | null
          id: string
          is_current: boolean
          is_verified: boolean
          kind: string
          port: number | null
          project_id: string
          retired_at: string | null
          server_id: string | null
          updated_at: string
          url: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          fingerprint?: string | null
          host?: string | null
          id?: string
          is_current?: boolean
          is_verified?: boolean
          kind?: string
          port?: number | null
          project_id: string
          retired_at?: string | null
          server_id?: string | null
          updated_at?: string
          url: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          fingerprint?: string | null
          host?: string | null
          id?: string
          is_current?: boolean
          is_verified?: boolean
          kind?: string
          port?: number | null
          project_id?: string
          retired_at?: string | null
          server_id?: string | null
          updated_at?: string
          url?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manara_addresses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manara_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manara_addresses_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      manara_endpoints: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          last_seen_at: string | null
          project_id: string
          status: string
          updated_at: string
          url: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          last_seen_at?: string | null
          project_id: string
          status?: string
          updated_at?: string
          url?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          last_seen_at?: string | null
          project_id?: string
          status?: string
          updated_at?: string
          url?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manara_endpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manara_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      manara_events: {
        Row: {
          address_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          metadata: Json | null
          project_id: string | null
        }
        Insert: {
          address_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
          metadata?: Json | null
          project_id?: string | null
        }
        Update: {
          address_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          metadata?: Json | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manara_events_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "manara_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manara_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manara_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      manara_projects: {
        Row: {
          created_at: string
          current_address_id: string | null
          group_tag: string | null
          id: string
          name: string
          owner_id: string | null
          project_key: string
          status: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          current_address_id?: string | null
          group_tag?: string | null
          id?: string
          name: string
          owner_id?: string | null
          project_key: string
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          current_address_id?: string | null
          group_tag?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          project_key?: string
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_address"
            columns: ["current_address_id"]
            isOneToOne: false
            referencedRelation: "manara_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manara_projects_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      manara_updates: {
        Row: {
          created_at: string
          error: string | null
          from_address_id: string | null
          id: string
          project_id: string
          published_at: string | null
          reason: string | null
          status: string
          to_address_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          from_address_id?: string | null
          id?: string
          project_id: string
          published_at?: string | null
          reason?: string | null
          status?: string
          to_address_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          from_address_id?: string | null
          id?: string
          project_id?: string
          published_at?: string | null
          reason?: string | null
          status?: string
          to_address_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manara_updates_from_address_id_fkey"
            columns: ["from_address_id"]
            isOneToOne: false
            referencedRelation: "manara_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manara_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manara_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manara_updates_to_address_id_fkey"
            columns: ["to_address_id"]
            isOneToOne: false
            referencedRelation: "manara_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_hourly: {
        Row: {
          bucket_start: string
          cpu_avg: number | null
          cpu_max: number | null
          created_at: string
          disk_avg: number | null
          disk_max: number | null
          id: string
          memory_avg: number | null
          memory_max: number | null
          samples: number
          server_id: string
        }
        Insert: {
          bucket_start: string
          cpu_avg?: number | null
          cpu_max?: number | null
          created_at?: string
          disk_avg?: number | null
          disk_max?: number | null
          id?: string
          memory_avg?: number | null
          memory_max?: number | null
          samples?: number
          server_id: string
        }
        Update: {
          bucket_start?: string
          cpu_avg?: number | null
          cpu_max?: number | null
          created_at?: string
          disk_avg?: number | null
          disk_max?: number | null
          id?: string
          memory_avg?: number | null
          memory_max?: number | null
          samples?: number
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_hourly_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      nginx_configs: {
        Row: {
          content: string
          created_at: string
          file_path: string
          id: string
          server_id: string
          status: string
          updated_at: string
          version: number
          website_id: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          file_path: string
          id?: string
          server_id: string
          status?: string
          updated_at?: string
          version?: number
          website_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          file_path?: string
          id?: string
          server_id?: string
          status?: string
          updated_at?: string
          version?: number
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nginx_configs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nginx_configs_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_channels: {
        Row: {
          channel_type: string
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          owner_id: string
          target: string
          updated_at: string
        }
        Insert: {
          channel_type: string
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          owner_id: string
          target: string
          updated_at?: string
        }
        Update: {
          channel_type?: string
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          owner_id?: string
          target?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel_type: string
          created_at: string
          error_message: string | null
          id: string
          notification_id: string | null
          owner_id: string
          provider_response: Json | null
          status: string
          target: string
        }
        Insert: {
          channel_type: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          owner_id: string
          provider_response?: Json | null
          status?: string
          target: string
        }
        Update: {
          channel_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          owner_id?: string
          provider_response?: Json | null
          status?: string
          target?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email: boolean
          event_type: string
          id: string
          in_app: boolean
          min_severity: string
          owner_id: string
          telegram: boolean
          updated_at: string
          webhook: boolean
        }
        Insert: {
          created_at?: string
          email?: boolean
          event_type: string
          id?: string
          in_app?: boolean
          min_severity?: string
          owner_id: string
          telegram?: boolean
          updated_at?: string
          webhook?: boolean
        }
        Update: {
          created_at?: string
          email?: boolean
          event_type?: string
          id?: string
          in_app?: boolean
          min_severity?: string
          owner_id?: string
          telegram?: boolean
          updated_at?: string
          webhook?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json
          owner_id: string
          severity: string
          title: string
          type: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json
          owner_id: string
          severity?: string
          title: string
          type: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json
          owner_id?: string
          severity?: string
          title?: string
          type?: string
          website_id?: string | null
        }
        Relationships: []
      }
      operation_log: {
        Row: {
          actor: string
          created_at: string
          id: string
          input: Json
          notes: string | null
          operation: string
          owner_id: string
          result: Json
          scope: string
          server_id: string | null
          status: string
          title: string
          website_id: string | null
        }
        Insert: {
          actor?: string
          created_at?: string
          id?: string
          input?: Json
          notes?: string | null
          operation: string
          owner_id: string
          result?: Json
          scope?: string
          server_id?: string | null
          status?: string
          title: string
          website_id?: string | null
        }
        Update: {
          actor?: string
          created_at?: string
          id?: string
          input?: Json
          notes?: string | null
          operation?: string
          owner_id?: string
          result?: Json
          scope?: string
          server_id?: string | null
          status?: string
          title?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operation_log_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_log_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_accounts: {
        Row: {
          account_number: string | null
          bank_name: string | null
          created_at: string
          currency: string
          gateway_url: string | null
          holder: string | null
          iban: string | null
          id: string
          is_active: boolean
          is_default: boolean
          kind: string
          label: string
          notes: string | null
          owner_id: string
          rib: string | null
          swift: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          gateway_url?: string | null
          holder?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: string
          label: string
          notes?: string | null
          owner_id: string
          rib?: string | null
          swift?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          gateway_url?: string | null
          holder?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: string
          label?: string
          notes?: string | null
          owner_id?: string
          rib?: string | null
          swift?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          event_type: string
          external_id: string | null
          fanout_delivered: number
          fanout_failed: number
          fanout_total: number
          id: string
          owner_id: string
          payload: Json
          provider: string
          received_at: string
          status: string
          subscription_id: string | null
          website_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type: string
          external_id?: string | null
          fanout_delivered?: number
          fanout_failed?: number
          fanout_total?: number
          id?: string
          owner_id: string
          payload?: Json
          provider?: string
          received_at?: string
          status?: string
          subscription_id?: string | null
          website_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type?: string
          external_id?: string | null
          fanout_delivered?: number
          fanout_failed?: number
          fanout_total?: number
          id?: string
          owner_id?: string
          payload?: Json
          provider?: string
          received_at?: string
          status?: string
          subscription_id?: string | null
          website_id?: string | null
        }
        Relationships: []
      }
      payment_orders: {
        Row: {
          account_id: string | null
          amount: number
          billing_cycle: string
          buyer_email: string | null
          buyer_name: string | null
          created_at: string
          currency: string
          id: string
          method: string
          note: string | null
          plan_id: string | null
          plan_name: string
          reference: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          billing_cycle?: string
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string
          note?: string | null
          plan_id?: string | null
          plan_name: string
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          billing_cycle?: string
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string
          note?: string | null
          plan_id?: string | null
          plan_name?: string
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hosting_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_page_links: {
        Row: {
          created_at: string
          id: string
          link_type: string
          note: string | null
          page_id: string
          target_name: string | null
          target_page_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_type?: string
          note?: string | null
          page_id: string
          target_name?: string | null
          target_page_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: string
          note?: string | null
          page_id?: string
          target_name?: string | null
          target_page_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_page_links_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "platform_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_page_links_target_page_id_fkey"
            columns: ["target_page_id"]
            isOneToOne: false
            referencedRelation: "platform_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_pages: {
        Row: {
          code: string | null
          created_at: string
          description_ar: string | null
          enabled: boolean
          icon: string | null
          id: string
          is_public: boolean
          min_role: Database["public"]["Enums"]["app_role"]
          name_ar: string
          name_en: string | null
          name_fr: string | null
          page_key: string
          route_path: string
          section: string
          show_in_sidebar: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description_ar?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          is_public?: boolean
          min_role?: Database["public"]["Enums"]["app_role"]
          name_ar: string
          name_en?: string | null
          name_fr?: string | null
          page_key: string
          route_path: string
          section?: string
          show_in_sidebar?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description_ar?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          is_public?: boolean
          min_role?: Database["public"]["Enums"]["app_role"]
          name_ar?: string
          name_en?: string | null
          name_fr?: string | null
          page_key?: string
          route_path?: string
          section?: string
          show_in_sidebar?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          address: string | null
          created_at: string
          default_language: string
          dns_records: Json
          id: string
          maintenance_mode: boolean
          notes: string | null
          official_domain: string | null
          phone: string | null
          singleton: boolean
          social_links: Json
          support_email: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          default_language?: string
          dns_records?: Json
          id?: string
          maintenance_mode?: boolean
          notes?: string | null
          official_domain?: string | null
          phone?: string | null
          singleton?: boolean
          social_links?: Json
          support_email?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          default_language?: string
          dns_records?: Json
          id?: string
          maintenance_mode?: boolean
          notes?: string | null
          official_domain?: string | null
          phone?: string | null
          singleton?: boolean
          social_links?: Json
          support_email?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      port_links: {
        Row: {
          auto_start: boolean
          bridge_kind: string
          created_at: string
          domain: string | null
          id: string
          last_checked_at: string | null
          last_result: string | null
          latency_ms: number | null
          link_kind: string
          name: string | null
          owner_id: string
          source_port: number
          source_server_id: string
          status: string
          target_host: string | null
          target_port: number
          target_server_id: string | null
          target_url: string | null
          updated_at: string
          vault_secret_id: string | null
          website_id: string | null
        }
        Insert: {
          auto_start?: boolean
          bridge_kind?: string
          created_at?: string
          domain?: string | null
          id?: string
          last_checked_at?: string | null
          last_result?: string | null
          latency_ms?: number | null
          link_kind?: string
          name?: string | null
          owner_id?: string
          source_port: number
          source_server_id: string
          status?: string
          target_host?: string | null
          target_port: number
          target_server_id?: string | null
          target_url?: string | null
          updated_at?: string
          vault_secret_id?: string | null
          website_id?: string | null
        }
        Update: {
          auto_start?: boolean
          bridge_kind?: string
          created_at?: string
          domain?: string | null
          id?: string
          last_checked_at?: string | null
          last_result?: string | null
          latency_ms?: number | null
          link_kind?: string
          name?: string | null
          owner_id?: string
          source_port?: number
          source_server_id?: string
          status?: string
          target_host?: string | null
          target_port?: number
          target_server_id?: string | null
          target_url?: string | null
          updated_at?: string
          vault_secret_id?: string | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "port_links_source_server_id_fkey"
            columns: ["source_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_links_target_server_id_fkey"
            columns: ["target_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      publish_runs: {
        Row: {
          command_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          output: string | null
          owner_id: string
          started_at: string
          status: string
          target_id: string
          trigger: string
        }
        Insert: {
          command_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          output?: string | null
          owner_id: string
          started_at?: string
          status?: string
          target_id: string
          trigger?: string
        }
        Update: {
          command_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          output?: string | null
          owner_id?: string
          started_at?: string
          status?: string
          target_id?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_runs_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "publish_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_targets: {
        Row: {
          created_at: string
          health_url: string | null
          id: string
          is_active: boolean
          is_canonical: boolean
          kind: string
          label: string
          last_publish_at: string | null
          last_status: string | null
          last_version: string | null
          owner_id: string
          port: number | null
          server_id: string | null
          service_name: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          health_url?: string | null
          id?: string
          is_active?: boolean
          is_canonical?: boolean
          kind?: string
          label: string
          last_publish_at?: string | null
          last_status?: string | null
          last_version?: string | null
          owner_id: string
          port?: number | null
          server_id?: string | null
          service_name?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          health_url?: string | null
          id?: string
          is_active?: boolean
          is_canonical?: boolean
          kind?: string
          label?: string
          last_publish_at?: string | null
          last_status?: string | null
          last_version?: string | null
          owner_id?: string
          port?: number | null
          server_id?: string | null
          service_name?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_targets_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      query_history: {
        Row: {
          confirmed_write: boolean
          created_at: string
          database_id: string | null
          error: string | null
          failed_count: number
          finished_at: string | null
          group_id: string | null
          id: string
          mode: string
          owner_id: string
          results: Json | null
          sql_text: string
          status: string
          success_count: number
          target_ids: Json
          target_kind: string
          targets_count: number
          title: string | null
          took_ms: number | null
        }
        Insert: {
          confirmed_write?: boolean
          created_at?: string
          database_id?: string | null
          error?: string | null
          failed_count?: number
          finished_at?: string | null
          group_id?: string | null
          id?: string
          mode?: string
          owner_id?: string
          results?: Json | null
          sql_text: string
          status?: string
          success_count?: number
          target_ids?: Json
          target_kind?: string
          targets_count?: number
          title?: string | null
          took_ms?: number | null
        }
        Update: {
          confirmed_write?: boolean
          created_at?: string
          database_id?: string | null
          error?: string | null
          failed_count?: number
          finished_at?: string | null
          group_id?: string | null
          id?: string
          mode?: string
          owner_id?: string
          results?: Json | null
          sql_text?: string
          status?: string
          success_count?: number
          target_ids?: Json
          target_kind?: string
          targets_count?: number
          title?: string | null
          took_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "query_history_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "site_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_points: {
        Row: {
          created_at: string
          id: string
          label: string | null
          notes: string | null
          owner_id: string
          point_type: string
          size_mb: number | null
          status: string
          storage_path: string | null
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          owner_id: string
          point_type?: string
          size_mb?: number | null
          status?: string
          storage_path?: string | null
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          owner_id?: string
          point_type?: string
          size_mb?: number | null
          status?: string
          storage_path?: string | null
          website_id?: string
        }
        Relationships: []
      }
      scheduled_tasks: {
        Row: {
          created_at: string
          cron_expression: string | null
          id: string
          interval_minutes: number
          is_active: boolean
          last_run_at: string | null
          last_status: string | null
          name: string
          next_run_at: string | null
          owner_id: string
          payload: Json
          schedule_kind: string
          server_id: string | null
          task_type: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          cron_expression?: string | null
          id?: string
          interval_minutes?: number
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          name: string
          next_run_at?: string | null
          owner_id?: string
          payload?: Json
          schedule_kind?: string
          server_id?: string | null
          task_type: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          cron_expression?: string | null
          id?: string
          interval_minutes?: number
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          next_run_at?: string | null
          owner_id?: string
          payload?: Json
          schedule_kind?: string
          server_id?: string | null
          task_type?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_tasks_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_tasks_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          category: string
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          resource: string | null
          resource_id: string | null
          severity: string
          success: boolean
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          category: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource?: string | null
          resource_id?: string | null
          severity?: string
          success?: boolean
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          category?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource?: string | null
          resource_id?: string | null
          severity?: string
          success?: boolean
        }
        Relationships: []
      }
      server_access: {
        Row: {
          created_at: string
          id: string
          level: string
          owner_id: string
          server_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          owner_id: string
          server_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          owner_id?: string
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_access_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_alert_history: {
        Row: {
          alert_type: string
          created_at: string
          details: Json
          id: string
          message: string | null
          notified_at: string | null
          owner_id: string
          resolved_at: string | null
          rule_id: string | null
          server_id: string | null
          severity: string
          website_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          details?: Json
          id?: string
          message?: string | null
          notified_at?: string | null
          owner_id: string
          resolved_at?: string | null
          rule_id?: string | null
          server_id?: string | null
          severity?: string
          website_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          details?: Json
          id?: string
          message?: string | null
          notified_at?: string | null
          owner_id?: string
          resolved_at?: string | null
          rule_id?: string | null
          server_id?: string | null
          severity?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_alert_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "server_alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_alert_history_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_alert_history_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      server_alert_rules: {
        Row: {
          alert_type: string
          channels: string[]
          cooldown_minutes: number
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          owner_id: string
          server_id: string | null
          threshold: number | null
          updated_at: string
        }
        Insert: {
          alert_type: string
          channels?: string[]
          cooldown_minutes?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          owner_id: string
          server_id?: string | null
          threshold?: number | null
          updated_at?: string
        }
        Update: {
          alert_type?: string
          channels?: string[]
          cooldown_minutes?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          owner_id?: string
          server_id?: string | null
          threshold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_alert_rules_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_automation_rules: {
        Row: {
          action: string
          action_payload: Json
          comparator: string
          cooldown_minutes: number
          created_at: string
          enabled: boolean
          id: string
          last_triggered_at: string | null
          metric: string
          name: string
          notify: boolean
          owner_id: string
          server_id: string
          threshold: number
          trigger_count: number
          updated_at: string
        }
        Insert: {
          action: string
          action_payload?: Json
          comparator?: string
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          metric: string
          name: string
          notify?: boolean
          owner_id?: string
          server_id: string
          threshold?: number
          trigger_count?: number
          updated_at?: string
        }
        Update: {
          action?: string
          action_payload?: Json
          comparator?: string
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          metric?: string
          name?: string
          notify?: boolean
          owner_id?: string
          server_id?: string
          threshold?: number
          trigger_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_automation_rules_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_boot_reports: {
        Row: {
          agent_version: string | null
          boot_at: string
          created_at: string
          current_ip: string | null
          failed: Json
          id: string
          notes: string | null
          owner_id: string
          previous_ip: string | null
          restored: Json
          server_id: string
        }
        Insert: {
          agent_version?: string | null
          boot_at?: string
          created_at?: string
          current_ip?: string | null
          failed?: Json
          id?: string
          notes?: string | null
          owner_id?: string
          previous_ip?: string | null
          restored?: Json
          server_id: string
        }
        Update: {
          agent_version?: string | null
          boot_at?: string
          created_at?: string
          current_ip?: string | null
          failed?: Json
          id?: string
          notes?: string | null
          owner_id?: string
          previous_ip?: string | null
          restored?: Json
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_boot_reports_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_commands: {
        Row: {
          action: string
          args: Json
          completed_at: string | null
          created_at: string
          dispatched_at: string | null
          dry_run: boolean
          duration_ms: number | null
          error_message: string | null
          exit_code: number | null
          finished_at: string | null
          id: string
          job_id: string | null
          output: string | null
          owner_id: string
          preview: Json
          progress: string | null
          requested_by: string | null
          server_id: string
          started_at: string | null
          status: string
          website_id: string | null
        }
        Insert: {
          action: string
          args?: Json
          completed_at?: string | null
          created_at?: string
          dispatched_at?: string | null
          dry_run?: boolean
          duration_ms?: number | null
          error_message?: string | null
          exit_code?: number | null
          finished_at?: string | null
          id?: string
          job_id?: string | null
          output?: string | null
          owner_id: string
          preview?: Json
          progress?: string | null
          requested_by?: string | null
          server_id: string
          started_at?: string | null
          status?: string
          website_id?: string | null
        }
        Update: {
          action?: string
          args?: Json
          completed_at?: string | null
          created_at?: string
          dispatched_at?: string | null
          dry_run?: boolean
          duration_ms?: number | null
          error_message?: string | null
          exit_code?: number | null
          finished_at?: string | null
          id?: string
          job_id?: string | null
          output?: string | null
          owner_id?: string
          preview?: Json
          progress?: string | null
          requested_by?: string | null
          server_id?: string
          started_at?: string | null
          status?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_commands_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_commands_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_commands_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      server_configs: {
        Row: {
          checksum: string | null
          collected_at: string
          content: string | null
          created_at: string
          id: string
          kind: string
          owner_id: string
          path: string
          server_id: string
        }
        Insert: {
          checksum?: string | null
          collected_at?: string
          content?: string | null
          created_at?: string
          id?: string
          kind: string
          owner_id: string
          path: string
          server_id: string
        }
        Update: {
          checksum?: string | null
          collected_at?: string
          content?: string | null
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          path?: string
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_configs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_containers: {
        Row: {
          cpu_pct: number | null
          id: string
          image: string | null
          last_seen_at: string
          mem_mb: number | null
          name: string
          owner_id: string
          ports: string | null
          restarts: number | null
          server_id: string
          state: string | null
          status: string | null
        }
        Insert: {
          cpu_pct?: number | null
          id?: string
          image?: string | null
          last_seen_at?: string
          mem_mb?: number | null
          name: string
          owner_id: string
          ports?: string | null
          restarts?: number | null
          server_id: string
          state?: string | null
          status?: string | null
        }
        Update: {
          cpu_pct?: number | null
          id?: string
          image?: string | null
          last_seen_at?: string
          mem_mb?: number | null
          name?: string
          owner_id?: string
          ports?: string | null
          restarts?: number | null
          server_id?: string
          state?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_containers_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_disks: {
        Row: {
          device: string | null
          health: string | null
          id: string
          inodes_pct: number | null
          iops: number | null
          last_seen_at: string
          mount: string
          owner_id: string
          read_bps: number | null
          server_id: string
          total_gb: number | null
          used_gb: number | null
          write_bps: number | null
        }
        Insert: {
          device?: string | null
          health?: string | null
          id?: string
          inodes_pct?: number | null
          iops?: number | null
          last_seen_at?: string
          mount: string
          owner_id: string
          read_bps?: number | null
          server_id: string
          total_gb?: number | null
          used_gb?: number | null
          write_bps?: number | null
        }
        Update: {
          device?: string | null
          health?: string | null
          id?: string
          inodes_pct?: number | null
          iops?: number | null
          last_seen_at?: string
          mount?: string
          owner_id?: string
          read_bps?: number | null
          server_id?: string
          total_gb?: number | null
          used_gb?: number | null
          write_bps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "server_disks_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          meta: Json | null
          owner_id: string
          server_id: string
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          meta?: Json | null
          owner_id: string
          server_id: string
          severity?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          meta?: Json | null
          owner_id?: string
          server_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_events_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_health_snapshots: {
        Row: {
          cpu_percent: number | null
          created_at: string
          disk_percent: number | null
          heartbeat_age_seconds: number | null
          id: string
          level: string
          memory_percent: number | null
          owner_id: string
          ports_down: number
          reasons: Json
          score: number
          server_id: string
          services_down: number
        }
        Insert: {
          cpu_percent?: number | null
          created_at?: string
          disk_percent?: number | null
          heartbeat_age_seconds?: number | null
          id?: string
          level?: string
          memory_percent?: number | null
          owner_id?: string
          ports_down?: number
          reasons?: Json
          score?: number
          server_id: string
          services_down?: number
        }
        Update: {
          cpu_percent?: number | null
          created_at?: string
          disk_percent?: number | null
          heartbeat_age_seconds?: number | null
          id?: string
          level?: string
          memory_percent?: number | null
          owner_id?: string
          ports_down?: number
          reasons?: Json
          score?: number
          server_id?: string
          services_down?: number
        }
        Relationships: [
          {
            foreignKeyName: "server_health_snapshots_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_ip_history: {
        Row: {
          created_at: string
          id: string
          new_ip: string
          old_ip: string | null
          owner_id: string
          server_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_ip: string
          old_ip?: string | null
          owner_id: string
          server_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_ip?: string
          old_ip?: string | null
          owner_id?: string
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_ip_history_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_links: {
        Row: {
          channel: string
          created_at: string
          id: string
          last_checked_at: string | null
          latency_ms: number | null
          link_type: string
          notes: string | null
          owner_id: string
          source_server_id: string
          status: string
          target_port: number
          target_server_id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          latency_ms?: number | null
          link_type?: string
          notes?: string | null
          owner_id: string
          source_server_id: string
          status?: string
          target_port?: number
          target_server_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          latency_ms?: number | null
          link_type?: string
          notes?: string | null
          owner_id?: string
          source_server_id?: string
          status?: string
          target_port?: number
          target_server_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_links_source_server_id_fkey"
            columns: ["source_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_links_target_server_id_fkey"
            columns: ["target_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_metrics: {
        Row: {
          collected_at: string
          cpu_cores: number | null
          cpu_mhz: number | null
          cpu_percent: number | null
          cpu_temp_c: number | null
          disk_total_gb: number | null
          disk_used_gb: number | null
          id: string
          latency_ms: number | null
          load_avg: number | null
          load15: number | null
          load5: number | null
          mem_available_mb: number | null
          mem_total_mb: number | null
          mem_used_mb: number | null
          net_rx_bps: number | null
          net_tx_bps: number | null
          owner_id: string
          process_count: number | null
          server_id: string
          swap_total_mb: number | null
          swap_used_mb: number | null
          top_processes: Json | null
          uptime_seconds: number | null
        }
        Insert: {
          collected_at?: string
          cpu_cores?: number | null
          cpu_mhz?: number | null
          cpu_percent?: number | null
          cpu_temp_c?: number | null
          disk_total_gb?: number | null
          disk_used_gb?: number | null
          id?: string
          latency_ms?: number | null
          load_avg?: number | null
          load15?: number | null
          load5?: number | null
          mem_available_mb?: number | null
          mem_total_mb?: number | null
          mem_used_mb?: number | null
          net_rx_bps?: number | null
          net_tx_bps?: number | null
          owner_id: string
          process_count?: number | null
          server_id: string
          swap_total_mb?: number | null
          swap_used_mb?: number | null
          top_processes?: Json | null
          uptime_seconds?: number | null
        }
        Update: {
          collected_at?: string
          cpu_cores?: number | null
          cpu_mhz?: number | null
          cpu_percent?: number | null
          cpu_temp_c?: number | null
          disk_total_gb?: number | null
          disk_used_gb?: number | null
          id?: string
          latency_ms?: number | null
          load_avg?: number | null
          load15?: number | null
          load5?: number | null
          mem_available_mb?: number | null
          mem_total_mb?: number | null
          mem_used_mb?: number | null
          net_rx_bps?: number | null
          net_tx_bps?: number | null
          owner_id?: string
          process_count?: number | null
          server_id?: string
          swap_total_mb?: number | null
          swap_used_mb?: number | null
          top_processes?: Json | null
          uptime_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "server_metrics_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_net_interfaces: {
        Row: {
          id: string
          last_seen_at: string
          name: string
          owner_id: string
          rx_bps: number | null
          rx_dropped: number | null
          rx_errors: number | null
          server_id: string
          tx_bps: number | null
          tx_dropped: number | null
          tx_errors: number | null
        }
        Insert: {
          id?: string
          last_seen_at?: string
          name: string
          owner_id: string
          rx_bps?: number | null
          rx_dropped?: number | null
          rx_errors?: number | null
          server_id: string
          tx_bps?: number | null
          tx_dropped?: number | null
          tx_errors?: number | null
        }
        Update: {
          id?: string
          last_seen_at?: string
          name?: string
          owner_id?: string
          rx_bps?: number | null
          rx_dropped?: number | null
          rx_errors?: number | null
          server_id?: string
          tx_bps?: number | null
          tx_dropped?: number | null
          tx_errors?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "server_net_interfaces_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_ports: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_public: boolean
          last_seen_at: string
          managed: boolean
          note: string | null
          owner_id: string
          port: number
          process_name: string | null
          protocol: string
          server_id: string
          service: string | null
          service_kind: string | null
          state: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          last_seen_at?: string
          managed?: boolean
          note?: string | null
          owner_id: string
          port: number
          process_name?: string | null
          protocol?: string
          server_id: string
          service?: string | null
          service_kind?: string | null
          state?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          last_seen_at?: string
          managed?: boolean
          note?: string | null
          owner_id?: string
          port?: number
          process_name?: string | null
          protocol?: string
          server_id?: string
          service?: string | null
          service_kind?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_ports_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_role_capabilities: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          min_level: string
          role: Database["public"]["Enums"]["server_role"]
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          min_level?: string
          role: Database["public"]["Enums"]["server_role"]
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          min_level?: string
          role?: Database["public"]["Enums"]["server_role"]
          updated_at?: string
        }
        Relationships: []
      }
      server_security: {
        Row: {
          active_users: number | null
          failed_ssh_24h: number | null
          firewall_active: boolean | null
          owner_id: string
          server_id: string
          updated_at: string
          updates_pending: number | null
        }
        Insert: {
          active_users?: number | null
          failed_ssh_24h?: number | null
          firewall_active?: boolean | null
          owner_id: string
          server_id: string
          updated_at?: string
          updates_pending?: number | null
        }
        Update: {
          active_users?: number | null
          failed_ssh_24h?: number | null
          firewall_active?: boolean | null
          owner_id?: string
          server_id?: string
          updated_at?: string
          updates_pending?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "server_security_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_services: {
        Row: {
          id: string
          last_seen_at: string
          name: string
          owner_id: string
          restarts: number | null
          server_id: string
          status: string
          sub_status: string | null
        }
        Insert: {
          id?: string
          last_seen_at?: string
          name: string
          owner_id: string
          restarts?: number | null
          server_id: string
          status?: string
          sub_status?: string | null
        }
        Update: {
          id?: string
          last_seen_at?: string
          name?: string
          owner_id?: string
          restarts?: number | null
          server_id?: string
          status?: string
          sub_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_services_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_sites: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          last_seen_at: string
          name: string
          owner_id: string
          port: number | null
          server_id: string
          service_kind: string | null
          status: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          last_seen_at?: string
          name: string
          owner_id: string
          port?: number | null
          server_id: string
          service_kind?: string | null
          status?: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          last_seen_at?: string
          name?: string
          owner_id?: string
          port?: number | null
          server_id?: string
          service_kind?: string | null
          status?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_sites_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_sites_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      server_task_assignments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          last_status: string | null
          min_level: string
          owner_id: string
          required_role: Database["public"]["Enums"]["server_role"] | null
          server_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          min_level?: string
          owner_id?: string
          required_role?: Database["public"]["Enums"]["server_role"] | null
          server_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          min_level?: string
          owner_id?: string
          required_role?: Database["public"]["Enums"]["server_role"] | null
          server_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_task_assignments_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "scheduled_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      server_tunnels: {
        Row: {
          auto_reconnect: boolean
          created_at: string
          gateway_address: unknown
          gateway_port: number | null
          gateway_server_id: string
          id: string
          kind: string
          last_check_at: string | null
          last_output: string | null
          latency_ms: number | null
          local_address: unknown
          local_port: number | null
          local_server_id: string
          name: string
          owner_id: string
          public_domain: string | null
          status: string
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          auto_reconnect?: boolean
          created_at?: string
          gateway_address?: unknown
          gateway_port?: number | null
          gateway_server_id: string
          id?: string
          kind?: string
          last_check_at?: string | null
          last_output?: string | null
          latency_ms?: number | null
          local_address?: unknown
          local_port?: number | null
          local_server_id: string
          name: string
          owner_id?: string
          public_domain?: string | null
          status?: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          auto_reconnect?: boolean
          created_at?: string
          gateway_address?: unknown
          gateway_port?: number | null
          gateway_server_id?: string
          id?: string
          kind?: string
          last_check_at?: string | null
          last_output?: string | null
          latency_ms?: number | null
          local_address?: unknown
          local_port?: number | null
          local_server_id?: string
          name?: string
          owner_id?: string
          public_domain?: string | null
          status?: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_tunnels_gateway_server_id_fkey"
            columns: ["gateway_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_tunnels_local_server_id_fkey"
            columns: ["local_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_tunnels_vault_secret_id_fkey"
            columns: ["vault_secret_id"]
            isOneToOne: false
            referencedRelation: "vault_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      server_vpn_peers: {
        Row: {
          allowed_ips: string
          created_at: string
          endpoint: string | null
          id: string
          interface: string
          internal_ip: string
          keepalive: number
          last_error: string | null
          last_handshake_at: string | null
          listen_port: number
          owner_id: string
          peer_server_id: string | null
          public_key: string | null
          server_id: string
          status: string
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          allowed_ips?: string
          created_at?: string
          endpoint?: string | null
          id?: string
          interface?: string
          internal_ip: string
          keepalive?: number
          last_error?: string | null
          last_handshake_at?: string | null
          listen_port?: number
          owner_id?: string
          peer_server_id?: string | null
          public_key?: string | null
          server_id: string
          status?: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          allowed_ips?: string
          created_at?: string
          endpoint?: string | null
          id?: string
          interface?: string
          internal_ip?: string
          keepalive?: number
          last_error?: string | null
          last_handshake_at?: string | null
          listen_port?: number
          owner_id?: string
          peer_server_id?: string | null
          public_key?: string | null
          server_id?: string
          status?: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_vpn_peers_peer_server_id_fkey"
            columns: ["peer_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_vpn_peers_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_vpn_peers_vault_secret_id_fkey"
            columns: ["vault_secret_id"]
            isOneToOne: false
            referencedRelation: "vault_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          agent_token_hash: string | null
          agent_version: string | null
          auto_cert_policy: string
          created_at: string
          description: string | null
          disk_gb: number | null
          duplicate_of: string | null
          hostname: string
          id: string
          is_tvcc_node: boolean
          last_seen_at: string | null
          machine_id: string | null
          maintenance_mode: boolean
          metadata: Json
          name: string
          network_kind: string
          os: string | null
          owner_id: string
          private_ip: string | null
          provider: string | null
          public_ip: string | null
          ram_mb: number | null
          region: string | null
          role: Database["public"]["Enums"]["server_role"]
          status: string
          tvcc_url: string | null
          tvcc_version: string | null
          updated_at: string
          vcpu: number | null
        }
        Insert: {
          agent_token_hash?: string | null
          agent_version?: string | null
          auto_cert_policy?: string
          created_at?: string
          description?: string | null
          disk_gb?: number | null
          duplicate_of?: string | null
          hostname: string
          id?: string
          is_tvcc_node?: boolean
          last_seen_at?: string | null
          machine_id?: string | null
          maintenance_mode?: boolean
          metadata?: Json
          name: string
          network_kind?: string
          os?: string | null
          owner_id: string
          private_ip?: string | null
          provider?: string | null
          public_ip?: string | null
          ram_mb?: number | null
          region?: string | null
          role?: Database["public"]["Enums"]["server_role"]
          status?: string
          tvcc_url?: string | null
          tvcc_version?: string | null
          updated_at?: string
          vcpu?: number | null
        }
        Update: {
          agent_token_hash?: string | null
          agent_version?: string | null
          auto_cert_policy?: string
          created_at?: string
          description?: string | null
          disk_gb?: number | null
          duplicate_of?: string | null
          hostname?: string
          id?: string
          is_tvcc_node?: boolean
          last_seen_at?: string | null
          machine_id?: string | null
          maintenance_mode?: boolean
          metadata?: Json
          name?: string
          network_kind?: string
          os?: string | null
          owner_id?: string
          private_ip?: string | null
          provider?: string | null
          public_ip?: string | null
          ram_mb?: number | null
          region?: string | null
          role?: Database["public"]["Enums"]["server_role"]
          status?: string
          tvcc_url?: string | null
          tvcc_version?: string | null
          updated_at?: string
          vcpu?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "servers_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_dependencies: {
        Row: {
          config: Json
          consumer_website_id: string
          created_at: string
          env_prefix: string | null
          id: string
          link_method: string
          notes: string | null
          owner_id: string
          provider_website_id: string
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          consumer_website_id: string
          created_at?: string
          env_prefix?: string | null
          id?: string
          link_method?: string
          notes?: string | null
          owner_id: string
          provider_website_id: string
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          consumer_website_id?: string
          created_at?: string
          env_prefix?: string | null
          id?: string
          link_method?: string
          notes?: string | null
          owner_id?: string
          provider_website_id?: string
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_dependencies_consumer_website_id_fkey"
            columns: ["consumer_website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_dependencies_provider_website_id_fkey"
            columns: ["provider_website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_dependencies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "site_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          callback_url: string | null
          created_at: string
          error_message: string | null
          id: string
          owner_id: string
          payload: Json
          provider_domain: string | null
          provider_website_id: string | null
          requester_domain: string | null
          requester_website_id: string | null
          result: Json | null
          routed_by: string | null
          service_key: string
          service_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          callback_url?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id: string
          payload?: Json
          provider_domain?: string | null
          provider_website_id?: string | null
          requester_domain?: string | null
          requester_website_id?: string | null
          result?: Json | null
          routed_by?: string | null
          service_key: string
          service_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          callback_url?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id?: string
          payload?: Json
          provider_domain?: string | null
          provider_website_id?: string | null
          requester_domain?: string | null
          requester_website_id?: string | null
          result?: Json | null
          routed_by?: string | null
          service_key?: string
          service_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_provider_website_id_fkey"
            columns: ["provider_website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_requester_website_id_fkey"
            columns: ["requester_website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_backup_copies: {
        Row: {
          checksum: string | null
          command_id: string | null
          completed_at: string | null
          copy_kind: string
          created_at: string
          destination_id: string
          domain: string
          error_message: string | null
          id: string
          owner_id: string
          remote_path: string
          size_bytes: number | null
          status: string
          updated_at: string
          website_id: string
        }
        Insert: {
          checksum?: string | null
          command_id?: string | null
          completed_at?: string | null
          copy_kind: string
          created_at?: string
          destination_id: string
          domain: string
          error_message?: string | null
          id?: string
          owner_id: string
          remote_path: string
          size_bytes?: number | null
          status?: string
          updated_at?: string
          website_id: string
        }
        Update: {
          checksum?: string | null
          command_id?: string | null
          completed_at?: string | null
          copy_kind?: string
          created_at?: string
          destination_id?: string
          domain?: string
          error_message?: string | null
          id?: string
          owner_id?: string
          remote_path?: string
          size_bytes?: number | null
          status?: string
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_backup_copies_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "backup_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_backup_copies_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_backups: {
        Row: {
          backup_type: string
          completed_at: string | null
          copy_index: number
          created_at: string
          dest_path: string | null
          encrypted: boolean
          error_message: string | null
          id: string
          is_latest: boolean
          label: string | null
          owner_id: string
          server_id: string | null
          size_mb: number | null
          status: string
          storage_path: string | null
          target_server_id: string | null
          verified_at: string | null
          website_id: string | null
        }
        Insert: {
          backup_type?: string
          completed_at?: string | null
          copy_index?: number
          created_at?: string
          dest_path?: string | null
          encrypted?: boolean
          error_message?: string | null
          id?: string
          is_latest?: boolean
          label?: string | null
          owner_id: string
          server_id?: string | null
          size_mb?: number | null
          status?: string
          storage_path?: string | null
          target_server_id?: string | null
          verified_at?: string | null
          website_id?: string | null
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          copy_index?: number
          created_at?: string
          dest_path?: string | null
          encrypted?: boolean
          error_message?: string | null
          id?: string
          is_latest?: boolean
          label?: string | null
          owner_id?: string
          server_id?: string | null
          size_mb?: number | null
          status?: string
          storage_path?: string | null
          target_server_id?: string | null
          verified_at?: string | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_backups_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_backups_target_server_id_fkey"
            columns: ["target_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_backups_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_clones: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          new_domain: string | null
          result: Json | null
          snapshot_path: string | null
          source_website_id: string | null
          status: string
          target_server_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_domain?: string | null
          result?: Json | null
          snapshot_path?: string | null
          source_website_id?: string | null
          status?: string
          target_server_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_domain?: string | null
          result?: Json | null
          snapshot_path?: string | null
          source_website_id?: string | null
          status?: string
          target_server_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_clones_source_website_id_fkey"
            columns: ["source_website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_clones_target_server_id_fkey"
            columns: ["target_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_cluster_members: {
        Row: {
          cluster_id: string
          created_at: string
          domain: string | null
          id: string
          last_seen_at: string
          last_sync_at: string | null
          name: string
          owner_id: string
          role: string
          server_id: string
          status: string
          sync_interval_seconds: number
          sync_mode: string
          sync_status: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          domain?: string | null
          id?: string
          last_seen_at?: string
          last_sync_at?: string | null
          name: string
          owner_id: string
          role?: string
          server_id: string
          status?: string
          sync_interval_seconds?: number
          sync_mode?: string
          sync_status?: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          domain?: string | null
          id?: string
          last_seen_at?: string
          last_sync_at?: string | null
          name?: string
          owner_id?: string
          role?: string
          server_id?: string
          status?: string
          sync_interval_seconds?: number
          sync_mode?: string
          sync_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_cluster_members_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "site_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_cluster_members_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_clusters: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          owner_id: string
          primary_server_id: string | null
          status: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          owner_id: string
          primary_server_id?: string | null
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          owner_id?: string
          primary_server_id?: string | null
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_clusters_primary_server_id_fkey"
            columns: ["primary_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_clusters_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_databases: {
        Row: {
          connection_kind: string
          created_at: string
          database_id: string | null
          db_engine: string
          db_name: string | null
          db_user: string | null
          env_key: string
          host: string | null
          id: string
          last_checked_at: string | null
          latency_ms: number | null
          owner_id: string
          port: number | null
          provisioned_at: string | null
          provisioning_error: string | null
          provisioning_status: string
          role: string
          schema_name: string | null
          secret_id: string | null
          server_id: string | null
          server_path: string | null
          site_code: string | null
          status: string
          updated_at: string
          website_id: string
        }
        Insert: {
          connection_kind?: string
          created_at?: string
          database_id?: string | null
          db_engine?: string
          db_name?: string | null
          db_user?: string | null
          env_key?: string
          host?: string | null
          id?: string
          last_checked_at?: string | null
          latency_ms?: number | null
          owner_id?: string
          port?: number | null
          provisioned_at?: string | null
          provisioning_error?: string | null
          provisioning_status?: string
          role?: string
          schema_name?: string | null
          secret_id?: string | null
          server_id?: string | null
          server_path?: string | null
          site_code?: string | null
          status?: string
          updated_at?: string
          website_id: string
        }
        Update: {
          connection_kind?: string
          created_at?: string
          database_id?: string | null
          db_engine?: string
          db_name?: string | null
          db_user?: string | null
          env_key?: string
          host?: string | null
          id?: string
          last_checked_at?: string | null
          latency_ms?: number | null
          owner_id?: string
          port?: number | null
          provisioned_at?: string | null
          provisioning_error?: string | null
          provisioning_status?: string
          role?: string
          schema_name?: string | null
          secret_id?: string | null
          server_id?: string | null
          server_path?: string | null
          site_code?: string | null
          status?: string
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_databases_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_databases_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "vault_secrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_databases_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_databases_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_groups: {
        Row: {
          color: string
          created_at: string
          description: string | null
          group_key: string | null
          group_kind: string
          icon: string
          id: string
          is_auto: boolean
          name: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          group_key?: string | null
          group_kind?: string
          icon?: string
          id?: string
          is_auto?: boolean
          name: string
          owner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          group_key?: string | null
          group_kind?: string
          icon?: string
          id?: string
          is_auto?: boolean
          name?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_health_checks: {
        Row: {
          checked_at: string
          error_message: string | null
          http_status: number | null
          id: string
          owner_id: string
          response_time_ms: number | null
          ssl_valid: boolean | null
          status: string
          website_id: string
        }
        Insert: {
          checked_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          owner_id: string
          response_time_ms?: number | null
          ssl_valid?: boolean | null
          status?: string
          website_id: string
        }
        Update: {
          checked_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          owner_id?: string
          response_time_ms?: number | null
          ssl_valid?: boolean | null
          status?: string
          website_id?: string
        }
        Relationships: []
      }
      site_provisioning: {
        Row: {
          command_id: string | null
          created_at: string
          detail: string | null
          id: string
          owner_id: string
          server_id: string | null
          status: string
          step: string
          updated_at: string
          website_id: string
        }
        Insert: {
          command_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          owner_id: string
          server_id?: string | null
          status?: string
          step: string
          updated_at?: string
          website_id: string
        }
        Update: {
          command_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          owner_id?: string
          server_id?: string | null
          status?: string
          step?: string
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_provisioning_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_provisioning_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_runtimes: {
        Row: {
          auto_start: boolean
          created_at: string
          domain: string
          exec_start: string | null
          id: string
          last_output: string | null
          last_restart_at: string | null
          memory_mb: number | null
          owner_id: string
          port: number | null
          root_path: string | null
          runtime_kind: string
          server_id: string
          status: string
          unit_name: string | null
          updated_at: string
          website_id: string | null
        }
        Insert: {
          auto_start?: boolean
          created_at?: string
          domain: string
          exec_start?: string | null
          id?: string
          last_output?: string | null
          last_restart_at?: string | null
          memory_mb?: number | null
          owner_id?: string
          port?: number | null
          root_path?: string | null
          runtime_kind?: string
          server_id: string
          status?: string
          unit_name?: string | null
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          auto_start?: boolean
          created_at?: string
          domain?: string
          exec_start?: string | null
          id?: string
          last_output?: string | null
          last_restart_at?: string | null
          memory_mb?: number | null
          owner_id?: string
          port?: number | null
          root_path?: string | null
          runtime_kind?: string
          server_id?: string
          status?: string
          unit_name?: string | null
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_runtimes_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_runtimes_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_services: {
        Row: {
          auth_type: string
          created_at: string
          description: string | null
          endpoint_url: string | null
          health_path: string | null
          id: string
          is_public: boolean
          link_method: string
          metadata: Json | null
          name: string
          owner_id: string
          port: number | null
          script: string | null
          service_type: string
          status: string
          updated_at: string
          website_id: string
        }
        Insert: {
          auth_type?: string
          created_at?: string
          description?: string | null
          endpoint_url?: string | null
          health_path?: string | null
          id?: string
          is_public?: boolean
          link_method?: string
          metadata?: Json | null
          name: string
          owner_id: string
          port?: number | null
          script?: string | null
          service_type: string
          status?: string
          updated_at?: string
          website_id: string
        }
        Update: {
          auth_type?: string
          created_at?: string
          description?: string | null
          endpoint_url?: string | null
          health_path?: string | null
          id?: string
          is_public?: boolean
          link_method?: string
          metadata?: Json | null
          name?: string
          owner_id?: string
          port?: number | null
          script?: string | null
          service_type?: string
          status?: string
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_services_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_snapshots: {
        Row: {
          created_at: string
          id: string
          note: string | null
          path: string | null
          server_id: string | null
          size_bytes: number | null
          slot: string
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          path?: string | null
          server_id?: string | null
          size_bytes?: number | null
          slot?: string
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          path?: string | null
          server_id?: string | null
          size_bytes?: number | null
          slot?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_snapshots_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_snapshots_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_storage_syncs: {
        Row: {
          auto_sync: boolean
          created_at: string
          domain: string
          file_count: number
          id: string
          interval_minutes: number
          last_output: string | null
          last_synced_at: string | null
          owner_id: string
          size_bytes: number
          source_path: string
          source_server_id: string | null
          status: string
          storage_path: string
          storage_server_id: string
          updated_at: string
          website_id: string
        }
        Insert: {
          auto_sync?: boolean
          created_at?: string
          domain: string
          file_count?: number
          id?: string
          interval_minutes?: number
          last_output?: string | null
          last_synced_at?: string | null
          owner_id?: string
          size_bytes?: number
          source_path: string
          source_server_id?: string | null
          status?: string
          storage_path: string
          storage_server_id: string
          updated_at?: string
          website_id: string
        }
        Update: {
          auto_sync?: boolean
          created_at?: string
          domain?: string
          file_count?: number
          id?: string
          interval_minutes?: number
          last_output?: string | null
          last_synced_at?: string | null
          owner_id?: string
          size_bytes?: number
          source_path?: string
          source_server_id?: string | null
          status?: string
          storage_path?: string
          storage_server_id?: string
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_storage_syncs_source_server_id_fkey"
            columns: ["source_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_storage_syncs_storage_server_id_fkey"
            columns: ["storage_server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_storage_syncs_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_templates: {
        Row: {
          created_at: string
          default_settings: Json
          description: string | null
          id: string
          name: string
          owner_id: string
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_settings?: Json
          description?: string | null
          id?: string
          name: string
          owner_id: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_settings?: Json
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_user_access: {
        Row: {
          access_level: string
          created_at: string
          id: string
          owner_id: string
          site_user_id: string
          website_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          id?: string
          owner_id: string
          site_user_id: string
          website_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
          owner_id?: string
          site_user_id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_user_access_site_user_id_fkey"
            columns: ["site_user_id"]
            isOneToOne: false
            referencedRelation: "site_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_user_access_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_users: {
        Row: {
          created_at: string
          email: string
          external_id: string
          full_name: string | null
          id: string
          is_active: boolean
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          external_id?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          external_id?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          counter: number
          id: string
          updated_at: string
        }
        Insert: {
          counter?: number
          id?: string
          updated_at?: string
        }
        Update: {
          counter?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ssl_certificates: {
        Row: {
          auto_renew: boolean
          created_at: string
          days_until_expiry: number | null
          domain: string
          domain_id: string | null
          id: string
          issuer: string | null
          last_checked_at: string | null
          notes: string | null
          owner_id: string
          status: string
          subject: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          website_id: string | null
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          days_until_expiry?: number | null
          domain: string
          domain_id?: string | null
          id?: string
          issuer?: string | null
          last_checked_at?: string | null
          notes?: string | null
          owner_id: string
          status?: string
          subject?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          website_id?: string | null
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          days_until_expiry?: number | null
          domain?: string
          domain_id?: string | null
          id?: string
          issuer?: string | null
          last_checked_at?: string | null
          notes?: string | null
          owner_id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          website_id?: string | null
        }
        Relationships: []
      }
      storage_events: {
        Row: {
          created_at: string
          detail: string | null
          event_kind: string
          id: string
          owner_id: string
          path: string | null
          server_id: string | null
          size_mb: number | null
          storage_id: string | null
          website_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event_kind: string
          id?: string
          owner_id?: string
          path?: string | null
          server_id?: string | null
          size_mb?: number | null
          storage_id?: string | null
          website_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          event_kind?: string
          id?: string
          owner_id?: string
          path?: string | null
          server_id?: string | null
          size_mb?: number | null
          storage_id?: string | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_events_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_events_storage_id_fkey"
            columns: ["storage_id"]
            isOneToOne: false
            referencedRelation: "storages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_events_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_quotas: {
        Row: {
          created_at: string
          id: string
          limit_bytes: number
          owner_id: string
          subscription_id: string | null
          transfer_limit_bytes: number
          transfer_used_bytes: number
          updated_at: string
          used_bytes: number
          website_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          limit_bytes?: number
          owner_id: string
          subscription_id?: string | null
          transfer_limit_bytes?: number
          transfer_used_bytes?: number
          updated_at?: string
          used_bytes?: number
          website_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          limit_bytes?: number
          owner_id?: string
          subscription_id?: string | null
          transfer_limit_bytes?: number
          transfer_used_bytes?: number
          updated_at?: string
          used_bytes?: number
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_quotas_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "hosting_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_quotas_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      storages: {
        Row: {
          auto_provisioned: boolean
          bucket: string | null
          created_at: string
          id: string
          identity_written: boolean
          last_sync_at: string | null
          name: string
          owner_id: string
          path: string | null
          region: string | null
          server_id: string | null
          size_gb: number | null
          status: string
          storage_type: string
          sync_status: string
          updated_at: string
          used_gb: number | null
          watch_enabled: boolean
          website_id: string | null
        }
        Insert: {
          auto_provisioned?: boolean
          bucket?: string | null
          created_at?: string
          id?: string
          identity_written?: boolean
          last_sync_at?: string | null
          name: string
          owner_id: string
          path?: string | null
          region?: string | null
          server_id?: string | null
          size_gb?: number | null
          status?: string
          storage_type?: string
          sync_status?: string
          updated_at?: string
          used_gb?: number | null
          watch_enabled?: boolean
          website_id?: string | null
        }
        Update: {
          auto_provisioned?: boolean
          bucket?: string | null
          created_at?: string
          id?: string
          identity_written?: boolean
          last_sync_at?: string | null
          name?: string
          owner_id?: string
          path?: string | null
          region?: string | null
          server_id?: string | null
          size_gb?: number | null
          status?: string
          storage_type?: string
          sync_status?: string
          updated_at?: string
          used_gb?: number | null
          watch_enabled?: boolean
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storages_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storages_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_servers: {
        Row: {
          cpu_quota: number
          created_at: string
          disk_quota_gb: number
          granted_at: string
          granted_by: string | null
          id: string
          owner_id: string
          ram_quota_mb: number
          role: Database["public"]["Enums"]["server_role"]
          server_id: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          cpu_quota?: number
          created_at?: string
          disk_quota_gb?: number
          granted_at?: string
          granted_by?: string | null
          id?: string
          owner_id: string
          ram_quota_mb?: number
          role?: Database["public"]["Enums"]["server_role"]
          server_id: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          cpu_quota?: number
          created_at?: string
          disk_quota_gb?: number
          granted_at?: string
          granted_by?: string | null
          id?: string
          owner_id?: string
          ram_quota_mb?: number
          role?: Database["public"]["Enums"]["server_role"]
          server_id?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_servers_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_servers_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "hosting_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          client_id: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          owner_id: string
          plan_name: string
          price: number
          starts_at: string
          status: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          owner_id: string
          plan_name: string
          price?: number
          starts_at?: string
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          owner_id?: string
          plan_name?: string
          price?: number
          starts_at?: string
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      task_runs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          output: string | null
          owner_id: string
          started_at: string
          status: string
          task_id: string | null
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          output?: string | null
          owner_id?: string
          started_at?: string
          status?: string
          task_id?: string | null
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          output?: string | null
          owner_id?: string
          started_at?: string
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "scheduled_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      tvcc_probe: {
        Row: {
          id: number
          name: string | null
        }
        Insert: {
          id?: number
          name?: string | null
        }
        Update: {
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      tvcc_service_links: {
        Row: {
          created_at: string
          id: string
          last_sync_at: string | null
          link_kind: string
          service_id: string | null
          site_id: string | null
          status: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          link_kind: string
          service_id?: string | null
          site_id?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          link_kind?: string
          service_id?: string | null
          site_id?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tvcc_service_links_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "site_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tvcc_service_links_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "lovable_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tvcc_service_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "lovable_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      uptime_checks: {
        Row: {
          checked_at: string
          error_message: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          monitor_id: string | null
          owner_id: string
          status: string
        }
        Insert: {
          checked_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          monitor_id?: string | null
          owner_id?: string
          status: string
        }
        Update: {
          checked_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          monitor_id?: string | null
          owner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "uptime_checks_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "uptime_monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      uptime_monitors: {
        Row: {
          created_at: string
          expected_status: number
          id: string
          interval_sec: number
          is_active: boolean
          last_checked_at: string | null
          last_latency_ms: number | null
          last_status: string | null
          method: string
          name: string
          owner_id: string
          timeout_ms: number
          updated_at: string
          url: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          expected_status?: number
          id?: string
          interval_sec?: number
          is_active?: boolean
          last_checked_at?: string | null
          last_latency_ms?: number | null
          last_status?: string | null
          method?: string
          name: string
          owner_id?: string
          timeout_ms?: number
          updated_at?: string
          url: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          expected_status?: number
          id?: string
          interval_sec?: number
          is_active?: boolean
          last_checked_at?: string | null
          last_latency_ms?: number | null
          last_status?: string | null
          method?: string
          name?: string
          owner_id?: string
          timeout_ms?: number
          updated_at?: string
          url?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uptime_monitors_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_costs: {
        Row: {
          category: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          owner_id: string
          period_end: string | null
          period_start: string | null
          provider: string | null
          quantity: number
          server_id: string | null
          total_cost: number
          unit: string
          unit_cost: number
          website_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          owner_id?: string
          period_end?: string | null
          period_start?: string | null
          provider?: string | null
          quantity?: number
          server_id?: string | null
          total_cost?: number
          unit?: string
          unit_cost?: number
          website_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          owner_id?: string
          period_end?: string | null
          period_start?: string | null
          provider?: string | null
          quantity?: number
          server_id?: string | null
          total_cost?: number
          unit?: string
          unit_cost?: number
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_costs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_costs_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          extras: Json
          id: string
          language: string
          sidebar_collapsed: boolean
          theme_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extras?: Json
          id?: string
          language?: string
          sidebar_collapsed?: boolean
          theme_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extras?: Json
          id?: string
          language?: string
          sidebar_collapsed?: boolean
          theme_id?: string
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
      vault_secret_versions: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          rotated_by: string | null
          secret_id: string
          value_encrypted: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          rotated_by?: string | null
          secret_id: string
          value_encrypted: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          rotated_by?: string | null
          secret_id?: string
          value_encrypted?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_secret_versions_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "vault_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_secrets: {
        Row: {
          category: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          last_rotated_at: string | null
          name: string
          owner_id: string
          rotation_period_days: number | null
          server_id: string | null
          updated_at: string
          value_encrypted: string
          website_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          last_rotated_at?: string | null
          name: string
          owner_id: string
          rotation_period_days?: number | null
          server_id?: string | null
          updated_at?: string
          value_encrypted: string
          website_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          last_rotated_at?: string | null
          name?: string
          owner_id?: string
          rotation_period_days?: number | null
          server_id?: string | null
          updated_at?: string
          value_encrypted?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_secrets_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      video_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          external_id: string | null
          id: string
          owner_id: string
          payload: Json
          prompt: string
          provider: string
          requester_channel: string
          status: string
          target_site: string | null
          thumbnail_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          owner_id: string
          payload?: Json
          prompt: string
          provider?: string
          requester_channel?: string
          status?: string
          target_site?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          owner_id?: string
          payload?: Json
          prompt?: string
          provider?: string
          requester_channel?: string
          status?: string
          target_site?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          endpoint_id: string | null
          error_message: string | null
          event: string
          id: string
          owner_id: string
          payload: Json
          response_code: number | null
          status: string
        }
        Insert: {
          created_at?: string
          endpoint_id?: string | null
          error_message?: string | null
          event: string
          id?: string
          owner_id?: string
          payload?: Json
          response_code?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          endpoint_id?: string | null
          error_message?: string | null
          event?: string
          id?: string
          owner_id?: string
          payload?: Json
          response_code?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          direction: string
          events: string[]
          id: string
          is_active: boolean
          last_delivery_at: string | null
          name: string
          owner_id: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          direction?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_delivery_at?: string | null
          name: string
          owner_id?: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          direction?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_delivery_at?: string | null
          name?: string
          owner_id?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      website_android_releases: {
        Row: {
          aab_url: string | null
          apk_url: string | null
          created_at: string
          id: string
          is_current: boolean
          notes: string | null
          owner_id: string
          version_code: number
          version_name: string
          website_id: string
        }
        Insert: {
          aab_url?: string | null
          apk_url?: string | null
          created_at?: string
          id?: string
          is_current?: boolean
          notes?: string | null
          owner_id: string
          version_code: number
          version_name: string
          website_id: string
        }
        Update: {
          aab_url?: string | null
          apk_url?: string | null
          created_at?: string
          id?: string
          is_current?: boolean
          notes?: string | null
          owner_id?: string
          version_code?: number
          version_name?: string
          website_id?: string
        }
        Relationships: []
      }
      website_env_vars: {
        Row: {
          created_at: string
          description: string | null
          environment: string
          id: string
          is_secret: boolean
          key: string
          owner_id: string
          updated_at: string
          value: string
          website_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          environment?: string
          id?: string
          is_secret?: boolean
          key: string
          owner_id: string
          updated_at?: string
          value: string
          website_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          environment?: string
          id?: string
          is_secret?: boolean
          key?: string
          owner_id?: string
          updated_at?: string
          value?: string
          website_id?: string
        }
        Relationships: []
      }
      website_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          owner_id: string
          website_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          owner_id: string
          website_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          owner_id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "site_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      website_settings: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          setting_key: string
          updated_at: string
          value: Json
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          setting_key: string
          updated_at?: string
          value?: Json
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          setting_key?: string
          updated_at?: string
          value?: Json
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_settings_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_template_links: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          template_id: string
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          template_id: string
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          template_id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_template_links_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "site_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          android_aab_url: string | null
          android_apk_url: string | null
          android_enabled: boolean
          android_latest_version: string | null
          android_status: string | null
          android_updated_at: string | null
          android_version_code: number | null
          api_config_url: string | null
          api_url: string | null
          created_at: string
          description: string | null
          domain: string
          frontend_domain: string | null
          hn_cloud_storage_id: string | null
          hn_db_connection_id: string | null
          hn_project_id: string | null
          id: string
          is_active: boolean
          is_remix: boolean | null
          last_checked_at: string | null
          legacy_site_code: string | null
          lovable_workspace_id: string | null
          manara_code: string | null
          name: string
          owner_email: string | null
          owner_id: string | null
          payments_provider_url: string | null
          registered_at: string | null
          registration_status: string
          remix_of: string | null
          server_id: string | null
          site_code: string | null
          site_id: string | null
          site_url: string | null
          slug: string | null
          status: Database["public"]["Enums"]["site_status"]
          updated_at: string
          verified: boolean
          verify_code: string
          workspace_name: string | null
        }
        Insert: {
          android_aab_url?: string | null
          android_apk_url?: string | null
          android_enabled?: boolean
          android_latest_version?: string | null
          android_status?: string | null
          android_updated_at?: string | null
          android_version_code?: number | null
          api_config_url?: string | null
          api_url?: string | null
          created_at?: string
          description?: string | null
          domain: string
          frontend_domain?: string | null
          hn_cloud_storage_id?: string | null
          hn_db_connection_id?: string | null
          hn_project_id?: string | null
          id?: string
          is_active?: boolean
          is_remix?: boolean | null
          last_checked_at?: string | null
          legacy_site_code?: string | null
          lovable_workspace_id?: string | null
          manara_code?: string | null
          name: string
          owner_email?: string | null
          owner_id?: string | null
          payments_provider_url?: string | null
          registered_at?: string | null
          registration_status?: string
          remix_of?: string | null
          server_id?: string | null
          site_code?: string | null
          site_id?: string | null
          site_url?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["site_status"]
          updated_at?: string
          verified?: boolean
          verify_code?: string
          workspace_name?: string | null
        }
        Update: {
          android_aab_url?: string | null
          android_apk_url?: string | null
          android_enabled?: boolean
          android_latest_version?: string | null
          android_status?: string | null
          android_updated_at?: string | null
          android_version_code?: number | null
          api_config_url?: string | null
          api_url?: string | null
          created_at?: string
          description?: string | null
          domain?: string
          frontend_domain?: string | null
          hn_cloud_storage_id?: string | null
          hn_db_connection_id?: string | null
          hn_project_id?: string | null
          id?: string
          is_active?: boolean
          is_remix?: boolean | null
          last_checked_at?: string | null
          legacy_site_code?: string | null
          lovable_workspace_id?: string | null
          manara_code?: string | null
          name?: string
          owner_email?: string | null
          owner_id?: string | null
          payments_provider_url?: string | null
          registered_at?: string | null
          registration_status?: string
          remix_of?: string | null
          server_id?: string | null
          site_code?: string | null
          site_id?: string | null
          site_url?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["site_status"]
          updated_at?: string
          verified?: boolean
          verify_code?: string
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "websites_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      manara_public_routes: {
        Row: {
          group_tag: string | null
          is_current: boolean | null
          is_verified: boolean | null
          kind: string | null
          project_key: string | null
          project_name: string | null
          project_status: string | null
          updated_at: string | null
          url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bump_site_visits: { Args: never; Returns: number }
      is_permanent_owner_email: { Args: { _email: string }; Returns: boolean }
      rollup_server_metrics: { Args: { retain_days?: number }; Returns: number }
      tvcc_exec_sql: { Args: { sql: string }; Returns: Json[] }
      verify_cron_secret: {
        Args: { _name: string; _secret: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer" | "system_owner"
      server_role:
        | "control"
        | "db_primary"
        | "db_replica"
        | "web"
        | "storage"
        | "backup"
        | "monitor"
      site_status: "online" | "offline" | "warning" | "pending"
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
      app_role: ["admin", "editor", "viewer", "system_owner"],
      server_role: [
        "control",
        "db_primary",
        "db_replica",
        "web",
        "storage",
        "backup",
        "monitor",
      ],
      site_status: ["online", "offline", "warning", "pending"],
    },
  },
} as const
