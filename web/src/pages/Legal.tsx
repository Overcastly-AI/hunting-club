import { ADMIN_PATH } from '@huntclub/shared/app';
import { LEGAL_DRAFT_NOTICE, type LegalDoc } from '@huntclub/shared';
import { useDocumentTitle } from '../title';

/** Privacy or Terms, from the shared copy (@huntclub/shared legal), marked as a draft. */
export function Legal(props: { doc: LegalDoc }) {
  const { doc } = props;
  useDocumentTitle(doc.title);
  return (
    <article aria-labelledby="legal-title">
      <h1 id="legal-title">{doc.title}</h1>
      <p className="banner" role="note">
        {LEGAL_DRAFT_NOTICE}
      </p>
      <p>{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ))}
      <a className="button" href={ADMIN_PATH}>
        Back to sign in
      </a>
    </article>
  );
}
