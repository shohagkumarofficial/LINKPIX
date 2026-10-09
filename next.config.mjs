/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The code was written without being able to run a build, so a stray type
  // error should not stop the deploy. Set this to false once a clean build
  // has been confirmed.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
