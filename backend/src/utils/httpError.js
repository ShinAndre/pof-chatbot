export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value, field) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(400, `Il campo "${field}" deve essere un UUID valido`);
  }
  return value.toLowerCase();
}
