// Reference-counted scroll lock so multiple overlays don't fight over body styles.
export function lockScroll() {
  const count = parseInt(document.body.dataset.scrollLocks ?? '0');
  if (count === 0) {
    const scrollY = window.scrollY;
    document.body.dataset.scrollTop = String(scrollY);
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
  }
  document.body.dataset.scrollLocks = String(count + 1);
}

export function unlockScroll() {
  const count = parseInt(document.body.dataset.scrollLocks ?? '1');
  if (count <= 1) {
    const scrollY = parseInt(document.body.dataset.scrollTop ?? '0');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    delete document.body.dataset.scrollLocks;
    delete document.body.dataset.scrollTop;
    window.scrollTo(0, scrollY);
  } else {
    document.body.dataset.scrollLocks = String(count - 1);
  }
}
