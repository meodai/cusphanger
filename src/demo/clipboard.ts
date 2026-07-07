export function copyText(text: string, trigger?: HTMLElement): void {
  const done = () => {
    if (!trigger) return;
    trigger.setAttribute('data-copied', '');
    window.setTimeout(() => trigger.removeAttribute('data-copied'), 900);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done, done);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  done();
}
