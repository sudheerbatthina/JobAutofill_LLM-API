export async function expandRepeatableSections(doc: Document): Promise<number> {
  const buttons = Array.from(
    doc.querySelectorAll<HTMLElement>('button, input[type="button"], [role="button"]'),
  ).filter((button) => /^add$/i.test(buttonText(button)));

  let clicked = 0;
  for (const button of buttons) {
    const section = findRepeatableSection(button);
    if (!section || hasOpenedFields(section)) continue;
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    button.click();
    clicked++;
    await delay(150);
  }

  if (clicked) await delay(650);
  return clicked;
}

function findRepeatableSection(button: HTMLElement): Element | null {
  let node: Element | null = button.parentElement;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    const text = node.textContent ?? '';
    if (/\b(work experience|employment history|prior work|experience|education)\b/i.test(text)) {
      return node;
    }
  }
  return null;
}

function hasOpenedFields(section: Element): boolean {
  return Array.from(
    section.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="file"]), select, textarea, [contenteditable="true"], [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="true"]',
    ),
  ).some((el) => !/^add$/i.test(buttonText(el)));
}

function buttonText(el: HTMLElement): string {
  if (el instanceof HTMLInputElement) return (el.value || el.getAttribute('aria-label') || '').trim();
  return (el.textContent || el.getAttribute('aria-label') || '').trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
