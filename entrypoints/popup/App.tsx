import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import {
  getProfile,
  getResume,
  getSettings,
  setSettings,
  type Settings,
} from '@/lib/profile/storage';
import './App.css';

function App() {
  const [name, setName] = useState<string>('');
  const [hasResume, setHasResume] = useState(false);
  const [settings, setPopupSettings] = useState<Settings | null>(null);
  const [filling, setFilling] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getProfile().then((p) =>
      setName(
        [p.personal.firstName, p.personal.middleName, p.personal.lastName]
          .filter(Boolean)
          .join(' ')
          .trim(),
      ),
    );
    getResume().then((r) => setHasResume(!!r));
    getSettings().then(setPopupSettings);
  }, []);

  const openOptions = () => browser.runtime.openOptionsPage();

  const fillAll = async () => {
    if (!settings?.autofillEnabled) {
      setMsg('Autofill is turned off.');
      return;
    }

    setFilling(true);
    setMsg('');
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const res = (await browser.tabs.sendMessage(tab.id, { type: 'FILL_ALL' })) as {
        filled?: number;
      };
      setMsg(res?.filled != null ? `Filled ${res.filled} field(s)` : 'Done');
    } catch (e) {
      setMsg('No fillable form detected on this page.');
    } finally {
      setFilling(false);
    }
  };

  const toggleAutofill = async () => {
    if (!settings) return;
    const next = { ...settings, autofillEnabled: !settings.autofillEnabled };
    setPopupSettings(next);
    await setSettings(next);
    setMsg(next.autofillEnabled ? 'Autofill turned on.' : 'Autofill turned off.');
  };

  const enabled = settings?.autofillEnabled ?? true;

  return (
    <div className="popup">
      <h1>Autofill</h1>
      <p className="who">{name ? `Profile: ${name}` : 'No profile set up yet'}</p>
      <p className="who">{hasResume ? 'Resume: uploaded' : 'Resume: none'}</p>

      <button
        className={`toggle ${enabled ? 'on' : 'off'}`}
        onClick={toggleAutofill}
        disabled={!settings}
      >
        <span>{enabled ? 'Autofill on' : 'Autofill off'}</span>
        <strong>{enabled ? 'Turn off' : 'Turn on'}</strong>
      </button>

      <button className="primary" onClick={fillAll} disabled={filling || !enabled}>
        {filling ? 'Filling...' : 'Fill all on this page'}
      </button>
      <button className="secondary" onClick={openOptions}>
        Edit profile & settings
      </button>

      {msg && <p className="msg">{msg}</p>}
      <p className="hint">
        {enabled
          ? 'Or click the inline icon next to any field to fill just that one. Nothing is ever submitted automatically.'
          : 'Inline icons are hidden while autofill is off.'}
      </p>
    </div>
  );
}

export default App;
