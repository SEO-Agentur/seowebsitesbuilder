/**
 * cPanel deploy adapter — uploads project files via SFTP to a cPanel-hosted
 * webserver's public_html (or another path). Suitable for PHP and static sites.
 *
 * Required credentials:
 *   host       — sftp host
 *   username   — sftp/cPanel username
 *   password   — password (or use privateKey)
 *   privateKey?— OpenSSH private key contents (alternative to password)
 *   remotePath?— absolute path to upload to (default: /home/<user>/public_html)
 *   publicUrl  — the URL the user will visit after deploy
 *
 * NOTE: requires the optional `ssh2-sftp-client` dependency. We import it
 * lazily so the orchestrator doesn't fail if it's not installed.
 */

import path from "node:path";
import { collectFiles, DeployError, DeployInput, DeployResult } from "./util";

export async function deployCpanel(input: DeployInput): Promise<DeployResult> {
  const { host, username, password, privateKey, publicUrl } = input.credentials;
  const remotePath = input.credentials.remotePath || `/home/${username}/public_html`;
  if (!host || !username || (!password && !privateKey)) {
    throw new DeployError("cPanel deploy requires host, username, and password or privateKey");
  }
  if (!publicUrl) throw new DeployError("cPanel deploy requires publicUrl (the URL of your site after deploy)");

  let SftpClient: any;
  try {
    SftpClient = (await import("ssh2-sftp-client")).default;
  } catch {
    throw new DeployError("ssh2-sftp-client is not installed on the orchestrator. Run `pnpm add ssh2-sftp-client` to enable cPanel deploys.");
  }
  const sftp = new SftpClient();
  await sftp.connect({ host, username, password, privateKey, port: 22 });

  try {
    if (!(await sftp.exists(remotePath))) {
      await sftp.mkdir(remotePath, true);
    }
    const files = await collectFiles(input.projectDir);
    for (const f of files) {
      const target = path.posix.join(remotePath, f.rel);
      const dir = path.posix.dirname(target);
      if (!(await sftp.exists(dir))) await sftp.mkdir(dir, true);
      await sftp.put(f.abs, target);
    }
  } finally {
    await sftp.end().catch(() => undefined);
  }

  return { url: publicUrl, status: "success" };
}
