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
      brand_settings: {
        Row: {
          created_at: string
          favicon_url: string | null
          id: string
          logo_url: string
          name: string
          singleton: boolean
          tagline: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url: string
          name?: string
          singleton?: boolean
          tagline?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string
          name?: string
          singleton?: boolean
          tagline?: string
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
      databases: {
        Row: {
          created_at: string
          db_type: string
          db_user: string | null
          host: string | null
          id: string
          name: string
          owner_id: string
          password_hash: string | null
          size_mb: number | null
          status: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          db_type?: string
          db_user?: string | null
          host?: string | null
          id?: string
          name: string
          owner_id: string
          password_hash?: string | null
          size_mb?: number | null
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          db_type?: string
          db_user?: string | null
          host?: string | null
          id?: string
          name?: string
          owner_id?: string
          password_hash?: string | null
          size_mb?: number | null
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "databases_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
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
      service_dependencies: {
        Row: {
          consumer_website_id: string
          created_at: string
          id: string
          notes: string | null
          owner_id: string | null
          provider_website_id: string
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          consumer_website_id: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          provider_website_id: string
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          consumer_website_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
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
      site_groups: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          owner_id?: string
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
      site_services: {
        Row: {
          created_at: string
          description: string | null
          endpoint_url: string | null
          id: string
          is_public: boolean
          metadata: Json | null
          name: string
          owner_id: string | null
          service_type: string
          status: string
          updated_at: string
          website_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          endpoint_url?: string | null
          id?: string
          is_public?: boolean
          metadata?: Json | null
          name: string
          owner_id?: string | null
          service_type: string
          status?: string
          updated_at?: string
          website_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          endpoint_url?: string | null
          id?: string
          is_public?: boolean
          metadata?: Json | null
          name?: string
          owner_id?: string | null
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
      storages: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          region: string | null
          size_gb: number | null
          status: string
          storage_type: string
          updated_at: string
          used_gb: number | null
          website_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          region?: string | null
          size_gb?: number | null
          status?: string
          storage_type?: string
          updated_at?: string
          used_gb?: number | null
          website_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          region?: string | null
          size_gb?: number | null
          status?: string
          storage_type?: string
          updated_at?: string
          used_gb?: number | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storages_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
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
      vault_secrets: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          last_rotated_at: string | null
          name: string
          owner_id: string
          updated_at: string
          value_encrypted: string
          website_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          last_rotated_at?: string | null
          name: string
          owner_id: string
          updated_at?: string
          value_encrypted: string
          website_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          last_rotated_at?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
          value_encrypted?: string
          website_id?: string | null
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
          created_at: string
          description: string | null
          domain: string
          frontend_domain: string | null
          hn_cloud_storage_id: string | null
          hn_db_connection_id: string | null
          id: string
          is_active: boolean
          last_checked_at: string | null
          name: string
          owner_id: string | null
          payments_provider_url: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["site_status"]
          updated_at: string
          verified: boolean
          verify_code: string
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
          created_at?: string
          description?: string | null
          domain: string
          frontend_domain?: string | null
          hn_cloud_storage_id?: string | null
          hn_db_connection_id?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          name: string
          owner_id?: string | null
          payments_provider_url?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["site_status"]
          updated_at?: string
          verified?: boolean
          verify_code?: string
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
          created_at?: string
          description?: string | null
          domain?: string
          frontend_domain?: string | null
          hn_cloud_storage_id?: string | null
          hn_db_connection_id?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          name?: string
          owner_id?: string | null
          payments_provider_url?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["site_status"]
          updated_at?: string
          verified?: boolean
          verify_code?: string
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
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer" | "system_owner"
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
      app_role: ["admin", "editor", "viewer", "system_owner"],
      site_status: ["online", "offline", "warning", "pending"],
    },
  },
} as const
