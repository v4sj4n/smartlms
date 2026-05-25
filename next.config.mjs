/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["http://localhost:3000", "https://www.optimolms.com"],
  devIndicators: process.env.NODE_ENV === "development" ? true : false,
}

export default nextConfig
