import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function ServiceCard({ service, variant = 'detail' }) {
  const home = variant === 'home';
  const Heading = home ? 'h3' : 'h2';
  const ImageContainer = home ? 'div' : Link;
  return <article className="service-card">
    <ImageContainer className="service-image" {...(home ? {} : { to: `/services/${service.slug}`, tabIndex: -1, 'aria-hidden': true })}><img src={service.images?.[0] || `/images/${service.image}.webp`} alt={home ? service.alt || `${service.name} cleaning service` : ''} width="1000" height="625" loading="lazy" decoding="async" style={{ objectPosition: service.position }} /></ImageContainer>
    <div className="service-body"><Heading>{home ? service.name : <Link to={`/services/${service.slug}`}>{service.name}</Link>}</Heading><p>{service.description}</p>
      {home ? <Link to={`/request-quote?service=${encodeURIComponent(service.name)}`} aria-label={`Request a Quote for ${service.name}`}>Request a Quote<ArrowRight size={18} aria-hidden="true" /></Link> : <div className="service-links"><Link to={`/services/${service.slug}`} aria-label={`Learn more about ${service.name}`}>Learn More<ArrowRight size={16} aria-hidden="true" /></Link><Link to={`/request-quote?service=${encodeURIComponent(service.name)}`} aria-label={`Request a Quote for ${service.name}`}>Request a Quote<ArrowRight size={16} aria-hidden="true" /></Link></div>}
    </div>
  </article>;
}
