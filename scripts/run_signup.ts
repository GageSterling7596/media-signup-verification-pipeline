const endpoint = process.env.SIGNUP_URL ?? "http://localhost:3000/signup";
const creatorEmail = process.env.CREATOR_EMAIL;
if (!creatorEmail) throw new Error("CREATOR_EMAIL is required");

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    creatorEmail,
    title: "Night Drive Session",
    sourceName: "night-drive-master.mov",
  }),
});
console.log(JSON.stringify(await response.json(), null, 2));

export {};
