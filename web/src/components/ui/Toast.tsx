import * as RadixToast from '@radix-ui/react-toast';
import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { ICON_SIZE } from '@huntclub/design';
import { TOAST_DURATION_MS } from './sizes';

export type ToastTone = 'success' | 'danger' | 'info';

export interface ToastMessage {
  tone: ToastTone;
  title: string;
  description?: string;
}

const ICONS: Record<ToastTone, LucideIcon> = {
  success: CircleCheck,
  danger: CircleAlert,
  info: Info,
};

let nextToastId = 0;

/** A danger toast's body: an alert, and excluded from the Radix status announcement. */
const DANGER_BODY = { role: 'alert', 'data-radix-toast-announce-exclude': '' } as const;

const ToastContext = createContext<((message: ToastMessage) => void) | null>(null);

/** Shows a toast: `useToast()({ tone: 'success', title: 'Invite link copied' })`. */
export function useToast(): (message: ToastMessage) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast needs a ToastProvider');
  return show;
}

/**
 * Toasts (Radix Toast: passes the strict CSP). Bottom right on desktop, bottom centre above
 * the tab bar on phones; 5 s (paused on hover and focus); Esc or the close button dismisses.
 * Radix announces each toast through its own role="status" region; a danger toast is an
 * alert instead (role="alert" on its body, left out of the Radix announcement so it is read
 * once). The role is not on the toast itself: that is a list item of the viewport's list.
 */
export function ToastProvider(props: { children: ReactNode }) {
  const [toasts, setToasts] = useState<(ToastMessage & { id: number })[]>([]);
  const show = useCallback((message: ToastMessage) => {
    const id = (nextToastId += 1);
    setToasts((list) => [...list, { ...message, id }]);
  }, []);
  const remove = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));
  return (
    <ToastContext.Provider value={show}>
      <RadixToast.Provider duration={TOAST_DURATION_MS} label="Notification">
        {props.children}
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <RadixToast.Root
              key={t.id}
              className={`ui-toast ui-toast--${t.tone}`}
              type={t.tone === 'danger' ? 'foreground' : 'background'}
              onOpenChange={(open) => (open ? undefined : remove(t.id))}
            >
              <Icon className="ui-toast__icon" size={ICON_SIZE.md} aria-hidden />
              <div className="ui-toast__body" {...(t.tone === 'danger' ? DANGER_BODY : {})}>
                <RadixToast.Title className="ui-toast__title">{t.title}</RadixToast.Title>
                {t.description ? (
                  <RadixToast.Description className="ui-toast__description">
                    {t.description}
                  </RadixToast.Description>
                ) : null}
              </div>
              <RadixToast.Close asChild>
                <Button variant="tertiary" iconOnly icon={X} label="Dismiss" />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}
        <RadixToast.Viewport className="ui-toast-viewport" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
