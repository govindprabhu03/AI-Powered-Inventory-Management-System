import { Button } from "@/components/ui/button";
import { signInWithOAuth } from "@/app/(auth)/actions";

/**
 * OAuth buttons.
 *
 * A Server Component: each button is a plain <form> whose action is a Server
 * Action. No client JavaScript, and the buttons still work if JS fails to load.
 * `.bind(null, "google")` pre-supplies the provider argument, since a form
 * action only ever receives FormData.
 */
export function OAuthButtons() {
  return (
    <div className="grid gap-2">
      <form action={signInWithOAuth.bind(null, "google")}>
        <Button type="submit" variant="outline" className="w-full">
          <GoogleIcon />
          Continue with Google
        </Button>
      </form>

      <form action={signInWithOAuth.bind(null, "github")}>
        <Button type="submit" variant="outline" className="w-full">
          <GitHubIcon />
          Continue with GitHub
        </Button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.08 1.08-2.76 2.28-5.71 2.28-4.55 0-8.11-3.67-8.11-8.22s3.56-8.22 8.11-8.22c2.46 0 4.25.97 5.57 2.21l2.31-2.31C18.99 2.42 16.5 1 12.48 1 6.31 1 1.13 6.02 1.13 12.19S6.31 23.38 12.48 23.38c3.33 0 5.84-1.09 7.8-3.14 2.02-2.02 2.65-4.86 2.65-7.15 0-.71-.05-1.36-.16-1.91h-10.3z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .3a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58A12 12 0 0 0 12 .3"
      />
    </svg>
  );
}
