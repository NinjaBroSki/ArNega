import { OverlayApp } from './overlay/OverlayApp';
import { SettingsApp } from './settings/SettingsApp';

export type View = 'overlay' | 'settings';

export function currentView(): View {
  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'settings' ? 'settings' : 'overlay';
}

export function App(): React.JSX.Element {
  const view = currentView();
  return view === 'settings' ? <SettingsApp /> : <OverlayApp />;
}
