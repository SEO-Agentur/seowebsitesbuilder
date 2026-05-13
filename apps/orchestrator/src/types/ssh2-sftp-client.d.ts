// Minimal ambient declaration so the dynamic import in deploys/cpanel.ts
// typechecks. The actual API is only used through `any`-typed wrappers; this
// shim just keeps tsc from complaining the module has no type declarations.
declare module "ssh2-sftp-client";
