export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          name: string;
          category: string;
          workday_percentage: number;
          start_date: string;
          end_date: string | null;
          active: boolean;
          annual_target_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          workday_percentage?: number;
          start_date: string;
          end_date?: string | null;
          active?: boolean;
          annual_target_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [];
      };
      employee_workload_periods: {
        Row: {
          id: string;
          employee_id: string;
          start_date: string;
          end_date: string | null;
          workload_percentage: number;
          annual_hours_full_time: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          start_date: string;
          end_date?: string | null;
          workload_percentage: number;
          annual_hours_full_time: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["employee_workload_periods"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "employee_workload_periods_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      shift_types: {
        Row: {
          id: string;
          code: string;
          name: string;
          computable_hours: number;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          computable_hours?: number;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shift_types"]["Insert"]>;
        Relationships: [];
      };
      shift_assignments: {
        Row: {
          id: string;
          employee_id: string;
          date: string;
          shift_type_id: string;
          source: "manual" | "pattern";
          employee_shift_pattern_id: string | null;
          generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          date: string;
          shift_type_id: string;
          source?: "manual" | "pattern";
          employee_shift_pattern_id?: string | null;
          generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shift_assignments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "shift_assignments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_assignments_shift_type_id_fkey";
            columns: ["shift_type_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id"];
          }
        ];
      };
      shift_patterns: {
        Row: {
          id: string;
          name: string;
          description: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shift_patterns"]["Insert"]>;
        Relationships: [];
      };
      shift_pattern_days: {
        Row: {
          id: string;
          pattern_id: string;
          day_index: number;
          shift_type_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pattern_id: string;
          day_index: number;
          shift_type_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shift_pattern_days"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "shift_pattern_days_pattern_id_fkey";
            columns: ["pattern_id"];
            isOneToOne: false;
            referencedRelation: "shift_patterns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_pattern_days_shift_type_id_fkey";
            columns: ["shift_type_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id"];
          }
        ];
      };
      employee_shift_patterns: {
        Row: {
          id: string;
          employee_id: string;
          pattern_id: string;
          start_date: string;
          end_date: string | null;
          start_day_index: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          pattern_id: string;
          start_date: string;
          end_date?: string | null;
          start_day_index?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["employee_shift_patterns"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "employee_shift_patterns_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employee_shift_patterns_pattern_id_fkey";
            columns: ["pattern_id"];
            isOneToOne: false;
            referencedRelation: "shift_patterns";
            referencedColumns: ["id"];
          }
        ];
      };
      absences: {
        Row: {
          id: string;
          employee_id: string;
          shift_type_id: string;
          start_date: string;
          end_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          shift_type_id: string;
          start_date: string;
          end_date: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["absences"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "absences_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "absences_shift_type_id_fkey";
            columns: ["shift_type_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type EmployeeWorkloadPeriod = Database["public"]["Tables"]["employee_workload_periods"]["Row"];
export type ShiftType = Database["public"]["Tables"]["shift_types"]["Row"];
export type ShiftAssignment = Database["public"]["Tables"]["shift_assignments"]["Row"];
export type ShiftPattern = Database["public"]["Tables"]["shift_patterns"]["Row"];
export type ShiftPatternDay = Database["public"]["Tables"]["shift_pattern_days"]["Row"];
export type EmployeeShiftPattern = Database["public"]["Tables"]["employee_shift_patterns"]["Row"];
export type Absence = Database["public"]["Tables"]["absences"]["Row"];
