import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { loadProfile } from '../../db/appState';
import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { ProfileProvider, useProfile, type ProfileContextValue } from '../ProfileProvider';

describe('ProfileProvider', () => {
  it('loads the saved profile and shares a saved change with every screen', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations);
    let context: ProfileContextValue | undefined;
    function Probe() {
      context = useProfile();
      return (
        <Text>
          {context.profile === undefined ? 'loading' : (context.profile?.displayName ?? 'none')}
        </Text>
      );
    }
    await render(
      <ProfileProvider db={db}>
        <Probe />
      </ProfileProvider>,
    );
    expect(await screen.findByText('none')).toBeTruthy();

    await act(() => context!.save({ displayName: 'Jake Smith', initials: 'JS' }));
    expect(screen.getByText('Jake Smith')).toBeTruthy();
    expect(await loadProfile(db)).toEqual({ displayName: 'Jake Smith', initials: 'JS' });
  });
});
