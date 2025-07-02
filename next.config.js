/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  images: { domains: ["your-s3-bucket.s3.amazonaws.com"] },
  poweredByHeader: false,
};
