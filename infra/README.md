# Infra (AWS CDK)

Code only. Agents never deploy. The owner's operator runs `cdk deploy` after reviewing `synth` and `diff`.

| Path                            | What                                                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/types.ts`               | `EnvConfig`, the project name, and secret parameter names (`/hunt-club-mesh/<env>/<name>`, SSM SecureString)                                                                                                   |
| `config/dev.ts`                 | The dev environment's real values (account, region, domain, zone, certificate). The only place they appear                                                                                                     |
| `src/stacks/web-stack.ts`       | Private S3 bucket + CloudFront (origin access control, HTTPS only, existing ACM cert) at the env domain, Route 53 A/AAAA aliases, and `/.well-known` universal-link files once the app IDs are known           |
| `src/stacks/api-stack.ts`       | Stripe webhook Lambda behind a Function URL (stub until Milestone 9), allowed to read only its own secrets                                                                                                     |
| `src/constructs/node-lambda.ts` | The one Lambda definition: Node 24, arm64, esbuild bundle, 14-day log group                                                                                                                                    |
| `src/well-known.ts`             | `apple-app-site-association` and `assetlinks.json`, built from `APP_ID` / `APP_LINK_PATHS` in `@huntclub/shared`                                                                                               |
| `lambda/*/index.ts`             | Lambda handlers                                                                                                                                                                                                |
| `test/guards.ts`                | Cost guard: fails on always-on resources (EC2, NAT, load balancers, RDS, ECS, ElastiCache, OpenSearch, provisioned concurrency…), log groups without retention, and any Secrets Manager resource or permission |

## What CDK does not own

The club DynamoDB table (`hunt-club-mesh-dev`) and the Cognito user pool and clients were built by the owner's operator as the CloudFormation stack `HuntClubMeshDataDev` (Retain policies). CDK only **references** them by the identifiers in `config/dev.ts`; the ownership guard test fails if any stack defines a table, user pool or client. Key names come from `@huntclub/club-data` and must match the live table (`PK`/`SK`, `GSI1` = `GSI1PK`/`GSI1SK`, TTL `expiresAt`).

## Commands

```sh
npm run synth -w @huntclub/infra   # cdk synth; needs no AWS credentials (account/region come from config)
npm test -w @huntclub/infra        # assertions + cost guard
```

Select an environment with `-c env=<name>` (default `dev`).

## Before the first deploy

- Bootstrap the account once: `cdk bootstrap aws://054825383623/us-east-1`.
- Create the secrets as SSM Parameter Store SecureString parameters (standard tier, default `aws/ssm` key; values never in the repo): `/hunt-club-mesh/dev/stripe-webhook-secret`, `/hunt-club-mesh/dev/stripe-api-key`. Not before Milestone 9; the stubs work without them.
- Universal links: add the Apple Team ID and the Android signing SHA-256 fingerprints to `config/dev.ts`. Until then no `.well-known` files are published.
