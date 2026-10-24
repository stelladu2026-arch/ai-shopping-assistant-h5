export const GUIDE_RUNTIME_VERSION: 'guide-wan26-four-images-20261020';
export function imageDiagnostics(
  env: NodeJS.ProcessEnv,
  imageStatus: (env: NodeJS.ProcessEnv) => unknown,
  imageRequest: (product: {name:string}, env: NodeJS.ProcessEnv) => {url:string;kind:string},
): {
  runtimeVersion:string;diagnosticsVersion:string;
  deployment:{projectId:string|null;environment:string|null;commit:string|null;host:string|null};
  configurationKeys:{recognized:string[];unrecognized:string[]};
  storage:{mode:string;configured:boolean;credentialsConfigured:boolean;configurationReady:boolean;connectivityChecked:boolean;note:string};
  image:unknown;endpoint:string|null;protocol:string|null;
};
export function storageDiagnostics(env: NodeJS.ProcessEnv): {mode:string;configured:boolean;credentialsConfigured:boolean;configurationReady:boolean;connectivityChecked:boolean;note:string};
