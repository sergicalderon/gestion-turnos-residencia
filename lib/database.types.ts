export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type ShiftAssignmentSource = "manual" | "pattern" | "absence" | "swap";
export type ShiftSwapStatus = "pending" | "approved" | "rejected" | "cancelled";

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          name: string;
          category: string;
          department_id: string | null;
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
          category?: string;
          department_id?: string | null;
          workday_percentage?: number;
          start_date: string;
          end_date?: string | null;
          active?: boolean;
          annual_target_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          }
        ];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
        Relationships: [];
      };
      user_departments: {
        Row: {
          id: string;
          user_id: string;
          department_id: string;
          role: "admin" | "coordinator" | "viewer";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          department_id: string;
          role?: "admin" | "coordinator" | "viewer";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_departments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          }
        ];
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
          department_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          computable_hours?: number;
          color?: string;
          department_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shift_types"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "shift_types_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          }
        ];
      };
      shift_assignments: {
        Row: {
          id: string;
          employee_id: string;
          date: string;
          shift_type_id: string;
          source: ShiftAssignmentSource;
          source_id: string | null;
          employee_shift_pattern_id: string | null;
          generated_at: string | null;
          updated_by_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          date: string;
          shift_type_id: string;
          source?: ShiftAssignmentSource;
          source_id?: string | null;
          employee_shift_pattern_id?: string | null;
          generated_at?: string | null;
          updated_by_user_id?: string | null;
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
      shift_swaps: {
        Row: {
          id: string;
          employee_a_id: string;
          employee_b_id: string;
          employee_a_original_date: string;
          employee_b_original_date: string;
          employee_a_original_shift_id: string;
          employee_b_original_shift_id: string;
          employee_a_new_shift_id: string;
          employee_b_new_shift_id: string;
          employee_a_previous_source: ShiftAssignmentSource;
          employee_a_previous_source_id: string | null;
          employee_b_previous_source: ShiftAssignmentSource;
          employee_b_previous_source_id: string | null;
          status: ShiftSwapStatus;
          reason: string | null;
          requested_by_user_id: string | null;
          approved_by_user_id: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_a_id: string;
          employee_b_id: string;
          employee_a_original_date: string;
          employee_b_original_date: string;
          employee_a_original_shift_id: string;
          employee_b_original_shift_id: string;
          employee_a_new_shift_id: string;
          employee_b_new_shift_id: string;
          employee_a_previous_source: ShiftAssignmentSource;
          employee_a_previous_source_id?: string | null;
          employee_b_previous_source: ShiftAssignmentSource;
          employee_b_previous_source_id?: string | null;
          status?: ShiftSwapStatus;
          reason?: string | null;
          requested_by_user_id?: string | null;
          approved_by_user_id?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shift_swaps"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "shift_swaps_employee_a_id_fkey";
            columns: ["employee_a_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_swaps_employee_b_id_fkey";
            columns: ["employee_b_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_swaps_employee_a_original_shift_id_fkey";
            columns: ["employee_a_original_shift_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_swaps_employee_b_original_shift_id_fkey";
            columns: ["employee_b_original_shift_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_swaps_employee_a_new_shift_id_fkey";
            columns: ["employee_a_new_shift_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_swaps_employee_b_new_shift_id_fkey";
            columns: ["employee_b_new_shift_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id"];
          }
        ];
      };
      department_shift_coverage_rules: {
        Row: {
          id: string;
          department_id: string;
          shift_type_id: string;
          day_of_week: number | null;
          min_required: number;
          max_allowed: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          department_id: string;
          shift_type_id: string;
          day_of_week?: number | null;
          min_required?: number;
          max_allowed?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["department_shift_coverage_rules"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "department_shift_coverage_rules_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "department_shift_coverage_rules_shift_type_id_fkey";
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
          department_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          is_active?: boolean;
          department_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shift_patterns"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "shift_patterns_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          }
        ];
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
    Functions: {
      register_approved_shift_swap: {
        Args: {
          p_employee_a_id: string;
          p_employee_a_date: string;
          p_employee_b_id: string;
          p_employee_b_date: string;
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["shift_swaps"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type UserDepartment = Database["public"]["Tables"]["user_departments"]["Row"];
export type EmployeeWorkloadPeriod = Database["public"]["Tables"]["employee_workload_periods"]["Row"];
export type ShiftType = Database["public"]["Tables"]["shift_types"]["Row"];
export type ShiftAssignment = Database["public"]["Tables"]["shift_assignments"]["Row"];
export type ShiftSwap = Database["public"]["Tables"]["shift_swaps"]["Row"];
export type DepartmentShiftCoverageRule = Database["public"]["Tables"]["department_shift_coverage_rules"]["Row"];
export type ShiftPattern = Database["public"]["Tables"]["shift_patterns"]["Row"];
export type ShiftPatternDay = Database["public"]["Tables"]["shift_pattern_days"]["Row"];
export type EmployeeShiftPattern = Database["public"]["Tables"]["employee_shift_patterns"]["Row"];
export type Absence = Database["public"]["Tables"]["absences"]["Row"];
