import { useEffect, useState } from 'react';
import { useKioskLanguage } from './kiosk-language';

export default function HomeCountdown({ seconds, onHome }: { seconds: number; onHome: () => void }) {
  const { tr } = useKioskLanguage();
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(timer);
        onHome();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [seconds, onHome]);
  return <p role="status">{tr(`Tự về trang chủ sau ${remaining} giây.`, `Returning home in ${remaining} seconds.`)}</p>;
}
