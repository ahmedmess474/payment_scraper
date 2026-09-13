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
    PUPPETEER_SKIP_DOWNLOAD=true \
    # The base image installs Chrome under pptruser's home at build time,
    # regardless of which uid actually runs the container later. Puppeteer's
    # default cache-path lookup is $HOME/.cache/puppeteer, and $HOME follows
    # whichever uid docker-compose's `user:` override resolves to at runtime
    # (e.g. uid 1000 resolves to this image's unrelated "node" user, home
    # /home/node) — so without pinning this explicitly, Puppeteer looks in
    # the wrong home and reports Chrome "not found" even though it's right
    # here. This makes browser discovery independent of the runtime uid.
    PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer

# $HOME for this image's built-in non-root user.
WORKDIR /home/pptruser/app

COPY --chown=pptruser:pptruser package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=pptruser:pptruser . .

# docker-compose runs this container as uid:gid 1000:1000 (see APP_UID/APP_GID
# in docker-compose.yml) to match the *host's* ownership of the bind-mounted
# ./secrets and ./data directories — not this image's built-in "pptruser",
# whose uid varies by image tag and is not 1000 here. Pre-create and chown the
# Chrome profile dir to that same 1000:1000 as root, so a brand-new named
# volume for it seeds with an owner that actually matches who runs the
# container, instead of whichever uid this particular image's pptruser is.
USER root
RUN mkdir -p .puppeteer-profile && chown -R 1000:1000 .puppeteer-profile
USER pptruser

EXPOSE 3000

CMD ["node", "src/index.js"]
