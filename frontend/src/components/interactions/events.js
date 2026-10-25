export const CONTEXT_EVENT = 'cyberdna:context-menu';
export const PALETTE_EVENT = 'cyberdna:command-palette';
export const openContextMenu = (event, type, item) => {
  event.preventDefault();
  window.dispatchEvent(new CustomEvent(CONTEXT_EVENT, { detail: { type, item, x: event.clientX, y: event.clientY } }));
};
export const requestCommandPalette = () => window.dispatchEvent(new CustomEvent(PALETTE_EVENT));

export const NOTEBOOK_INSERT_EVENT = 'cyberdna:notebook-insert';
export const NOTEBOOK_OPEN_EVENT = 'cyberdna:notebook-open';
