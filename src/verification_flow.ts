import { createHash, randomUUID } from "node:crypto";
import type { EmailSend } from "./infrai_email.js";

export type AssetState = "awaiting_email" | "processing";
export type SignupAsset = {
  assetId: string;
  creatorEmail: string;
  title: string;
  sourceName: string;
  verificationToken: string;
  verificationMessageId: string;
  state: AssetState;
  jobId?: string;
};

export interface VerificationMailer {
  send(payload: EmailSend, requestKey: string): Promise<{ message_id: string }>;
  get(messageId: string): Promise<Record<string, unknown>>;
}

export class MediaSignupFlow {
  private readonly mailer: VerificationMailer;
  private readonly publicUrl: string;
  private readonly assets = new Map<string, SignupAsset>();

  constructor(mailer: VerificationMailer, publicUrl: string) {
    this.mailer = mailer;
    this.publicUrl = publicUrl;
  }

  async register(input: { creatorEmail: string; title: string; sourceName: string }) {
    const assetId = randomUUID();
    const verificationToken = randomUUID();
    const requestKey = createHash("sha256")
      .update(`verify:${assetId}:${input.creatorEmail}`)
      .digest("hex");
    const link = `${this.publicUrl}/verify?token=${encodeURIComponent(verificationToken)}`;
    const sent = await this.mailer.send({
      to: input.creatorEmail,
      subject: `Verify delivery for ${input.title}`,
      html: `<p>Confirm this creator address:</p><p><a href="${link}">Verify email</a></p>`,
    }, requestKey);
    const asset: SignupAsset = {
      assetId,
      creatorEmail: input.creatorEmail,
      title: input.title,
      sourceName: input.sourceName,
      verificationToken,
      verificationMessageId: sent.message_id,
      state: "awaiting_email",
    };
    this.assets.set(assetId, asset);
    return { assetId, state: asset.state, messageId: sent.message_id };
  }

  async verify(token: string) {
    const asset = [...this.assets.values()].find((candidate) => candidate.verificationToken === token);
    if (!asset) return undefined;
    if (asset.state === "awaiting_email") {
      asset.state = "processing";
      asset.jobId = `job_${asset.assetId}`;
    }
    return { assetId: asset.assetId, state: asset.state, jobId: asset.jobId };
  }

  async delivery(assetId: string) {
    const asset = this.assets.get(assetId);
    if (!asset) return undefined;
    const delivery = await this.mailer.get(asset.verificationMessageId);
    return { assetId, messageId: asset.verificationMessageId, delivery };
  }

  tokenForTest(assetId: string): string | undefined {
    return this.assets.get(assetId)?.verificationToken;
  }
}
