import { FaDiscord, FaFacebookF, FaGlobe, FaHeart, FaInstagram } from 'react-icons/fa';
import './SocialBar.scss';

export default function SocialBar({ t, config }) {
  const items = [
    { key: 'website', label: t.website, url: config.websiteUrl, Icon: FaGlobe },
    { key: 'discord', label: t.discord, url: config.discordUrl, Icon: FaDiscord },
    { key: 'instagram', label: t.instagram, url: config.instagramUrl, Icon: FaInstagram },
    { key: 'facebook', label: t.facebook, url: config.facebookUrl, Icon: FaFacebookF },
    { key: 'donate', label: t.donate, url: config.donateUrl, Icon: FaHeart, accent: true },
  ].filter((item) => item.url);

  return (
    <nav className="social-bar" aria-label="Social">
      {items.map(({ key, label, url, Icon, accent }) => (
        <button
          key={key}
          type="button"
          className={`social-bar__btn${accent ? ' social-bar__btn--accent' : ''}`}
          title={label}
          onClick={() => window.mubreda?.openExternal(url)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
