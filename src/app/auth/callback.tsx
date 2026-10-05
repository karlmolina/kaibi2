import { Redirect } from 'expo-router';

// Android may deep-link the OAuth redirect into the app; the code exchange happens in signInWithGoogle.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
