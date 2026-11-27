// The dev-only component kit at /app/#/_kit (see KIT_ENABLED in Root.tsx): every component
// in every state, with the theme switch on top. Not linked from anywhere; production builds
// do not include it, and the admin is noindex in any case.
import './kit.css';
import { ThemeToggle, ToastProvider } from '../components/ui';
import { KIT_SECTIONS } from './examples';

export function Kit() {
  return (
    <ToastProvider>
      <div className="kit">
        <header className="kit-header">
          <div>
            <h1 className="text-title-1 kit-title">Component kit</h1>
            <p className="kit-intro text-body-large">
              Every UI component in every state (docs/UI_REDESIGN.md section 6). Development only.
            </p>
          </div>
          <ThemeToggle />
        </header>
        <main className="kit-main">
          {KIT_SECTIONS.map(({ id, title, Demo }) => (
            <section
              key={id}
              id={`kit-${id}`}
              aria-labelledby={`kit-${id}-title`}
              className="kit-section"
            >
              <h2 id={`kit-${id}-title`} className="kit-section__title text-title-2">
                {title}
              </h2>
              <Demo />
            </section>
          ))}
        </main>
      </div>
    </ToastProvider>
  );
}
