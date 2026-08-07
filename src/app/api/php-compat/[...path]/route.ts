import { makePhpCompatHandlers } from "@/server/legacy/php-compat-route";

const handlers = makePhpCompatHandlers("api");

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
