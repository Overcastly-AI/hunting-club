import { FAQ } from '../faq';
import { PAGE_PATHS } from '../routes';

export function Faq() {
  return (
    <div className="wrap page-head narrow">
      <h1>Questions</h1>
      <p className="lede">
        Plain answers about cell service, radios, what is free and what clubs pay for.
      </p>
      <ul className="rows">
        {FAQ.map((item) => (
          <li key={item.q}>
            <h2 className="question">{item.q}</h2>
            <p>{item.a}</p>
          </li>
        ))}
      </ul>
      <p>
        Something else? <a href={PAGE_PATHS.contact}>Contact us</a>.
      </p>
    </div>
  );
}
