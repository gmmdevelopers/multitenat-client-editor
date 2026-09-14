// src/types/api/appointments.ts
import type { Appointment, AppointmentWithRelations } from "@/types";
import type { AppointmentStatus } from "@/types/enums";
import type { PaginatedResponse, PaginationQuery } from "./common";

export interface ListAppointmentsQuery extends PaginationQuery {
  status?: AppointmentStatus;
  professionalId?: string;
  patientId?: string;
  from?: string; // ISO date
  to?: string; // ISO date
}

export type ListAppointmentsResponse =
  PaginatedResponse<AppointmentWithRelations>;

export interface CreateAppointmentRequest {
  patientId: string;
  professionalId: string;
  boxId: string;
  startsAt: string;
  endsAt: string;
  status?: AppointmentStatus;
}

export interface CreateAppointmentResponse {
  appointment: Appointment;
}

export interface UpdateAppointmentRequest {
  startsAt?: string;
  endsAt?: string;
  status?: AppointmentStatus;
  professionalId?: string;
  boxId?: string;
}

export interface UpdateAppointmentResponse {
  appointment: Appointment;
}

export type CancelAppointmentResponse = UpdateAppointmentResponse;
