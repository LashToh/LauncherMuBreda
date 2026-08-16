import { FaDiscord, FaFacebookF, FaGlobe, FaInstagram } from 'react-icons/fa';
import { FALLBACK_CONFIG } from '../../constants';
import './SocialBar.scss';

export default function SocialBar({ t, config = {} }) {
  const merged = { ...FALLBACK_CONFIG, ...config };

  const items = [
    { key: 'website', label: t.website, url: merged.websiteUrl, Icon: FaGlobe },
    { key: 'discord', label: t.discord, url: merged.discordUrl, Icon: FaDiscord },
    { key: 'instagram', label: t.instagram, url: merged.instagramUrl, Icon: FaInstagram },
    { key: 'facebook', label: t.facebook, url: merged.facebookUrl, Icon: FaFacebookF },
  ].filter((item) => typeof item.url === 'string' && item.url.startsWith('http'));

  async function openLink(url) {
    if (window.mubreda?.openExternal) {
      const result = await window.mubreda.openExternal(url);
      if (result?.ok) return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <nav className="social-bar" aria-label="Social">
      {items.map(({ key, label, url, Icon }) => (
        <button
          key={key}
          type="button"
          className="social-bar__btn"
          title={label}
          onClick={() => openLink(url)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
