import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import styles from './LoginPage.module.css';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';
import {
  WrenchIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ShieldIcon,
  SparklesIcon,
  ArrowRightIcon,
} from '@/components/icons';
import { ApiError } from '@/api/errors';

export const LoginPage: React.FC = () => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, user, isMaintenanceStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expiredReason = searchParams.get('reason') === 'expired';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !otp.trim()) {
      setErrorMsg('Please enter both your registered institutional email and team OTP.');
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await login({
        email: email.trim(),
        otp: otp.trim(),
        isAdmin: isAdminMode,
      });

      const userRole = session.user.role;
      const userDept = (session.user.dept || '').toLowerCase();

      // Route according to authoritative profile data
      if (userRole === 'office_staff' && userDept.includes('maintenance')) {
        navigate('/maintenance', { replace: true });
      } else if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_OTP') {
          setErrorMsg('The provided OTP is invalid or has expired. Please verify with your team.');
        } else if (err.code === 'USER_NOT_FOUND') {
          setErrorMsg('No account found with this email. Contact your campus administrator.');
        } else if (err.code === 'USE_ADMIN_LOGIN') {
          setIsAdminMode(true);
          setErrorMsg('This account requires Admin authentication. Please submit via Admin mode.');
        } else {
          setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
        }
      } else {
        setErrorMsg('Unable to connect to the campus authentication server. Please check your network.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Left Brand Side */}
      <div className={styles.brandSide}>
        <div className={styles.brandHeader}>
          <div className={styles.logoIcon}>
            <WrenchIcon size={24} />
          </div>
          <span className={styles.brandTitle}>FixIt</span>
        </div>

        <div className={styles.brandContent}>
          <h1 className={styles.headline}>
            Campus maintenance, <br />
            <span className={styles.highlight}>intelligently unified.</span>
          </h1>
          <p className={styles.description}>
            Report infrastructure defects, track real-time resolution lifecycles, and coordinate campus repairs through transparent SLA turnarounds.
          </p>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>
                <CheckCircleIcon size={18} />
              </span>
              <span>Fast 3-step issue reporting with photo documentation</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>
                <SparklesIcon size={18} />
              </span>
              <span>Dynamic issue classification and SLA turnaround tracking</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>
                <ShieldIcon size={18} />
              </span>
              <span>Dedicated Maintenance Operations command center</span>
            </div>
          </div>
        </div>

        <div className={styles.brandFooter}>
          CampusOS Infrastructure Platform • 12-Hour Secure Session
        </div>
      </div>

      {/* Right Form Side */}
      <div className={styles.formSide}>
        <div className={styles.formCard}>
          {/* Mode Switcher: Member vs Admin */}
          <div className={styles.modeToggle} role="tablist">
            <button
              type="button"
              className={`${styles.modeBtn} ${!isAdminMode ? styles.modeBtnActive : ''}`}
              onClick={() => {
                setIsAdminMode(false);
                setErrorMsg(null);
              }}
              role="tab"
              aria-selected={!isAdminMode}
            >
              Campus Member
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${isAdminMode ? styles.modeBtnActive : ''}`}
              onClick={() => {
                setIsAdminMode(true);
                setErrorMsg(null);
              }}
              role="tab"
              aria-selected={isAdminMode}
            >
              Admin Access
            </button>
          </div>

          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {isAdminMode ? 'Administrator Sign In' : 'Sign in to FixIt'}
            </h2>
            <p className={styles.formSubtitle}>
              {isAdminMode
                ? 'Enter your administrative credentials to manage tickets and platform settings'
                : 'Students, Faculty, and Maintenance Staff authenticate with email and team OTP'}
            </p>
          </div>

          {isAuthenticated && user && !expiredReason && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-electric-cyan)', fontWeight: 600 }}>Active Session Detected</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {user.name} ({user.role})
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(isMaintenanceStaff ? '/maintenance' : isAdmin ? '/admin' : '/dashboard')}
                icon={<ArrowRightIcon size={14} />}
                style={{ height: 'auto', padding: '0.35rem 0.75rem' }}
              >
                Enter
              </Button>
            </div>
          )}

          {expiredReason && (
            <div className={styles.alertBox} style={{ marginBottom: '1.25rem' }}>
              <AlertCircleIcon size={18} />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

          {errorMsg && (
            <div className={styles.alertBox} style={{ marginBottom: '1.25rem' }} role="alert">
              <AlertCircleIcon size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Institutional Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. yourname@campus.edu"
              required
              autoFocus
              autoComplete="email"
            />

            <Input
              label="Team OTP"
              type="password"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter your assigned team OTP"
              required
              autoComplete="current-password"
              helperText="The OTP provided by the platform administrator"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              icon={!isSubmitting ? <ArrowRightIcon size={18} /> : undefined}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Pre-fills for Evaluators */}
          <div className={styles.quickFillGroup}>
            <span className={styles.quickFillLabel}>
              Quick Fill Test Accounts:
            </span>
            <div className={styles.quickFillRow}>
              <button
                type="button"
                className={styles.quickFillBtn}
                onClick={() => {
                  setIsAdminMode(false);
                  setEmail('student@campus.edu');
                }}
              >
                Student
              </button>
              <button
                type="button"
                className={styles.quickFillBtn}
                onClick={() => {
                  setIsAdminMode(false);
                  setEmail('faculty@campus.edu');
                }}
              >
                Faculty
              </button>
              <button
                type="button"
                className={styles.quickFillBtn}
                onClick={() => {
                  setIsAdminMode(false);
                  setEmail('maintenance@campus.edu');
                }}
              >
                Maintenance Staff
              </button>
              <button
                type="button"
                className={styles.quickFillBtn}
                onClick={() => {
                  setIsAdminMode(true);
                  setEmail('admin@campus.edu');
                }}
              >
                Admin
              </button>
            </div>
          </div>

          <div className={styles.infoNote}>
            <strong>Authentication Notice:</strong> Authentication is securely validated by the CampusOS shared auth server. Tokens remain valid for 12 hours.
          </div>
        </div>
      </div>
    </div>
  );
};
