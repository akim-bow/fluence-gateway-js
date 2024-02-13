import { Fluence } from "@fluencelabs/js-client";
import relays from "../relays.json" assert { type: "json" };
import { Type } from "@sinclair/typebox";


import { helloWorld, helloWorldRemote, showSubnet, runDeployedServices } from "../compiled-aqua/main.js";

const DEFAULT_ACCESS_TOKEN = "abcdefhi";
const DEFAULT_PEER_PRIVATE_KEY = new Array(32).fill("a").join("");

// This is an authorization token for the gateway service.
const ACCESS_TOKEN = process.env.ACCESS_TOKEN ?? DEFAULT_ACCESS_TOKEN;
if (ACCESS_TOKEN === DEFAULT_ACCESS_TOKEN) {
  console.warn(
    "Default access token is used. Remember to generate the appropriate token and save it in env variables.",
  );
}

// This is the peer's private key.
const PEER_PRIVATE_KEY =
  process.env.PEER_PRIVATE_KEY ?? DEFAULT_PEER_PRIVATE_KEY;
if (PEER_PRIVATE_KEY === DEFAULT_PEER_PRIVATE_KEY) {
  console.warn(
    "Default peer private key is used. It must be regenerated and properly hidden otherwise one could steal it and pretend to be this gateway.",
  );
}

const PEER_PRIVATE_KEY_BYTES = new TextEncoder().encode(PEER_PRIVATE_KEY);

export default async function (server) {
  await server.register(import("@fastify/rate-limit"), {
    max: 100,
    timeWindow: "1 minute",
  });

  server.addHook("onReady", async () => {
    await Fluence.connect(relays[0], {
      keyPair: {
        type: "Ed25519",
        source: PEER_PRIVATE_KEY_BYTES,
      },
    });
  });

  server.addHook("onRequest", async (request, reply) => {
    if (request.headers.access_token !== ACCESS_TOKEN) {
      await reply.status(403).send({
        error: "Unauthorized",
        statusCode: 403,
      });
    }
  });

  server.addHook("onClose", async () => {
    await Fluence.disconnect();
  });

  const callbackBody = Type.Object({
    name: Type.String(),
  });

  

  const callbackResponse = Type.String();

  

  const showSubnetResponse = Type.Array(
    Type.Object({
      host_id: Type.Union([Type.String(), Type.Null()]),
      services: Type.Union([Type.Array(Type.String()), Type.Null()]),
      spells: Type.Union([Type.Array(Type.String()), Type.Null()]),
      worker_id: Type.Union([Type.String(), Type.Null()]),
    }),
  );

  

  const runDeployedServicesResponse = Type.Array(
    Type.Object({
      answer: Type.Union([Type.String(), Type.Null()]),
      worker: Type.Object({
        host_id: Type.String(),
        pat_id: Type.String(),
        worker_id: Type.Union([Type.String(), Type.Null()]),
      }),
    }),
  );

  

  // Request and response
  server.post(
    "/my/callback/hello",
    { schema: { body: callbackBody, response: { 200: callbackResponse } } },
    async (request, reply) => {
      const { name } = request.body;
      const result = await helloWorld(name);
      return reply.send(result);
    },
  );

  // Fire and forget
  server.post("/my/webhook/hello", async (_request, reply) => {
    void helloWorldRemote("Fluence");
    return reply.send();
  });

  server.post(
    "/my/callback/showSubnet",
    { schema: { response: { 200: showSubnetResponse } } },
    async (_request, reply) => {
      const result = await showSubnet();
      return reply.send(result);
    },
  );

  server.post(
    "/my/callback/runDeployedServices",
    { schema: { response: { 200: runDeployedServicesResponse } } },
    async (_request, reply) => {
      const result = await runDeployedServices();
      return reply.send(result);
    },
  );
};