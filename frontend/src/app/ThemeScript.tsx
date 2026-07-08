import Script from 'next/script';

// This script runs before React hydration to prevent flash of wrong theme.
// It reads the user's preference from localStorage and applies it immediately.
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('theme');
        if (!theme) theme = 'dark';
        document.documentElement.setAttribute('data-theme', theme);
      } catch(e) {}
    })();
  `;
  return <Script id="theme-script" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: script }} />;
}
