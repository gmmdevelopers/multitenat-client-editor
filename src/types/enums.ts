export const AppointmentStatus = {
  draft: "draft",
  held: "held",
  pending_payment: "pending_payment",
  confirmed: "confirmed",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "no_show",
  failed_payment: "failed_payment",
} as const;

export type AppointmentStatus =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const AdminRole = {
  owner: "owner",
  admin: "admin",
  receptionist: "receptionist",
} as const;

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];
