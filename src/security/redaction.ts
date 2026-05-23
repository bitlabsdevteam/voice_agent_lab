const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;

export function redactSensitiveText(input: string): string {
  return input
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(CARD_PATTERN, "[REDACTED_CARD]");
}

export function containsSensitiveText(input: string): boolean {
  return EMAIL_PATTERN.test(input) || PHONE_PATTERN.test(input) || CARD_PATTERN.test(input);
}
