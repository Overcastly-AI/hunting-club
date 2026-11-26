import { App } from 'aws-cdk-lib';
import { getEnvConfig } from '../config';
import { buildApp } from '../src/app';

const app = new App();
buildApp(getEnvConfig(app.node.tryGetContext('env') as string | undefined), app);
app.synth();
