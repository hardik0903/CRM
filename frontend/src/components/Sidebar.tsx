'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import ThemeToggle from './ThemeToggle';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onImportClick: () => void;
}

const MAIN_NAV = [
  { key: 'manage', label: 'Manage Leads', icon: 'users', active: true },
];

function NavIcon({ name }: { name: string }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'users':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

export default function Sidebar({ onImportClick }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className={styles.mobileToggle}
        onClick={toggleMobile}
        aria-label="Toggle navigation"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {mobileOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div className={styles.backdrop} onClick={toggleMobile} />
      )}

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}
      >
        {/* Logo */}
        <div className={styles.logo}>
          <svg
            width="180"
            height="44"
            viewBox="0 0 180 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g transform="translate(0, 4)">
              <rect width="36" height="36" rx="10" fill="var(--text-primary)" />
              <path
                d="M 26 10 L 26 26 L 20.5 26 L 20.5 20.5 L -3 44 L -8 39 L 15.5 15.5 L 10 15.5 L 10 10 Z"
                fill="var(--sidebar-bg)"
              />
            </g>
            <text
              x="44"
              y="32"
              fontFamily="var(--font-plus-jakarta), sans-serif"
              fontWeight="800"
              fontSize="28"
              fill="var(--text-primary)"
              letterSpacing="-0.03em"
            >
              GrowEasy
            </text>
          </svg>
        </div>

        {/* Nav sections */}
        <nav className={styles.nav}>
          <div className={styles.navSection}>
            <p className={styles.navHeading}>MAIN</p>
            {MAIN_NAV.map((item) => (
              <button
                key={item.key}
                className={`${styles.navItem} ${item.active ? styles.navItemActive : ''}`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Footer with theme toggle */}
        <div className={styles.sidebarFooter}>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
