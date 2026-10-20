export const GUIDE_RUNTIME_VERSION: 'guide-wan26-four-images-20261020';
export function imageDiagnostics(
  env: NodeJS.ProcessEnv,
  imageStatus: (env: NodeJS.ProcessEnv) => unknown,
  imageRequest: (product: {name:string}, env: NodeJS.ProcessEnv) => {url:string;kind:string},
): {runtimeVersion:string;image:unknown;endpoint:string|null;protocol:string|null};
