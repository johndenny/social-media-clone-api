import "dotenv/config";
import { ApolloServer } from "apollo-server-express";
import { schema } from "./schema";
import { context, prisma } from "./context";
import express from "express";
import http from "http";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import cookieParser from "cookie-parser";
import { corsOptions } from "./utils/corsOptions";
import { v2 as cloudinary } from "cloudinary";
import bodyParser from "body-parser";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { decodeAuthHeader } from "./utils/auth";

async function startApolloServer() {
  const app = express();
  app.use(cookieParser());
  app.use(bodyParser.json({ limit: "50mb" }));
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
    secure: true,
  });
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/",
  });

  const serverCleanUp = useServer(
    {
      schema,
      context: (ctx) => {
        const token = decodeAuthHeader(
          ctx.connectionParams?.authentication as string
        );
        return { userId: token?.userId, prisma };
      },
    },
    wsServer
  );

  const server = new ApolloServer({
    schema,
    context,
    csrfPrevention: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanUp.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({
    app,
    cors: corsOptions,
    path: "/",
  });

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: 4000 }, resolve)
  );
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
}
startApolloServer();
