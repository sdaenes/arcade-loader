import React from 'react';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🕹</span>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>ARCADE<span className={styles.logoBold}>LOADER</span></span>
          <span className={styles.logoSub}>OPTIMISEUR DE TRANSPORT 3D</span>
        </div>
      </div>
      <div className={styles.tagline}>
        Calcul automatique du meilleur agencement pour vos bornes
      </div>
    </header>
  );
}
