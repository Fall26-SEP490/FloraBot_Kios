import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function useKioskLanguage() {
  const { i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'vi';
  return {
    language,
    tr: (vi: string, en: string) => (language === 'en' ? en : vi),
    setLanguage: (value: 'vi' | 'en') => {
      void i18n.changeLanguage(value);
    },
  };
}

export function LanguagePicker() {
  const { language, tr, setLanguage } = useKioskLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <div className="kh-language" role="group" aria-label={tr('Ngôn ngữ', 'Language')}>
      <button
        type="button"
        aria-label="Tiếng Việt"
        aria-pressed={language === 'vi'}
        onClick={() => setLanguage('vi')}
      >
        VI <span>Tiếng Việt</span>
      </button>
      <button
        type="button"
        aria-label="English"
        aria-pressed={language === 'en'}
        onClick={() => setLanguage('en')}
      >
        EN <span>English</span>
      </button>
    </div>
  );
}
