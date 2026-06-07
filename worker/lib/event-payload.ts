export type SesEventType =
  | 'Bounce'
  | 'Complaint'
  | 'Delivery'
  | 'Send'
  | 'Reject'
  | 'Open'
  | 'Click'
  | 'Rendering Failure'
  | 'RenderingFailure'
  | 'DeliveryDelay'
  | 'Subscription';

type SesMailTags = Record<string, string[]>;

interface SesMailCommonHeaders extends Record<string, unknown> {
  subject?: string;
}

interface SesMail extends Record<string, unknown> {
  timestamp?: string;
  messageId?: string;
  source?: string;
  destination?: string[];
  commonHeaders?: SesMailCommonHeaders;
  tags?: SesMailTags;
}

interface SesEmailAddressRecipient extends Record<string, unknown> {
  emailAddress?: string;
}

interface SesBounceRecipient extends SesEmailAddressRecipient {
  diagnosticCode?: string;
}

interface SesBounce extends Record<string, unknown> {
  bounceType?: string;
  bounceSubType?: string;
  bouncedRecipients?: SesBounceRecipient[];
  timestamp?: string;
}

interface SesComplaint extends Record<string, unknown> {
  complainedRecipients?: SesEmailAddressRecipient[];
  timestamp?: string;
  feedbackId?: string;
  complaintFeedbackType?: string;
}

interface SesDelivery extends Record<string, unknown> {
  timestamp?: string;
  recipients?: string[];
  smtpResponse?: string;
  reportingMTA?: string;
}

interface SesReject extends Record<string, unknown> {
  reason?: string;
}

interface SesRenderingFailure extends Record<string, unknown> {
  errorMessage?: string;
}

interface SesDeliveryDelay extends Record<string, unknown> {
  timestamp?: string;
  delayType?: string;
  delayedRecipients?: SesEmailAddressRecipient[];
}

interface SesSubscription extends Record<string, unknown> {
  contactList?: string;
  timestamp?: string;
}

export interface SesEventPayload {
  eventType?: SesEventType;
  notificationType?: SesEventType;
  mail?: SesMail;
  bounce?: SesBounce;
  complaint?: SesComplaint;
  delivery?: SesDelivery;
  reject?: SesReject;
  failure?: SesRenderingFailure;
  renderingFailure?: SesRenderingFailure;
  deliveryDelay?: SesDeliveryDelay;
  subscription?: SesSubscription;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const toRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const toSesEventPayload = (value: unknown): SesEventPayload => {
  const record = toRecord(value);
  return {
    eventType: toSesEventType(record.eventType),
    notificationType: toSesEventType(record.notificationType),
    mail: toSesMail(record.mail),
    bounce: toSesBounce(record.bounce),
    complaint: toSesComplaint(record.complaint),
    delivery: toSesDelivery(record.delivery),
    reject: toSesReject(record.reject),
    failure: toSesRenderingFailure(record.failure),
    renderingFailure: toSesRenderingFailure(record.renderingFailure),
    deliveryDelay: toSesDeliveryDelay(record.deliveryDelay),
    subscription: toSesSubscription(record.subscription),
  };
};

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

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const toSesEventType = (value: unknown): SesEventType | undefined => {
  const eventType = toString(value);
  switch (eventType) {
    case 'Bounce':
    case 'Complaint':
    case 'Delivery':
    case 'Send':
    case 'Reject':
    case 'Open':
    case 'Click':
    case 'Rendering Failure':
    case 'RenderingFailure':
    case 'DeliveryDelay':
    case 'Subscription': {
      return eventType;
    }
    default: {
      return undefined;
    }
  }
};

const toSesMailTags = (value: unknown): SesMailTags | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, entry]) => [key, stringArray(entry)] as const)
    .filter(([, entry]) => entry.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const toSesMailCommonHeaders = (value: unknown): SesMailCommonHeaders | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    subject: toString(value.subject),
  };
};

const toSesMail = (value: unknown): SesMail | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    timestamp: toString(value.timestamp),
    messageId: toString(value.messageId),
    source: toString(value.source),
    destination: stringArray(value.destination),
    commonHeaders: toSesMailCommonHeaders(value.commonHeaders),
    tags: toSesMailTags(value.tags),
  };
};

