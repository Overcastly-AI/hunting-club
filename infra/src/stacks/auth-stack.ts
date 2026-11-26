import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import { AUTH_CALLBACK_PATH, URL_SCHEME } from '@huntclub/shared';
import type { EnvConfig } from '../../config';

export interface AuthStackProps extends StackProps {
  readonly config: EnvConfig;
}

/** Sign-in redirect URLs for each client, built from the shared app identity and the env domain. */
export function callbackUrls(config: EnvConfig) {
  return {
    app: [`${URL_SCHEME}://${AUTH_CALLBACK_PATH}`],
    web: [`https://${config.domainName}/${AUTH_CALLBACK_PATH}`],
  };
}

/**
 * Club accounts (admins and members; free users never sign in). Passwordless email
 * one-time codes via choice-based sign-in (USER_AUTH), which needs the Essentials
 * feature plan. No hosted UI domain: the app and web page call Cognito directly.
 */
export class AuthStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly appClient: cognito.UserPoolClient;
  readonly webClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const urls = callbackUrls(props.config);

    this.userPool = new cognito.UserPool(this, 'Users', {
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      signInPolicy: {
        // Cognito requires the password factor to stay enabled; the apps only offer the code.
        allowedFirstAuthFactors: { password: true, emailOtp: true },
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OFF,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const client = (id: string, callbacks: string[]) =>
      this.userPool.addClient(id, {
        generateSecret: false,
        authFlows: { user: true },
        preventUserExistenceErrors: true,
        enableTokenRevocation: true,
        oAuth: {
          flows: { authorizationCodeGrant: true },
          scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
          callbackUrls: callbacks,
          logoutUrls: callbacks,
        },
        supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      });

    this.appClient = client('AppClient', urls.app);
    this.webClient = client('WebClient', urls.web);
  }
}
