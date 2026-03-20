const DEFAULT_FALLBACK_TIMESTAMP = new Date('2015-01-01T00:00:00.000Z').getTime();

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function normalizeTimestamp(input: unknown): number {
  if (input instanceof Date) {
    return input.getTime();
  }

  if (typeof input === 'number') {
    if (input <= 0) return DEFAULT_FALLBACK_TIMESTAMP;
    return input < 1_000_000_000_000 ? input * 1000 : input;
  }

  if (typeof input === 'string') {
    const numeric = Number(input);
    if (!Number.isNaN(numeric) && numeric > 0) {
      return normalizeTimestamp(numeric);
    }

    const parsed = Date.parse(input);
    return Number.isNaN(parsed) ? DEFAULT_FALLBACK_TIMESTAMP : parsed;
  }

  return DEFAULT_FALLBACK_TIMESTAMP;
}

export function formatDate(timestamp: number): string {
  return new Date(normalizeTimestamp(timestamp)).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    // hour: '2-digit',
    // minute: '2-digit',
  });
}

export function formatSectionDate(timestamp: number): string {
  return new Date(normalizeTimestamp(timestamp)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateLabel(timestamp: number): string {
  return new Date(normalizeTimestamp(timestamp)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
