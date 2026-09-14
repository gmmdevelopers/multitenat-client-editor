import { api } from "./client";

const API_URL = process.env.NEXT_PUBLIC_API_URL!; // ej: http://api.multitenant.test:3000/api

export type SaveEditorPayload = {
  blocks: unknown[];
};

