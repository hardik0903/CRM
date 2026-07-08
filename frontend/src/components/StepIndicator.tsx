'use client';

import { AppStep } from '@/types';
import styles from './StepIndicator.module.css';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const STEPS: { key: AppStep; label: string; icon: React.ReactNode }[] = [
  {
    key: 'upload',
    label: 'Upload',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    key: 'preview',
    label: 'Preview',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
  },
  {
    key: 'processing',
    label: 'Processing',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    key: 'results',
    label: 'Results',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
];

const stepOrder: AppStep[] = ['upload', 'preview', 'processing', 'results'];

function getStepStatus(stepKey: AppStep, currentStep: AppStep): 'completed' | 'active' | 'upcoming' {
  const currentIdx = stepOrder.indexOf(currentStep);
  const stepIdx = stepOrder.indexOf(stepKey);
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'active';
  return 'upcoming';
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <nav className={styles.container} aria-label="Import progress">
      <ol className={styles.steps}>
        {STEPS.map((step, idx) => {
          const status = getStepStatus(step.key, currentStep);
          return (
            <li key={step.key} className={styles.stepItem}>
              {idx > 0 && (
                <div
                  className={`${styles.connector} ${status !== 'upcoming' ? styles.connectorActive : ''}`}
                  aria-hidden="true"
                />
              )}
              <div
                className={`${styles.stepCircle} ${styles[status]}`}
                aria-current={status === 'active' ? 'step' : undefined}
              >
                {status === 'completed' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.icon
                )}
              </div>
              <span className={`${styles.stepLabel} ${styles[`label_${status}`]}`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
