# syntax=docker/dockerfile:1

# Pinned to the exact "puppeteer" version in package.json. This image is
# maintained by the Puppeteer team specifically to solve "no browser on the
# server" — it bundles the matching Chrome for Testing build plus every
# shared library that build needs (libnss3, libatk, fonts, etc.), so there's
# nothing to apt-get by hand and no version mismatch between the npm package
# and the browser it drives.
#
# If you bump the "puppeteer" dependency in package.json, bump this tag to
# match: https://github.com/puppeteer/puppeteer/pkgs/container/puppeteer
FROM ghcr.io/puppeteer/puppeteer:25.3.0

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true

# Image already runs as non-root "pptruser" (uid 1000) with this as $HOME.
WORKDIR /home/pptruser/app

COPY --chown=pptruser:pptruser package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=pptruser:pptruser . .

EXPOSE 3000

CMD ["node", "src/index.js"]
