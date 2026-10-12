import Image, { type ImageProps } from "next/image";

/**
 * next/image wrapper: SVG renders are served as-is (no optimisation needed),
 * raster photos (e.g. Cloudinary uploads) go through the image optimiser.
 */
export function ProductImage({ src, alt, ...props }: Omit<ImageProps, "src"> & { src: string }) {
  const isSvg = src.toLowerCase().split("?")[0].endsWith(".svg");
  return <Image src={src} alt={alt} unoptimized={isSvg} {...props} />;
}
