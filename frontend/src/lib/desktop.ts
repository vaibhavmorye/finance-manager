/** True when running inside the Tauri desktop shell. */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
