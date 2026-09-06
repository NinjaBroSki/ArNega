/**
 * Minimal native menu — enough for standard macOS behavior (Cmd+C on
 * selected answer text, Cmd+Q, Cmd+, for Settings) without any clutter.
 */
import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import { openSettingsWindow, showOverlay } from './windows.js';

export function installAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'CommandOrControl+,',
          click: () => openSettingsWindow(),
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Show ArNega',
          accelerator: 'CommandOrControl+Shift+O',
          click: () => showOverlay(),
        },
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
