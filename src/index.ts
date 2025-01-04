import { join } from "path";
import express, { Request, Response, RequestHandler } from "express";
import { readFileSync } from "fs";
import serveStatic from "serve-static";
import dotenv from "dotenv";
import cors from "cors";
import shopify from "./shopify.js";
import bodyParser from "body-parser";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
const backendPort = process.env.BACKEND_PORT as string;
const envPort = process.env.PORT as string;
const PORT = parseInt(backendPort || envPort, 10);

const app = express();

// Middleware
app.use(cors({
  origin: "*", // Allow requests from Shopify CDN
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Shopify Authentication
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);

app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: {} })
);

app.use("/api/*", shopify.validateAuthenticatedSession());

app.get('/apps/app_proxy/test', (req,res)=> {
  res.status(200).send("test");
})

app.get('/test', (req,res)=>{
  res.status(200).send('test');
})

// API Routes
app.post("/apps/saved-cart/save", async (req, res) => {
  try {
    const { customerId, variantIds, shop } = req.body;

    // Create or update saved cart in DB
    await prisma.savedCart.upsert({
      where: {
        customerId_shop: {
          customerId,
          shop,
        },
      },
      update: {
        items: variantIds,
        updatedAt: new Date(),
      },
      create: {
        customerId,
        shop,
        items: variantIds,
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error saving cart:", error);
    res.status(500).json({ success: false, error: error });
  }
});

app.get("/apps/saved-cart/retrieve", async (req, res) => {
  try {
    const { customerId, shop } = req.query;

    const savedCart = await prisma.savedCart.findUnique({
      where: {
        customerId_shop: {
          customerId: customerId as string,
          shop: shop as string,
        },
      },
    });

    if (!savedCart) {
      res.status(404).json({ success: false, error: "No saved cart found" });
    } else {
      res.status(200).json({ success: true, variants: savedCart.items });
    }
  } catch (error) {
    console.error("Error retrieving cart:", error);
    res.status(500).json({ success: false, error: error });
  }
});


// App Proxy Endpoint
app.all("/apps/app_proxy/saved-cart", async (req, res) => {
  try {
    const { customerId, shop } = req.query;

    const savedCart = await prisma.savedCart.findUnique({
      where: {
        customerId_shop: {
          customerId: customerId as string,
          shop: shop as string,
        },
      },
    });

    if (!savedCart) {
      res.status(404).json({ success: false, error: "No saved cart found" });
    } else {
      res.status(200).json({ success: true, variants: savedCart.items });
    }
  } catch (error) {
    console.error("Error in app proxy endpoint:", error);
    res.status(500).json({ success: false, error: error });
  }
});

// Serve Frontend
app.use(
  "/*",
  shopify.ensureInstalledOnShop() as RequestHandler,
  async (_req: Request, res: Response) => {
    const htmlContent = readFileSync(
      join(`${process.cwd()}/frontend/`, "index.html"),
      "utf-8"
    );
    const transformedHtml = htmlContent.replace(
      /%SHOPIFY_API_KEY%/g,
      process.env.SHOPIFY_API_KEY || ""
    );

    res.status(200).set("Content-Type", "text/html").send(transformedHtml);
  }
);

// Health Check
app.get("/test", (req, res) => {
  res.status(200).send("API is working correctly");
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});
