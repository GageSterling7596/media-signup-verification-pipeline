import assert from "node:assert/strict";
import test from "node:test";
import { MediaSignupFlow, type VerificationMailer } from "../src/verification_flow.js";

test("processing starts once only after the creator verifies the email", async () => {
  let sends = 0;
  const mailer: VerificationMailer = {
    async send() {
      sends += 1;
      return { message_id: "msg_42" };
    },
    async get() {
      return { status: "delivered" };
    },
  };
  const flow = new MediaSignupFlow(mailer, "https://stream.example");
  const signup = await flow.register({
    creatorEmail: "creator@example.com",
    title: "Night Drive Session",
    sourceName: "night-drive-master.mov",
  });

  assert.equal(signup.state, "awaiting_email");
  assert.equal(sends, 1);
  const token = flow.tokenForTest(signup.assetId);
  assert.ok(token);
  const first = await flow.verify(token);
  const second = await flow.verify(token);
  assert.deepEqual(first, second);
  assert.equal(first?.state, "processing");
  assert.equal(first?.jobId, `job_${signup.assetId}`);
});