const toSesEmailAddressRecipient = (value: unknown): SesEmailAddressRecipient => ({
  emailAddress: toString(toRecord(value).emailAddress),
});

const toSesBounceRecipient = (value: unknown): SesBounceRecipient => {
  const record = toRecord(value);
  return {
    emailAddress: toString(record.emailAddress),
    diagnosticCode: toString(record.diagnosticCode),
  };
};

const toSesBounceRecipients = (value: unknown): SesBounceRecipient[] =>
  Array.isArray(value) ? value.map(toSesBounceRecipient) : [];

const toSesEmailAddressRecipients = (value: unknown): SesEmailAddressRecipient[] =>
  Array.isArray(value) ? value.map(toSesEmailAddressRecipient) : [];

const toSesBounce = (value: unknown): SesBounce | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    bounceType: toString(value.bounceType),
    bounceSubType: toString(value.bounceSubType),
    bouncedRecipients: toSesBounceRecipients(value.bouncedRecipients),
    timestamp: toString(value.timestamp),
  };
};

const toSesComplaint = (value: unknown): SesComplaint | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    complainedRecipients: toSesEmailAddressRecipients(value.complainedRecipients),
    timestamp: toString(value.timestamp),
    feedbackId: toString(value.feedbackId),
    complaintFeedbackType: toString(value.complaintFeedbackType),
  };
};

const toSesDelivery = (value: unknown): SesDelivery | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    timestamp: toString(value.timestamp),
    recipients: stringArray(value.recipients),
    smtpResponse: toString(value.smtpResponse),
    reportingMTA: toString(value.reportingMTA),
  };
};

const toSesReject = (value: unknown): SesReject | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return { reason: toString(value.reason) };
};

const toSesRenderingFailure = (value: unknown): SesRenderingFailure | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    errorMessage: toString(value.errorMessage),
  };
};

const toSesDeliveryDelay = (value: unknown): SesDeliveryDelay | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    timestamp: toString(value.timestamp),
    delayType: toString(value.delayType),
    delayedRecipients: toSesEmailAddressRecipients(value.delayedRecipients),
  };
};

const toSesSubscription = (value: unknown): SesSubscription | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    contactList: toString(value.contactList),
    timestamp: toString(value.timestamp),
  };
};

const emailAddressArray = (recipients: SesEmailAddressRecipient[] | undefined): string[] =>
  recipients
    ?.map((recipient) => recipient.emailAddress)
    .filter((entry): entry is string => typeof entry === 'string') ?? [];

const extractBounceDiagnostic = (bounce: SesBounce): string | null => {
  if (!bounce.bouncedRecipients) {
    return null;
  }

  for (const recipient of bounce.bouncedRecipients) {
    if (recipient.diagnosticCode) {
      return recipient.diagnosticCode;
    }
  }

  return null;
};

const extractBounceDetail = (bounce: SesBounce, storedBounceType: string | null): string | null => {
  if (bounce.bounceSubType) {
    return bounce.bounceSubType;
  }

  if (storedBounceType) {
    return storedBounceType;
  }

  if (bounce.bounceType) {
    return bounce.bounceType;
  }

  return extractBounceDiagnostic(bounce);
};

const extractBounceReason = (bounce: SesBounce, storedBounceType: string | null): string | null => {
  if (bounce.bounceSubType) {
    return bounce.bounceSubType;
  }

  if (bounce.bounceType) {
    return bounce.bounceType;
  }

  if (storedBounceType) {
    return storedBounceType;
  }

  return extractBounceDiagnostic(bounce);
};

