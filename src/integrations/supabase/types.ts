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
      ai_agents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_run_at: string | null
          name: string
          runs_today: number
          status: string
          success_rate: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          runs_today?: number
          status?: string
          success_rate?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          runs_today?: number
          status?: string
          success_rate?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_decisions: {
        Row: {
          agent_name: string
          created_at: string
          decision: string
          id: string
          reasoning: string | null
          timestamp: string
        }
        Insert: {
          agent_name: string
          created_at?: string
          decision: string
          id?: string
          reasoning?: string | null
          timestamp?: string
        }
        Update: {
          agent_name?: string
          created_at?: string
          decision?: string
          id?: string
          reasoning?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      ai_events: {
        Row: {
          action: string
          agent_id: string | null
          created_at: string
          id: string
          payload: Json | null
          severity: string
          summary: string | null
        }
        Insert: {
          action: string
          agent_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          severity?: string
          summary?: string | null
        }
        Update: {
          action?: string
          agent_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          severity?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          co2_kg: number | null
          cost_usd: number | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          dest_address: string
          dest_city: string | null
          dest_lat: number | null
          dest_lng: number | null
          dropoff_latitude: number | null
          dropoff_location: string | null
          dropoff_longitude: number | null
          estimated_cost: number | null
          estimated_time: number | null
          eta: string | null
          id: string
          origin_warehouse_id: string | null
          pickup_latitude: number | null
          pickup_location: string | null
          pickup_longitude: number | null
          priority: string
          scheduled_for: string | null
          status: string
          tracking_no: string
          updated_at: string
          vehicle_id: string | null
          weight: number | null
          weight_kg: number
        }
        Insert: {
          co2_kg?: number | null
          cost_usd?: number | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          dest_address: string
          dest_city?: string | null
          dest_lat?: number | null
          dest_lng?: number | null
          dropoff_latitude?: number | null
          dropoff_location?: string | null
          dropoff_longitude?: number | null
          estimated_cost?: number | null
          estimated_time?: number | null
          eta?: string | null
          id?: string
          origin_warehouse_id?: string | null
          pickup_latitude?: number | null
          pickup_location?: string | null
          pickup_longitude?: number | null
          priority?: string
          scheduled_for?: string | null
          status?: string
          tracking_no: string
          updated_at?: string
          vehicle_id?: string | null
          weight?: number | null
          weight_kg?: number
        }
        Update: {
          co2_kg?: number | null
          cost_usd?: number | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          dest_address?: string
          dest_city?: string | null
          dest_lat?: number | null
          dest_lng?: number | null
          dropoff_latitude?: number | null
          dropoff_location?: string | null
          dropoff_longitude?: number | null
          estimated_cost?: number | null
          estimated_time?: number | null
          eta?: string | null
          id?: string
          origin_warehouse_id?: string | null
          pickup_latitude?: number | null
          pickup_location?: string | null
          pickup_longitude?: number | null
          priority?: string
          scheduled_for?: string | null
          status?: string
          tracking_no?: string
          updated_at?: string
          vehicle_id?: string | null
          weight?: number | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_origin_warehouse_id_fkey"
            columns: ["origin_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          assigned_vehicle: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          license_no: string | null
          name: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_vehicle?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          license_no?: string | null
          name?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_vehicle?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          license_no?: string | null
          name?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_assigned_vehicle_fkey"
            columns: ["assigned_vehicle"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          arrival_eta: string | null
          created_at: string
          delivery_id: string | null
          id: string
          route_id: string
          sequence: number
        }
        Insert: {
          arrival_eta?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          route_id: string
          sequence: number
        }
        Update: {
          arrival_eta?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          route_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          delivery_id: string | null
          distance: number | null
          driver_id: string | null
          estimated_co2_kg: number
          estimated_cost_usd: number
          fuel_cost: number | null
          id: string
          name: string
          optimization_score: number
          origin_warehouse_id: string | null
          planned_for: string
          status: string
          total_distance_km: number
          total_duration_min: number
          travel_time: number | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          distance?: number | null
          driver_id?: string | null
          estimated_co2_kg?: number
          estimated_cost_usd?: number
          fuel_cost?: number | null
          id?: string
          name: string
          optimization_score?: number
          origin_warehouse_id?: string | null
          planned_for?: string
          status?: string
          total_distance_km?: number
          total_duration_min?: number
          travel_time?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          distance?: number | null
          driver_id?: string | null
          estimated_co2_kg?: number
          estimated_cost_usd?: number
          fuel_cost?: number | null
          id?: string
          name?: string
          optimization_score?: number
          origin_warehouse_id?: string | null
          planned_for?: string
          status?: string
          total_distance_km?: number
          total_duration_min?: number
          travel_time?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_origin_warehouse_id_fkey"
            columns: ["origin_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      vehicles: {
        Row: {
          battery_pct: number | null
          capacity: number | null
          capacity_kg: number
          created_at: string
          current_lat: number | null
          current_lng: number | null
          current_location: string | null
          driver_id: string | null
          fuel_efficiency: number | null
          fuel_pct: number | null
          fuel_type: string
          home_warehouse_id: string | null
          id: string
          model: string
          odometer_km: number
          plate: string
          status: string
          type: string
          updated_at: string
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          battery_pct?: number | null
          capacity?: number | null
          capacity_kg?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          current_location?: string | null
          driver_id?: string | null
          fuel_efficiency?: number | null
          fuel_pct?: number | null
          fuel_type?: string
          home_warehouse_id?: string | null
          id?: string
          model: string
          odometer_km?: number
          plate: string
          status?: string
          type?: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          battery_pct?: number | null
          capacity?: number | null
          capacity_kg?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          current_location?: string | null
          driver_id?: string | null
          fuel_efficiency?: number | null
          fuel_pct?: number | null
          fuel_type?: string
          home_warehouse_id?: string | null
          id?: string
          model?: string
          odometer_km?: number
          plate?: string
          status?: string
          type?: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_home_warehouse_id_fkey"
            columns: ["home_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string
          capacity_units: number
          city: string
          code: string
          country: string
          created_at: string
          id: string
          lat: number | null
          latitude: number | null
          lng: number | null
          longitude: number | null
          name: string
          status: string
          updated_at: string
          used_units: number
          warehouse_name: string | null
        }
        Insert: {
          address: string
          capacity_units?: number
          city: string
          code: string
          country?: string
          created_at?: string
          id?: string
          lat?: number | null
          latitude?: number | null
          lng?: number | null
          longitude?: number | null
          name: string
          status?: string
          updated_at?: string
          used_units?: number
          warehouse_name?: string | null
        }
        Update: {
          address?: string
          capacity_units?: number
          city?: string
          code?: string
          country?: string
          created_at?: string
          id?: string
          lat?: number | null
          latitude?: number | null
          lng?: number | null
          longitude?: number | null
          name?: string
          status?: string
          updated_at?: string
          used_units?: number
          warehouse_name?: string | null
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          delivery_id: string
          id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          delivery_id: string
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          delivery_id?: string
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          agent_key: string
          agent_name: string
          completed_at: string | null
          created_at: string
          decision: string | null
          duration_ms: number | null
          execution_id: string
          id: string
          output: Json | null
          reasoning: string | null
          started_at: string | null
          status: string
          step_order: number
          updated_at: string
        }
        Insert: {
          agent_key: string
          agent_name: string
          completed_at?: string | null
          created_at?: string
          decision?: string | null
          duration_ms?: number | null
          execution_id: string
          id?: string
          output?: Json | null
          reasoning?: string | null
          started_at?: string | null
          status?: string
          step_order: number
          updated_at?: string
        }
        Update: {
          agent_key?: string
          agent_name?: string
          completed_at?: string | null
          created_at?: string
          decision?: string | null
          duration_ms?: number | null
          execution_id?: string
          id?: string
          output?: Json | null
          reasoning?: string | null
          started_at?: string | null
          status?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "workflow_executions"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "admin" | "dispatcher" | "fleet_manager"
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
      app_role: ["admin", "dispatcher", "fleet_manager"],
    },
  },
} as const
