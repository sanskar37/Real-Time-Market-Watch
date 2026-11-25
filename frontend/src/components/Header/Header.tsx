import { useEffect, useState } from 'react';
import { LogoMark, RefreshIcon } from '../icons/icons';
import { formatMarketClock } from '../../lib/format';
import type { ConnectionStatus } from '../../lib/types';
import { useConnectionStatus, useMarketServices } from '../../store/hooks';
import styles from './Header.module.css';

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  live: 'Live',
  connecting: 'Connecting',
  offline: 'Offline',
};

/** Ticks once a second on server time. Isolated so the clock never re-renders anything else. */
function MarketClock() {
  const { socket } = useMarketServices();
  const [now, setNow] = useState(() => socket.serverNow());

  useEffect(() => {
    const id = window.setInterval(() => setNow(socket.serverNow()), 1000);
    return () => window.clearInterval(id);
  }, [socket]);

  const { date, time } = formatMarketClock(now);
  return (
    <time className={styles.clock} dateTime={new Date(now).toISOString()}>
      <span>{date}</span>
      <span>{time}</span>
    </time>
  );
}

function ConnectionBadge() {
  const status = useConnectionStatus();
  return (
    <span className={styles.status} data-status={status} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Header() {
  const { socket } = useMarketServices();
  const [spinning, setSpinning] = useState(false);

  const onRefresh = () => {
    socket.refresh();
    setSpinning(true);
  };

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <LogoMark className={styles.logo} />
        <h1 className={styles.title}>Market Watch</h1>
      </div>
      <div className={styles.meta}>
        <div className={styles.live}>
          <ConnectionBadge />
          <span className={styles.divider} aria-hidden="true" />
          <MarketClock />
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={onRefresh}
          aria-label="Refresh prices"
          title="Refresh prices"
        >
          <RefreshIcon
            className={spinning ? `${styles.refreshIcon} ${styles.spin}` : styles.refreshIcon}
            onAnimationEnd={() => setSpinning(false)}
          />
        </button>
      </div>
    </header>
  );
}
