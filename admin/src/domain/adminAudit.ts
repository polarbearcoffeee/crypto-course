export type AuditResult = "success" | "denied" | "failure";

export type AuditSnapshot =
  | null
  | boolean
  | number
  | string
  | readonly AuditSnapshot[]
  | Readonly<{ [key: string]: AuditSnapshot | undefined }>;

export type AdministrativeAuditInput = Readonly<{
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  requestId: string;
  result: AuditResult;
  before: AuditSnapshot;
  after: AuditSnapshot;
}>;

export type AdministrativeAuditEvent = AdministrativeAuditInput &
  Readonly<{
    eventId: string;
    occurredAt: string;
  }>;

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function immutableClone<T>(value: T): T {
  const clone = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item === null || typeof item !== "object" || Object.isFrozen(item)) {
      return;
    }
    Object.freeze(item);
    for (const child of Object.values(item)) freeze(child);
  };
  freeze(clone);
  return clone;
}

/**
 * Append-only administrative audit storage.
 *
 * The interface intentionally exposes no update or delete operation. Production
 * adapters should map `append` to storage rules that also deny mutations.
 */
export class ImmutableAdminAuditLog {
  readonly #events: AdministrativeAuditEvent[] = [];
  readonly #requestIds = new Set<string>();

  constructor(
    private readonly now: () => string,
    private readonly createEventId: () => string,
  ) {}

  record(input: AdministrativeAuditInput): AdministrativeAuditEvent {
    return this.append(input);
  }

  append(input: AdministrativeAuditInput): AdministrativeAuditEvent {
    const requestId = requireText(input.requestId, "Request ID");
    if (this.#requestIds.has(requestId)) {
      throw new Error("Request ID has already been audited.");
    }

    const event = immutableClone<AdministrativeAuditEvent>({
      eventId: requireText(this.createEventId(), "Event ID"),
      occurredAt: requireText(this.now(), "Audit timestamp"),
      actorId: requireText(input.actorId, "Actor ID"),
      action: requireText(input.action, "Action"),
      targetType: requireText(input.targetType, "Target type"),
      targetId: requireText(input.targetId, "Target ID"),
      reason: requireText(input.reason, "Reason"),
      requestId,
      result: input.result,
      before: input.before,
      after: input.after,
    });

    this.#events.push(event);
    this.#requestIds.add(requestId);
    return event;
  }

  list(): readonly AdministrativeAuditEvent[] {
    return immutableClone(this.#events);
  }

  findByRequestId(requestId: string): AdministrativeAuditEvent | undefined {
    const event = this.#events.find((item) => item.requestId === requestId);
    return event ? immutableClone(event) : undefined;
  }
}
