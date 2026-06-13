/* icons.jsx — минимальные строчные иконки */
window.Icon = function Icon({ n, className, style }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    gear: <g {...p}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.09 3.7l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></g>,
    check: <polyline {...p} points="20 6 9 17 4 12" />,
    checkbold: <polyline fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12" />,
    plus: <g {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></g>,
    minus: <line {...p} x1="5" y1="12" x2="19" y2="12" />,
    refresh: <g {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" /></g>,
    backspace: <g {...p}><path d="M21 5H8l-5 7 5 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" /><line x1="16" y1="9" x2="11" y2="15" /><line x1="11" y1="9" x2="16" y2="15" /></g>,
    flag: <g {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></g>,
    calx: <g {...p}><rect x="3" y="4" width="18" height="18" rx="3" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="10" y1="15" x2="14" y2="19" /><line x1="14" y1="15" x2="10" y2="19" /></g>,
    walk: <g {...p}><circle cx="13" cy="4" r="1.6" /><path d="M11 21l1.5-5L10 13l1-5 3 2 2 1" /><path d="M12.5 16L10 21" /></g>,
    cycle: <g {...p}><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M6 18l4-7h4l-2-4" /><circle cx="14" cy="6" r="1.3" /></g>,
    ellipse: <g {...p}><ellipse cx="12" cy="12" rx="9" ry="5" /><path d="M7 12l4 3 6-5" /></g>,
    x: <g {...p}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></g>,
    dumbbell: <g {...p}><path d="M6.5 6.5l11 11" /><path d="M4 9l-1.5 1.5a2 2 0 0 0 0 2.8L4 15M9 4l1.5-1.5a2 2 0 0 1 2.8 0L15 4" transform="rotate(0 12 12)" /><rect x="2.2" y="8.2" width="4" height="7.6" rx="1.2" transform="rotate(-45 4.2 12)" /><rect x="17.8" y="8.2" width="4" height="7.6" rx="1.2" transform="rotate(-45 19.8 12)" /></g>,
    bolt: <polygon fill="currentColor" stroke="none" points="13 2 4 14 11 14 10 22 20 9 13 9" />,
    timer: <g {...p}><circle cx="12" cy="13" r="8" /><path d="M12 13V9" /><path d="M9 2h6" /><path d="M19 6l1.5-1.5" /></g>,
    pause: <g {...p}><rect x="7" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.6" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none" /></g>,
    play: <polygon fill="currentColor" stroke="none" points="7 4 20 12 7 20" />,
    skip: <g {...p}><polygon fill="currentColor" stroke="none" points="5 4 15 12 5 20" /><line x1="19" y1="5" x2="19" y2="19" /></g>,
  };
  return <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">{paths[n] || null}</svg>;
};
