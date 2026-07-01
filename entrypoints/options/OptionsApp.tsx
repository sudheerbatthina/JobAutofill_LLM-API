import React from 'react';
import {
  getProfile,
  setProfile as saveProfile,
  getSettings,
  setSettings as saveSettings,
  getResume,
  setResume,
  type Settings,
  type ResumeFile,
} from '@/lib/profile/storage';
import {
  emptyProfile,
  ProfileSchema,
  type Profile,
  type Education,
  type Experience,
} from '@/lib/profile/schema';
import { extractPdfText } from '@/lib/profile/resumeText';
import type { StructureResumeResponse } from '@/lib/llm/messaging';
import { browser } from 'wxt/browser';
import { Text, Area, TriState, Chips, Suggest } from './fields';

function update<T>(obj: T, patch: Partial<T>): T {
  return { ...obj, ...patch };
}

const emptyEducation: Education = {
  school: '',
  degree: '',
  field: '',
  startDate: '',
  endDate: '',
  gpa: '',
};
const emptyExperience: Experience = {
  company: '',
  title: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
};

export function OptionsApp() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [resume, setResumeState] = React.useState<ResumeFile | null>(null);
  const [pendingResume, setPendingResume] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState('');
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    Promise.all([getProfile(), getSettings(), getResume()]).then(([p, s, r]) => {
      setProfile(p);
      setSettings(s);
      setResumeState(r);
    });
  }, []);

  if (!profile || !settings) {
    return (
      <div className="wrap">
        <p className="sub">Loading…</p>
      </div>
    );
  }

  const mut = (patch: Partial<Profile>) => {
    setProfile((p) => (p ? update(p, patch) : p));
    setDirty(true);
  };

  const save = async () => {
    await saveProfile(profile);
    await saveSettings(settings);
    setDirty(false);
    setStatus('Saved ✓');
    setTimeout(() => setStatus(''), 2000);
  };

  const onResumeUpload = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const record: ResumeFile = {
      name: file.name,
      type: file.type,
      dataUrl,
      size: file.size,
      addedAt: Date.now(),
    };
    await setResume(record);
    setResumeState(record);
    setStatus(`Resume "${file.name}" saved ✓`);
    setTimeout(() => setStatus(''), 2500);
  };

  /** Parse the uploaded PDF locally, then ask Claude to structure it into the
   * profile. Only fields with extracted values overwrite the current profile. */
  const parseResumeIntoProfile = async (file: File) => {
    setStatus('Reading PDF…');
    let text: string;
    try {
      text = await extractPdfText(file);
    } catch (e) {
      setStatus(`Could not read PDF: ${(e as Error).message}`);
      return;
    }
    setStatus('Asking Claude to structure your resume…');
    let res: StructureResumeResponse;
    try {
      res = (await browser.runtime.sendMessage({
        type: 'CLAUDE_STRUCTURE_RESUME',
        resumeText: text,
      })) as StructureResumeResponse;
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
      return;
    }
    if (!res?.ok || !res.profile) {
      setStatus(`Claude error: ${res?.error ?? 'failed'}`);
      return;
    }
    // Merge: keep existing user-entered work-auth/eeo; overwrite the rest.
    const merged = ProfileSchema.parse({
      ...profile,
      ...res.profile,
      personal: { ...profile.personal, ...res.profile.personal },
      links: { ...profile.links, ...res.profile.links },
      workAuth: profile.workAuth,
      eeo: profile.eeo,
    });
    setProfile(merged);
    setDirty(true);
    setStatus('Profile filled from resume ✓ — review and Save');
    setTimeout(() => setStatus(''), 4000);
  };

  return (
    <div className="wrap">
      <h1>Autofill — Profile & Settings</h1>
      <p className="sub">
        This data stays on your machine (Chrome local storage). It is used to fill job
        application forms. Nothing is uploaded except optional Claude calls you trigger
        explicitly.
      </p>

      {/* Personal */}
      <section className="card">
        <h2>👤 Personal</h2>
        <div className="grid">
          <Text
            label="First name"
            value={profile.personal.firstName}
            onChange={(v) => mut({ personal: update(profile.personal, { firstName: v }) })}
          />
          <Text
            label="Last name"
            value={profile.personal.lastName}
            onChange={(v) => mut({ personal: update(profile.personal, { lastName: v }) })}
          />
          <Text
            label="Email"
            type="email"
            value={profile.personal.email}
            onChange={(v) => mut({ personal: update(profile.personal, { email: v }) })}
          />
          <Text
            label="Phone"
            value={profile.personal.phone}
            onChange={(v) => mut({ personal: update(profile.personal, { phone: v }) })}
          />
          <Text
            label="Address"
            full
            value={profile.personal.addressLine1}
            onChange={(v) => mut({ personal: update(profile.personal, { addressLine1: v }) })}
          />
          <Text
            label="City"
            value={profile.personal.city}
            onChange={(v) => mut({ personal: update(profile.personal, { city: v }) })}
          />
          <Text
            label="State"
            value={profile.personal.state}
            onChange={(v) => mut({ personal: update(profile.personal, { state: v }) })}
          />
          <Text
            label="Zip / Postal code"
            value={profile.personal.zip}
            onChange={(v) => mut({ personal: update(profile.personal, { zip: v }) })}
          />
          <Text
            label="Country"
            value={profile.personal.country}
            onChange={(v) => mut({ personal: update(profile.personal, { country: v }) })}
          />
        </div>
      </section>

      {/* Links */}
      <section className="card">
        <h2>🔗 Links</h2>
        <div className="grid">
          <Text
            label="LinkedIn"
            value={profile.links.linkedin}
            onChange={(v) => mut({ links: update(profile.links, { linkedin: v }) })}
          />
          <Text
            label="GitHub"
            value={profile.links.github}
            onChange={(v) => mut({ links: update(profile.links, { github: v }) })}
          />
          <Text
            label="Portfolio"
            value={profile.links.portfolio}
            onChange={(v) => mut({ links: update(profile.links, { portfolio: v }) })}
          />
          <Text
            label="Website"
            value={profile.links.website}
            onChange={(v) => mut({ links: update(profile.links, { website: v }) })}
          />
        </div>
      </section>

      {/* Work authorization */}
      <section className="card">
        <h2>🛂 Work Authorization</h2>
        <div className="grid">
          <TriState
            label="Authorized to work in the US?"
            value={profile.workAuth.authorizedToWorkUS}
            onChange={(v) => mut({ workAuth: update(profile.workAuth, { authorizedToWorkUS: v }) })}
          />
          <TriState
            label="Will you require sponsorship?"
            value={profile.workAuth.requireSponsorship}
            onChange={(v) => mut({ workAuth: update(profile.workAuth, { requireSponsorship: v }) })}
          />
          <Text
            label="Visa status (free text)"
            full
            placeholder="US Citizen / Green Card / F-1 OPT / H-1B …"
            value={profile.workAuth.visaStatus}
            onChange={(v) => mut({ workAuth: update(profile.workAuth, { visaStatus: v }) })}
          />
        </div>
      </section>

      {/* EEO / Demographic */}
      <section className="card">
        <h2>🏳️ EEO & Demographic</h2>
        <p className="hint">
          These questions appear on almost every US application. Your answers are stored locally
          and filled automatically. All fields are voluntary — leave blank to skip.
        </p>
        <div className="grid">
          <Suggest
            label="Gender"
            value={profile.eeo.gender}
            onChange={(v) => mut({ eeo: update(profile.eeo, { gender: v }) })}
            options={['Man', 'Woman', 'Non-binary', 'I prefer to self-describe', "I don't wish to answer"]}
          />
          <Suggest
            label="Pronouns"
            value={profile.eeo.pronouns}
            onChange={(v) => mut({ eeo: update(profile.eeo, { pronouns: v }) })}
            options={['He/Him', 'She/Her', 'They/Them', 'Ze/Hir', 'I prefer not to say']}
          />
          <Suggest
            label="Are you Hispanic or Latino?"
            value={profile.eeo.hispanicLatino}
            onChange={(v) => mut({ eeo: update(profile.eeo, { hispanicLatino: v }) })}
            options={['Yes', 'No', 'Decline to self-identify']}
          />
          <Suggest
            label="Race / Ethnicity"
            full
            value={profile.eeo.race}
            onChange={(v) => mut({ eeo: update(profile.eeo, { race: v }) })}
            options={[
              'White',
              'Black or African American',
              'Asian',
              'Hispanic or Latino',
              'American Indian or Alaskan Native',
              'Native Hawaiian or Other Pacific Islander',
              'Two or more races',
              'Decline to self-identify',
            ]}
          />
          <Suggest
            label="Veteran status"
            full
            value={profile.eeo.veteranStatus}
            onChange={(v) => mut({ eeo: update(profile.eeo, { veteranStatus: v }) })}
            options={[
              'I am not a protected veteran',
              'I am a protected veteran',
              "I don't wish to answer",
            ]}
          />
          <Suggest
            label="Disability status"
            full
            value={profile.eeo.disabilityStatus}
            onChange={(v) => mut({ eeo: update(profile.eeo, { disabilityStatus: v }) })}
            options={[
              "No, I don't have a disability",
              'Yes, I have a disability',
              "I don't wish to answer",
            ]}
          />
        </div>
      </section>

      {/* Education */}
      <RepeatSection<Education>
        title="🎓 Education"
        items={profile.education}
        empty={emptyEducation}
        onChange={(items) => mut({ education: items })}
        render={(edu, set) => (
          <div className="grid">
            <Text label="School" value={edu.school} onChange={(v) => set({ school: v })} />
            <Text label="Degree" value={edu.degree} onChange={(v) => set({ degree: v })} />
            <Text label="Field of study" value={edu.field} onChange={(v) => set({ field: v })} />
            <Text label="GPA" value={edu.gpa} onChange={(v) => set({ gpa: v })} />
            <Text label="Start" value={edu.startDate} onChange={(v) => set({ startDate: v })} />
            <Text label="End" value={edu.endDate} onChange={(v) => set({ endDate: v })} />
          </div>
        )}
        summary={(edu) => edu.school || edu.degree || 'New education'}
      />

      {/* Experience */}
      <RepeatSection<Experience>
        title="💼 Experience"
        items={profile.experience}
        empty={emptyExperience}
        onChange={(items) => mut({ experience: items })}
        render={(exp, set) => (
          <div className="grid">
            <Text label="Company" value={exp.company} onChange={(v) => set({ company: v })} />
            <Text label="Title" value={exp.title} onChange={(v) => set({ title: v })} />
            <Text label="Location" value={exp.location} onChange={(v) => set({ location: v })} />
            <Text label="Start" value={exp.startDate} onChange={(v) => set({ startDate: v })} />
            <Text
              label="End (or 'Present')"
              value={exp.endDate}
              onChange={(v) => set({ endDate: v })}
            />
            <Area
              label="Description"
              value={exp.description}
              onChange={(v) => set({ description: v })}
            />
          </div>
        )}
        summary={(exp) => [exp.title, exp.company].filter(Boolean).join(' · ') || 'New role'}
      />

      {/* Skills + summary */}
      <section className="card">
        <h2>🧰 Skills & Summary</h2>
        <Chips
          label="Skills"
          value={profile.skills}
          onChange={(v) => mut({ skills: v })}
          placeholder="Python, React, AWS…"
        />
        <Area
          label="Summary / extra context (used by Claude for essay questions)"
          rows={4}
          value={profile.summary}
          onChange={(v) => mut({ summary: v })}
        />
      </section>

      {/* Resume */}
      <section className="card">
        <h2>📄 Resume</h2>
        {resume ? (
          <p className="sub">
            Current: <code>{resume.name}</code> ({Math.round(resume.size / 1024)} KB)
          </p>
        ) : (
          <p className="sub">No resume uploaded yet.</p>
        )}
        <div className="row">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onResumeUpload(f);
                setPendingResume(f);
              }
            }}
          />
          <button
            className="secondary"
            disabled={!pendingResume}
            onClick={() => pendingResume && parseResumeIntoProfile(pendingResume)}
            title={pendingResume ? '' : 'Select a PDF first'}
          >
            ✨ Parse with Claude
          </button>
        </div>
        <p className="hint">
          The PDF is stored locally and injected into application file-upload fields. "Parse with
          Claude" reads it in your browser and fills your profile (needs an API key below).
        </p>
      </section>

      {/* Settings */}
      <section className="card">
        <h2>🤖 Claude (LLM) Settings</h2>
        <div className="grid">
          <Text
            label="Anthropic API key (stored locally)"
            full
            type="password"
            placeholder="sk-ant-…"
            value={settings.anthropicApiKey}
            onChange={(v) => {
              setSettings(update(settings, { anthropicApiKey: v }));
              setDirty(true);
            }}
          />
          <Text
            label="Model"
            value={settings.model}
            onChange={(v) => {
              setSettings(update(settings, { model: v }));
              setDirty(true);
            }}
          />
          <div className="field">
            <label>LLM enabled</label>
            <div className="tristate">
              <button
                type="button"
                className={settings.llmEnabled ? 'active' : ''}
                onClick={() => {
                  setSettings(update(settings, { llmEnabled: true }));
                  setDirty(true);
                }}
              >
                On
              </button>
              <button
                type="button"
                className={!settings.llmEnabled ? 'active' : ''}
                onClick={() => {
                  setSettings(update(settings, { llmEnabled: false }));
                  setDirty(true);
                }}
              >
                Off
              </button>
            </div>
          </div>
        </div>
        <p className="hint">
          Used only when you explicitly click "generate" on an essay/free-text question. Get a key
          at <a href="https://console.anthropic.com/">console.anthropic.com</a>.
        </p>
      </section>

      <div className="savebar">
        <span className={`status${status.includes('✓') ? ' ok' : ''}`}>
          {status || (dirty ? 'Unsaved changes' : 'All changes saved')}
        </span>
        <button
          className="secondary"
          onClick={() => {
            setProfile(emptyProfile());
            setDirty(true);
          }}
        >
          Reset profile
        </button>
        <button onClick={save} disabled={!dirty}>
          Save
        </button>
      </div>
    </div>
  );
}

/** Generic add/remove/edit list section for education & experience. */
function RepeatSection<T>({
  title,
  items,
  empty,
  onChange,
  render,
  summary,
}: {
  title: string;
  items: T[];
  empty: T;
  onChange: (items: T[]) => void;
  render: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
  summary: (item: T) => string;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {items.map((item, i) => (
        <div className="repeat-item" key={i}>
          <div className="repeat-head">
            <strong>{summary(item)}</strong>
            <button
              className="danger"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
          {render(item, (patch) =>
            onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))),
          )}
        </div>
      ))}
      <button className="ghost" onClick={() => onChange([...items, { ...empty }])}>
        + Add
      </button>
    </section>
  );
}
