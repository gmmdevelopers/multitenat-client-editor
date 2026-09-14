import type { AppointmentStatus } from "./enums";
import type { Patient } from "./patient";
import type { Professional } from "./patient";
import type { Box } from "./patient";

export interface Appointment {
  id: string;
  tenantId: string;
  patientId: string;
  professionalId: string;
  boxId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentWithRelations extends Appointment {
  patient: Patient;
  professional: Professional;
  box: Box;
}
