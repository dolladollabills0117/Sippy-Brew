"use client";
import { createApiClient } from "@sippy/core/api";

/** Same typed client the mobile apps use. On the web, the session cookie authenticates. */
export const api = createApiClient({ baseUrl: "" });
export { ApiError } from "@sippy/core/api";
