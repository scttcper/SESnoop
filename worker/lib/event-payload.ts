type RawEventPayload = Record<string, unknown>;

const toString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
};

const parseDate = (value: unknown): Date => {
  const asString = toString(value);
  if (asString) {
    const parsed = new Date(asString);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

export class EventPayload {
  constructor(readonly raw: RawEventPayload) {}

  get eventType(): string {
    return toString(this.raw.eventType) ?? 'Unknown';
  }

  get mail(): Record<string, unknown> {
    const mail = this.raw.mail;
    return typeof mail === 'object' && mail ? (mail as Record<string, unknown>) : {};
  }

  get messageId(): string {
    return toString(this.mail.messageId) ?? '';
  }

  get sourceEmail(): string | undefined {
    return toString(this.mail.source);
  }

  get subject(): string | undefined {
    const headers = this.mail.commonHeaders;
    if (typeof headers === 'object' && headers) {
      return toString((headers as Record<string, unknown>).subject);
    }
    return undefined;
  }

  get sentAt(): Date | null {
    const timestamp = this.mail.timestamp;
    if (timestamp) {
      return parseDate(timestamp);
    }
    return null;
  }

  get timestamp(): Date {
    switch (this.eventType) {
      case 'Bounce': {
        return parseDate(this.bounce?.timestamp);
      }
      case 'Complaint': {
        return parseDate(this.complaint?.timestamp);
      }
      case 'Delivery': {
        return parseDate(this.delivery?.timestamp);
      }
      case 'DeliveryDelay': {
        return parseDate(this.deliveryDelay?.timestamp);
      }
      case 'Subscription': {
        return parseDate(this.subscription?.timestamp);
      }
      default: {
        return parseDate(this.mail.timestamp);
      }
    }
  }

  get recipients(): string[] {
    switch (this.eventType) {
      case 'Bounce': {
        return (
          this.bounce?.bouncedRecipients
            ?.map((recipient) => recipient?.emailAddress)
            .filter((value): value is string => typeof value === 'string') ?? []
        );
      }
      case 'Complaint': {
        return (
          this.complaint?.complainedRecipients
            ?.map((recipient) => recipient?.emailAddress)
            .filter((value): value is string => typeof value === 'string') ?? []
        );
      }
      case 'Delivery': {
        return (this.delivery?.recipients ?? []).filter(
          (value): value is string => typeof value === 'string',
        );
      }
      case 'DeliveryDelay': {
        return (
          this.deliveryDelay?.delayedRecipients
            ?.map((recipient) => recipient?.emailAddress)
            .filter((value): value is string => typeof value === 'string') ?? []
        );
      }
      default: {
        return (Array.isArray(this.mail.destination) ? this.mail.destination : []).filter(
          (value): value is string => typeof value === 'string',
        );
      }
    }
  }

  get eventData(): Record<string, unknown> {
    switch (this.eventType) {
      case 'Bounce': {
        return this.bounce ?? {};
      }
      case 'Complaint': {
        return this.complaint ?? {};
      }
      case 'Delivery': {
        return this.delivery ?? {};
      }
      case 'DeliveryDelay': {
        return this.deliveryDelay ?? {};
      }
      case 'RenderingFailure': {
        return this.renderingFailure ?? {};
      }
      case 'Reject': {
        return this.reject ?? {};
      }
      case 'Subscription': {
        return this.subscription ?? {};
      }
      default: {
        return {};
      }
    }
  }

  get bounceType(): string | undefined {
    const bounceType = this.bounce?.bounceType;
    return typeof bounceType === 'string' ? bounceType : undefined;
  }

  private get bounce() {
    return this.raw.bounce as
      | {
          bounceType?: unknown;
          timestamp?: unknown;
          bouncedRecipients?: Array<{ emailAddress?: unknown }>;
        }
      | undefined;
  }

  private get complaint() {
    return this.raw.complaint as
      | {
          timestamp?: unknown;
          complainedRecipients?: Array<{ emailAddress?: unknown }>;
        }
      | undefined;
  }

  private get delivery() {
    return this.raw.delivery as { timestamp?: unknown; recipients?: unknown[] } | undefined;
  }

  private get deliveryDelay() {
    return this.raw.deliveryDelay as
      | {
          timestamp?: unknown;
          delayedRecipients?: Array<{ emailAddress?: unknown }>;
        }
      | undefined;
  }

  private get renderingFailure() {
    return (
      (this.raw.renderingFailure as Record<string, unknown> | undefined) ??
      (this.raw.failure as Record<string, unknown> | undefined)
    );
  }

  private get reject() {
    return this.raw.reject as Record<string, unknown> | undefined;
  }

  private get subscription() {
    return this.raw.subscription as { timestamp?: unknown } | undefined;
  }
}
