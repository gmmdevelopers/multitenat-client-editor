import type { Patient } from "@/types";
import type { PaginatedResponse, PaginationQuery } from "./common";

export interface ListPatientsQuery extends PaginationQuery {
  q?: string;
  isActive?: boolean;
}

export type ListPatientsResponse = PaginatedResponse<Patient>;

export interface CreatePatientRequest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

export interface CreatePatientResponse {
  patient: Patient;
}

export type UpdatePatientRequest = Partial<CreatePatientRequest> & {
  isActive?: boolean;
};

export interface UpdatePatientResponse {
  patient: Patient;
}
