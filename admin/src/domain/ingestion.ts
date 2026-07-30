import { z } from "zod";
import {
  EVENT_SCHEMA_VERSION,
  eventPropertySchemas,
  learningEventSchema,
  METRIC_DEFINITION_VERSION,
  type LearningEvent,
} from "./events";

const idSchema = z.string().trim().min(1).max(128);
const dateTimeSchema = z.string().datetime({ offset: true });

export const authenticationContextSchema = z
  .object({
    actorId: idSchema,
    learnerId: idSchema,
    source: z.enum(["learner-web", "admin", "migration", "system"]),
  })
  .strict();

const eventVariants = Object.entries(eventPropertySchemas).map(
  ([type, properties]) =>
    z
      .object({
        type: z.literal(type),
        occurredAt: dateTimeSchema,
        schemaVersion: z.literal(EVENT_SCHEMA_VERSION),
        metricDefinitionVersion: z.literal(METRIC_DEFINITION_VERSION),
        idempotencyKey: idSchema,
        properties,
      })
      .strict(),
);

export const eventIngestionPayloadSchema = z.discriminatedUnion(
  "type",
  eventVariants as [
    (typeof eventVariants)[number],
    (typeof eventVariants)[number],
    ...(typeof eventVariants)[number][],
  ],
);

export type AuthenticationContext = z.infer<
  typeof authenticationContextSchema
>;

export function validateTrustedWrite<T>(
  schema: z.ZodType<T>,
  input: unknown,
): T {
  return schema.parse(input);
}

function stableEventId(context: AuthenticationContext, key: string): string {
  const identity = `${context.source}\u0000${context.actorId}\u0000${context.learnerId}\u0000${key}`;
  let hash = 0x811c9dc5;

  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `event-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function ingestLearningEvent(
  input: unknown,
  authentication: unknown,
  serverNow: Date = new Date(),
): LearningEvent {
  const context = validateTrustedWrite(
    authenticationContextSchema,
    authentication,
  );
  const payload = validateTrustedWrite(eventIngestionPayloadSchema, input);

  if (Number.isNaN(serverNow.getTime())) {
    throw new Error("Server timestamp must be a valid Date.");
  }

  return validateTrustedWrite(learningEventSchema, {
    ...payload,
    eventId: stableEventId(context, payload.idempotencyKey),
    learnerId: context.learnerId,
    source: context.source,
    receivedAt: serverNow.toISOString(),
  });
}
