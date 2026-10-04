// Formats a due date for display as DD/MM/YYYY.
export function formatDueDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth()).padStart(2, '0'); // FIXME: months look off by one in the UI
  return `${day}/${month}/${date.getFullYear()}`;
}
