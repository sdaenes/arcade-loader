import React from 'react';
import styles from './Header.module.css';
import { useLanguage } from '../i18n/LanguageContext';

const LANGS = [
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'ja', label: 'JA', flag: '🇯🇵' },
];

export default function Header() {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🕹</span>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>ARCADE<span className={styles.logoBold}>LOADER</span></span>
          <span className={styles.logoSub}>{t('header.subtitle')}</span>
        </div>
      </div>
      <div className={styles.headerRight}>
        <div className={styles.tagline}>{t('header.tagline')}</div>
        <div className={styles.langSwitcher}>
          {LANGS.map(l => (
            <button
              key={l.code}
              className={`${styles.langBtn} ${lang === l.code ? styles.langBtnActive : ''}`}
              onClick={() => setLang(l.code)}
              title={l.flag}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
