import { FAQ } from '../faq';
import { PAGE_PATHS } from '../routes';

export function Faq() {
  return (
    <section className="hero faq-page">
      <div className="wrap">
        <h1>Questions</h1>
        {FAQ.map((item) => (
          <div key={item.q}>
            <h2>{item.q}</h2>
            <p>{item.a}</p>
          </div>
        ))}
        <p className="muted">
          Something else? <a href={PAGE_PATHS.contact}>Contact us</a>.
        </p>
      </div>
    </section>
  );
}
