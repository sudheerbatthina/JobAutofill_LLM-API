import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getProfile, getResume } from '@/lib/profile/storage';
import './App.css';

function App() {
  const [name, setName] = useState<string>('');
  const [hasResume, setHasResume] = useState(false);
  const [filling, setFilling] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getProfile().then((p) => setName([p.personal.firstName, p.personal.lastName].join(' ').trim()));
    getResume().then((r) => setHasResume(!!r));
  }, []);

  const openOptions = () => browser.runtime.openOptionsPage();

  const fillAll = async () => {
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

  return (
    <div className="popup">
      <h1>Autofill</h1>
      <p className="who">{name ? `Profile: ${name}` : 'No profile set up yet'}</p>
      <p className="who">{hasResume ? 'Resume: ✓ uploaded' : 'Resume: none'}</p>

      <button className="primary" onClick={fillAll} disabled={filling}>
        {filling ? 'Filling…' : 'Fill all on this page'}
      </button>
      <button className="secondary" onClick={openOptions}>
        Edit profile & settings
      </button>

      {msg && <p className="msg">{msg}</p>}
      <p className="hint">
        Or click the inline ⚡ icon next to any field to fill just that one. Nothing is ever
        submitted automatically.
      </p>
    </div>
  );
}

export default App;
