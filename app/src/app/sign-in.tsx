import { router } from 'expo-router';

import { SignInScreen } from '../club/SignInScreen';

export default function SignInRoute() {
  return <SignInScreen onDone={() => router.back()} />;
}
