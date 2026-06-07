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
          created_at: string
          description: string | null
          domain: string
          id: string
          is_active: boolean
          last_checked_at: string | null
          name: string
          owner_id: string
          status: Database["public"]["Enums"]["site_status"]
          updated_at: string
          verified: boolean
          verify_code: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          name: string
          owner_id: string
          status?: Database["public"]["Enums"]["site_status"]
          updated_at?: string
          verified?: boolean
          verify_code?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          name?: string
          owner_id?: string
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
      app_role: "admin" | "editor" | "viewer"
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
      app_role: ["admin", "editor", "viewer"],
      site_status: ["online", "offline", "warning", "pending"],
    },
  },
} as const
