import { CLOUD_ENVIRONMENTS } from '../cloud';
import { privacyPolicy, termsOfUse, type LegalDoc } from '../legal';

const text = (doc: LegalDoc) =>
  [doc.intro, ...doc.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join('\n');

describe('privacy and terms copy', () => {
  it('states the privacy facts from docs/SPEC.md', () => {
    const privacy = text(privacyPolicy);
    expect(privacy).toMatch(/you have no account\. The app never contacts our servers for you/);
    expect(privacy).toMatch(/shared only while you are checked in/);
    expect(privacy).toMatch(/over the radio mesh/);
    expect(privacy).toContain(`AWS) in the ${CLOUD_ENVIRONMENTS.dev.region} region`);
    expect(privacy).toMatch(/Stripe/);
    expect(privacy).toMatch(/Channel keys and message bodies are never written to logs/);
    expect(privacy).toMatch(/Ask your club admin/);
  });

  it('says the app is not an emergency service and the mesh stays free', () => {
    const terms = text(termsOfUse);
    expect(terms).toMatch(/not an emergency service/);
    expect(terms).toMatch(/call 911 from your phone if you have service/);
    expect(terms).toMatch(/Ask for a Hand, is free/);
  });

  it('never mentions legal shooting hours or reads like a 911 call', () => {
    for (const doc of [privacyPolicy, termsOfUse]) {
      expect(text(doc)).not.toMatch(/shooting hours|SOS|emergency alert/i);
    }
  });
});