const formatReasonLabel = (value: string | null): string => {
  if (!value) {
    return 'Unknown';
  }
  const normalized = value
    .replaceAll('_', ' ')
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return 'Unknown';
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const normalizeRecipients = (recipients: string[]): string[] => [
  ...new Set(recipients.map((recipient) => recipient.trim().toLowerCase()).filter(Boolean)),
];

export const extractDestinations = (mail: Record<string, unknown>): string[] => {
  return stringArray(toSesMail(mail)?.destination);
};

export const normalizeMailTags = (mail: Record<string, unknown>): string[] => {
  const tags = toSesMail(mail)?.tags;
  if (!tags) {
    return [];
  }

  return Object.entries(tags)
    .filter(([key]) => !key.toLowerCase().startsWith('ses:'))
    .flatMap(([key, values]) => values.map((value) => `${key}:${value}`));
};

export const extractEventDetail = (
  eventType: string,
  eventData: Record<string, unknown>,
  bounceType: string | null,
): string | null => {
  switch (eventType) {
    case 'Bounce': {
      return extractBounceDetail(toSesBounce(eventData) ?? {}, bounceType);
    }
    case 'Delivery': {
      const delivery = toSesDelivery(eventData) ?? {};
      return delivery.smtpResponse ?? delivery.reportingMTA ?? null;
    }
    case 'Complaint': {
      const complaint = toSesComplaint(eventData) ?? {};
      return complaint.complaintFeedbackType ?? complaint.feedbackId ?? null;
    }
    case 'Reject': {
      return toSesReject(eventData)?.reason ?? null;
    }
    case 'RenderingFailure': {
      return toSesRenderingFailure(eventData)?.errorMessage ?? null;
    }
    case 'DeliveryDelay': {
      return toSesDeliveryDelay(eventData)?.delayType ?? null;
    }
    case 'Subscription': {
      return toSesSubscription(eventData)?.contactList ?? null;
    }
    default: {
      return null;
    }
  }
};

export const resolveBounceReason = (
  eventData: Record<string, unknown>,
  bounceType: string | null,
): string => {
  return formatReasonLabel(extractBounceReason(toSesBounce(eventData) ?? {}, bounceType));
};

export class EventPayload {
  readonly raw: Record<string, unknown>;

  private readonly payload: SesEventPayload;

  constructor(value: unknown) {
    this.raw = toRecord(value);
    this.payload = toSesEventPayload(this.raw);
  }

  get eventType(): string {
    return this.payload.eventType ?? this.payload.notificationType ?? 'Unknown';
  }

  get mail(): SesMail {
    return this.payload.mail ?? {};
  }

  get messageId(): string {
    return toString(this.mail.messageId) ?? '';
  }

  get sourceEmail(): string | undefined {
    return toString(this.mail.source);
  }

  get subject(): string | undefined {
    return this.mail.commonHeaders?.subject;
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
        return parseDate(this.bounce.timestamp);
      }
      case 'Complaint': {
        return parseDate(this.complaint.timestamp);
      }
      case 'Delivery': {
        return parseDate(this.delivery.timestamp);
      }
      case 'DeliveryDelay': {
        return parseDate(this.deliveryDelay.timestamp);
      }
      case 'Subscription': {
        return parseDate(this.subscription.timestamp);
      }
      default: {
        return parseDate(this.mail.timestamp);
      }
    }
  }

  get recipients(): string[] {
    switch (this.eventType) {
      case 'Bounce': {
        return emailAddressArray(this.bounce.bouncedRecipients);
      }
      case 'Complaint': {
        return emailAddressArray(this.complaint.complainedRecipients);
      }
      case 'Delivery': {
        return stringArray(this.delivery.recipients);
      }
      case 'DeliveryDelay': {
        return emailAddressArray(this.deliveryDelay.delayedRecipients);
      }
      default: {
        return stringArray(this.mail.destination);
      }
    }
  }

  get eventData(): Record<string, unknown> {
    switch (this.eventType) {
      case 'Bounce': {
        return this.bounce;
      }
      case 'Complaint': {
        return this.complaint;
      }
      case 'Delivery': {
        return this.delivery;
      }
      case 'DeliveryDelay': {
        return this.deliveryDelay;
      }
      case 'RenderingFailure': {
        return this.renderingFailure;
      }
      case 'Reject': {
        return this.reject;
      }
      case 'Subscription': {
        return this.subscription;
      }
      default: {
        return {};
      }
    }
  }

  get bounceType(): string | undefined {
    return toString(this.bounce.bounceType);
  }

  private get bounce() {
    return this.payload.bounce ?? {};
  }

  private get complaint() {
    return this.payload.complaint ?? {};
  }

  private get delivery() {
    return this.payload.delivery ?? {};
  }

  private get deliveryDelay() {
    return this.payload.deliveryDelay ?? {};
  }

  private get renderingFailure() {
    return this.payload.renderingFailure ?? this.payload.failure ?? {};
  }

  private get reject() {
    return this.payload.reject ?? {};
  }

  private get subscription() {
    return this.payload.subscription ?? {};
  }
}
