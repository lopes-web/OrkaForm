const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function normalizeSlug(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 64);

  return slug || 'novo-formulario';
}

export function publicFormPath(form: { id: string; slug?: string }): string {
  return `/${form.slug || form.id}`;
}

export function publicFormUrl(form: { id: string; slug?: string }): string {
  return `${window.location.origin}${publicFormPath(form)}`;
}
