FROM node:22-bookworm

WORKDIR /workerd

ADD ./workerd .

RUN yarn install --frozen-lockfile

EXPOSE 8787