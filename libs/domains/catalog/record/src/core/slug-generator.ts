export function generateSlug(text: string): string {
  return text
  .toLowerCase()                 // Convert to lowercase
  .trim()                        // Remove leading/trailing spaces
  .replace(/[^a-z0-9\s-]/g, '')  // Remove invalid chars
  .replace(/\s+/g, '-')          // Replace spaces with -
  .replace(/-+/g, '-');
}