import { LEGAL_DRAFT_NOTICE, type LegalDoc } from '@huntclub/shared';

/** Privacy or Terms, from the shared copy (@huntclub/shared legal), marked as a draft. */
export function Legal(props: { doc: LegalDoc }) {
  const { doc } = props;
  return (
    <div className="wrap page-head narrow legal">
      <h1>{doc.title}</h1>
      <p className="notice" role="note">
        {LEGAL_DRAFT_NOTICE}
      </p>
      <p className="lede">{doc.intro}</p>
      {doc.sections.map((section) => (
        <div key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      ))}
    </div>
  );
}
