import { Users } from 'lucide-react';
import { ButtonLink, EmptyState } from './ui';

/** Pages that need a club, before there is one (the same words everywhere). */
export function NoClub() {
  return (
    <EmptyState
      icon={Users}
      title="Create your club first"
      action={
        <ButtonLink variant="primary" href="#/club">
          Go to My club
        </ButtonLink>
      }
    >
      Stands, areas, the roster and map packs all belong to a club.
    </EmptyState>
  );
}
