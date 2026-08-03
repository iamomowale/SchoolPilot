export interface AppConfig {
  appName: string;
  environment: 'development' | 'test' | 'production';
}

export function createAppConfig(environment: AppConfig['environment']): AppConfig {
  return {
    appName: 'SchoolPilot',
    environment,
  };
}
