# The consumer image.
#
# Two stages so that npm, its cache and the lockfile do not ship to a host that
# runs eleven other domains. The runtime stage carries node, one dependency and
# one file.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` rather than `npm install`: the lockfile is the point. An install that
# is free to resolve a different version is an image that differs from the one
# that was tested, built on a day nobody was watching.
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json consumer.mjs ./

# The base image ships a `node` user. Running as root inside a container on a
# shared host buys nothing and costs the difference between a container escape
# being interesting and being catastrophic.
USER node

EXPOSE 9274

# No shell form. `node` as PID 1 receives SIGTERM directly, which is what makes
# the shutdown handler run and the last buffered batch get sent — under a shell
# wrapper the signal goes to the shell and the buffer dies with the container.
CMD ["node", "consumer.mjs"]
