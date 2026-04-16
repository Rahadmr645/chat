import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

const cloudName =
  process.env.CLOUDINARY_CLOUD_NAME ||
  process.env.CLOUD_NAME ||
  process.env.CLOUD_NAMNE;
const apiKey = process.env.CLOUDINARY_API_KEY || process.env.API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.CLOUD_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

export const isCloudinaryConfigured = () =>
  Boolean(cloudName && apiKey && apiSecret);

export const uploadBufferToCloudinary = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      reject(
        new Error(
          "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
        )
      );
      return;
    }

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });

    Readable.from(buffer).pipe(stream);
  });

export const destroyCloudinaryAsset = (publicId, resourceType = "image") => {
  if (!publicId || !isCloudinaryConfigured()) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
