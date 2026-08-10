import "server-only";
import { v2 as cloudinary } from "cloudinary";

const required = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;

function getEnv(name: (typeof required)[number]) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Cloudinary slider storage`);
  return value;
}

cloudinary.config({
  cloud_name: getEnv("CLOUDINARY_CLOUD_NAME"),
  api_key: getEnv("CLOUDINARY_API_KEY"),
  api_secret: getEnv("CLOUDINARY_API_SECRET"),
  secure: true,
});

export { cloudinary };