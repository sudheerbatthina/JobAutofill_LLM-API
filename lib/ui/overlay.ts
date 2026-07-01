import type { DetectedField } from '@/lib/fields/types';

/**
 * Lightweight per-field overlay. A single Shadow-DOM host holds one small
 * button per detected field, absolutely positioned next to the field. Using a
 * shadow root keeps our styles isolated from the page. We reposition on
 * scroll/resize and when the caller re-syncs after DOM mutations.
 */

export interface FieldAction {
  field: DetectedField;
  /** Whether we have a value to fill (controls icon style). */
  fillable: boolean;
  /** Whether to show the ✨ generate (LLM) action. */
  canGenerate: boolean;
  onFill: () => void;
  onGenerate?: () => void;
}

const STYLE = `
:host { all: initial; }
.icon-wrap {
  position: absolute;
  z-index: 2147483646;
  display: flex;
  gap: 2px;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
button {
  width: 20px; height: 20px;
  border: none; border-radius: 5px;
  background: #2f6fed; color: #fff;
  font-size: 12px; line-height: 1;
  cursor: pointer; padding: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,.3);
  display: flex; align-items: center; justify-content: center;
}
button:hover { background: #6ea8fe; }
button.muted { background: #6b7280; }
button.gen { background: #8b5cf6; }
button.gen:hover { background: #a78bfa; }
.flash { outline: 2px solid #51cf66 !important; transition: outline .2s; }
`;

export class OverlayManager {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private entries = new Map<string, { action: FieldAction; wrap: HTMLDivElement }>();
  private rafPending = false;

  constructor(private doc: Document) {
    this.host = doc.createElement('div');
    this.host.id = '__autofill_overlay_host';
    this.host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;';
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = STYLE;
    this.root.appendChild(style);
    doc.documentElement.appendChild(this.host);

    const reposition = () => this.scheduleReposition();
    this.doc.defaultView?.addEventListener('scroll', reposition, true);
    this.doc.defaultView?.addEventListener('resize', reposition);
  }

  /** Replace the set of field actions shown. */
  sync(actions: FieldAction[]): void {
    const nextIds = new Set(actions.map((a) => a.field.id));
    // Remove stale
    for (const [id, entry] of this.entries) {
      if (!nextIds.has(id)) {
        entry.wrap.remove();
        this.entries.delete(id);
      }
    }
    // Add/update
    for (const action of actions) {
      const existing = this.entries.get(action.field.id);
      if (existing) {
        existing.action = action;
        continue;
      }
      const wrap = this.doc.createElement('div');
      wrap.className = 'icon-wrap';

      const fillBtn = this.doc.createElement('button');
      fillBtn.textContent = '⚡';
      fillBtn.title = action.fillable
        ? `Fill: ${action.field.label || action.field.kind}`
        : `No saved value for "${action.field.label}"`;
      if (!action.fillable) fillBtn.className = 'muted';
      fillBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.entries.get(action.field.id)?.action.onFill();
      });
      wrap.appendChild(fillBtn);

      if (action.canGenerate && action.onGenerate) {
        const genBtn = this.doc.createElement('button');
        genBtn.textContent = '✨';
        genBtn.className = 'gen';
        genBtn.title = 'Generate answer with Claude';
        genBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.entries.get(action.field.id)?.action.onGenerate?.();
        });
        wrap.appendChild(genBtn);
      }

      this.root.appendChild(wrap);
      this.entries.set(action.field.id, { action, wrap });
    }
    this.reposition();
  }

  /** Briefly highlight a field after filling. */
  flash(field: DetectedField): void {
    const el = field.element;
    el.classList.add('__autofill_flash');
    // inject a one-off page style for the flash (shadow style can't reach page els)
    ensurePageFlashStyle(this.doc);
    setTimeout(() => el.classList.remove('__autofill_flash'), 600);
  }

  private scheduleReposition(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    this.doc.defaultView?.requestAnimationFrame(() => {
      this.rafPending = false;
      this.reposition();
    });
  }

  reposition(): void {
    const win = this.doc.defaultView!;
    for (const { action, wrap } of this.entries.values()) {
      const el = action.field.element;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        wrap.style.display = 'none';
        continue;
      }
      wrap.style.display = 'flex';
      // Place at the top-right just inside the field.
      const top = rect.top + win.scrollY + 4;
      const left = rect.right + win.scrollX - 24;
      wrap.style.top = `${top}px`;
      wrap.style.left = `${left}px`;
    }
  }

  destroy(): void {
    this.host.remove();
    this.entries.clear();
  }
}

function ensurePageFlashStyle(doc: Document): void {
  if (doc.getElementById('__autofill_flash_style')) return;
  const s = doc.createElement('style');
  s.id = '__autofill_flash_style';
  s.textContent = `.__autofill_flash { outline: 2px solid #51cf66 !important; outline-offset: 1px; transition: outline .15s; }`;
  doc.head?.appendChild(s);
}
