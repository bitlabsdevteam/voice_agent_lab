FROM node:23-slim AS build
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
COPY tests ./tests
COPY scripts ./scripts
COPY prompts ./prompts
COPY public ./public
COPY docs ./docs
RUN npm run build

FROM node:23-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV VOICE_AGENT_PROVIDER=mock-openai
ENV VOICE_AGENT_SESSION_STORE=file
ENV VOICE_AGENT_DATA_DIR=/data
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY public ./public
COPY prompts ./prompts
COPY scripts ./scripts
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
