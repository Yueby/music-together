// Generated from sdk/src by tools/build-sdk.ts.
import type { AppQuery } from "./types.js";
export interface NotificationTemplate {
    title: string;
    body: string;
    /** Review examples; never substituted into a real delivery. */
    examples?: Record<string, string>;
}
export type NotificationTemplates = Record<string, NotificationTemplate>;
export interface NotificationRequest {
    mode: "frontend" | "backend";
    /** Reason for requesting permission. */
    reason: string;
    /** Optional scheduled delivery as Unix epoch milliseconds, for frontend mode only. */
    at?: number;
    params?: Record<string, string>;
    query?: AppQuery;
}
export type NotificationPermit = {
    mode: "frontend";
    expiresAt: number;
    scheduledAt: number;
} | {
    mode: "backend";
    token: string;
    expiresAt: number;
    deliveryUrl: string;
};
export declare const NOTIFICATION_RENDER_BYTES: number;
export declare function validNotificationId(value: unknown): value is string;
/** Unique variables in title/body order, including the platform-owned app_name. */
export declare function notificationVariables(template: Pick<NotificationTemplate, "title" | "body">): string[];
export declare function validateNotificationParams(template: NotificationTemplate, value: unknown, { requireAll, maxBytes, }?: {
    requireAll?: boolean;
    maxBytes?: number;
}): Record<string, string>;
export declare function validateNotificationTemplates(value: unknown, permissions: readonly string[]): NotificationTemplates;
/** Returns plain text, with one substitution pass and a preflighted UTF-8 output budget. */
export declare function renderNotificationTemplate(template: NotificationTemplate, { appName, params, allowMissing, maxBytes, }: {
    appName: string;
    params?: Record<string, string>;
    allowMissing?: boolean;
    maxBytes?: number;
}): {
    title: string;
    body: string;
};
/** Examples are only a preview fallback; absent values remain visibly unresolved. */
export declare function previewNotificationTemplate(template: NotificationTemplate, options: {
    appName: string;
    params?: Record<string, string>;
    maxBytes?: number;
}): {
    title: string;
    body: string;
};
export declare function normalizeNotificationRequest(value: unknown, { templates, appName, maxBytes, }: {
    templates: NotificationTemplates;
    appName: string;
    maxBytes?: number;
}): {
    template_id: string;
    mode: "frontend" | "backend";
    reason: string;
    at?: number;
    params: Record<string, string>;
    query: Record<string, string[]>;
};
